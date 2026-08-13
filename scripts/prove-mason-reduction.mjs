#!/usr/bin/env node
// scripts/prove-mason-reduction.mjs
//
// STEP 8 · Mason render reduction · static regression measurement.
//
// Compares the OLD render (300-char summary · 5-edge samples · Cat/Audience
// on separate lines) against the NEW render (220-char summary · 3-edge
// samples · Cat/Audience folded) using REAL preserved ContextBundles from
// data/nex-brain/worker_jobs.json.
//
// Also produces a per-record summary-content regression report showing
// which summaries would actually be truncated at 220 chars and what
// content (verbatim tail) would be dropped, so Truth-Law information-loss
// can be inspected explicitly instead of just measured in bytes.
//
// Read-only · never posts · never mutates state.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const JOBS_PATH = join(process.cwd(), "data", "nex-brain", "worker_jobs.json");

// ── OLD renderContext (verbatim pre-Step-8) ──────────────────────────
function renderContextOLD(ctx) {
  if (!ctx || ctx.records.length === 0) {
    return `CONTEXT (records NEX already knows about):
  (none returned — this may be a new topic for NEX)`;
  }
  const lines = [];
  lines.push(`CONTEXT — records NEX already knows about (${ctx.records.length}):`);
  lines.push("");
  lines.push("You MUST NOT re-author these. Use typed edges to link to them instead.");
  lines.push("");
  for (const r of ctx.records) {
    lines.push(`━━━ ${r.record_id} ━━━`);
    lines.push(`Title:            ${r.title}`);
    lines.push(`Category:         ${r.category}`);
    lines.push(`Primary audience: ${r.primary_audience}`);
    const summary = r.summary.replace(/\s+/g, " ").slice(0, 300);
    lines.push(`Summary:          ${summary}${r.summary.length > 300 ? "…" : ""}`);
    if (r.nex_concepts.length > 0) {
      lines.push(`NEX concepts:     ${r.nex_concepts.slice(0, 8).join(", ")}`);
    }
    if (r.industry_concepts.length > 0) {
      lines.push(`Industry concepts:${r.industry_concepts.slice(0, 8).join(", ")}`);
    }
    if (r.sample_edges.length > 0) {
      lines.push(`Sample edges:     ${r.sample_edges.map((e) => `${e.edge_type}→${e.to}`).join(", ")}`);
    }
    lines.push("");
  }
  if (ctx.gaps.length > 0) {
    lines.push(`GAP KEYWORDS (not covered by any existing record — candidates for new authoring):`);
    lines.push(`  ${ctx.gaps.slice(0, 20).join(", ")}`);
  }
  return lines.join("\n");
}

// ── NEW renderContext (verbatim post-Step-8) ─────────────────────────
function renderContextNEW(ctx) {
  if (!ctx || ctx.records.length === 0) {
    return `CONTEXT (records NEX already knows about):
  (none returned — this may be a new topic for NEX)`;
  }
  const lines = [];
  lines.push(`CONTEXT — records NEX already knows about (${ctx.records.length}):`);
  lines.push("");
  lines.push("You MUST NOT re-author these. Use typed edges to link to them instead.");
  lines.push("");
  for (const r of ctx.records) {
    lines.push(`━━━ ${r.record_id} ━━━`);
    lines.push(`Title:            ${r.title}`);
    lines.push(`Category: ${r.category} · Audience: ${r.primary_audience}`);
    const summary = r.summary.replace(/\s+/g, " ").slice(0, 220);
    lines.push(`Summary:          ${summary}${r.summary.length > 220 ? "…" : ""}`);
    if (r.nex_concepts.length > 0) {
      lines.push(`NEX concepts:     ${r.nex_concepts.slice(0, 8).join(", ")}`);
    }
    if (r.industry_concepts.length > 0) {
      lines.push(`Industry concepts:${r.industry_concepts.slice(0, 8).join(", ")}`);
    }
    if (r.sample_edges.length > 0) {
      lines.push(`Sample edges:     ${r.sample_edges.slice(0, 3).map((e) => `${e.edge_type}→${e.to}`).join(", ")}`);
    }
    lines.push("");
  }
  if (ctx.gaps.length > 0) {
    lines.push(`GAP KEYWORDS (not covered by any existing record — candidates for new authoring):`);
    lines.push(`  ${ctx.gaps.slice(0, 20).join(", ")}`);
  }
  return lines.join("\n");
}

const jobs = JSON.parse(readFileSync(JOBS_PATH, "utf8"));
const bundles = [];
for (const j of jobs) {
  const b = j.input_payload?.context_bundle;
  if (b && Array.isArray(b.records)) bundles.push({ inbox: j.input_ref, worker: j.worker_type, status: j.status, bundle: b });
}

console.log("");
console.log("=".repeat(78));
console.log("STEP 8 · MASON REDUCTION · STATIC REGRESSION MEASUREMENT");
console.log("=".repeat(78));
console.log(`preserved bundles found: ${bundles.length}  (in ${JOBS_PATH})`);
console.log("");

let sumOld = 0;
let sumNew = 0;
let recordsWithLongSummary = 0;
let totalRecords = 0;
const droppedTails = []; // capture the verbatim tail that Step-8 truncates so Truth-Law loss can be inspected

for (const { inbox, worker, status, bundle } of bundles) {
  const oldOut = renderContextOLD(bundle);
  const newOut = renderContextNEW(bundle);
  const oldC = oldOut.length;
  const newC = newOut.length;
  const delta = newC - oldC;
  const pct = oldC === 0 ? "n/a" : `${((delta / oldC) * 100).toFixed(1)}%`;
  sumOld += oldC; sumNew += newC;

  console.log(`inbox: ${inbox}  worker=${worker}  status=${status}`);
  console.log(`  records: ${bundle.records.length}  gaps: ${bundle.gaps?.length ?? 0}`);
  console.log(`  OLD: ${oldC} chars  NEW: ${newC} chars  delta ${delta >= 0 ? "+" : ""}${delta}  (${pct})`);

  for (const r of bundle.records) {
    totalRecords += 1;
    const rawLen = (r.summary ?? "").length;
    // Post-normalisation length (both renderers normalise whitespace before slice).
    const normalised = (r.summary ?? "").replace(/\s+/g, " ");
    const normLen = normalised.length;
    // Character loss AT THE RENDERED LAYER (not the source layer).
    if (normLen > 220) {
      recordsWithLongSummary += 1;
      const oldRendered = normalised.slice(0, 300);
      const newRendered = normalised.slice(0, 220);
      const droppedByStep8 = oldRendered.slice(220);          // tail lost by 220 cap that OLD 300-cap would have kept
      const droppedByBothCaps = normalised.slice(300);       // tail lost by BOTH renderers (already truncated in OLD)
      droppedTails.push({
        record_id: r.record_id,
        title: r.title,
        source_summary_chars: rawLen,
        normalised_chars: normLen,
        old_rendered_chars: oldRendered.length,
        new_rendered_chars: newRendered.length,
        chars_lost_by_step8: droppedByStep8.length,
        chars_already_lost_by_old: droppedByBothCaps.length,
        step8_dropped_tail_verbatim: droppedByStep8,
        both_dropped_tail_verbatim_head: droppedByBothCaps.slice(0, 120),
      });
    }
  }
  console.log("");
}

console.log("-".repeat(78));
const totalDelta = sumNew - sumOld;
const totalPct = sumOld === 0 ? "n/a" : `${((totalDelta / sumOld) * 100).toFixed(1)}%`;
console.log(`AGGREGATE across ${bundles.length} preserved bundles`);
console.log(`  OLD total:   ${sumOld} chars`);
console.log(`  NEW total:   ${sumNew} chars`);
console.log(`  total delta: ${totalDelta >= 0 ? "+" : ""}${totalDelta}  (${totalPct})`);
const totalRenderedRecords = bundles.reduce((s, b) => s + b.bundle.records.length, 0);
if (totalRenderedRecords > 0) {
  console.log(`  per-record avg savings: ${(totalDelta / totalRenderedRecords).toFixed(1)} chars`);
  console.log(`  (across ${totalRenderedRecords} real rendered records)`);
}
console.log("");

// ── Truth-Law regression check on summary content ────────────────────
console.log("-".repeat(78));
console.log("TRUTH-LAW REGRESSION · SUMMARY CONTENT LOSS INSPECTION");
console.log("-".repeat(78));
console.log(`total records rendered:              ${totalRecords}`);
console.log(`records with normalised summary >220: ${recordsWithLongSummary}  (${totalRecords ? ((recordsWithLongSummary/totalRecords)*100).toFixed(0) : 0}%)`);
console.log("");
if (droppedTails.length === 0) {
  console.log("No records in the preserved sample have summaries over 220 chars.");
  console.log("Static loss is zero across the sample. Live probe will provide the");
  console.log("real check against production-shape summaries.");
} else {
  console.log(`Per-record breakdown of tails Step-8 would newly drop (was kept by OLD 300-cap):`);
  console.log("");
  for (const t of droppedTails) {
    console.log(`  ● ${t.record_id}  (${t.title.slice(0, 60)})`);
    console.log(`      source summary chars:        ${t.source_summary_chars}`);
    console.log(`      normalised chars:            ${t.normalised_chars}`);
    console.log(`      OLD rendered chars:          ${t.old_rendered_chars}`);
    console.log(`      NEW rendered chars:          ${t.new_rendered_chars}`);
    console.log(`      chars newly lost by Step 8:  ${t.chars_lost_by_step8}`);
    console.log(`      chars already lost by OLD:   ${t.chars_already_lost_by_old}`);
    console.log(`      Step 8 dropped tail:`);
    console.log(`        "${t.step8_dropped_tail_verbatim.replace(/\n/g, " ⏎ ")}"`);
    if (t.chars_already_lost_by_old > 0) {
      console.log(`      OLD had also dropped further tail (head 120):`);
      console.log(`        "${t.both_dropped_tail_verbatim_head.replace(/\n/g, " ⏎ ")}${t.chars_already_lost_by_old > 120 ? "…" : ""}"`);
    }
    console.log("");
  }
}

// ── Structural invariants (all fields Avery still needs) ─────────────
console.log("-".repeat(78));
console.log("STRUCTURAL INVARIANTS");
console.log("-".repeat(78));

const checks = [];
const need = (label, pass, detail) => checks.push({ label, pass, detail });
const sampleBundle = bundles.find((b) => b.bundle.records.length > 0);
if (sampleBundle) {
  const out = renderContextNEW(sampleBundle.bundle);
  const first = sampleBundle.bundle.records[0];
  need("record_id header present", out.includes(`━━━ ${first.record_id} ━━━`), "id binding for typed edges");
  need("Title label present",       out.includes("Title:"), "human anchor");
  need("Category + Audience folded onto one line",
    /Category: [^\n]* · Audience: /.test(out) && !out.includes("Primary audience:"),
    "labels combined · no separate 'Primary audience:' line");
  need("Summary label present",     out.includes("Summary:"), "linking signal");
  need("NEX concepts label",         out.includes("NEX concepts:") || first.nex_concepts.length === 0, "typed-edge backbone");
  need("Industry concepts label",    out.includes("Industry concepts:") || first.industry_concepts.length === 0, "regulatory edge backbone");
  need("Imperative preserved",       out.includes("You MUST NOT re-author these"), "context integrity doctrine");
  need("GAP KEYWORDS section",       out.includes("GAP KEYWORDS") || (sampleBundle.bundle.gaps?.length ?? 0) === 0, "authoring target list");
  need("Sample edges cap ≤ 3",
    (() => {
      const m = out.match(/Sample edges:     ([^\n]*)/);
      if (!m) return first.sample_edges.length === 0;
      const count = m[1].split(",").length;
      return count <= 3;
    })(),
    "5→3 cap enforced");
}
let failures = 0;
for (const c of checks) {
  console.log(`  [${c.pass ? "PASS" : "FAIL"}] ${c.label}`);
  if (!c.pass) { console.log(`         ↳ ${c.detail}`); failures += 1; }
}

console.log("");
console.log("-".repeat(78));
if (failures === 0) {
  console.log(`RESULT: PASS · ${checks.length} structural assertions passed · Truth-Law loss captured above`);
  console.log("Runtime verification via live probe (Step 8 target: context_chars < 6798) is the next check.");
} else {
  console.log(`RESULT: FAIL · ${failures}/${checks.length} assertions failed`);
  process.exit(1);
}
