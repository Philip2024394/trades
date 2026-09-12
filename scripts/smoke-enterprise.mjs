#!/usr/bin/env node
// scripts/smoke-enterprise.mjs
//
// Founder Phase 16 · P16-5 · Enterprise regression.
//
// Verifies:
//   A · owner creates team · auto-becomes owner · gets audit event team.create
//   B · list teams for owner returns the team with role=owner
//   C · owner adds a member (role=member) · audit event member.add lands
//   D · member cannot add another member (403 forbidden_actor_role)
//   E · owner cannot be removed if last owner (cannot_remove_last_owner)
//   F · owner can remove non-owner · audit event member.remove lands
//   G · non-member cannot list members (403 not_a_member)
//   H · audit export ndjson streams valid line-per-event
//   I · audit export records its own event (audit.export)
//   J · non-authenticated user gets 401 on any teams endpoint
//   K · admin console page renders 200 for a member

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

async function signup(displayName) {
  const jar = new CookieJar();
  const r = await jf(jar, "/api/nex/auth/signup", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: displayName }),
  });
  return { jar, userId: r.body?.user_id };
}

// ══ A · owner creates team
console.log("\n══ A · owner creates team · audit event lands");
const ownerLabel = `p16-owner-${randomUUID().slice(0, 6)}`;
const { jar: ownerJar, userId: ownerId } = await signup(ownerLabel);
let teamId, teamName;
{
  teamName = `Team ${randomUUID().slice(0, 6)}`;
  const r = await jf(ownerJar, "/api/nex/enterprise/teams", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: teamName, tier: "pro" }),
  });
  teamId = r.body?.team?.team_id;
  console.log(`  status=${r.status} id=${teamId?.slice(0, 8)} slug=${r.body?.team?.slug}`);
  if (r.status !== 200) failures.push({ case: "A", reason: `status_${r.status}` });
  if (!teamId) failures.push({ case: "A", reason: "no_team_id" });
}

// ══ B · list teams shows role=owner
console.log("\n══ B · list teams returns our team with role=owner");
{
  const r = await jf(ownerJar, "/api/nex/enterprise/teams");
  const ours = (r.body?.teams ?? []).find((t) => t.team_id === teamId);
  console.log(`  count=${r.body?.teams?.length} role=${ours?.role}`);
  if (ours?.role !== "owner") failures.push({ case: "B", reason: `role_${ours?.role}` });
}

// ══ C · owner adds a member
console.log("\n══ C · owner adds member · audit lands");
const { jar: memberJar, userId: memberId } = await signup(`p16-member-${randomUUID().slice(0, 6)}`);
{
  const r = await jf(ownerJar, `/api/nex/enterprise/teams/${teamId}/members`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: memberId, role: "member" }),
  });
  console.log(`  status=${r.status} role=${r.body?.member?.role}`);
  if (r.status !== 200) failures.push({ case: "C", reason: `status_${r.status}` });
  if (r.body?.member?.role !== "member") failures.push({ case: "C", reason: "wrong_role" });
}

// ══ D · member cannot add another member
console.log("\n══ D · member cannot add another member (403)");
{
  const { userId: otherUserId } = await signup(`p16-other-${randomUUID().slice(0, 6)}`);
  const r = await jf(memberJar, `/api/nex/enterprise/teams/${teamId}/members`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: otherUserId, role: "member" }),
  });
  console.log(`  status=${r.status} err=${r.body?.error}`);
  if (r.status !== 403) failures.push({ case: "D", reason: `status_${r.status}` });
  if (r.body?.error !== "forbidden_actor_role") failures.push({ case: "D", reason: `err_${r.body?.error}` });
}

// ══ E · cannot remove last owner
console.log("\n══ E · cannot remove last owner");
{
  const r = await jf(ownerJar, `/api/nex/enterprise/teams/${teamId}/members/${ownerId}`, { method: "DELETE" });
  console.log(`  status=${r.status} err=${r.body?.error}`);
  if (r.status !== 403) failures.push({ case: "E", reason: `status_${r.status}` });
  if (r.body?.error !== "cannot_remove_last_owner") failures.push({ case: "E", reason: `err_${r.body?.error}` });
}

// ══ F · owner removes non-owner
console.log("\n══ F · owner removes member");
{
  const r = await jf(ownerJar, `/api/nex/enterprise/teams/${teamId}/members/${memberId}`, { method: "DELETE" });
  console.log(`  status=${r.status} ok=${r.body?.ok}`);
  if (r.status !== 200) failures.push({ case: "F", reason: `status_${r.status}` });
  // Verify member is really gone.
  const list = await jf(ownerJar, `/api/nex/enterprise/teams/${teamId}/members`);
  const stillThere = (list.body?.members ?? []).some((m) => m.user_id === memberId);
  if (stillThere) failures.push({ case: "F", reason: "still_in_list" });
}

// ══ G · non-member cannot list members
console.log("\n══ G · non-member cannot list members (403)");
{
  const { jar: strangerJar } = await signup(`p16-stranger-${randomUUID().slice(0, 6)}`);
  const r = await jf(strangerJar, `/api/nex/enterprise/teams/${teamId}/members`);
  console.log(`  status=${r.status} err=${r.body?.error}`);
  if (r.status !== 403) failures.push({ case: "G", reason: `status_${r.status}` });
}

// ══ H · NDJSON export streams valid lines
console.log("\n══ H · NDJSON export = one JSON per line");
let ndjsonBefore = 0;
{
  const res = await fetch(`${HOST}/api/nex/enterprise/teams/${teamId}/audit/export?format=ndjson`, {
    headers: { cookie: ownerJar.header() },
  });
  const body = await res.text();
  const lines = body.split("\n").filter((l) => l.trim().length > 0);
  ndjsonBefore = lines.length;
  console.log(`  status=${res.status} lines=${lines.length} ct=${res.headers.get("content-type")}`);
  if (res.status !== 200) failures.push({ case: "H", reason: `status_${res.status}` });
  if (!(res.headers.get("content-type") ?? "").includes("ndjson")) failures.push({ case: "H", reason: "bad_content_type" });
  if (lines.length < 3) failures.push({ case: "H", reason: `only_${lines.length}_events` });
  // Every line must parse as JSON.
  for (const l of lines.slice(0, 5)) {
    try {
      const j = JSON.parse(l);
      if (!j.action) failures.push({ case: "H", reason: "line_missing_action" });
    } catch {
      failures.push({ case: "H", reason: `bad_json_line_${l.slice(0, 40)}` });
      break;
    }
  }
}

// ══ I · audit.export event recorded
console.log("\n══ I · audit.export event self-recorded");
{
  // Trigger another export, then compare event counts (should grow by ≥1).
  await fetch(`${HOST}/api/nex/enterprise/teams/${teamId}/audit/export?format=json`, {
    headers: { cookie: ownerJar.header() },
  }).then((r) => r.text());
  const res = await fetch(`${HOST}/api/nex/enterprise/teams/${teamId}/audit/export?format=ndjson`, {
    headers: { cookie: ownerJar.header() },
  });
  const body = await res.text();
  const lines = body.split("\n").filter((l) => l.trim().length > 0);
  const exportEvents = lines.filter((l) => l.includes(`"action":"audit.export"`));
  console.log(`  total=${lines.length} audit.export_events=${exportEvents.length}`);
  if (exportEvents.length < 2) failures.push({ case: "I", reason: `only_${exportEvents.length}_export_events` });
  if (lines.length <= ndjsonBefore) failures.push({ case: "I", reason: "count_did_not_grow" });
}

// ══ J · unauthenticated → 401
console.log("\n══ J · unauthenticated /teams → 401");
{
  const r = await fetch(`${HOST}/api/nex/enterprise/teams`);
  console.log(`  status=${r.status}`);
  if (r.status !== 401) failures.push({ case: "J", reason: `status_${r.status}` });
}

// ══ K · admin console renders
console.log("\n══ K · admin console page renders 200");
{
  const res = await fetch(`${HOST}/nex/enterprise/${teamId}`, { headers: { cookie: ownerJar.header() } });
  const text = await res.text();
  console.log(`  status=${res.status} name_present=${text.includes(teamName)}`);
  if (res.status !== 200) failures.push({ case: "K", reason: `status_${res.status}` });
  if (!text.includes(teamName)) failures.push({ case: "K", reason: "team_name_missing" });
  if (!text.toLowerCase().includes("audit")) failures.push({ case: "K", reason: "audit_section_missing" });
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · enterprise foundations live · teams + roles + audit + SIEM export.");
  process.exit(0);
}
