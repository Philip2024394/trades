#!/usr/bin/env node
// scripts/smoke-chat-ui.mjs
//
// Founder Phase 7 · P7-2 · polished demo chat UI regression.
//
// Verifies:
//   A · GET /nex/chat returns 200 · content-type HTML
//   B · marker text present · confirms it rendered the chat page
//   C · chat route responds with cited_sources when relevant
//   D · trust-badge branches exist in the source
//   E · sources panel branch exists in the source
//   F · cross-domain card branch exists in the source
//   G · ticker footer exists in the source
//   H · observatory snapshot readable (ticker depends on this)

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";
const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function get(pth) {
  const res = await fetch(`${HOST}${pth}`);
  const text = await res.text();
  return { status: res.status, text, contentType: res.headers.get("content-type") ?? "" };
}

const failures = [];

console.log("\n══ A · GET /nex/chat returns 200 HTML");
{
  const r = await get("/nex/chat");
  console.log(`  status=${r.status} ct=${r.contentType.slice(0, 50)}`);
  if (r.status !== 200) failures.push({ case: "A", reason: `status_${r.status}` });
  if (!r.contentType.startsWith("text/html")) failures.push({ case: "A", reason: "not_html" });
}

console.log("\n══ B · marker present");
{
  const r = await get("/nex/chat");
  if (!r.text.includes("NEX Chat")) failures.push({ case: "B", reason: "no_page_title" });
  if (!r.text.includes("Every reply carries sources")) failures.push({ case: "B", reason: "no_tagline" });
}

console.log("\n══ C · chat route responds to a real query with envelope");
{
  const res = await fetch(`${HOST}/api/nex-conv/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "hello", conversation_id: `smoke-p7-C`, market: "ID", useLiveWorld: true }),
  });
  const j = await res.json();
  console.log(`  status=${res.status} has_reply=${!!j?.reply} cited_sources_type=${Array.isArray(j?.cited_sources) ? "array" : typeof j?.cited_sources}`);
  if (res.status !== 200) failures.push({ case: "C", reason: `status_${res.status}` });
  if (!Array.isArray(j?.cited_sources)) failures.push({ case: "C", reason: "no_cited_sources" });
}

console.log("\n══ D-G · source branches present in the page component");
{
  const src = await readFile(path.join(REPO, "src/app/nex/chat/page.tsx"), "utf8");
  if (!src.includes("TrustBadge")) failures.push({ case: "D", reason: "no_trust_badge" });
  if (!src.includes("SourcesPanel")) failures.push({ case: "E", reason: "no_sources_panel" });
  if (!src.includes("CrossDomainCard")) failures.push({ case: "F", reason: "no_cross_domain_card" });
  if (!src.includes("tickerStyle") && !src.includes("observatory")) failures.push({ case: "G", reason: "no_ticker" });
}

console.log("\n══ H · observatory snapshot reachable (ticker source)");
{
  const r = await fetch(`${HOST}/api/nex/observatory/snapshot?window=1h`);
  const j = await r.json();
  if (r.status !== 200) failures.push({ case: "H", reason: `status_${r.status}` });
  if (typeof j?.doctrine_health?.overall_score !== "number") failures.push({ case: "H", reason: "no_score" });
  console.log(`  overall_score=${j?.doctrine_health?.overall_score}`);
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · polished demo chat UI live · shows sources · trust badges · cross-domain · observatory ticker.");
  process.exit(0);
}
