#!/usr/bin/env node
// scripts/nex-p2-provision-test-users.mjs
//
// NEX Y-P2 · Controlled Supabase test-user provisioning
// Philip 2026-09-07 · founder authorization Option 2
//
// PURPOSE
// -------
// Creates exactly TWO controlled test users required by Y-P2 for the
// two-context Chromium proof of the server-side friend edge.
//
// The founder's Y-P2 authorization forbids inventing UUIDs. Real
// Supabase auth.users rows must exist, with matching hammerex_nex_users
// rows for authorization. This script creates both, using the real
// Supabase Auth Admin API and the real service-role key.
//
// USAGE
// -----
//   node scripts/nex-p2-provision-test-users.mjs
//
// REQUIRED ENV (read only · never logged)
//   NEXT_PUBLIC_NEX_SUPABASE_URL       · NEX project (Project B · ijvqdvsvwtwxzcqmoqit)
//   NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY  · Project B anon key (for sign-in verification)
//   NEX_SUPABASE_SERVICE_ROLE_KEY      · Project B service-role JWT (admin API)
//   NEX_P2_TEST_USER_A_EMAIL           · deterministic e.g. nex-p2-a@nex.dev
//   NEX_P2_TEST_USER_A_PASSWORD        · founder-generated random string
//   NEX_P2_TEST_USER_B_EMAIL           · deterministic e.g. nex-p2-b@nex.dev
//   NEX_P2_TEST_USER_B_PASSWORD        · founder-generated random string
//
// AUTHORITY (per NEX SUPABASE AUTHORITY RESET 2026-09-07)
//   NEX has ONE Supabase project: ijvqdvsvwtwxzcqmoqit (Project B).
//   The legacy Project A (msdonkkechxzgagyguoe) is NOT NEX and must
//   never be used for NEX auth, users, or friend-edge data.
//
// WRITES
// ------
//   auth.users            · via supabase.auth.admin.createUser         · 2 rows
//   hammerex_nex_users    · via upsert on supabase_user_id UNIQUE      · 2 rows
//
// PRINTS
// ------
//   The two Supabase auth.users UUIDs (stdout only)
//
// SECURITY
// --------
//   · No JSON registry written.
//   · Service-role key + passwords read from env only, never printed.
//   · Access tokens from the sign-in verification are never logged; the
//     session is signed out immediately after verification.
//   · No user other than the two named test users is modified.
//   · Idempotent · re-running reuses existing accounts.
//
// SCOPE LOCK · founder directive
//   Do NOT expand this script to seed additional users, projects, or
//   related resources. It exists solely to unblock Y-P2 authorization.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

// Two-step tsx trampoline · reloads with .env.local so the same env the
// app uses is visible here. Guard prevents infinite recursion.
if (!process.env.NEX_P2_PROVISION_INNER) {
  const envArgs = fs.existsSync(path.join(repoRoot, ".env.local"))
    ? ["--env-file=.env.local"]
    : [];
  const entryFile = fileURLToPath(import.meta.url);
  const res = spawnSync(
    "npx",
    ["tsx", ...envArgs, entryFile, ...process.argv.slice(2)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, NEX_P2_PROVISION_INNER: "1" } },
  );
  process.exit(res.status ?? 1);
}

const { createClient } = await import("@supabase/supabase-js");

// ---------------------------------------------------------------------------
// Env resolution — fail-fast with an actionable message.
// ---------------------------------------------------------------------------

// NEX-scoped env vars only · never fall back to the generic vars because
// those belong to the legacy trades/hammerex Project A, not NEX (§2 rule).
const url         = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const anonKey     = process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY;
const serviceKey  = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY;

const A_EMAIL     = process.env.NEX_P2_TEST_USER_A_EMAIL;
const A_PASSWORD  = process.env.NEX_P2_TEST_USER_A_PASSWORD;
const B_EMAIL     = process.env.NEX_P2_TEST_USER_B_EMAIL;
const B_PASSWORD  = process.env.NEX_P2_TEST_USER_B_PASSWORD;

const missing = [];
if (!url)        missing.push("NEXT_PUBLIC_NEX_SUPABASE_URL");
if (!serviceKey) missing.push("NEX_SUPABASE_SERVICE_ROLE_KEY");
if (!A_EMAIL)    missing.push("NEX_P2_TEST_USER_A_EMAIL");
if (!A_PASSWORD) missing.push("NEX_P2_TEST_USER_A_PASSWORD");
if (!B_EMAIL)    missing.push("NEX_P2_TEST_USER_B_EMAIL");
if (!B_PASSWORD) missing.push("NEX_P2_TEST_USER_B_PASSWORD");

// Project-authority guard · fail-fast if the configured URL is not the
// canonical NEX Supabase (Project B).
if (url && !/ijvqdvsvwtwxzcqmoqit\.supabase\.co/i.test(url)) {
  console.error("HARD STOP · NEXT_PUBLIC_NEX_SUPABASE_URL does not resolve to the authoritative NEX Supabase project (ijvqdvsvwtwxzcqmoqit).");
  console.error(`  Resolved to: ${url}`);
  console.error("  Refusing to provision test users against a non-NEX Supabase.");
  process.exit(3);
}

if (missing.length > 0) {
  console.error("HARD STOP · missing required env vars:");
  for (const k of missing) console.error("  ·", k);
  console.error("");
  console.error("Fix: copy the missing lines from .env.local.example into .env.local,");
  console.error("     generate a fresh random password for each user, e.g.");
  console.error("       node -e \"console.log(require('crypto').randomBytes(24).toString('hex'))\"");
  console.error("     then re-run this script.");
  process.exit(2);
}

if (A_EMAIL.toLowerCase() === B_EMAIL.toLowerCase()) {
  console.error("HARD STOP · NEX_P2_TEST_USER_A_EMAIL and _B_EMAIL must differ.");
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Supabase admin client · service-role · no session persistence.
// ---------------------------------------------------------------------------

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findExistingAuthUserByEmail(email) {
  // Auth Admin listUsers is paginated. For our scope (two accounts) a
  // single page of 200 is sufficient. If a project ever grows past
  // this we would need to paginate — deliberately out of scope here.
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`auth.admin.listUsers failed: ${error.message}`);
  const target = email.toLowerCase();
  return data.users.find((u) => (u.email || "").toLowerCase() === target) ?? null;
}

async function ensureAuthUser(label, email, password) {
  const existing = await findExistingAuthUserByEmail(email);
  if (existing) {
    console.log(`[${label}] auth.users · already exists · id ${existing.id} · reusing`);
    return { id: existing.id, created: false };
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nex_test_account: true,
      purpose: "y-p2-friend-edge-proof",
      label,
    },
  });
  if (error) throw new Error(`[${label}] auth.admin.createUser failed: ${error.message}`);
  const id = data.user?.id;
  if (!id) throw new Error(`[${label}] createUser returned no user id`);
  console.log(`[${label}] auth.users · created · id ${id}`);
  return { id, created: true };
}

async function ensureNexUserRow(label, supabase_user_id, email) {
  const { data, error } = await supabase
    .from("hammerex_nex_users")
    .upsert(
      {
        supabase_user_id,
        email,
        display_name: `NEX P2 Test User ${label}`,
        role: "author",       // default, non-privileged
        status: "active",
        metadata: {
          nex_test_account: true,
          purpose: "y-p2-friend-edge-proof",
          label,
        },
      },
      { onConflict: "supabase_user_id", ignoreDuplicates: false },
    )
    .select("id, supabase_user_id, email")
    .single();
  if (error) throw new Error(`[${label}] hammerex_nex_users upsert failed: ${error.message}`);
  console.log(`[${label}] hammerex_nex_users · row ok · nex_id ${data.id}`);
  return data;
}

async function verifyAuthWorks(label, email, password) {
  if (!anonKey) {
    console.log(`[${label}] sign-in verification · SKIPPED · NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY not set`);
    return { verified: false, skipped: true };
  }
  // Use a fresh anon client so the service_role key never touches
  // signInWithPassword (which would be a no-op / silently unsafe).
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`[${label}] sign-in verification failed: ${error.message}`);
  if (!data?.session?.access_token) {
    throw new Error(`[${label}] sign-in returned no access_token`);
  }
  // Sign out immediately · never log the access_token (auth credential).
  await anon.auth.signOut();
  console.log(`[${label}] sign-in verification · ok`);
  return { verified: true, skipped: false };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log("=== NEX Y-P2 · controlled test-user provisioning ===");
console.log(`Supabase project: ${url}`);
console.log(`User A email:     ${A_EMAIL}`);
console.log(`User B email:     ${B_EMAIL}`);
console.log("");

let userA, userB, nexA, nexB, verA, verB;
try {
  userA = await ensureAuthUser("A", A_EMAIL, A_PASSWORD);
  userB = await ensureAuthUser("B", B_EMAIL, B_PASSWORD);
  nexA  = await ensureNexUserRow("A", userA.id, A_EMAIL);
  nexB  = await ensureNexUserRow("B", userB.id, B_EMAIL);
  verA  = await verifyAuthWorks("A", A_EMAIL, A_PASSWORD);
  verB  = await verifyAuthWorks("B", B_EMAIL, B_PASSWORD);
} catch (err) {
  console.error("");
  console.error("HARD STOP · provisioning failed:");
  console.error("  ·", err instanceof Error ? err.message : String(err));
  process.exit(1);
}

console.log("");
console.log("=== SUCCESS · Y-P2 test users ready ===");
console.log("");
console.log(`  User A supabase_user_id: ${userA.id}   (auth.users created=${userA.created})`);
console.log(`  User B supabase_user_id: ${userB.id}   (auth.users created=${userB.created})`);
console.log("");
console.log("hammerex_nex_users:");
console.log(`  User A nex_id: ${nexA.id}`);
console.log(`  User B nex_id: ${nexB.id}`);
console.log("");
console.log(`Auth verification: A=${verA.verified ? "ok" : (verA.skipped ? "skipped" : "fail")} · B=${verB.verified ? "ok" : (verB.skipped ? "skipped" : "fail")}`);
console.log("");
console.log("No JSON registry written · no credentials persisted · no other users touched.");
console.log("Paste the two supabase_user_id values back to Claude to wire the Y-P2 mock profiles.");
