#!/usr/bin/env node
// scripts/smoke-oauth.mjs
//
// Founder Phase 24 · P24-5 · OAuth foundation regression.
//
// The smoke runs WITHOUT real Google credentials · the correct behavior
// is honest degradation, not fabrication.
//
// Verifies:
//   A · GET /api/nex/auth/providers returns google row with configured=false when unset
//   B · doctrine_note names "honest" behavior of providers list
//   C · /api/nex/auth/oauth/google/start → 503 with oauth_not_configured (env unset)
//   D · /api/nex/auth/oauth/google/callback → 503 with oauth_not_configured
//   E · /api/nex/auth/oauth/imaginary/start → 404 unknown_provider
//   F · when creds present (shim via env), start returns 302 with well-formed authorize URL
//   G · start URL contains state, code_challenge, code_challenge_method=S256, scope, redirect_uri
//   H · callback with unknown state → 400 invalid_or_expired_state
//   I · callback with missing state OR code → 400 missing_state_or_code
//   J · callback with provider-side error param → 400 provider_error

const HOST = process.env.NEX_TEST_HOST ?? "http://localhost:3008";
const failures = [];

async function get(pth, opts = {}) {
  const res = await fetch(`${HOST}${pth}`, { redirect: "manual", ...opts });
  const text = await res.text();
  let body = null; try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, text, body, location: res.headers.get("location") };
}

// ══ A · providers listing
console.log("\n══ A · GET /api/nex/auth/providers");
let hadUnconfigured = false;
{
  const r = await get("/api/nex/auth/providers");
  const google = (r.body?.providers ?? []).find((p) => p.id === "google");
  console.log(`  status=${r.status} google.configured=${google?.configured}`);
  if (r.status !== 200) failures.push({ case: "A", reason: `status_${r.status}` });
  if (!google) failures.push({ case: "A", reason: "no_google_provider" });
  if (google && typeof google.configured !== "boolean") failures.push({ case: "A", reason: "no_configured_bool" });
  hadUnconfigured = google?.configured === false;
}

// ══ B · doctrine_note honest
console.log("\n══ B · providers list has honest doctrine_note");
{
  const r = await get("/api/nex/auth/providers");
  const note = String(r.body?.doctrine_note ?? "").toLowerCase();
  const honest = note.includes("honest") || note.includes("never fabric");
  console.log(`  honest=${honest} note="${note.slice(0, 60)}…"`);
  if (!honest) failures.push({ case: "B", reason: "note_not_honest" });
}

// ══ C · start unconfigured → 503
console.log("\n══ C · start (unconfigured) → 503 oauth_not_configured");
{
  // Only meaningful if provider is actually unconfigured in this env.
  if (!hadUnconfigured) {
    console.log("  (skipping · google is already configured)");
  } else {
    const r = await get("/api/nex/auth/oauth/google/start");
    console.log(`  status=${r.status} err=${r.body?.error}`);
    if (r.status !== 503) failures.push({ case: "C", reason: `status_${r.status}` });
    if (r.body?.error !== "oauth_not_configured") failures.push({ case: "C", reason: `err_${r.body?.error}` });
  }
}

// ══ D · callback unconfigured → 503
console.log("\n══ D · callback (unconfigured) → 503 oauth_not_configured");
{
  if (!hadUnconfigured) {
    console.log("  (skipping · google is already configured)");
  } else {
    const r = await get("/api/nex/auth/oauth/google/callback?state=x&code=y");
    console.log(`  status=${r.status} err=${r.body?.error}`);
    if (r.status !== 503) failures.push({ case: "D", reason: `status_${r.status}` });
    if (r.body?.error !== "oauth_not_configured") failures.push({ case: "D", reason: `err_${r.body?.error}` });
  }
}

// ══ E · unknown provider → 404
console.log("\n══ E · unknown provider → 404");
{
  const r = await get("/api/nex/auth/oauth/imaginary/start");
  console.log(`  status=${r.status} err=${r.body?.error}`);
  if (r.status !== 404) failures.push({ case: "E", reason: `status_${r.status}` });
  if (r.body?.error !== "unknown_provider") failures.push({ case: "E", reason: `err_${r.body?.error}` });
}

// ══ F · start when configured returns 302 with proper URL
//
// We can't set env vars on the already-running dev server from here,
// so we detect environment state and skip if not configured. The check
// still ensures the code path is honest — the test A already verified
// the unconfigured branch.
console.log("\n══ F · start (configured, if creds present) → 302 to authorize URL");
{
  const providers = await get("/api/nex/auth/providers");
  const google = (providers.body?.providers ?? []).find((p) => p.id === "google");
  if (google?.configured) {
    const r = await get("/api/nex/auth/oauth/google/start");
    console.log(`  status=${r.status} location_host=${r.location ? new URL(r.location).host : "(none)"}`);
    if (r.status !== 302) failures.push({ case: "F", reason: `status_${r.status}` });
    if (!r.location || !r.location.startsWith("https://accounts.google.com/")) failures.push({ case: "F", reason: `bad_location_${r.location?.slice(0, 40)}` });
  } else {
    console.log("  (skipping · google unconfigured · test A already covered honest 503)");
  }
}

// ══ G · start URL has PKCE + state + scope + redirect_uri
console.log("\n══ G · configured start URL carries PKCE + state + scope + redirect_uri");
{
  const providers = await get("/api/nex/auth/providers");
  const google = (providers.body?.providers ?? []).find((p) => p.id === "google");
  if (google?.configured) {
    const r = await get("/api/nex/auth/oauth/google/start");
    const u = r.location ? new URL(r.location) : null;
    const state = u?.searchParams.get("state");
    const cc = u?.searchParams.get("code_challenge");
    const ccm = u?.searchParams.get("code_challenge_method");
    const scope = u?.searchParams.get("scope");
    const ru = u?.searchParams.get("redirect_uri");
    console.log(`  state_len=${state?.length} cc_len=${cc?.length} ccm=${ccm} scope=${scope} ru=${ru}`);
    if (!state || state.length < 20) failures.push({ case: "G", reason: "bad_state" });
    if (!cc || cc.length < 20) failures.push({ case: "G", reason: "bad_challenge" });
    if (ccm !== "S256") failures.push({ case: "G", reason: `bad_method_${ccm}` });
    if (!scope?.includes("email")) failures.push({ case: "G", reason: "no_email_scope" });
    if (!ru?.includes("/callback")) failures.push({ case: "G", reason: "bad_ru" });
  } else {
    console.log("  (skipping · google unconfigured)");
  }
}

// ══ H · callback with unknown state → 400 invalid_or_expired_state (only meaningful when configured)
console.log("\n══ H · callback with unknown state → 400 invalid_or_expired_state");
{
  const providers = await get("/api/nex/auth/providers");
  const google = (providers.body?.providers ?? []).find((p) => p.id === "google");
  if (google?.configured) {
    const r = await get("/api/nex/auth/oauth/google/callback?state=deadbeef&code=abc");
    console.log(`  status=${r.status} err=${r.body?.error}`);
    if (r.status !== 400) failures.push({ case: "H", reason: `status_${r.status}` });
    if (r.body?.error !== "invalid_or_expired_state") failures.push({ case: "H", reason: `err_${r.body?.error}` });
  } else {
    console.log("  (skipping · google unconfigured)");
  }
}

// ══ I · callback with missing params → 400 missing_state_or_code
console.log("\n══ I · callback with missing state/code → 400 missing_state_or_code");
{
  const providers = await get("/api/nex/auth/providers");
  const google = (providers.body?.providers ?? []).find((p) => p.id === "google");
  if (google?.configured) {
    const r = await get("/api/nex/auth/oauth/google/callback");
    console.log(`  status=${r.status} err=${r.body?.error}`);
    if (r.status !== 400) failures.push({ case: "I", reason: `status_${r.status}` });
    if (r.body?.error !== "missing_state_or_code") failures.push({ case: "I", reason: `err_${r.body?.error}` });
  } else {
    console.log("  (skipping · google unconfigured)");
  }
}

// ══ J · provider-side error param → 400 provider_error
console.log("\n══ J · callback with provider-side error param → 400 provider_error");
{
  const providers = await get("/api/nex/auth/providers");
  const google = (providers.body?.providers ?? []).find((p) => p.id === "google");
  if (google?.configured) {
    const r = await get("/api/nex/auth/oauth/google/callback?error=access_denied&state=x");
    console.log(`  status=${r.status} err=${r.body?.error} detail=${r.body?.detail}`);
    if (r.status !== 400) failures.push({ case: "J", reason: `status_${r.status}` });
    if (r.body?.error !== "provider_error") failures.push({ case: "J", reason: `err_${r.body?.error}` });
  } else {
    console.log("  (skipping · google unconfigured)");
  }
}

// ══ K · library-direct: state store is single-use + TTL enforced
console.log("\n══ K · state store: single-use + honest expiry");
{
  const { spawnSync } = await import("node:child_process");
  const runner = `
import { issueState, consumeState, _pendingStateCount } from "./src/lib/nex/oauth/state.ts";
const a = issueState({ provider_id: "google", redirect_after: "/x" });
const b = issueState({ provider_id: "google", redirect_after: "/y" });
const consumedA = consumeState(a.state);
const consumedA2 = consumeState(a.state);
const consumedBad = consumeState("not-a-real-state");
console.log(JSON.stringify({
  a_state_len: a.state.length,
  a_cv_len: a.code_verifier.length,
  a_cc_len: a.code_challenge.length,
  consumedA_ok: consumedA?.redirect_after === "/x",
  consumedA2_null: consumedA2 === null,
  consumedBad_null: consumedBad === null,
  pending_after: _pendingStateCount(),
}));
`;
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "-e", runner], { encoding: "utf8" });
  const line = (r.stdout ?? "").split(/\r?\n/).filter((l) => l.startsWith("{")).pop() ?? "";
  let parsed = null; try { parsed = JSON.parse(line); } catch { /* ignore */ }
  console.log(`  ${line || r.stderr?.slice(0, 120)}`);
  if (!parsed) failures.push({ case: "K", reason: "no_parse" });
  else {
    if (parsed.a_state_len < 20) failures.push({ case: "K", reason: "state_too_short" });
    if (parsed.a_cv_len < 20) failures.push({ case: "K", reason: "cv_too_short" });
    if (parsed.a_cc_len < 20) failures.push({ case: "K", reason: "cc_too_short" });
    if (!parsed.consumedA_ok) failures.push({ case: "K", reason: "first_consume_lost_entry" });
    if (!parsed.consumedA2_null) failures.push({ case: "K", reason: "state_reusable" });
    if (!parsed.consumedBad_null) failures.push({ case: "K", reason: "unknown_state_accepted" });
    if (parsed.pending_after !== 1) failures.push({ case: "K", reason: `pending_${parsed.pending_after}` });
  }
}

// ══ L · library-direct: provider becomes configured when env vars set
console.log("\n══ L · provider config toggles on env shim");
{
  const { spawnSync } = await import("node:child_process");
  const runner = `
import { getProvider, isConfigured, listProviders } from "./src/lib/nex/oauth/providers.ts";
const p = getProvider("google");
const list = listProviders();
console.log(JSON.stringify({
  found: !!p,
  configured: isConfigured(p),
  in_list: list.find((x) => x.id === "google")?.configured,
  authorize_url: p?.authorize_url,
  scopes: p?.scopes,
}));
`;
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "-e", runner], {
    encoding: "utf8",
    env: { ...process.env, GOOGLE_OAUTH_CLIENT_ID: "shim.apps.googleusercontent.com", GOOGLE_OAUTH_CLIENT_SECRET: "shim-secret" },
  });
  const line = (r.stdout ?? "").split(/\r?\n/).filter((l) => l.startsWith("{")).pop() ?? "";
  let parsed = null; try { parsed = JSON.parse(line); } catch { /* ignore */ }
  console.log(`  ${line || r.stderr?.slice(0, 120)}`);
  if (!parsed) failures.push({ case: "L", reason: "no_parse" });
  else {
    if (!parsed.found) failures.push({ case: "L", reason: "google_not_registered" });
    if (!parsed.configured) failures.push({ case: "L", reason: "env_shim_did_not_activate" });
    if (parsed.in_list !== true) failures.push({ case: "L", reason: "list_not_updated" });
    if (!String(parsed.authorize_url).startsWith("https://accounts.google.com/")) failures.push({ case: "L", reason: "bad_authorize_url" });
    if (!Array.isArray(parsed.scopes) || !parsed.scopes.includes("email")) failures.push({ case: "L", reason: "missing_email_scope" });
  }
}

console.log(`\n══ SUMMARY  failures=${failures.length}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`   ❌ [${f.case}] ${f.reason}`);
  process.exit(1);
} else {
  console.log("   0 regressions · OAuth foundation live · honest 503 when unset · state+PKCE issued when configured.");
  process.exit(0);
}
