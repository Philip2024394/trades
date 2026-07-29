#!/usr/bin/env node
// validate-brain.mjs
//
// NEX Validation Runner (Philip 2026-07-28 · post-Governance-v1.0)
// ─────────────────────────────────────────────────────────────────
// Operational utility · NOT a platform feature. Feeds the adversarial
// corpus to a brain's ask endpoint, saves every response, and tracks
// per-question regressions against prior runs.
//
// Purpose: turn Validation v1.0 Phase 2 into a repeatable measurement.
// Every future version of the Staircase Brain gets compared against
// prior runs · answer_kind flips and confidence swings are flagged so
// the author can see exactly which questions improved or regressed.
//
// Usage:
//   node scripts/validate-brain.mjs \
//     --brain staircase \
//     --version 0.2.0 \
//     --corpus docs/brains/staircase-adversarial-corpus.md \
//     --base-url http://localhost:3008 \
//     [--limit 50]           # optional · cap number of questions
//     [--dry-run]            # optional · parse corpus, don't hit endpoint
//     [--admin-secret ...]   # optional · if endpoint requires auth
//
// Output structure:
//   validation/
//     staircase-v0.2.0/
//       run-001-2026-07-28T14-32-00Z.json
//       run-001.csv
//       run-001.md
//       regressions-vs-v0.1.0.md    (if a prior version was ever run)
//
// Governance:
//   · Does NOT author trade knowledge · calls the ask endpoint and
//     records its responses.
//   · Does NOT judge correctness · answer_kind + confidence + evidence
//     are objective envelope fields. Adds an empty `expert_score: null`
//     column in the CSV for the human expert to fill in later.
//   · Freeze-compatible · uses only existing primitives.
//
// Zero dependencies · Node built-ins only.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

// ---------- CLI parsing ----------

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

const args = parseArgs(process.argv);
const BRAIN_SLUG   = args.brain    ?? "staircase";
const VERSION      = args.version  ?? "unknown";
const CORPUS_PATH  = args.corpus   ?? "docs/brains/staircase-adversarial-corpus.md";
const BASE_URL     = args["base-url"] ?? process.env.NEX_BASE_URL ?? "http://localhost:3008";
const LIMIT        = args.limit    ? parseInt(args.limit, 10) : null;
const DRY_RUN      = args["dry-run"] === true;
const ADMIN_SECRET = args["admin-secret"] ?? process.env.NEX_ADMIN_SECRET ?? null;
const ACTOR_ID     = args["actor-id"]     ?? "validation-runner@localhost";

if (args.help || args.h) {
  console.log(readFileSync(new URL(import.meta.url), "utf-8").split("\n").filter(l => l.startsWith("//")).map(l => l.slice(3)).join("\n"));
  process.exit(0);
}

// ---------- Corpus parser ----------

/**
 * Parse the adversarial corpus markdown. Returns an array of
 * { number, category, question } objects. Assumes questions are
 * numbered lines under `##`/`###` category headings.
 */
function parseCorpus(mdPath) {
  const md = readFileSync(mdPath, "utf-8");
  const lines = md.split("\n");
  const questions = [];
  let currentLevel = "unknown";
  let currentCategory = "unknown";
  for (const raw of lines) {
    const line = raw.trim();
    // Top-level heading — `## LEVEL 1 · FOUNDATIONS` · `## Legacy Seed` · `## Growth log` etc.
    if (/^##\s+(?!#)/.test(line)) {
      currentLevel = line.replace(/^#+\s*/, "").trim();
      currentCategory = currentLevel;
      continue;
    }
    // Sub-category heading — `### L1.A · Terminology (30)` etc.
    if (/^###\s+/.test(line)) {
      currentCategory = line.replace(/^#+\s*/, "").trim();
      continue;
    }
    // Numbered question — `1. How would you...`
    const m = /^(\d+)\.\s+(.+)$/.exec(line);
    if (m) {
      const num = parseInt(m[1], 10);
      const question = m[2].trim();
      // Skip lines that look like table rows or navigation
      if (question.length < 5) continue;
      // Skip preamble numbered lists (before we've seen any ## heading)
      // and skip the Growth log table's row numbers (Growth log has no
      // numbered lines but this is a belt-and-braces filter).
      if (currentLevel === "unknown") continue;
      if (/^growth log/i.test(currentLevel)) continue;
      questions.push({
        number: num,
        level: currentLevel,
        category: currentCategory,
        question,
      });
    }
  }
  return questions;
}

// ---------- Ask endpoint call ----------

async function askBrain(question) {
  const start = performance.now();
  try {
    const res = await fetch(`${BASE_URL}/api/nex/brains/${BRAIN_SLUG}/ask`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(ADMIN_SECRET ? { "x-nex-admin-secret": ADMIN_SECRET, "x-nex-actor-id": ACTOR_ID } : {}),
      },
      body: JSON.stringify({ query: question }),
    });
    const durationMs = Math.round(performance.now() - start);
    const bodyText = await res.text();
    let body = null;
    try { body = JSON.parse(bodyText); } catch { body = { parse_error: bodyText.slice(0, 400) }; }
    return { status: res.status, ok: res.ok, body, duration_ms: durationMs };
  } catch (err) {
    return { status: 0, ok: false, body: { error: err instanceof Error ? err.message : String(err) }, duration_ms: Math.round(performance.now() - start) };
  }
}

// ---------- Output helpers ----------

const OUT_ROOT = resolve(process.cwd(), "validation", `${BRAIN_SLUG}-v${VERSION}`);

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function nextRunNumber(outDir) {
  if (!existsSync(outDir)) return 1;
  const existing = readdirSync(outDir).filter(f => /^run-\d{3}/.test(f)).map(f => parseInt(f.slice(4, 7), 10));
  return existing.length === 0 ? 1 : Math.max(...existing) + 1;
}

function toIsoStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + "Z";
}

// ---------- Regression comparison ----------

function findPriorRuns() {
  const validationRoot = resolve(process.cwd(), "validation");
  if (!existsSync(validationRoot)) return [];
  const dirs = readdirSync(validationRoot).filter(d => d.startsWith(`${BRAIN_SLUG}-v`) && d !== `${BRAIN_SLUG}-v${VERSION}`);
  const runs = [];
  for (const d of dirs) {
    const version = d.slice(BRAIN_SLUG.length + 2);
    const runsDir = join(validationRoot, d);
    const jsonFiles = readdirSync(runsDir).filter(f => f.endsWith(".json") && f.startsWith("run-"));
    if (jsonFiles.length === 0) continue;
    const latest = jsonFiles.sort().at(-1);
    runs.push({ version, path: join(runsDir, latest) });
  }
  return runs.sort((a, b) => a.version.localeCompare(b.version));
}

function compareRuns(current, prior) {
  const priorByKey = new Map(prior.results.map(r => [`${r.number}::${r.question}`, r]));
  const regressions = [];
  const improvements = [];
  const unchanged = [];
  const new_questions = [];
  for (const c of current.results) {
    const key = `${c.number}::${c.question}`;
    const p = priorByKey.get(key);
    if (!p) { new_questions.push(c); continue; }
    const priorKind = p.envelope?.answer_kind ?? "unknown";
    const currKind = c.envelope?.answer_kind ?? "unknown";
    const priorConf = p.envelope?.confidence ?? 0;
    const currConf = c.envelope?.confidence ?? 0;
    // Classification of change:
    //   REGRESSION: verified/derived → unknown
    //   IMPROVEMENT: unknown → verified/derived
    //   CONFIDENCE_DROP: same kind but confidence dropped >0.15
    //   CONFIDENCE_RISE: same kind but confidence rose >0.15
    //   UNCHANGED: otherwise
    const priorAnswered = priorKind === "verified" || priorKind === "derived";
    const currAnswered = currKind === "verified" || currKind === "derived";
    if (priorAnswered && !currAnswered) {
      regressions.push({ ...c, prior_kind: priorKind, prior_confidence: priorConf, current_kind: currKind, current_confidence: currConf, change: "answered→unanswered" });
    } else if (!priorAnswered && currAnswered) {
      improvements.push({ ...c, prior_kind: priorKind, prior_confidence: priorConf, current_kind: currKind, current_confidence: currConf, change: "unanswered→answered" });
    } else if (priorKind === currKind && Math.abs(priorConf - currConf) > 0.15) {
      if (currConf < priorConf) regressions.push({ ...c, prior_kind: priorKind, prior_confidence: priorConf, current_kind: currKind, current_confidence: currConf, change: "confidence_drop" });
      else improvements.push({ ...c, prior_kind: priorKind, prior_confidence: priorConf, current_kind: currKind, current_confidence: currConf, change: "confidence_rise" });
    } else {
      unchanged.push(c);
    }
  }
  return { regressions, improvements, unchanged, new_questions };
}

// ---------- Aggregate metrics ----------

function summarise(results) {
  const total = results.length;
  const byKind = { verified: 0, derived: 0, unknown: 0, out_of_scope: 0, error: 0 };
  let confSum = 0, confCount = 0;
  let durationSum = 0;
  let evidenceEntries = 0;
  let httpErrors = 0;
  for (const r of results) {
    if (!r.ok) { httpErrors++; byKind.error++; continue; }
    const kind = r.envelope?.answer_kind ?? "unknown";
    byKind[kind] = (byKind[kind] ?? 0) + 1;
    if (typeof r.envelope?.confidence === "number") { confSum += r.envelope.confidence; confCount++; }
    if (Array.isArray(r.envelope?.evidence)) evidenceEntries += r.envelope.evidence.length;
    durationSum += r.duration_ms ?? 0;
  }
  return {
    total,
    by_kind: byKind,
    avg_confidence: confCount ? +(confSum / confCount).toFixed(3) : null,
    avg_duration_ms: total ? Math.round(durationSum / total) : null,
    avg_evidence_per_answer: total ? +(evidenceEntries / total).toFixed(2) : null,
    http_errors: httpErrors,
    verified_pct: total ? Math.round((byKind.verified / total) * 100) : 0,
    unknown_pct: total ? Math.round((byKind.unknown / total) * 100) : 0,
  };
}

// ---------- Output writers ----------

function writeJson(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2), "utf-8");
}

function writeCsv(path, results) {
  const headers = ["number", "level", "category", "question", "answer_kind", "confidence", "duration_ms", "evidence_count", "http_status", "expert_score", "expert_notes"];
  const rows = [headers.join(",")];
  for (const r of results) {
    const kind = r.envelope?.answer_kind ?? "error";
    const conf = r.envelope?.confidence ?? "";
    const ev = Array.isArray(r.envelope?.evidence) ? r.envelope.evidence.length : "";
    const row = [
      r.number,
      csvEscape(r.level),
      csvEscape(r.category),
      csvEscape(r.question),
      kind,
      conf,
      r.duration_ms,
      ev,
      r.status,
      "",  // expert_score placeholder
      "",  // expert_notes placeholder
    ];
    rows.push(row.join(","));
  }
  writeFileSync(path, rows.join("\n"), "utf-8");
}

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeSummaryMd(path, run, summary, regressionReport) {
  const lines = [];
  lines.push(`# Validation Run · ${run.brain} v${run.version} · run ${String(run.run_number).padStart(3, "0")}`);
  lines.push("");
  lines.push(`- **Run at:** ${run.started_at}`);
  lines.push(`- **Endpoint:** ${run.base_url}/api/nex/brains/${run.brain}/ask`);
  lines.push(`- **Corpus:** ${run.corpus_path}`);
  lines.push(`- **Total questions:** ${summary.total}`);
  lines.push("");
  lines.push(`## Aggregate metrics`);
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---:|`);
  lines.push(`| verified | ${summary.by_kind.verified} (${summary.verified_pct}%) |`);
  lines.push(`| derived | ${summary.by_kind.derived} |`);
  lines.push(`| unknown | ${summary.by_kind.unknown} (${summary.unknown_pct}%) |`);
  lines.push(`| out_of_scope | ${summary.by_kind.out_of_scope} |`);
  lines.push(`| http_errors | ${summary.http_errors} |`);
  lines.push(`| avg confidence | ${summary.avg_confidence ?? "—"} |`);
  lines.push(`| avg response time | ${summary.avg_duration_ms ?? "—"} ms |`);
  lines.push(`| avg evidence per answer | ${summary.avg_evidence_per_answer ?? "—"} |`);
  lines.push("");
  if (regressionReport) {
    lines.push(`## Regression comparison vs v${regressionReport.prior_version}`);
    lines.push("");
    lines.push(`- **Regressions (was answered → now unanswered · or big confidence drop):** ${regressionReport.regressions.length}`);
    lines.push(`- **Improvements (was unanswered → now answered · or big confidence rise):** ${regressionReport.improvements.length}`);
    lines.push(`- **Unchanged:** ${regressionReport.unchanged.length}`);
    lines.push(`- **New questions in this run:** ${regressionReport.new_questions.length}`);
    lines.push("");
    if (regressionReport.regressions.length > 0) {
      lines.push(`### ⚠ Regressions`);
      lines.push("");
      for (const r of regressionReport.regressions.slice(0, 20)) {
        lines.push(`- **Q${r.number}** · ${r.change} · was \`${r.prior_kind}@${r.prior_confidence}\` → now \`${r.current_kind}@${r.current_confidence}\``);
        lines.push(`  > ${r.question}`);
      }
      if (regressionReport.regressions.length > 20) lines.push(`- … and ${regressionReport.regressions.length - 20} more`);
      lines.push("");
    }
    if (regressionReport.improvements.length > 0) {
      lines.push(`### ✅ Improvements`);
      lines.push("");
      for (const r of regressionReport.improvements.slice(0, 20)) {
        lines.push(`- **Q${r.number}** · ${r.change} · was \`${r.prior_kind}@${r.prior_confidence}\` → now \`${r.current_kind}@${r.current_confidence}\``);
        lines.push(`  > ${r.question}`);
      }
      if (regressionReport.improvements.length > 20) lines.push(`- … and ${regressionReport.improvements.length - 20} more`);
      lines.push("");
    }
  }
  lines.push(`## Expert scoring`);
  lines.push("");
  lines.push(`- Objective metrics above are automatic.`);
  lines.push(`- Subjective correctness (Correct · Partial · Wrong · Should-be-Unknown) must be scored by a certified expert.`);
  lines.push(`- Open the accompanying CSV, fill in the \`expert_score\` and \`expert_notes\` columns, save.`);
  lines.push(`- Once scored, run \`compare-expert-scores\` (future utility) to compute Question Success Rate.`);
  lines.push("");
  lines.push(`## Raw data`);
  lines.push("");
  lines.push(`- \`run-${String(run.run_number).padStart(3, "0")}.json\` — full envelopes for every question`);
  lines.push(`- \`run-${String(run.run_number).padStart(3, "0")}.csv\` — flat table for expert scoring`);
  writeFileSync(path, lines.join("\n"), "utf-8");
}

// ---------- Main ----------

async function main() {
  console.log(`\n═════ NEX Validation Runner ═════`);
  console.log(`Brain: ${BRAIN_SLUG} · Version: ${VERSION} · Base URL: ${BASE_URL}`);
  console.log(`Corpus: ${CORPUS_PATH}`);
  if (LIMIT) console.log(`Limit: ${LIMIT} questions`);
  if (DRY_RUN) console.log(`⚠ DRY RUN · not calling the endpoint`);
  console.log();

  // Parse corpus
  const allQuestions = parseCorpus(resolve(process.cwd(), CORPUS_PATH));
  console.log(`Parsed ${allQuestions.length} questions from corpus`);
  const questions = LIMIT ? allQuestions.slice(0, LIMIT) : allQuestions;
  console.log(`Running ${questions.length} questions\n`);

  if (DRY_RUN) {
    console.log(`Sample:`);
    for (const q of questions.slice(0, 3)) {
      console.log(`  Q${q.number} · [${q.category}] · ${q.question.slice(0, 100)}`);
    }
    return;
  }

  // Execute
  ensureDir(OUT_ROOT);
  const runNumber = nextRunNumber(OUT_ROOT);
  const startedAt = new Date().toISOString();
  const stampFile = toIsoStamp();

  const results = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    process.stdout.write(`  [${i + 1}/${questions.length}] Q${q.number} `);
    const res = await askBrain(q.question);
    const envelope = res.body?.envelope ?? null;
    results.push({
      ...q,
      status: res.status,
      ok: res.ok,
      duration_ms: res.duration_ms,
      envelope,
      raw_body: res.body,
    });
    process.stdout.write(res.ok ? `✓ ${envelope?.answer_kind ?? "?"} · ${res.duration_ms}ms\n` : `✗ HTTP ${res.status}\n`);
  }
  console.log();

  const summary = summarise(results);

  // Regression report
  const priorRuns = findPriorRuns();
  let regressionReport = null;
  if (priorRuns.length > 0) {
    const nearest = priorRuns.at(-1);
    console.log(`Comparing against prior run: ${nearest.path}`);
    const priorRun = JSON.parse(readFileSync(nearest.path, "utf-8"));
    const cmp = compareRuns({ results }, priorRun);
    regressionReport = { prior_version: nearest.version, ...cmp };
  }

  // Write outputs
  const runMeta = {
    brain: BRAIN_SLUG,
    version: VERSION,
    run_number: runNumber,
    started_at: startedAt,
    base_url: BASE_URL,
    corpus_path: CORPUS_PATH,
    question_count: results.length,
  };
  const runFile = join(OUT_ROOT, `run-${String(runNumber).padStart(3, "0")}-${stampFile}.json`);
  const csvFile = join(OUT_ROOT, `run-${String(runNumber).padStart(3, "0")}.csv`);
  const mdFile  = join(OUT_ROOT, `run-${String(runNumber).padStart(3, "0")}.md`);

  writeJson(runFile, { ...runMeta, summary, regression_report: regressionReport, results });
  writeCsv(csvFile, results);
  writeSummaryMd(mdFile, runMeta, summary, regressionReport);

  console.log(`═════ Complete ═════`);
  console.log(`  JSON: ${runFile}`);
  console.log(`  CSV:  ${csvFile}`);
  console.log(`  MD:   ${mdFile}`);
  console.log();
  console.log(`Aggregate: ${summary.verified_pct}% verified · ${summary.unknown_pct}% unknown · avg confidence ${summary.avg_confidence ?? "—"} · avg ${summary.avg_duration_ms ?? "—"}ms`);
  if (regressionReport) {
    console.log(`Regressions: ${regressionReport.regressions.length} · Improvements: ${regressionReport.improvements.length} · Unchanged: ${regressionReport.unchanged.length}`);
  }
  console.log();
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
