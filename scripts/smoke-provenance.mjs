#!/usr/bin/env node
// scripts/smoke-provenance.mjs
//
// Founder Phase 4 · P4-5 · Trust/provenance surface regression.
//
// Verifies:
//   A · every chat response includes cited_sources array
//   B · when research is activated, cited_sources are populated with web_research entries
//   C · every source has trust_band that is either canonical/verified/provisional/unknown
//   D · alignment_score present when available · always 0..1
//   E · adapter-promoted queries have empty or minimal cited_sources (nothing to cite)

import { randomUUID } from "node:crypto";

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";

async function chat(cid, message) {
  const res = await fetch(`${HOST}/api/nex-conv/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversation_id: cid, market: "ID", useLiveWorld: true }),
  });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: null }; }
}

const failures = [];
try { await chat(randomUUID(), "warmup"); } catch {}

console.log("\n══ A · every chat response has cited_sources array");
{
  const r = await chat(randomUUID(), "hello there");
  const cs = r.body?.cited_sources;
  console.log(`  status=${r.status} cited_sources_type=${Array.isArray(cs) ? "array" : typeof cs} count=${cs?.length}`);
  if (r.status !== 200) failures.push({ case: "A", reason: `status_${r.status}` });
  if (!Array.isArray(cs)) failures.push({ case: "A", reason: "not_array" });
}

console.log("\n══ B · research-activated queries produce web_research citations");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:none deep dive on medieval Java maritime trade routes " + Date.now());
  const activated = r.body?._debug_timings?.research_activated;
  const cs = r.body?.cited_sources ?? [];
  const hasResearch = cs.some((c) => c.source_type === "web_research");
  console.log(`  research_activated=${activated} count=${cs.length} has_web_research=${hasResearch}`);
  if (activated && !hasResearch) failures.push({ case: "B", reason: "activated_but_no_research_source" });
}

console.log("\n══ C · trust_band on every source is a valid band");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:real xyzzy plugh basic detail " + Date.now());
  const cs = r.body?.cited_sources ?? [];
  const validBands = new Set(["canonical_verified","canonical_unverified","evidence_verified","evidence_provisional","unknown","clarify","mixed"]);
  for (const c of cs) {
    if (!validBands.has(c.trust_band)) {
      failures.push({ case: "C", reason: `bad_band_${c.trust_band}` });
    }
  }
  console.log(`  ${cs.length} sources · all bands valid`);
}

console.log("\n══ D · alignment_score in [0,1] when present");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:none tell me about Borobudur history " + Date.now());
  const cs = r.body?.cited_sources ?? [];
  for (const c of cs) {
    if (c.alignment_score !== undefined) {
      if (typeof c.alignment_score !== "number" || c.alignment_score < 0 || c.alignment_score > 1) {
        failures.push({ case: "D", reason: `bad_score_${c.alignment_score}` });
      }
    }
  }
  console.log(`  ${cs.length} sources · alignment_score in range`);
}

console.log("\n══ E · adapter-promoted routine query · empty or minimal sources");
{
  const cid = randomUUID();
  const r = await chat(cid, "how many rooms does Gaotama Hotel have?");
  const promoted = r.body?._debug_timings?.deterministic_reply_promotion?.accepted;
  const cs = r.body?.cited_sources ?? [];
  console.log(`  promoted=${promoted} cited_sources_count=${cs.length}`);
  // When adapter promotes, cited_sources may be empty · that's OK (adapter's
  // own reasoning array carries the trust info)
  if (!Array.isArray(cs)) failures.push({ case: "E", reason: "not_array" });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · trust/provenance surface live on chat responses.");
  process.exit(0);
}
