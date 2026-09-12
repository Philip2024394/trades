#!/usr/bin/env node
// scripts/smoke-api-platform.mjs
//
// Founder Phase 14 · P14-5 · Public API platform regression.
//
// Verifies:
//   A · signup + issue key returns raw_token exactly once (nex_live_ prefix)
//   B · list keys shows the key by prefix (never raw_token)
//   C · public API rejects missing bearer (401)
//   D · public API rejects garbage bearer (401)
//   E · public API accepts valid bearer, returns rate-limit headers
//   F · scope enforcement: chat:read-only key can't POST /public/v1/chat (403)
//   G · rate limit fires after N calls on free tier · 429 + Retry-After header
//   H · revoke returns ok · subsequent bearer call → 401
//   I · rotate returns new raw_token · old token → 401 · new token → 200
//   J · unauthenticated /api/nex/keys → 401
//   K · request_count increments per resolve

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
  header() { return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; "); }
}

async function jf(jar, pth, opts = {}) {
  const headers = new Headers(opts.headers ?? {});
  if (jar.header()) headers.set("cookie", jar.header());
  const res = await fetch(`${HOST}${pth}`, { ...opts, headers });
  jar.addFromResponse(res);
  const text = await res.text();
  let body = null; try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, text, body, headers: res.headers };
}

async function bearer(token, pth, opts = {}) {
  const headers = new Headers(opts.headers ?? {});
  if (token) headers.set("authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  const res = await fetch(`${HOST}${pth}`, { ...opts, headers });
  const text = await res.text();
  let body = null; try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, text, body, headers: res.headers };
}

// ══ A · signup + issue key
console.log("\n══ A · signup + issue key returns raw_token nex_live_...");
const jar = new CookieJar();
let rawToken, apiKeyId;
{
  const s = await jf(jar, "/api/nex/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: `p14-${randomUUID().slice(0, 6)}` }),
  });
  if (s.status !== 200) failures.push({ case: "A", reason: `signup_${s.status}` });

  const k = await jf(jar, "/api/nex/keys", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "smoke-test-key", tier: "free" }),
  });
  console.log(`  status=${k.status} raw=${k.body?.raw_token?.slice(0, 16)}… id=${k.body?.api_key_id?.slice(0, 8)}`);
  if (k.status !== 200) failures.push({ case: "A", reason: `issue_${k.status}` });
  rawToken = k.body?.raw_token;
  apiKeyId = k.body?.api_key_id;
  if (!rawToken?.startsWith("nex_live_")) failures.push({ case: "A", reason: `bad_prefix_${rawToken?.slice(0, 10)}` });
  if (!k.body?.warning) failures.push({ case: "A", reason: "no_warning" });
}

// ══ B · list shows key by prefix · not raw
console.log("\n══ B · list keys shows prefix, not raw_token");
{
  const r = await jf(jar, "/api/nex/keys");
  const keys = r.body?.keys ?? [];
  const ours = keys.find((k) => k.api_key_id === apiKeyId);
  console.log(`  count=${keys.length} prefix=${ours?.token_prefix} has_raw=${JSON.stringify(ours).includes("nex_live_")}`);
  if (!ours) failures.push({ case: "B", reason: "not_in_list" });
  if (ours?.token_prefix !== rawToken.slice(0, 12)) failures.push({ case: "B", reason: `prefix_mismatch_${ours?.token_prefix}` });
  const listStr = JSON.stringify(r.body);
  if (listStr.includes(rawToken)) failures.push({ case: "B", reason: "list_leaked_full_token" });
}

// ══ C · missing bearer → 401
console.log("\n══ C · missing bearer → 401");
{
  const r = await bearer(null, "/api/nex/public/v1/chat", {
    method: "POST", body: JSON.stringify({ message: "hi" }),
  });
  console.log(`  status=${r.status} err=${r.body?.error}`);
  if (r.status !== 401) failures.push({ case: "C", reason: `status_${r.status}` });
}

// ══ D · garbage bearer → 401
console.log("\n══ D · garbage bearer → 401");
{
  const r = await bearer("nex_live_deadbeef", "/api/nex/public/v1/chat", {
    method: "POST", body: JSON.stringify({ message: "hi" }),
  });
  console.log(`  status=${r.status}`);
  if (r.status !== 401) failures.push({ case: "D", reason: `status_${r.status}` });
}

// ══ E · valid bearer + rate-limit headers
console.log("\n══ E · valid bearer accepted · rate-limit headers present");
{
  const r = await bearer(rawToken, "/api/nex/public/v1/chat", {
    method: "POST", body: JSON.stringify({ message: "hello" }),
  });
  const lim = r.headers.get("x-ratelimit-limit");
  const rem = r.headers.get("x-ratelimit-remaining");
  console.log(`  status=${r.status} limit=${lim} remaining=${rem} reply=${String(r.body?.reply ?? "").slice(0, 40)}`);
  if (r.status !== 200 && r.status !== 502) failures.push({ case: "E", reason: `status_${r.status}` });
  if (!lim) failures.push({ case: "E", reason: "no_limit_header" });
  if (!rem) failures.push({ case: "E", reason: "no_remaining_header" });
}

// ══ F · scope enforcement · read-only key rejected on chat:write
console.log("\n══ F · read-only key cannot POST chat (403)");
let readOnlyToken;
{
  const k = await jf(jar, "/api/nex/keys", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "read-only", tier: "free", scopes: ["chat:read"] }),
  });
  readOnlyToken = k.body?.raw_token;
  const r = await bearer(readOnlyToken, "/api/nex/public/v1/chat", {
    method: "POST", body: JSON.stringify({ message: "hi" }),
  });
  console.log(`  status=${r.status} err=${r.body?.error}`);
  if (r.status !== 403) failures.push({ case: "F", reason: `status_${r.status}` });
  if (!String(r.body?.error ?? "").includes("chat:write")) failures.push({ case: "F", reason: "no_scope_hint" });
}

// ══ G · rate-limit fires on free tier (20 rpm)
console.log("\n══ G · rate limit fires + Retry-After header");
{
  // Fire 25 in parallel · at least the last 5 must 429.
  const bursts = await Promise.all(
    Array.from({ length: 25 }, () =>
      bearer(rawToken, "/api/nex/public/v1/chat", {
        method: "POST", body: JSON.stringify({ message: "burst" }),
      }),
    ),
  );
  const four29 = bursts.filter((r) => r.status === 429);
  const hasRetryAfter = four29.some((r) => r.headers.get("retry-after"));
  console.log(`  429_count=${four29.length}/25 has_retry_after=${hasRetryAfter}`);
  if (four29.length < 4) failures.push({ case: "G", reason: `only_${four29.length}_429s` });
  if (four29.length > 0 && !hasRetryAfter) failures.push({ case: "G", reason: "no_retry_after" });
}

// ══ H · revoke → subsequent call 401
console.log("\n══ H · revoke → subsequent call 401");
{
  const del = await jf(jar, `/api/nex/keys/${apiKeyId}`, { method: "DELETE" });
  console.log(`  del.status=${del.status} ok=${del.body?.ok}`);
  if (del.status !== 200) failures.push({ case: "H", reason: `del_${del.status}` });
  const r = await bearer(rawToken, "/api/nex/public/v1/chat", {
    method: "POST", body: JSON.stringify({ message: "post-revoke" }),
  });
  console.log(`  post-revoke.status=${r.status}`);
  if (r.status !== 401) failures.push({ case: "H", reason: `post_revoke_${r.status}` });
}

// ══ I · rotate returns new token · old rejected · new accepted
console.log("\n══ I · rotate: old rejected, new accepted");
{
  // Issue a fresh key with pro tier so we don't hit the rate limit.
  const fresh = await jf(jar, "/api/nex/keys", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "rotate-target", tier: "pro" }),
  });
  const oldToken = fresh.body?.raw_token;
  const id = fresh.body?.api_key_id;
  const rot = await jf(jar, `/api/nex/keys/${id}`, { method: "POST" });
  const newToken = rot.body?.raw_token;
  console.log(`  old=${oldToken?.slice(0, 12)}… new=${newToken?.slice(0, 12)}… same=${oldToken === newToken}`);
  if (!newToken?.startsWith("nex_live_")) failures.push({ case: "I", reason: "no_new_token" });
  if (oldToken === newToken) failures.push({ case: "I", reason: "same_token_after_rotate" });
  const rOld = await bearer(oldToken, "/api/nex/public/v1/chat", { method: "POST", body: JSON.stringify({ message: "old" }) });
  const rNew = await bearer(newToken, "/api/nex/public/v1/chat", { method: "POST", body: JSON.stringify({ message: "new" }) });
  console.log(`  old.status=${rOld.status} new.status=${rNew.status}`);
  if (rOld.status !== 401) failures.push({ case: "I", reason: `old_still_${rOld.status}` });
  if (rNew.status !== 200 && rNew.status !== 502) failures.push({ case: "I", reason: `new_${rNew.status}` });
}

// ══ J · unauthenticated /api/nex/keys → 401
console.log("\n══ J · unauthenticated /api/nex/keys → 401");
{
  const r = await fetch(`${HOST}/api/nex/keys`);
  console.log(`  status=${r.status}`);
  if (r.status !== 401) failures.push({ case: "J", reason: `status_${r.status}` });
}

// ══ K · request_count increments per resolve
console.log("\n══ K · request_count increments after use");
{
  // Fresh key so we can measure delta cleanly.
  const fresh = await jf(jar, "/api/nex/keys", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "counter-test", tier: "enterprise" }),
  });
  const tk = fresh.body?.raw_token;
  const id = fresh.body?.api_key_id;
  // Call twice.
  await bearer(tk, "/api/nex/public/v1/chat", { method: "POST", body: JSON.stringify({ message: "one" }) });
  await bearer(tk, "/api/nex/public/v1/chat", { method: "POST", body: JSON.stringify({ message: "two" }) });
  // Small delay for fire-and-forget UPDATE to land.
  await new Promise((r) => setTimeout(r, 250));
  const list = await jf(jar, "/api/nex/keys");
  const row = (list.body?.keys ?? []).find((k) => k.api_key_id === id);
  const count = Number(row?.request_count ?? 0);
  console.log(`  request_count=${count} last_used_at=${row?.last_used_at ? "set" : "null"}`);
  if (count < 2) failures.push({ case: "K", reason: `count_${count}` });
  if (!row?.last_used_at) failures.push({ case: "K", reason: "no_last_used_at" });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · API platform live · bearer + scopes + rate limit + rotation.");
  process.exit(0);
}
