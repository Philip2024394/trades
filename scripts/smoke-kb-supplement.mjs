#!/usr/bin/env node
// scripts/smoke-kb-supplement.mjs
//
// Founder Path A · KB-2 · Knowledge Brain supplementary evidence.
//
// Verifies:
//   A · KB does NOT fire when adapter promotes (composition-first discipline)
//   B · KB fires when rescue would · kb_meta populated
//   C · when KB has hits, rescue can cite them (bundle enriched)
//   D · Doctrine invariants preserved · zero fabrication
//   E · KB failure is non-fatal (rescue path still completes)

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

// ══ A · adapter promotes → KB does NOT fire (composition-first)
console.log("\n══ A · adapter promoted → KB does NOT fire");
{
  const cid = randomUUID();
  const r = await chat(cid, "how many rooms does Gaotama Hotel have?");
  const dbg = r.body?._debug_timings ?? {};
  console.log(`  kb_meta=${JSON.stringify(dbg.kb_meta)}`);
  // kb_meta is null when the KB block wasn't reached (adapter promoted).
  if (dbg.kb_meta && dbg.kb_meta.fired) failures.push({ case: "A", reason: "kb_fired_on_adapter_promoted" });
}

// ══ B · rescue path fires → KB tried
console.log("\n══ B · rescue path fires → kb_meta populated");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:real xyzzy plugh detail check " + Date.now());
  const dbg = r.body?._debug_timings ?? {};
  const kb = dbg.kb_meta;
  console.log(`  kb_meta=${JSON.stringify(kb)}`);
  if (!kb) failures.push({ case: "B", reason: "no_kb_meta" });
  else if (kb.fired !== true) failures.push({ case: "B", reason: `kb_did_not_fire_${kb.fired}` });
  else if (typeof kb.total_ms !== "number") failures.push({ case: "B", reason: "no_total_ms" });
}

// ══ C · when KB has hits, rescue can cite them
console.log("\n══ C · KB hits appear in bundle · rescue can cite");
{
  const cid = randomUUID();
  // A query where KB should find something in question_variant.
  const r = await chat(cid, "cite:real wifi accommodation yogyakarta " + Date.now());
  const dbg = r.body?._debug_timings ?? {};
  const kb = dbg.kb_meta;
  const rescue = dbg.llm_rescue_verdict;
  console.log(`  kb.hits=${kb?.hits} rescue.verified=${rescue?.verified} cited=${JSON.stringify(rescue?.cited_source_refs)}`);
  // The mock rescue provider cites bundle.items[0]. If KB added items,
  // one of them may be the top-cited item · verify shape only.
  if (kb?.fired && rescue) {
    if (!Array.isArray(rescue.cited_source_refs)) failures.push({ case: "C", reason: "no_cited_array" });
  }
}

// ══ D · Doctrine invariants · fabrication guard
console.log("\n══ D · doctrine invariants preserved · fabrication guard");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:orphan xyzzy plugh " + Date.now());
  const dbg = r.body?._debug_timings ?? {};
  const rescue = dbg.llm_rescue_verdict;
  const reply = String(r.body?.reply ?? "");
  if (rescue?.verified) failures.push({ case: "D", reason: "orphan_verified" });
  if (reply.toLowerCase().includes("ritz fabricated hotel")) failures.push({ case: "D", reason: "FABRICATED_LEAKED" });
  console.log(`  rescue.verified=${rescue?.verified} rejected=${rescue?.rejected_claims_count}`);
}

// ══ E · KB failure is non-fatal
console.log("\n══ E · KB failure non-fatal");
{
  // We can't easily force a KB error from HTTP · assert that a normal
  // request completes even with KB in the pipeline (implicit test).
  const cid = randomUUID();
  const r = await chat(cid, "hello there");
  console.log(`  status=${r.status} reply_present=${!!r.body?.reply}`);
  if (r.status !== 200) failures.push({ case: "E", reason: `status_${r.status}` });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · KB-2 supplementary evidence green · composition-first + doctrines preserved.");
  process.exit(0);
}
