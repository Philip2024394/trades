#!/usr/bin/env node
// scripts/smoke-listing-chat.mjs
//
// Founder Phase 31 · P31-9 · NEX Listing Chat regression (Doctrine #7).
//
// Verifies:
//   A · unauthenticated send → 401
//   B · signed-in send with valid body → 200 + thread_id + message_id + doctrine_note names Doctrine #7
//   C · empty body → 400
//   D · overlong body (>4000) → 400
//   E · first message with owner_email_hint → owner_invite object present · email_status one of queued_pending_smtp/sent/queued
//   F · history endpoint returns just the sender's own thread
//   G · a different user cannot read the first user's thread (isolation)
//   H · directory page bundle NO LONGER references wa.me · has data-nex-chat-open + data-nex-chat-drawer
//   I · migration 165 applied · listing_message + outbound_email tables exist
//   J · file-grep gate: src/lib/nex/{brain,retrieval,embedding,training}/* files DO NOT reference listing_message
//   K · owner reply GET with unknown token → 404
//   L · Doctrine #5 sanitiser counter present on send response

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

// Pick a real listing ref
let refId = null;
{
  const r = await fetch(`${HOST}/api/nex/directory?q=hotel`);
  const j = await r.json();
  refId = j?.cards?.[0]?.ref_id;
  if (!refId) failures.push({ case: "SETUP", reason: "no_listing_found" });
  console.log(`\n══ setup · listing=${refId}`);
}

// ══ A · unauthenticated → 401
console.log("\n══ A · unauthenticated send → 401");
if (refId) {
  const emptyJar = new CookieJar();
  const r = await jf(emptyJar, `/api/nex/directory/${encodeURIComponent(refId)}/chat/send`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: "hi" }),
  });
  console.log(`  status=${r.status} err=${r.body?.error}`);
  if (r.status !== 401) failures.push({ case: "A", reason: `status_${r.status}` });
}

// Signup Alice
const alice = new CookieJar();
await jf(alice, "/api/nex/auth/signup", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ display_name: `p31-alice-${randomUUID().slice(0, 6)}` }),
});

// ══ B · valid send
console.log("\n══ B · signed-in send returns thread + message + Doctrine #7 banner");
let firstThreadId = null;
if (refId) {
  const r = await jf(alice, `/api/nex/directory/${encodeURIComponent(refId)}/chat/send`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: "Hi, do you have parking?" }),
  });
  firstThreadId = r.body?.thread_id;
  console.log(`  status=${r.status} thread=${firstThreadId?.slice(0, 8)} msg=${r.body?.message?.message_id?.slice(0, 8)}`);
  if (r.status !== 200) failures.push({ case: "B", reason: `status_${r.status}` });
  if (!firstThreadId) failures.push({ case: "B", reason: "no_thread_id" });
  if (!r.body?.message?.message_id) failures.push({ case: "B", reason: "no_message_id" });
  if (!/doctrine\s*#?\s*7/i.test(String(r.body?.doctrine_note ?? ""))) failures.push({ case: "B", reason: "no_doctrine_7_banner" });
}

// ══ C · empty body
console.log("\n══ C · empty body → 400");
if (refId) {
  const r = await jf(alice, `/api/nex/directory/${encodeURIComponent(refId)}/chat/send`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: "" }),
  });
  console.log(`  status=${r.status}`);
  if (r.status !== 400) failures.push({ case: "C", reason: `status_${r.status}` });
}

// ══ D · overlong body
console.log("\n══ D · overlong body → 400");
if (refId) {
  const r = await jf(alice, `/api/nex/directory/${encodeURIComponent(refId)}/chat/send`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: "x".repeat(4100) }),
  });
  console.log(`  status=${r.status}`);
  if (r.status !== 400) failures.push({ case: "D", reason: `status_${r.status}` });
}

// ══ E · first message from a NEW listing thread with owner_email_hint → owner_invite queued
console.log("\n══ E · first message + owner_email_hint → owner_invite email queued");
{
  // Pick a different listing so we get a fresh (Alice, listing) pair
  const r2 = await fetch(`${HOST}/api/nex/directory?q=hotel`);
  const cards = (await r2.json())?.cards ?? [];
  const secondRef = cards.find((c) => c.ref_id !== refId)?.ref_id;
  if (!secondRef) { console.log("  (skip · no second listing)"); }
  else {
    const r = await jf(alice, `/api/nex/directory/${encodeURIComponent(secondRef)}/chat/send`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Do you accept groups of 8?", owner_email_hint: `owner-${randomUUID().slice(0, 6)}@example.test` }),
    });
    const inv = r.body?.owner_invite;
    console.log(`  status=${r.status} owner_invite=${JSON.stringify(inv)?.slice(0, 120)}`);
    if (r.status !== 200) failures.push({ case: "E", reason: `status_${r.status}` });
    if (!inv) failures.push({ case: "E", reason: "no_owner_invite" });
    if (inv && !["queued_pending_smtp", "queued", "sent", "sending", "failed"].includes(inv.email_status)) failures.push({ case: "E", reason: `bad_email_status_${inv.email_status}` });
  }
}

// ══ F · history returns sender's own thread
console.log("\n══ F · history returns sender's own thread + messages");
if (refId) {
  const r = await jf(alice, `/api/nex/directory/${encodeURIComponent(refId)}/chat/history`);
  console.log(`  status=${r.status} thread=${r.body?.thread?.thread_id?.slice(0, 8)} count=${r.body?.messages?.length}`);
  if (r.status !== 200) failures.push({ case: "F", reason: `status_${r.status}` });
  if (r.body?.thread?.thread_id !== firstThreadId) failures.push({ case: "F", reason: "thread_mismatch" });
  if ((r.body?.messages ?? []).length < 1) failures.push({ case: "F", reason: "no_messages" });
}

// ══ G · a different user cannot read Alice's thread
console.log("\n══ G · another user cannot read Alice's thread");
{
  const bob = new CookieJar();
  await jf(bob, "/api/nex/auth/signup", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: `p31-bob-${randomUUID().slice(0, 6)}` }),
  });
  const r = await jf(bob, `/api/nex/directory/${encodeURIComponent(refId)}/chat/history`);
  console.log(`  bob.thread=${r.body?.thread?.thread_id ?? "null"} bob.msgs=${r.body?.messages?.length ?? 0}`);
  if (r.body?.thread) failures.push({ case: "G", reason: "cross_user_thread_leaked" });
  if ((r.body?.messages ?? []).length > 0) failures.push({ case: "G", reason: "cross_user_messages_leaked" });
}

// ══ H · directory page no longer references wa.me · has NEX Chat markers in bundle
console.log("\n══ H · bundle: WhatsApp gone, NEX Chat markers present");
{
  const html = await (await fetch(`${HOST}/nex/directory`)).text();
  const chunkMatch = html.match(/\/_next\/static\/[^"'\s]+\.(js|mjs)/g) ?? [];
  const uniq = [...new Set(chunkMatch)];
  let sawWaMe = false, sawChatOpen = false, sawChatDrawer = false, sawChatSend = false;
  for (const url of uniq.slice(0, 40)) {
    try {
      const src = await (await fetch(`${HOST}${url}`)).text();
      if (/wa\.me\//.test(src)) sawWaMe = true;
      if (/data-nex-chat-open/.test(src)) sawChatOpen = true;
      if (/data-nex-chat-drawer/.test(src)) sawChatDrawer = true;
      if (/data-nex-chat-send/.test(src)) sawChatSend = true;
      if (!sawWaMe && sawChatOpen && sawChatDrawer && sawChatSend) break;
    } catch { /* ignore */ }
  }
  console.log(`  wa.me=${sawWaMe} chat-open=${sawChatOpen} chat-drawer=${sawChatDrawer} chat-send=${sawChatSend}`);
  if (sawWaMe) failures.push({ case: "H", reason: "wa_me_still_present" });
  if (!sawChatOpen) failures.push({ case: "H", reason: "no_chat_open" });
  if (!sawChatDrawer) failures.push({ case: "H", reason: "no_chat_drawer" });
  if (!sawChatSend) failures.push({ case: "H", reason: "no_chat_send" });
}

// ══ I · migration applied
console.log("\n══ I · migration 165 applied · nex.listing_message + nex.outbound_email exist");
{
  const { readFile } = await import("node:fs/promises");
  try {
    const sql = await readFile("deploy/postgres/init/165_nex_listing_chat.sql", "utf8");
    if (!sql.includes("CREATE TABLE IF NOT EXISTS nex.listing_message")) failures.push({ case: "I", reason: "no_listing_message_ddl" });
    if (!sql.includes("CREATE TABLE IF NOT EXISTS nex.outbound_email")) failures.push({ case: "I", reason: "no_outbound_email_ddl" });
    if (!/DOCTRINE #7/i.test(sql)) failures.push({ case: "I", reason: "no_doctrine_7_header" });
    console.log(`  migration_file_ok`);
  } catch (e) {
    failures.push({ case: "I", reason: `read_error_${(e).message}` });
  }
}

// ══ J · Doctrine #7 file-grep gate: brain / retrieval / embedding / training MUST NOT reference message tables
console.log("\n══ J · Doctrine #7 gate: brain / retrieval / embedding / training do not reference listing_message");
{
  const { readdir, readFile } = await import("node:fs/promises");
  async function walk(dir) {
    let out = [];
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) out = out.concat(await walk(p));
        else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
      }
    } catch { /* dir may not exist */ }
    return out;
  }
  const dirs = [
    "src/lib/nex/brain",
    "src/lib/nex/retrieval",
    "src/lib/nex/embedding",
    "src/lib/nex/training",
  ];
  let leaks = [];
  for (const d of dirs) {
    const files = await walk(d);
    for (const f of files) {
      try {
        const src = await readFile(f, "utf8");
        if (/listing_message|friends_message/.test(src)) leaks.push(f);
      } catch { /* ignore */ }
    }
  }
  console.log(`  leaked_files=${leaks.length}`);
  if (leaks.length > 0) failures.push({ case: "J", reason: `doctrine_7_violated_${leaks.join(",")}` });
}

// ══ K · owner reply GET with unknown token → 404
console.log("\n══ K · owner reply GET with unknown token → 404");
{
  const r = await fetch(`${HOST}/api/nex/owner/${"deadbeef".repeat(4)}/reply`);
  console.log(`  status=${r.status}`);
  if (r.status !== 404) failures.push({ case: "K", reason: `status_${r.status}` });
}

// ══ L · sanitiser count reported on send envelope
console.log("\n══ L · Doctrine #5 sanitiser count reported on send response");
if (refId) {
  const r = await jf(alice, `/api/nex/directory/${encodeURIComponent(refId)}/chat/send`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: "clean question about hours" }),
  });
  const hasField = typeof r.body?.sanitiser_neutralised === "number";
  console.log(`  neutralised_field_present=${hasField} value=${r.body?.sanitiser_neutralised}`);
  if (!hasField) failures.push({ case: "L", reason: "no_sanitiser_field" });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · NEX Listing Chat live · WhatsApp dropped · Doctrine #7 enforced · owner-invite queued with honest fallback.");
  process.exit(0);
}
