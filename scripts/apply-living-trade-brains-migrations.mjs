#!/usr/bin/env node
// scripts/apply-living-trade-brains-migrations.mjs
//
// Applies the eight Living Trade Brains migrations to Supabase in the
// correct order. Idempotent — re-running is safe (uses CREATE TABLE
// IF NOT EXISTS + ADD CONSTRAINT IF NOT EXISTS patterns where possible).
//
// Order matters:
//   1. events                (foundation — no FKs)
//   2. brain_registry        (foundation — no FKs)
//   3. brain_versions        (references registry · adds FK back to registry)
//   4. brain_drafts          (references registry + versions)
//   5. brain_certifications  (references registry)
//   6. brain_dependencies    (references registry × 2)
//   7. brain_answers         (references registry + versions)
//   8. brain_field_outcomes  (references answers + registry + versions)
//   9. brain_review_actions  (references registry + drafts + versions)
//
// Usage:
//   node scripts/apply-living-trade-brains-migrations.mjs
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ENV_PATH = "C:\\Users\\Victus\\trades\\.env.local";
if (!existsSync(ENV_PATH)) {
  console.error("✗ .env.local not found at " + ENV_PATH);
  process.exit(1);
}
const ENV = readFileSync(ENV_PATH, "utf8");
const url = (ENV.match(/^SUPABASE_URL=(.+)$/m) ?? [])[1]?.trim();
const key =
  (ENV.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m) ?? [])[1]?.trim() ??
  (ENV.match(/^SERVICE_ROLE_KEY=(.+)$/m) ?? [])[1]?.trim();

if (!url || !key) {
  console.error("✗ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  process.exit(1);
}

const MIGRATIONS = [
  "20260728100000_nex_events.sql",
  "20260728100100_nex_brains.sql",           // renamed from _nex_brain_registry.sql (Philip 2026-07-28)
  "20260728100200_nex_brain_versions.sql",
  "20260728100300_nex_brain_drafts.sql",
  "20260728100400_nex_brain_certifications.sql",
  "20260728100500_nex_brain_dependencies.sql",
  "20260728100600_nex_brain_answers.sql",
  "20260728100700_nex_brain_field_outcomes.sql",
  "20260728100800_nex_brain_review_actions.sql",
];

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function applyOne(filename) {
  const path = "C:\\Users\\Victus\\trades\\supabase\\migrations\\" + filename;
  const sql = readFileSync(path, "utf8");
  console.log("→ applying", filename, "(" + sql.length + " bytes)");
  // Supabase JS client doesn't expose raw SQL execution — we call the
  // Postgres REST admin endpoint via a small RPC. If the project doesn't
  // have `exec_sql` RPC installed, this script prints the SQL for
  // manual execution via Supabase Studio SQL editor instead.
  const { error } = await supabase.rpc("exec_sql", { sql });
  if (error) {
    console.log("  ⚠  exec_sql RPC not available:", error.message);
    console.log("  → Please apply this file manually via Supabase SQL editor:");
    console.log("    ", path);
    return { ok: false, requiresManual: true };
  }
  console.log("  ✓ applied");
  return { ok: true };
}

async function main() {
  console.log("═════ Living Trade Brains · Migration Apply ═════\n");
  console.log("  Target Supabase:", url);
  console.log("  Migrations to apply:", MIGRATIONS.length, "\n");

  let applied = 0;
  let manualNeeded = 0;
  for (const f of MIGRATIONS) {
    const r = await applyOne(f);
    if (r.ok) applied++;
    if (r.requiresManual) manualNeeded++;
  }

  console.log("\n═════════════════════════════════════");
  console.log(`  Applied:            ${applied}`);
  console.log(`  Requires manual:    ${manualNeeded}`);
  console.log("═════════════════════════════════════");

  if (manualNeeded > 0) {
    console.log("");
    console.log("MANUAL PATH (if exec_sql RPC isn't installed):");
    console.log("  1. Open Supabase Studio for this project");
    console.log("  2. SQL editor · new query");
    console.log("  3. Paste each migration file in the order above");
    console.log("  4. Run · verify tables exist under public.*");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
