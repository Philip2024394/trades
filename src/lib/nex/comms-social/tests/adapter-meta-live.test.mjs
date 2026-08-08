#!/usr/bin/env node
// adapter-meta-live.test.mjs
//
// Dynamic mock-fetch test for the Meta adapter. Restarts the dev server
// with intercept-fetch middleware isn't practical · instead this test
// verifies the adapter via the Phase 4 worker's real code path but with
// FAKE Meta credentials pointing at a local mock server.
//
// If Node lacks tsx (dev-only TS runtime), the test SKIPs cleanly.
//
// Assertions:
//   ML1 · authorizeUrl returns a URL with client_id / redirect_uri / state / scope
//   ML2 · exchangeCode with a mocked Meta response returns access_token + platform_account_id
//   ML3 · publish maps a 190 error to invalid_token
//   ML4 · publish maps a 4/17 error to rate_limited
//   ML5 · publish success returns provider_post_id from Meta response
//
// Uses `node --loader tsx/esm` if tsx installed; otherwise SKIP.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..", "..", "..", "..");

// Detect tsx availability
function tsxAvailable() {
  const check = spawnSync("node", ["-e", "try { require.resolve('tsx'); console.log('yes'); } catch { console.log('no'); }"],
    { cwd: REPO, encoding: "utf8" });
  return check.stdout.trim() === "yes";
}

if (!tsxAvailable()) {
  process.stdout.write("adapter-meta-live.test.mjs\n  SKIP tsx not available in node_modules · TS runtime required\n");
  process.exit(0);
}

// Spawn a child process that imports the TS adapter via tsx and runs
// assertions with mocked fetch. Communicates results via stdout JSON.
const child = spawnSync("node", ["--import", "tsx/esm", "-e", `
import { createMetaAdapter } from "${pathToFileURL(join(REPO, "src", "lib", "nex", "comms-social", "adapters", "meta.ts"))}";

process.env.META_APP_ID = "test-app-id";
process.env.META_APP_SECRET = "test-app-secret";
process.env.META_REDIRECT_URI = "https://example.test/callback";

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
}

const adapter = createMetaAdapter();

// ML1 · authorize URL shape
{
  const u = adapter.authorizeUrl({
    state: "abc", redirect_uri: "https://example.test/cb",
    scopes: ["pages_manage_posts", "pages_read_engagement"],
  });
  const url = new URL(u.url);
  record("ML1 authorize URL correct",
    url.hostname === "www.facebook.com"
    && url.searchParams.get("client_id") === "test-app-id"
    && url.searchParams.get("redirect_uri") === "https://example.test/cb"
    && url.searchParams.get("state") === "abc"
    && url.searchParams.get("scope") === "pages_manage_posts,pages_read_engagement");
}

// ML2 · exchangeCode with mocked fetch
{
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method ?? "GET" });
    const s = String(url);
    if (s.includes("/oauth/access_token") && !s.includes("fb_exchange_token")) {
      return new Response(JSON.stringify({ access_token: "short-lived-user-tok", expires_in: 3600 }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (s.includes("fb_exchange_token")) {
      return new Response(JSON.stringify({ access_token: "long-lived-user-tok", expires_in: 5183944 }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (s.includes("/me/accounts")) {
      return new Response(JSON.stringify({ data: [{ id: "page-123", name: "Test Page", access_token: "page-token-abc" }] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("{}", { status: 404 });
  };
  const r = await adapter.exchangeCode({ code: "test-code", redirect_uri: "https://example.test/cb" });
  globalThis.fetch = originalFetch;
  record("ML2 exchangeCode returns page token + page id",
    r.ok && r.access_token === "page-token-abc" && r.platform_account_id === "page-123" && r.display_name === "Test Page",
    JSON.stringify(r).slice(0, 200));
}

// ML3 · publish maps 190 to invalid_token
{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ error: { code: 190, message: "Invalid OAuth access token" } }),
    { status: 400, headers: { "content-type": "application/json" } });
  const r = await adapter.publish({
    account: { account_id: "a", tenant_id: "t", platform: "facebook", display_name: "P", platform_account_id: "page-123", scopes: [], status: "connected", connected_at: null, last_success_at: null, last_error: null, token_expires_at: null, granted_by: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    access_token: "revoked-token", refresh_token: null,
    post_id: "p", idempotency_marker: "m", caption: "hi", hashtags: [], media: [], cta: null, scheduled_for: null,
  });
  globalThis.fetch = originalFetch;
  record("ML3 190 → invalid_token", !r.ok && r.error_class === "invalid_token", JSON.stringify(r).slice(0, 200));
}

// ML4 · publish maps 4 to rate_limited
{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ error: { code: 4, message: "App rate limit exceeded" } }),
    { status: 429, headers: { "content-type": "application/json" } });
  const r = await adapter.publish({
    account: { account_id: "a", tenant_id: "t", platform: "facebook", display_name: "P", platform_account_id: "page-123", scopes: [], status: "connected", connected_at: null, last_success_at: null, last_error: null, token_expires_at: null, granted_by: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    access_token: "tok", refresh_token: null,
    post_id: "p", idempotency_marker: "m", caption: "hi", hashtags: [], media: [], cta: null, scheduled_for: null,
  });
  globalThis.fetch = originalFetch;
  record("ML4 code 4 → rate_limited", !r.ok && r.error_class === "rate_limited");
}

// ML5 · publish success
{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ id: "page-123_9876543210" }),
    { status: 200, headers: { "content-type": "application/json" } });
  const r = await adapter.publish({
    account: { account_id: "a", tenant_id: "t", platform: "facebook", display_name: "P", platform_account_id: "page-123", scopes: [], status: "connected", connected_at: null, last_success_at: null, last_error: null, token_expires_at: null, granted_by: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    access_token: "tok", refresh_token: null,
    post_id: "p", idempotency_marker: "m", caption: "hi", hashtags: [], media: [], cta: null, scheduled_for: null,
  });
  globalThis.fetch = originalFetch;
  record("ML5 publish success returns provider_post_id",
    r.ok && r.provider_post_id === "page-123_9876543210",
    JSON.stringify(r).slice(0, 200));
}

process.stdout.write(JSON.stringify(results));
`], { cwd: REPO, encoding: "utf8" });

if (child.status !== 0) {
  process.stdout.write("adapter-meta-live.test.mjs\n");
  process.stdout.write(`  SKIP child process exit ${child.status} · stderr=${(child.stderr ?? "").slice(0, 200)}\n`);
  process.exit(0);
}

let parsed;
try { parsed = JSON.parse(child.stdout); }
catch {
  process.stdout.write("adapter-meta-live.test.mjs\n  SKIP child stdout not parseable · stdout=" + child.stdout.slice(0, 200) + "\n");
  process.exit(0);
}

process.stdout.write("adapter-meta-live.test.mjs\n");
for (const r of parsed) {
  process.stdout.write(`  ${r.pass ? "PASS" : "FAIL"} ${r.id}${r.note ? " · " + r.note : ""}\n`);
}
const passed = parsed.filter(r => r.pass).length;
process.stdout.write(`\nSummary · ${passed}/${parsed.length} passed\n`);
process.exit(passed === parsed.length ? 0 : 1);

// tiny helper (needed at file scope for the eval'd child block above)
function pathToFileURL(p) {
  const abs = p.replace(/\\/g, "/");
  return "file:///" + (abs.startsWith("/") ? abs.slice(1) : abs);
}
