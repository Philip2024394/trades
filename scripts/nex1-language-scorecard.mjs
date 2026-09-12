#!/usr/bin/env node
// scripts/nex1-language-scorecard.mjs
//
// NEX1 · LANGUAGE BRAIN · SCORECARD DASHBOARD.
//
// Produces the founder-specified dashboard:
//   · per-language section (english / bahasa_indonesia / code_switch / programming)
//   · per-dimension score (18 dimensions from language-scorecard.ts)
//   · level band (basic_recognition → fluent)
//   · fluent claim requires: percent === 100 AND benchmark_complete === true
//   · regression pool enforced · any regression fails the whole run
//   · hidden cases included by default in evidence · omitted from stdout list
//
// Examiner separation: this script READS the language brain and READS
// the challenge/regression pools · it never writes to either.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const REPO_ROOT = process.cwd();
if (!process.env.NEX1_SCORECARD_INNER) {
  const envArgs = existsSync(resolve(REPO_ROOT, ".env.local")) ? ["--env-file=.env.local"] : [];
  const r = spawnSync(
    "npx",
    ["tsx", ...envArgs, resolve(REPO_ROOT, "scripts/nex1-language-scorecard.mjs")],
    { stdio: "inherit", cwd: REPO_ROOT, shell: true, env: { ...process.env, NEX1_SCORECARD_INNER: "1" } },
  );
  process.exit(r.status ?? 1);
}

const bridgePath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-language-brain/intent-bridge-v0.ts")).href;
const rubricPath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-language-brain/capability-rubric.ts")).href;
const scorecardPath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-language-brain/language-scorecard.ts")).href;
const ambPath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-language-brain/ambiguity-sub-metrics.ts")).href;
const regressionPath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-language-brain/regression-pool.ts")).href;

const bridge = await import(bridgePath);
const rubric = await import(rubricPath);
const scorecard = await import(scorecardPath);
const ambiguity = await import(ambPath);
const regressionMod = await import(regressionPath);

// ── Load registry ──
const registry = JSON.parse(readFileSync(resolve(REPO_ROOT, "data/nex1-language-brain/pattern-registry-v0.json"), "utf8"));

// ── Load challenge sets · every JSON under challenge-set-v0/ ──
const CHALLENGE_DIR = resolve(REPO_ROOT, "data/nex1-language-brain/challenge-set-v0");
const challengeFiles = readdirSync(CHALLENGE_DIR).filter((f) => f.endsWith(".json"));
const publicCases = [];
const hiddenCases = [];
for (const f of challengeFiles) {
  const doc = JSON.parse(readFileSync(join(CHALLENGE_DIR, f), "utf8"));
  const cases = doc.cases ?? doc.entries ?? [];
  for (const c of cases) {
    if (c.hidden === true || (c.tags && c.tags.includes("hidden"))) hiddenCases.push(c);
    else publicCases.push(c);
  }
}

// ── Load regression pool ──
let regressionIndex = null;
const regressionPath2 = resolve(REPO_ROOT, "data/nex1-language-brain/regression/regression-index.json");
if (existsSync(regressionPath2)) {
  regressionIndex = JSON.parse(readFileSync(regressionPath2, "utf8"));
}
const regressionCases = (regressionIndex?.entries ?? []).map(regressionMod.regressionToRubricCase);

console.log("NEX1 · LANGUAGE BRAIN · SCORECARD DASHBOARD");
console.log("─".repeat(60));
console.log(`Registry version:            ${registry.version}`);
console.log(`Public challenge cases:      ${publicCases.length}`);
console.log(`Hidden challenge cases:      ${hiddenCases.length}`);
console.log(`Regression pool cases:       ${regressionCases.length}`);
console.log("");

const runOne = (tc) => {
  const observed = bridge.processLanguageInput(
    { utterance: tc.utterance, language_hint: tc.language_hint, prior_context: tc.prior_context },
    { registry },
  );
  const cr = rubric.scoreCase(tc, observed);
  // Compute ambiguity sub-metrics for this case
  const expectedIsRefusal = tc.expected.kind === "refuse";
  const ambSub = ambiguity.scoreAmbiguitySubMetrics(tc.tags ?? [], observed, expectedIsRefusal);
  return { ...cr, tags: tc.tags ?? [], ambiguity_sub_metrics: ambSub };
};

// ── Score all cases · public + hidden + regression ──
// Tag each scored case with its provenance so we can compute the coverage
// breakdown per language track (public / hidden / adversarial / regression).
const scoredRegression = regressionCases.map((tc) => ({ ...runOne(tc), provenance: "regression" }));
const scoredPublic     = publicCases.map((tc)     => ({ ...runOne(tc), provenance: "public"     }));
const scoredHidden     = hiddenCases.map((tc)     => ({ ...runOne(tc), provenance: "hidden"     }));
const allScored = [
  ...scoredRegression,  // regression FIRST · so we can halt if any fail
  ...scoredPublic,
  ...scoredHidden,
];

// ── Regression gate ──
const regressionCheck = regressionMod.regressionPoolClean(allScored);
if (!regressionCheck.clean) {
  console.log(`❌  REGRESSION DETECTED · ${regressionCheck.failed_ids.length} case(s) regressed from historical PASS:`);
  for (const id of regressionCheck.failed_ids.slice(0, 10)) console.log(`     - ${id}`);
  console.log("");
}

// ── Aggregate per-language, per-dimension ──
const languages = ["english", "bahasa_indonesia", "code_switch", "programming"];
const sections = [];
for (const lang of languages) {
  const casesForLang = allScored.filter((cr) => {
    const l = scorecard.tagsToLanguage(cr.tags);
    return l === lang;
  });

  // Per-dimension buckets
  const dimBuckets = {};
  for (const cr of casesForLang) {
    const dims = scorecard.tagsToDimensions(cr.tags);
    for (const d of dims) {
      if (!dimBuckets[d]) dimBuckets[d] = { total: 0, max: 0, case_count: 0 };
      dimBuckets[d].total += cr.case_score;
      dimBuckets[d].max += 5;
      dimBuckets[d].case_count += 1;
    }
  }

  // Ambiguity dimension is a COMPOSITE (per founder correction)
  const ambCases = casesForLang.map((cr) => cr.ambiguity_sub_metrics);
  const ambAgg = ambiguity.aggregateAmbiguity(ambCases);
  if (ambAgg.applicable_case_count > 0) {
    dimBuckets["ambiguity"] = {
      total: Math.round(ambAgg.composite_percent),
      max: 100,
      case_count: ambAgg.applicable_case_count,
    };
  }

  const dimensions = Object.entries(dimBuckets).map(([dimension, b]) => ({
    dimension,
    points: b.total,
    max_points: b.max,
    percent: b.max === 0 ? 0 : (b.total / b.max) * 100,
    case_count: b.case_count,
  }));

  // Overall aggregate for this language
  const overallPoints = casesForLang.reduce((acc, cr) => acc + cr.case_score, 0);
  const overallMax = casesForLang.length * 5;
  const overallPercent = overallMax === 0 ? 0 : (overallPoints / overallMax) * 100;

  // Per-language benchmark completeness · every input to this test must be
  // measured FOR THIS LANGUAGE (not globally). Global regression = 47 does
  // not entitle code_switch (regression=0) to fluent status.
  const hiddenForLang = casesForLang.some((cr) => cr.provenance === "hidden");
  const advForLang = casesForLang.some((cr) => cr.tags.includes("adversarial"));
  const regForLang = casesForLang.some((cr) => cr.provenance === "regression");
  const bcomplete = scorecard.benchmarkComplete(hiddenForLang, advForLang, regForLang, dimensions);

  const weak = dimensions.filter((d) => d.percent < 60 && d.case_count > 0).map((d) => d.dimension);

  // Coverage indicator (founder correction 2026-09-12).
  // adversarial can overlap with public/hidden · so it is counted independently.
  const coverage = {
    public: casesForLang.filter((cr) => cr.provenance === "public" && !cr.tags.includes("adversarial")).length,
    hidden: casesForLang.filter((cr) => cr.provenance === "hidden").length,
    adversarial: casesForLang.filter((cr) => cr.tags.includes("adversarial")).length,
    regression: casesForLang.filter((cr) => cr.provenance === "regression").length,
    total: casesForLang.length,
  };
  const benchmark_maturity = scorecard.classifyMaturity(coverage);
  const level = scorecard.classifyLevel(overallPercent, bcomplete, benchmark_maturity);

  sections.push({
    language: lang,
    overall_points: overallPoints,
    overall_max: overallMax,
    overall_percent: overallPercent,
    level,
    benchmark_complete: bcomplete,
    benchmark_maturity,
    coverage,
    dimensions,
    case_count: casesForLang.length,
    weak_dimensions: weak,
  });
}

// ── Emit dashboard ──
const flagIcon = { english: "🇬🇧", bahasa_indonesia: "🇮🇩", code_switch: "🔄", programming: "💻" };
for (const s of sections) {
  console.log(`${flagIcon[s.language] ?? "· "} ${s.language.toUpperCase().padEnd(20)}    intent-bridge score: ${s.overall_percent.toFixed(1)}%   level: ${s.level}   n=${s.case_count}`);
  // Coverage indicator · placed BEFORE dimensions so it is impossible to
  // read the score without seeing the maturity floor it stands on.
  console.log(`     coverage · public=${s.coverage.public} · hidden=${s.coverage.hidden} · adversarial=${s.coverage.adversarial} · regression=${s.coverage.regression} · total=${s.coverage.total}`);
  console.log(`     benchmark maturity: ${s.benchmark_maturity}`);
  if (s.dimensions.length === 0) {
    console.log(`     · no cases yet (dimension surface not measured)`);
  } else {
    const rows = s.dimensions.slice().sort((a, b) => b.percent - a.percent);
    for (const d of rows) {
      const bar = "█".repeat(Math.round(d.percent / 5)).padEnd(20, "░");
      console.log(`     ${d.dimension.padEnd(22)} ${d.percent.toFixed(1).padStart(5)}%  ${bar}  n=${d.case_count}`);
    }
  }
  if (s.weak_dimensions.length > 0) console.log(`     ⚠  weak: ${s.weak_dimensions.join(", ")}`);
  console.log(`     benchmark_complete=${s.benchmark_complete} · fluent=${s.level === "fluent"}`);
  console.log("");
}

// ── Persist evidence ──
const dir = resolve(REPO_ROOT, "data/nex1-language-brain/lab-evidence");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidencePath = resolve(dir, `scorecard-${stamp}.json`);
writeFileSync(evidencePath, JSON.stringify({
  at: new Date().toISOString(),
  benchmark_version: registry.version,
  attribution: {
    teaching_infrastructure: "src/lib/nex-language-brain/* · taught_by=master_ai_engineer",
    challenge_authorship: "data/nex1-language-brain/challenge-set-v0/* · authored_by=examiner",
    novel_execution: "attempted_by=nex1 · teaching_assistance=true",
    external_llm_used: false,
    independent_authorship_percent: 0,
  },
  regression_pool: {
    entries: regressionCases.length,
    clean: regressionCheck.clean,
    failed_ids: regressionCheck.failed_ids,
  },
  public_cases: publicCases.length,
  hidden_cases: hiddenCases.length,
  sections,
  taught_by: "master_ai_engineer",
}, null, 2), "utf8");
console.log(`Evidence: ${evidencePath}`);
console.log("");
if (!regressionCheck.clean) {
  console.log("RESULT · REGRESSION · run flagged as failing regardless of new-case scores.");
  process.exit(1);
}
console.log(`RESULT · scorecard clean · regression pool intact (${regressionCases.length} cases) · hidden included=${hiddenCases.length > 0}`);
