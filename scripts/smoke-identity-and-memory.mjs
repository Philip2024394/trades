#!/usr/bin/env node
// scripts/smoke-identity-and-memory.mjs
//
// Founder Phase 10 · P10-7 · Identity + memory transparency regression.
//
// Verifies:
//   A · POST /api/nex/auth/signup returns user_id + sets cookie
//   B · GET /api/nex/auth/session with cookie returns authenticated=true
//   C · session without cookie returns authenticated=false
//   D · chat route reads cookie · teaches a memory · memory list contains it
//   E · DELETE memory removes it from list
//   F · GET /api/nex/user/export returns full profile
//   G · POST /api/nex/user/delete cascades (session becomes unauthenticated)
//   H · anonymous chat (no cookie) still works · falls back to body.user_id
//   I · /nex/settings page renders 200
//   J · Doctrine #4 · memory-citation attempt still rejected

import { randomUUID } from "node:crypto";

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";
const failures = [];

class CookieJar {
  constructor() { this.cookies = new Map(); }
  addFromResponse(res) {
    const setCookie = res.headers.get("set-cookie") ?? "";
    for (const c of setCookie.split(/,\s*(?=[^ ]+=)/)) {
      const m = c.match(/^([^=]+)=([^;]*)/);
      if (m) this.cookies.set(m[1], m[2]);
    }
  }
  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  hasSession() { return this.cookies.has("nex_session"); }
}

async function jarFetch(jar, path, opts = {}) {
  const headers = new Headers(opts.headers ?? {});
  if (jar.header()) headers.set("cookie", jar.header());
  const res = await fetch(`${HOST}${path}`, { ...opts, headers });
  jar.addFromResponse(res);
  const text = await res.text();
  return { status: res.status, text, body: (() => { try { return JSON.parse(text); } catch { return null; } })() };
}

// ══ A · signup
console.log("\n══ A · signup returns user_id + sets cookie");
let jar = new CookieJar();
let userId;
{
  const r = await jarFetch(jar, "/api/nex/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_name: `smoke-${randomUUID().slice(0, 8)}` }) });
  console.log(`  status=${r.status} user_id=${r.body?.user_id?.slice(0, 8)} cookie=${jar.hasSession()}`);
  if (r.status !== 200) failures.push({ case: "A", reason: `status_${r.status}` });
  if (!r.body?.user_id) failures.push({ case: "A", reason: "no_user_id" });
  if (!jar.hasSession()) failures.push({ case: "A", reason: "no_cookie" });
  userId = r.body?.user_id;
}

// ══ B · authenticated session
console.log("\n══ B · session with cookie returns authenticated");
{
  const r = await jarFetch(jar, "/api/nex/auth/session");
  console.log(`  authenticated=${r.body?.authenticated} user_id=${r.body?.user_id?.slice(0, 8)}`);
  if (r.body?.authenticated !== true) failures.push({ case: "B", reason: "not_authenticated" });
  if (r.body?.user_id !== userId) failures.push({ case: "B", reason: "user_id_mismatch" });
}

// ══ C · session without cookie
console.log("\n══ C · session without cookie returns anonymous");
{
  const emptyJar = new CookieJar();
  const r = await jarFetch(emptyJar, "/api/nex/auth/session");
  console.log(`  authenticated=${r.body?.authenticated}`);
  if (r.body?.authenticated !== false) failures.push({ case: "C", reason: "should_be_unauthenticated" });
}

// ══ D · chat reads cookie · teach memory · list contains it
console.log("\n══ D · chat reads cookie · teach memory · appears in list");
{
  const cid = randomUUID();
  await jarFetch(jar, "/api/nex-conv/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "please remember I prefer window seats", conversation_id: cid, market: "ID", useLiveWorld: true }),
  });
  await new Promise((r) => setTimeout(r, 400));
  const list = await jarFetch(jar, "/api/nex/user/memory/list");
  const memories = list.body?.memories ?? [];
  console.log(`  count=${memories.length} first=${memories[0]?.claim_text?.slice(0, 40)}`);
  if (memories.length < 1) failures.push({ case: "D", reason: "no_memories_taught" });
}

// ══ E · delete individual memory
console.log("\n══ E · delete individual memory");
{
  const before = await jarFetch(jar, "/api/nex/user/memory/list");
  const beforeCount = before.body?.memories?.length ?? 0;
  const targetId = before.body?.memories?.[0]?.memory_id;
  if (!targetId) {
    console.log(`  (no memory to delete · skip)`);
  } else {
    const del = await jarFetch(jar, `/api/nex/user/memory/${encodeURIComponent(targetId)}`, { method: "DELETE" });
    console.log(`  del.status=${del.status} ok=${del.body?.ok}`);
    if (del.status !== 200) failures.push({ case: "E", reason: `del_status_${del.status}` });
    const after = await jarFetch(jar, "/api/nex/user/memory/list");
    const afterCount = after.body?.memories?.length ?? 0;
    if (afterCount !== beforeCount - 1) failures.push({ case: "E", reason: `count_${beforeCount}->${afterCount}` });
  }
}

// ══ F · export
console.log("\n══ F · export returns full profile");
{
  const r = await jarFetch(jar, "/api/nex/user/export");
  console.log(`  status=${r.status} user_id=${r.body?.user_id?.slice(0, 8)}`);
  if (r.status !== 200) failures.push({ case: "F", reason: `status_${r.status}` });
  if (!r.body?.profile) failures.push({ case: "F", reason: "no_profile" });
}

// ══ G · delete account · session becomes unauthenticated
console.log("\n══ G · delete account · session becomes unauthenticated");
{
  const r = await jarFetch(jar, "/api/nex/user/delete", { method: "POST" });
  console.log(`  status=${r.status} ok=${r.body?.ok}`);
  if (r.status !== 200) failures.push({ case: "G", reason: `del_status_${r.status}` });
  const s = await jarFetch(jar, "/api/nex/auth/session");
  console.log(`  post-delete authenticated=${s.body?.authenticated}`);
  if (s.body?.authenticated !== false) failures.push({ case: "G", reason: "still_authenticated_after_delete" });
}

// ══ H · anonymous chat (no cookie) still works
console.log("\n══ H · anonymous chat still works");
{
  const cid = randomUUID();
  const r = await fetch(`${HOST}/api/nex-conv/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "hello", conversation_id: cid, market: "ID", useLiveWorld: true }),
  });
  console.log(`  status=${r.status}`);
  if (r.status !== 200) failures.push({ case: "H", reason: `status_${r.status}` });
}

// ══ I · settings page renders
console.log("\n══ I · /nex/settings renders 200");
{
  const r = await fetch(`${HOST}/nex/settings`);
  const text = await r.text();
  if (r.status !== 200) failures.push({ case: "I", reason: `status_${r.status}` });
  if (!text.includes("NEX Settings")) failures.push({ case: "I", reason: "no_marker" });
  console.log(`  status=${r.status}`);
}

// ══ J · Doctrine #4 preserved · memory-cite still rejected
console.log("\n══ J · Doctrine #4 · memory citations still rejected");
{
  const r = await fetch(`${HOST}/api/nex-conv/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "cite:memory xyzzy plugh detail", conversation_id: randomUUID(), market: "ID", useLiveWorld: true }),
  });
  const j = await r.json();
  const reasons = (j?._debug_timings?.llm_rescue_verdict?.rejected_claims ?? []).map((x) => x.reason);
  const hasReject = reasons.some((r) => r.startsWith("doctrine_4_memory_is_not_truth:"));
  console.log(`  doctrine_4_reject=${hasReject}`);
  if (!hasReject) failures.push({ case: "J", reason: "doctrine_4_reject_missing" });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · identity + memory transparency live · Doctrine #4 preserved.");
  process.exit(0);
}
