#!/usr/bin/env node
// scripts/nex1-language-lab-v0.mjs
//
// NEX1 · LANGUAGE LAB v0 · runner + scorer.
//
// Reads:
//   · data/nex1-language-brain/pattern-registry-v0.json (deterministic patterns)
//   · data/nex1-language-brain/challenge-set-v0/cases.json (measurable rubric cases)
// Runs each case through the intent bridge, scores it against the rubric,
// aggregates the fluency percent, writes evidence.
//
// This never claims fluency. It reports a number.
//
// Isolation: touches ONLY paths under
//   · src/lib/nex-language-brain/
//   · data/nex1-language-brain/
//   · scripts/nex1-language-*.mjs
// Engineering brain paths are not touched by this script.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REPO_ROOT = process.cwd();
if (!process.env.NEX1_LANG_INNER) {
  const envArgs = existsSync(resolve(REPO_ROOT, ".env.local")) ? ["--env-file=.env.local"] : [];
  const r = spawnSync(
    "npx",
    ["tsx", ...envArgs, resolve(REPO_ROOT, "scripts/nex1-language-lab-v0.mjs")],
    { stdio: "inherit", cwd: REPO_ROOT, shell: true, env: { ...process.env, NEX1_LANG_INNER: "1" } },
  );
  process.exit(r.status ?? 1);
}

const bridgePath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-language-brain/intent-bridge-v0.ts")).href;
const rubricPath = pathToFileURL(resolve(REPO_ROOT, "src/lib/nex-language-brain/capability-rubric.ts")).href;
const bridge = await import(bridgePath);
const rubric = await import(rubricPath);

const registry = JSON.parse(readFileSync(resolve(REPO_ROOT, "data/nex1-language-brain/pattern-registry-v0.json"), "utf8"));
const challengeSet = JSON.parse(readFileSync(resolve(REPO_ROOT, "data/nex1-language-brain/challenge-set-v0/cases.json"), "utf8"));

console.log("NEX1 · LANGUAGE LAB v0 · deterministic Path A · scoring initial challenge set");
console.log("─".repeat(78));
console.log(`Registry version: ${registry.version}`);
console.log(`Registry patterns: ${registry.intent_patterns.length} intents · ${registry.safety_patterns.length} safety`);
console.log(`Challenge cases: ${challengeSet.cases.length}`);
console.log("");

const caseResults = [];
const perTag = {};

for (const tc of challengeSet.cases) {
  const observed = bridge.processLanguageInput(
    { utterance: tc.utterance, language_hint: tc.language_hint, prior_context: tc.prior_context },
    { registry },
  );
  const cr = rubric.scoreCase(tc, observed);
  caseResults.push({ ...cr, tags: tc.tags });

  for (const t of tc.tags) {
    if (!perTag[t]) perTag[t] = { count: 0, total: 0, max: 0 };
    perTag[t].count += 1;
    perTag[t].total += cr.case_score;
    perTag[t].max += 5;
  }

  const mark = cr.case_score === 5 ? "✅" : cr.case_score >= 3 ? "▲" : "❌";
  const notesTail = cr.notes.length > 0 ? ` · ${cr.notes[0].slice(0, 80)}` : "";
  console.log(`  ${mark} [${cr.case_score}/5] ${tc.id.padEnd(24)} · "${tc.utterance.slice(0, 40)}"${notesTail}`);
}

for (const t of Object.keys(perTag)) {
  perTag[t].percent = perTag[t].max === 0 ? 0 : (perTag[t].total / perTag[t].max) * 100;
}

const suite = rubric.scoreSuite(caseResults);
const suiteWithTags = { ...suite, per_tag: perTag };

console.log("\n══════════ NEX1 LANGUAGE LAB v0 · FLUENCY SCORE ══════════");
console.log(`  cases:                     ${suite.total_cases}`);
console.log(`  total score:               ${suite.total_score} / ${suite.max_score}`);
console.log(`  fluency %:                 ${suite.fluency_percent.toFixed(1)}%`);
console.log("\n  per-dimension:");
for (const [k, v] of Object.entries(suite.per_dimension)) {
  console.log(`    ${k.padEnd(30)} ${v.total}/${v.max}  (${v.percent.toFixed(1)}%)`);
}
console.log("\n  per-tag (sorted by percent, then count):");
const tagRows = Object.entries(perTag)
  .map(([k, v]) => ({ tag: k, ...v }))
  .sort((a, b) => a.percent - b.percent || b.count - a.count);
for (const row of tagRows) {
  console.log(`    ${row.tag.padEnd(20)} ${row.total}/${row.max}  (${row.percent.toFixed(1)}%)  n=${row.count}`);
}

const dir = resolve(REPO_ROOT, "data/nex1-language-brain/lab-evidence");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidencePath = resolve(dir, `score-${stamp}.json`);
writeFileSync(evidencePath, JSON.stringify({
  at: new Date().toISOString(),
  attribution: {
    teaching_infrastructure: "src/lib/nex-language-brain/* · taught_by=master_ai_engineer",
    challenge_authorship: "data/nex1-language-brain/challenge-set-v0/* · authored_by=examiner",
    novel_execution: "attempted_by=nex1 · teaching_assistance=true",
    external_llm_used: false,
  },
  registry_version: registry.version,
  suite: suiteWithTags,
}, null, 2), "utf8");

console.log(`\nEvidence: ${evidencePath}`);
console.log("═".repeat(58));
