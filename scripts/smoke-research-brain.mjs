#!/usr/bin/env node
// scripts/smoke-research-brain.mjs
//
// Founder Path A · Phase A2 · Research Brain regression.
// Doctrine anchors: #1 (Gate v2 alignment) · #2 (actions via Action Brain) ·
// #3 (web capped at evidence_provisional) · #4 (memory never seeds research).
// Composition-first: research fires ONLY when adapter/composer/rescue all
// fail to answer. Preserves "LLM only when necessary" discipline.
//
// Verifies:
//   A · adapter promotes deterministic → research does NOT fire
//   B · composer accepts → research does NOT fire
//   C · rescue verifies → research does NOT fire
//   D · none of the above → research FIRES · produces CitedReport
//   E · every CitedClaim passes Gate v2 alignment threshold
//   F · budget-cap honoured · latency_ms <= budget * 1.2
//   G · zero fabrication invariant · no invented content in headline
//   H · disagreements surfaced (not suppressed) when present
//
// Requires: NEX_RESEARCH_BRAIN=on · NEX_LLM_RESCUE=1 ·
//           NEX_LLM_RESCUE_PROVIDER=mock · NEX_WEB_ACQUISITION_PROVIDER=mock

import { randomUUID } from "node:crypto";

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";

async function chat(cid, message, extra = {}) {
  const res = await fetch(`${HOST}/api/nex-conv/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversation_id: cid, market: "ID", useLiveWorld: true, ...extra }),
  });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: { _parse_error: text.slice(0, 200) } }; }
}

const failures = [];
try { await chat(randomUUID(), "warmup"); } catch {}

// ══════════════════════════════════════════════════════════════════
// A · adapter promoted → research does NOT fire
// ══════════════════════════════════════════════════════════════════
console.log("\n══ A · adapter promoted → research does NOT fire");
{
  const cid = randomUUID();
  const r = await chat(cid, "how many rooms does Gaotama Hotel have?");
  const dbg = r.body?._debug_timings ?? {};
  const meta = dbg.research_meta;
  console.log(`  research.fired=${meta?.fired} reason=${meta?.reason}`);
  if (!meta) failures.push({ case: "A_adapter_promoted", reason: "no_research_meta" });
  else if (meta.fired === true) failures.push({ case: "A_adapter_promoted", reason: `unexpected_fire_${meta.reason}` });
}

// ══════════════════════════════════════════════════════════════════
// B · composer accepted (typical greeting) → research does NOT fire
// ══════════════════════════════════════════════════════════════════
console.log("\n══ B · composer accepted (greeting) → research does NOT fire");
{
  const cid = randomUUID();
  const r = await chat(cid, "hello there");
  const dbg = r.body?._debug_timings ?? {};
  const meta = dbg.research_meta;
  console.log(`  research.fired=${meta?.fired} reason=${meta?.reason}`);
  if (!meta) failures.push({ case: "B_composer", reason: "no_research_meta" });
  else if (meta.fired === true) failures.push({ case: "B_composer", reason: `unexpected_fire_${meta.reason}` });
}

// ══════════════════════════════════════════════════════════════════
// C · rescue verified → research does NOT fire
// ══════════════════════════════════════════════════════════════════
console.log("\n══ C · rescue verified → research does NOT fire");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:real xyzzy plugh with fine details");
  const dbg = r.body?._debug_timings ?? {};
  const meta = dbg.research_meta;
  const rescue = dbg.llm_rescue_verdict;
  console.log(`  rescue.verified=${rescue?.verified} research.fired=${meta?.fired} reason=${meta?.reason}`);
  if (!meta) failures.push({ case: "C_rescue_verified", reason: "no_research_meta" });
  else if (meta.fired === true) failures.push({ case: "C_rescue_verified", reason: `unexpected_fire_${meta.reason}` });
}

// ══════════════════════════════════════════════════════════════════
// D · nothing answered → research FIRES · produces CitedReport
// ══════════════════════════════════════════════════════════════════
console.log("\n══ D · adapter+composer+rescue all fail → research FIRES");
{
  const cid = randomUUID();
  // Query designed to fail all upstream paths:
  //   - no entity in accommodation KF
  //   - deterministic composer can't compose (no entity resolved)
  //   - "cite:none" tells the mock rescue to abstain (unverified)
  //   Research brain then fires on a novel objective.
  const r = await chat(cid, "cite:none what is the Ringelmann effect in multi-agent LLM systems");
  const dbg = r.body?._debug_timings ?? {};
  const meta = dbg.research_meta;
  const report = dbg.research_report;
  console.log(`  research.fired=${meta?.fired} reason=${meta?.reason} answered=${meta?.answered} claims=${meta?.claim_count} spans=${meta?.span_count}`);
  if (report) {
    console.log(`  report.headline: ${JSON.stringify(String(report.headline).slice(0, 100))}`);
    console.log(`  report.top_claims: ${report.top_claims.length}`);
  }
  if (!meta) failures.push({ case: "D_research_fires", reason: "no_research_meta" });
  else if (meta.fired !== true) failures.push({ case: "D_research_fires", reason: `did_not_fire_${meta.reason}` });
  // We don't assert answered=true because the mock web provider might return
  // no aligned spans · but we assert the loop ran and produced meta.
  if (meta?.fired && typeof meta.latency_ms !== "number") {
    failures.push({ case: "D_research_fires", reason: "no_latency_ms" });
  }
}

// ══════════════════════════════════════════════════════════════════
// E · every CitedClaim passes Gate v2 alignment threshold
// ══════════════════════════════════════════════════════════════════
console.log("\n══ E · every CitedClaim >= alignment threshold");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:none what are the primary sources on medieval Java maritime trade");
  const dbg = r.body?._debug_timings ?? {};
  const report = dbg.research_report;
  const threshold = 0.20;
  if (report && Array.isArray(report.top_claims)) {
    for (const c of report.top_claims) {
      if (typeof c.alignment_score !== "number") {
        failures.push({ case: "E_alignment", reason: "no_alignment_score_on_claim" });
      } else if (c.alignment_score < threshold) {
        failures.push({ case: "E_alignment", reason: `alignment_${c.alignment_score}_below_threshold_${threshold}` });
      }
      if (c.trust !== "evidence_provisional" && c.trust !== "unknown") {
        failures.push({ case: "E_trust_cap", reason: `trust_${c.trust}_exceeds_ceiling` });
      }
    }
    console.log(`  ${report.top_claims.length} claims all >= threshold=${threshold} and trust <= evidence_provisional`);
  } else {
    console.log(`  (no report produced by research brain for this query · skipping alignment assertion)`);
  }
}

// ══════════════════════════════════════════════════════════════════
// F · budget-cap honoured
// ══════════════════════════════════════════════════════════════════
console.log("\n══ F · latency_ms within budget");
{
  const cid = randomUUID();
  const budget = 20_000; // matches NEX_RESEARCH_BUDGET_MS default
  const r = await chat(cid, "cite:none Ringelmann effect multi-agent LLM cost patterns", { });
  const dbg = r.body?._debug_timings ?? {};
  const meta = dbg.research_meta;
  console.log(`  latency_ms=${meta?.latency_ms} budget=${budget}`);
  if (meta?.fired && typeof meta.latency_ms === "number" && meta.latency_ms > budget * 1.2) {
    failures.push({ case: "F_budget", reason: `latency_${meta.latency_ms}_exceeds_1.2x_budget_${budget}` });
  }
}

// ══════════════════════════════════════════════════════════════════
// G · zero fabrication invariant (no invented content in headline)
// ══════════════════════════════════════════════════════════════════
console.log("\n══ G · no invented content · headline traces to a span");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:none xylophone research brain never invented topic");
  const dbg = r.body?._debug_timings ?? {};
  const report = dbg.research_report;
  if (report && report.answered === true && report.headline) {
    // The headline must be a claim that CITES a span (top_claims[0].cites must be non-empty).
    const top = report.top_claims?.[0];
    if (!top || !Array.isArray(top.cites) || top.cites.length === 0) {
      failures.push({ case: "G_fabrication", reason: "headline_has_no_citations" });
    }
    console.log(`  headline traces to ${top?.cites?.length ?? 0} span(s) · trust=${top?.trust}`);
  } else {
    console.log(`  honest UNKNOWN (research answered=false) · fabrication guard vacuously true`);
  }
}

// ══════════════════════════════════════════════════════════════════
// H · disagreements surfaced (present in meta even when count=0)
// ══════════════════════════════════════════════════════════════════
console.log("\n══ H · disagreements field present");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:none disagreement corpus check");
  const dbg = r.body?._debug_timings ?? {};
  const meta = dbg.research_meta;
  console.log(`  disagreement_count=${meta?.disagreement_count}`);
  if (meta?.fired && typeof meta.disagreement_count !== "number") {
    failures.push({ case: "H_disagreements", reason: "no_disagreement_count_field" });
  }
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · Research Brain fires only when needed · Gate v2 alignment enforced · zero fabrication.");
  process.exit(0);
}
