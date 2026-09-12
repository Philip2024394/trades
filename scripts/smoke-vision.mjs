#!/usr/bin/env node
// scripts/smoke-vision.mjs
//
// Founder BEGIN Phase 3.8 · Vision input regression.
//
// Verifies:
//   A · request WITHOUT image_base64 → no vision fired
//   B · request WITH image_base64 (mock hint=receipt) → 3 vision items extracted,
//        vision_extra_items_count=3, source_type=vision, ref_ids vision:*
//   C · LLM (mock, cite:real) picks first evidence which is a vision ref →
//        rescue verified, cited_source_refs contain a vision: prefix
//   D · Fabrication guard on vision cites: cite:orphan tries to cite a fake
//        vision ref → rejected, honest limitation returned
//   E · zero-fabrication invariant preserved end-to-end
//
// Requires NEX_VISION=on NEX_VISION_PROVIDER=mock (already in .env.local)

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

// Dummy base64 payload · length > 32 so the vision provider runs.
// Mock provider only hashes it for the ref_id; content doesn't need to be
// a real image for the mock.
const DUMMY_IMG = Buffer.from("mock-image-content-for-regression-testing-not-a-real-jpeg").toString("base64");

const failures = [];

// Warmup
try { await chat(randomUUID(), "warmup"); } catch {}

// ══════════════════════════════════════════════════════════════════
// A · no image → no vision
// ══════════════════════════════════════════════════════════════════
console.log("\n══ A · request WITHOUT image_base64 → no vision fired");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:real hotel gaotama info");
  const dbg = r.body?._debug_timings ?? {};
  const meta = dbg.vision_provider_meta;
  const count = dbg.vision_extra_items_count ?? 0;
  console.log(`  vision_provider_meta=${JSON.stringify(meta)} count=${count}`);
  if (meta !== null && meta !== undefined) failures.push({ case: "no_image", reason: "vision_ran_without_image" });
  if (count > 0) failures.push({ case: "no_image", reason: "vision_items_added_without_image" });
}

// ══════════════════════════════════════════════════════════════════
// B · WITH image + hint=receipt → 3 vision items extracted
// ══════════════════════════════════════════════════════════════════
console.log("\n══ B · request WITH image + hint=receipt → vision extracts 3 facts");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:real receipt from my hotel", { image_base64: DUMMY_IMG });
  const dbg = r.body?._debug_timings ?? {};
  const meta = dbg.vision_provider_meta;
  const count = dbg.vision_extra_items_count ?? 0;
  console.log(`  vision_provider_meta.completed=${meta?.completed} count=${count} hash=${meta?.image_hash?.slice(0, 8)}`);
  if (!meta || meta.completed !== true) failures.push({ case: "with_image_receipt", reason: "vision_did_not_complete" });
  if (count !== 3) failures.push({ case: "with_image_receipt", reason: `expected_3_items_got_${count}` });
  // Rescue may or may not fire depending on whether adapter promoted · we
  // don't assert on that here · Track C separately verifies rescue cites.
}

// ══════════════════════════════════════════════════════════════════
// C · LLM (mock, cite:real) picks first evidence which is a vision ref
// ══════════════════════════════════════════════════════════════════
console.log("\n══ C · cite:real + image → rescue cites vision ref");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:real xyzzy plugh menu photo attached", { image_base64: DUMMY_IMG });
  const dbg = r.body?._debug_timings ?? {};
  const rescue = dbg.llm_rescue_verdict;
  const count = dbg.vision_extra_items_count ?? 0;
  console.log(`  rescue.verified=${rescue?.verified} cited=${JSON.stringify(rescue?.cited_source_refs)}`);
  console.log(`  vision_items_extracted=${count}`);
  if (!rescue) failures.push({ case: "cite_vision", reason: "rescue_did_not_fire" });
  else {
    const cited = rescue.cited_source_refs ?? [];
    const hasVision = cited.some((c) => c.startsWith("vision:"));
    if (!rescue.verified) failures.push({ case: "cite_vision", reason: "verdict_not_verified" });
    if (!hasVision) failures.push({ case: "cite_vision", reason: `expected_vision_prefix_in_cited_got_${JSON.stringify(cited)}` });
  }
}

// ══════════════════════════════════════════════════════════════════
// D · Fabrication guard on vision refs
// ══════════════════════════════════════════════════════════════════
console.log("\n══ D · Fabrication guard rejects orphan vision citation");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:orphan xyzzy plugh with photo attached", { image_base64: DUMMY_IMG });
  const dbg = r.body?._debug_timings ?? {};
  const rescue = dbg.llm_rescue_verdict;
  const reply = String(r.body?.reply ?? "");
  console.log(`  rescue.verified=${rescue?.verified} rejected=${rescue?.rejected_claims_count}`);
  console.log(`  reply: ${JSON.stringify(reply.slice(0, 80))}`);
  if (!rescue) failures.push({ case: "vision_fabrication", reason: "rescue_did_not_fire" });
  else {
    if (rescue.verified) failures.push({ case: "vision_fabrication", reason: "orphan_claim_accepted" });
    if (rescue.rejected_claims_count < 1) failures.push({ case: "vision_fabrication", reason: "no_rejection_recorded" });
    if (reply.toLowerCase().includes("ritz fabricated hotel")) failures.push({ case: "vision_fabrication", reason: "FABRICATED_LEAKED" });
    // Honest reply is either "couldn't verify" (rescue limitation) or
    // "Based on research:" (Research Brain fallback · itself gate-validated).
    if (!reply.includes("couldn't verify") && !reply.startsWith("Based on research:")) {
      failures.push({ case: "vision_fabrication", reason: "no_honest_reply_pattern" });
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// E · Vision facts appear in ref_id format vision:hash:i
// ══════════════════════════════════════════════════════════════════
console.log("\n══ E · vision ref_ids follow vision:hash:i format");
{
  // Same call as B, then check the reasoning trace.
  const cid = randomUUID();
  const r = await chat(cid, "cite:real facility photo", { image_base64: DUMMY_IMG });
  const dbg = r.body?._debug_timings ?? {};
  const rescue = dbg.llm_rescue_verdict;
  const cited = rescue?.cited_source_refs ?? [];
  const goodFormat = cited.filter((c) => /^vision:[a-f0-9]{16}:\d+$/.test(c));
  console.log(`  cited=${JSON.stringify(cited)}`);
  console.log(`  well-formed vision refs: ${goodFormat.length}/${cited.length}`);
  if (rescue?.verified && cited.length > 0 && goodFormat.length === 0) {
    failures.push({ case: "ref_format", reason: "no_well_formed_vision_ref" });
  }
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · vision → evidence → gate → verified · fabrication guard preserved.");
  process.exit(0);
}
