#!/usr/bin/env node
// scripts/prove-rowan-reduction.mjs
//
// STEP 7 · Rowan render reduction · measurement.
//
// This script reads real learning_bundle payloads that Rowan produced for
// past knowledge-extractor jobs (preserved in data/nex-brain/worker_jobs.json)
// and measures the char output of two renderings:
//
//   OLD render  · inlined below · exact copy of the pre-Step-7 renderLearning
//   NEW render  · inlined below · exact copy of the post-Step-7 renderLearning
//
// Both renders operate on the SAME bundle shape, so per-bundle deltas are
// clean apples-to-apples measurements without needing a live LLM call.
//
// Read-only · never posts · never mutates state.
// STOP after reporting.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const JOBS_PATH = join(process.cwd(), "data", "nex-brain", "worker_jobs.json");

// ── OLD renderLearning (pre-Step-7 · verbatim from git-adjacent source) ─
function trim(s, max) { return s.length > max ? s.slice(0, max) + "…" : s; }

function renderLearningOLD(learning) {
  if (!learning || learning.examples.length === 0) {
    return `LEARNING BUNDLE — past decisions by Philip:
  (no relevant prior feedback yet — author from scratch using the other bundles)`;
  }
  const lines = [];
  lines.push(`LEARNING BUNDLE — past decisions by Philip (${learning.examples.length} example${learning.examples.length === 1 ? "" : "s"}):`);
  lines.push(``);
  lines.push(`Synthesis: ${learning.overall_lesson}`);
  lines.push(``);
  lines.push(`Weight these examples heavily. Do NOT repeat patterns Philip corrected.`);
  lines.push(`DO emulate patterns Philip approved.`);
  lines.push(``);
  for (const ex of learning.examples) {
    const date = ex.created_at.slice(0, 10);
    lines.push(`━━━ ${ex.kind.toUpperCase()} (severity: ${ex.severity}, ${date}) ━━━`);
    if (ex.domain) lines.push(`Domain: ${ex.domain}`);
    if (ex.topic_tags && ex.topic_tags.length > 0) {
      lines.push(`Topics: ${ex.topic_tags.slice(0, 6).join(", ")}`);
    }
    if (ex.question) lines.push(`Question: ${trim(ex.question, 300)}`);
    if (ex.nex_answer) lines.push(`NEX said: ${trim(ex.nex_answer, 300)}`);
    if (ex.correction) lines.push(`Philip corrected to: ${trim(ex.correction, 300)}`);
    if (ex.lesson) lines.push(`Lesson: ${trim(ex.lesson, 240)}`);
    lines.push(``);
  }
  return lines.join("\n");
}

// ── NEW renderLearning (post-Step-7 · verbatim from current source) ────
function renderLearningNEW(learning) {
  if (!learning || learning.examples.length === 0) {
    return `LEARNING BUNDLE — past decisions by Philip:
  (no relevant prior feedback yet — author from scratch using the other bundles)`;
  }
  const lines = [];
  lines.push(`LEARNING BUNDLE — past decisions by Philip (${learning.examples.length} example${learning.examples.length === 1 ? "" : "s"}):`);
  lines.push(``);
  lines.push(`Synthesis: ${learning.overall_lesson}`);
  lines.push(``);
  lines.push(`Weight these examples heavily. Do NOT repeat patterns Philip corrected.`);
  lines.push(`DO emulate patterns Philip approved.`);
  lines.push(``);
  for (const ex of learning.examples) {
    lines.push(`━━━ ${ex.kind.toUpperCase()} ━━━`);
    if (ex.question) lines.push(`Question: ${trim(ex.question, 200)}`);
    if (ex.nex_answer) lines.push(`NEX said: ${trim(ex.nex_answer, 200)}`);
    if (ex.correction) lines.push(`Philip corrected to: ${trim(ex.correction, 300)}`);
    if (ex.lesson) lines.push(`Lesson: ${trim(ex.lesson, 240)}`);
    lines.push(``);
  }
  return lines.join("\n");
}

// ── Load real preserved bundles ────────────────────────────────────────
const jobs = JSON.parse(readFileSync(JOBS_PATH, "utf8"));
const extractorJobs = jobs.filter((j) =>
  j.worker_type === "knowledge-extractor" &&
  j.input_payload &&
  j.input_payload.learning_bundle &&
  Array.isArray(j.input_payload.learning_bundle.examples)
);

console.log("");
console.log("=".repeat(78));
console.log("STEP 7 · ROWAN REDUCTION · MEASUREMENT AGAINST REAL PRESERVED BUNDLES");
console.log("=".repeat(78));
console.log(`extractor jobs with learning bundles preserved: ${extractorJobs.length}`);
console.log(`worker_jobs source:                            ${JOBS_PATH}`);
console.log("");

let sumOld = 0;
let sumNew = 0;

for (const j of extractorJobs) {
  const b = j.input_payload.learning_bundle;
  const oldOut = renderLearningOLD(b);
  const newOut = renderLearningNEW(b);
  const oldC = oldOut.length;
  const newC = newOut.length;
  const delta = newC - oldC;
  const pct = oldC === 0 ? "n/a" : `${((delta / oldC) * 100).toFixed(1)}%`;
  sumOld += oldC;
  sumNew += newC;
  console.log(`inbox: ${j.input_ref}  status=${j.status}`);
  console.log(`  examples:      ${b.examples.length}`);
  console.log(`  overall:       ${b.overall_lesson}`);
  console.log(`  OLD render:    ${oldC} chars`);
  console.log(`  NEW render:    ${newC} chars`);
  console.log(`  delta:         ${delta >= 0 ? "+" : ""}${delta}  (${pct})`);
  console.log("");
}

console.log("-".repeat(78));
const totalDelta = sumNew - sumOld;
const totalPct = sumOld === 0 ? "n/a" : `${((totalDelta / sumOld) * 100).toFixed(1)}%`;
console.log(`AGGREGATE across ${extractorJobs.length} preserved bundles`);
console.log(`  OLD total:     ${sumOld} chars`);
console.log(`  NEW total:     ${sumNew} chars`);
console.log(`  total delta:   ${totalDelta >= 0 ? "+" : ""}${totalDelta}  (${totalPct})`);
console.log("");

// ── Projection to Step-6 baseline (8-example bundle) ──────────────────
// Step 6 measured learning_chars = 1,904 with 8 examples.
// The preserved bundles here mostly have 1 example each · not directly
// comparable in absolute chars. We project by computing the per-example
// average savings from the preserved sample.
const totalExamples = extractorJobs.reduce((s, j) => s + j.input_payload.learning_bundle.examples.length, 0);
if (totalExamples > 0) {
  const perExampleSavings = totalDelta / totalExamples;
  console.log(`Per-example savings estimate:  ${perExampleSavings.toFixed(1)} chars`);
  console.log(`  (averaged over ${totalExamples} real examples across ${extractorJobs.length} bundles)`);
  console.log("");
  const STEP6_LEARNING = 1904;
  const STEP6_EXAMPLES = 8;
  // Wrapper is fixed · per-example savings scale linearly.
  const projectedStep6 = STEP6_LEARNING + STEP6_EXAMPLES * perExampleSavings;
  const projectedSaving = STEP6_LEARNING - projectedStep6;
  const projectedPct = ((projectedSaving / STEP6_LEARNING) * 100).toFixed(1);
  console.log(`Projection onto Step 6 baseline (8-example bundle, learning_chars=1904):`);
  console.log(`  projected NEW learning_chars: ${projectedStep6.toFixed(0)}`);
  console.log(`  projected savings:            ${projectedSaving.toFixed(0)} chars (${projectedPct}% of Rowan)`);
  console.log(`  projected total-input impact: ~${((projectedSaving / 27465) * 100).toFixed(2)}% of Step 6 total_input_chars`);
}
console.log("");
console.log("Note: this is a static replay measurement · not a live extractor invocation.");
console.log("The actual Step 6 bundle (nx_msngtbff_548e39bc) was cleaned up post-completion.");
console.log("A live re-probe would show the exact number · runtime verification remains available.");
