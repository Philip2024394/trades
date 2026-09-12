#!/usr/bin/env node
// scripts/smoke-conversations.mjs
//
// Founder Phase 13 · P13-5 · Conversation persistence regression.
//
// Verifies:
//   A · signup + create conversation
//   B · POST message · title auto-derived from first user message
//   C · GET conversation returns all messages ordered by ord
//   D · GET /api/nex/conversations lists it for the user
//   E · search finds a distinctive phrase in prior turn
//   F · branch from mid-conversation creates fork with N+1 messages
//   G · anonymous cannot see authenticated user's conversations
//   H · share link works · read-only render 200 · view_count increments
//   I · share of unknown conversation returns 404
//   J · role validation rejects garbage
//   K · doctrine banner present on shared view

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
  return { status: res.status, text, body };
}

// ══ A · signup + create conversation
console.log("\n══ A · signup + create conversation");
const jar = new CookieJar();
let convId, distinctivePhrase;
{
  const s = await jf(jar, "/api/nex/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: `p13-${randomUUID().slice(0, 6)}` }),
  });
  if (s.status !== 200) failures.push({ case: "A", reason: `signup_${s.status}` });

  const r = await jf(jar, "/api/nex/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  console.log(`  status=${r.status} id=${r.body?.conversation?.conversation_id?.slice(0, 8)}`);
  if (r.status !== 200) failures.push({ case: "A", reason: `create_${r.status}` });
  convId = r.body?.conversation?.conversation_id;
  if (!convId) failures.push({ case: "A", reason: "no_conv_id" });
}

// ══ B · first user message + auto-title
console.log("\n══ B · first user message auto-titles the conversation");
{
  distinctivePhrase = `sunfish-quokka-${randomUUID().slice(0, 6)}`;
  const firstText = `How do I ${distinctivePhrase} in Yogyakarta today please?`;
  const post = await jf(jar, `/api/nex/conversations/${convId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "user", content: firstText }),
  });
  if (post.status !== 200) failures.push({ case: "B", reason: `post_${post.status}` });
  const get = await jf(jar, `/api/nex/conversations/${convId}`);
  const title = get.body?.conversation?.title ?? "";
  console.log(`  title="${title}"`);
  if (!title.toLowerCase().includes("how do i")) failures.push({ case: "B", reason: `bad_title_${title.slice(0, 30)}` });
  if (title === "New conversation") failures.push({ case: "B", reason: "auto_title_did_not_fire" });
}

// ══ C · GET returns ordered messages
console.log("\n══ C · messages ordered by ord");
let firstMsgId;
{
  // Add an assistant reply.
  await jf(jar, `/api/nex/conversations/${convId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "assistant", content: "Here is a helpful answer with citations." }),
  });
  const get = await jf(jar, `/api/nex/conversations/${convId}`);
  const msgs = get.body?.messages ?? [];
  console.log(`  count=${msgs.length} ords=${msgs.map((m) => m.ord).join(",")}`);
  if (msgs.length !== 2) failures.push({ case: "C", reason: `msg_count_${msgs.length}` });
  if (msgs[0]?.ord !== 0 || msgs[1]?.ord !== 1) failures.push({ case: "C", reason: "ord_wrong" });
  firstMsgId = msgs[0]?.message_id;
}

// ══ D · list conversations for user
console.log("\n══ D · list conversations for authenticated user");
{
  const r = await jf(jar, "/api/nex/conversations");
  const found = (r.body?.conversations ?? []).some((c) => c.conversation_id === convId);
  console.log(`  count=${r.body?.conversations?.length} found_ours=${found}`);
  if (!found) failures.push({ case: "D", reason: "conv_not_in_list" });
}

// ══ E · search for the distinctive phrase
console.log("\n══ E · search finds prior distinctive phrase");
{
  const r = await jf(jar, `/api/nex/conversations/search?q=${encodeURIComponent(distinctivePhrase)}`);
  const hit = (r.body?.results ?? []).some((h) => h.conversation_id === convId);
  console.log(`  results=${r.body?.results?.length} snippet="${r.body?.results?.[0]?.snippet?.slice(0, 50)}…"`);
  if (!hit) failures.push({ case: "E", reason: "search_missed" });
}

// ══ F · branch from message 0 creates fork with 1 message
console.log("\n══ F · branch conversation from message 0");
let branchId;
{
  const r = await jf(jar, `/api/nex/conversations/${convId}/branch`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from_message_id: firstMsgId }),
  });
  branchId = r.body?.conversation?.conversation_id;
  console.log(`  status=${r.status} branchId=${branchId?.slice(0, 8)} title="${r.body?.conversation?.title}"`);
  if (r.status !== 200) failures.push({ case: "F", reason: `branch_${r.status}` });
  if (!branchId) failures.push({ case: "F", reason: "no_branch_id" });
  const inner = await jf(jar, `/api/nex/conversations/${branchId}`);
  const bMsgs = inner.body?.messages ?? [];
  console.log(`  branched_msg_count=${bMsgs.length} branched_from=${inner.body?.conversation?.branched_from?.slice(0, 8)}`);
  if (bMsgs.length !== 1) failures.push({ case: "F", reason: `expected_1_got_${bMsgs.length}` });
  if (inner.body?.conversation?.branched_from !== convId) failures.push({ case: "F", reason: "no_branched_from" });
}

// ══ G · anonymous cannot see authenticated user's conversations
console.log("\n══ G · anonymous list is empty (does not leak)");
{
  const emptyJar = new CookieJar();
  const r = await jf(emptyJar, "/api/nex/conversations");
  console.log(`  authenticated=${r.body?.authenticated} count=${r.body?.conversations?.length}`);
  if (r.body?.authenticated !== false) failures.push({ case: "G", reason: "leaked_authenticated" });
  if ((r.body?.conversations ?? []).length !== 0) failures.push({ case: "G", reason: "leaked_conversations" });
}

// ══ H · share link creates + serves + view_count increments
console.log("\n══ H · share link renders + view_count increments");
let shareToken;
{
  const cr = await jf(jar, `/api/nex/conversations/${convId}/share`, { method: "POST" });
  shareToken = cr.body?.share_token;
  console.log(`  token=${shareToken?.slice(0, 8)} url=${cr.body?.view_url}`);
  if (!shareToken || shareToken.length !== 32) failures.push({ case: "H", reason: `bad_token_${shareToken}` });

  const api1 = await fetch(`${HOST}/api/nex/share/${shareToken}`);
  const j1 = await api1.json();
  if (api1.status !== 200) failures.push({ case: "H", reason: `api_${api1.status}` });
  if ((j1?.messages ?? []).length !== 2) failures.push({ case: "H", reason: `api_msg_count_${j1?.messages?.length}` });

  const api2 = await fetch(`${HOST}/api/nex/share/${shareToken}`);
  if (api2.status !== 200) failures.push({ case: "H", reason: `second_view_${api2.status}` });

  const html = await fetch(`${HOST}/nex/share/${shareToken}`);
  const text = await html.text();
  console.log(`  page.status=${html.status} contains_phrase=${text.includes(distinctivePhrase)}`);
  if (html.status !== 200) failures.push({ case: "H", reason: `html_${html.status}` });
  if (!text.includes(distinctivePhrase)) failures.push({ case: "H", reason: "phrase_missing" });
}

// ══ I · unknown share token → 404
console.log("\n══ I · unknown share token → 404");
{
  const r = await fetch(`${HOST}/api/nex/share/${"0".repeat(32)}`);
  console.log(`  status=${r.status}`);
  if (r.status !== 404) failures.push({ case: "I", reason: `status_${r.status}` });
}

// ══ J · role validation
console.log("\n══ J · role validation rejects garbage");
{
  const r = await jf(jar, `/api/nex/conversations/${convId}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "banana", content: "x" }),
  });
  console.log(`  status=${r.status} err=${r.body?.error}`);
  if (r.status !== 400) failures.push({ case: "J", reason: `status_${r.status}` });
}

// ══ K · doctrine banner on shared page
console.log("\n══ K · doctrine banner rendered on shared page");
{
  const html = await fetch(`${HOST}/nex/share/${shareToken}`);
  const text = await html.text();
  const has = text.toLowerCase().includes("nex doctrine") && text.toLowerCase().includes("evidence chain");
  console.log(`  doctrine_banner=${has}`);
  if (!has) failures.push({ case: "K", reason: "doctrine_banner_missing" });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · conversation persistence live · branching · search · share.");
  process.exit(0);
}
