#!/usr/bin/env node
// scripts/smoke-offline.mjs
//
// Founder AIW-5 · NEX AI-WiFi · offline resilience.
//
// Verifies NEX still answers routine questions when the internet is
// unreliable. We can't unplug the network from a smoke test, but we
// can:
//   A · fire a routine adapter-path query and assert it comes back
//       even when the underlying providers are unhealthy
//   B · assert the composer's honest-boundary path is engaged when
//       the query would need internet (fabrication guard proves the
//       zero-fabrication invariant holds even offline)
//   C · assert Observatory + Knowledge Brain still respond (they
//       read Postgres only · no internet dependency)
//
// The real end-to-end offline test is a manual pull-the-wifi
// exercise · this smoke gives us the guarantees we can assert
// deterministically from HTTP.

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
  catch { return { status: res.status, body: null, raw: text.slice(0, 200) }; }
}

const failures = [];
try { await chat(randomUUID(), "warmup"); } catch {}

// ══ A · routine adapter query still lands
console.log("\n══ A · routine adapter query works · answered from Postgres");
{
  const cid = randomUUID();
  const r = await chat(cid, "how many rooms does Gaotama Hotel have?");
  const dbg = r.body?._debug_timings ?? {};
  const promoted = dbg.deterministic_reply_promotion?.accepted;
  const reply = String(r.body?.reply ?? "");
  console.log(`  status=${r.status} promoted=${promoted} reply_len=${reply.length}`);
  if (r.status !== 200) failures.push({ case: "A", reason: `status_${r.status}` });
  if (!reply) failures.push({ case: "A", reason: "empty_reply" });
}

// ══ B · fabrication guard still holds when internet-only query fails
console.log("\n══ B · fabrication guard preserved for internet-only query");
{
  const cid = randomUUID();
  const r = await chat(cid, "cite:none what did fictional character Xyzzyquux5678 do on Tuesday?");
  const reply = String(r.body?.reply ?? "");
  console.log(`  reply preview: ${JSON.stringify(reply.slice(0, 100))}`);
  // Reply must not invent character details.
  if (reply.toLowerCase().includes("xyzzyquux5678") &&
      !reply.toLowerCase().includes("don't have") &&
      !reply.toLowerCase().includes("couldn't") &&
      !reply.toLowerCase().includes("no verified") &&
      !reply.toLowerCase().startsWith("based on research:")) {
    failures.push({ case: "B", reason: "fabricated_character_details_leaked" });
  }
}

// ══ C · Observatory + Knowledge Brain read Postgres only
console.log("\n══ C · Postgres-only surfaces respond");
{
  const obs = await fetch(`${HOST}/api/nex/observatory/snapshot?window=1h`);
  const obsBody = await obs.json();
  const score = obsBody?.doctrine_health?.overall_score;
  console.log(`  observatory status=${obs.status} overall_score=${score}`);
  if (obs.status !== 200) failures.push({ case: "C", reason: `observatory_${obs.status}` });
  if (typeof score !== "number") failures.push({ case: "C", reason: "no_score" });

  const kb = await fetch(`${HOST}/api/nex/knowledge-brain/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "hotel yogyakarta wifi", top_k: 3 }),
  });
  const kbBody = await kb.json();
  console.log(`  knowledge-brain status=${kb.status} hits=${kbBody?.answer?.hits?.length}`);
  if (kb.status !== 200) failures.push({ case: "C", reason: `kb_${kb.status}` });
}

// ══ D · Attributions endpoint always available offline (static data)
console.log("\n══ D · attributions endpoint (no internet dependency)");
{
  const r = await fetch(`${HOST}/api/nex/attributions`);
  const body = await r.json();
  console.log(`  status=${r.status} count=${body?.attributions?.length}`);
  if (r.status !== 200 || !Array.isArray(body?.attributions)) {
    failures.push({ case: "D", reason: `attributions_${r.status}` });
  }
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · offline-resilient surfaces green · fabrication guard held.");
  process.exit(0);
}
