#!/usr/bin/env node
// scripts/apply-nex-migration-127.mjs
//
// Applies Migration 127 (nex_surface_health_event · HQ diagnostics
// foundation per the Chat Surfaces × Visual Themes × HQ Diagnostics
// doctrine sealed 2026-10-03) to the NEX Supabase database.
//
// ** EXECUTE MIGRATION 127 AUTHORISATION issued 2026-10-03 by founder **
// §12 Item 1 only · boundaries, HQ page, kill-switch remain unauthorised.
//
// Target protection pattern reused verbatim from Migration 126 ·
// three-way agreement: hardcoded ref ↔ NEX_MIGRATION_TARGET env var ↔
// DATABASE_URL extracted ref.
//
// Verification runs a 6-point checklist proving the sealed doctrine's
// §7 invariants hold at the DB level:
//   1. nex_migration_history row for 127 is present
//   2. nex_surface_health_event table exists with correct columns
//   3. CHECK constraints lock the three closed-set enums (classification,
//      recovery_action, lifecycle_state)
//   4. Legal-transition trigger rejects a known-illegal transition
//   5. Verify-while-active trigger rejects verified while another row
//      with the same signature is fallback-active
//   6. RLS is enabled on the table
//
// Each verification step uses a savepoint around any mutation so no
// test rows survive.
//
// To run:
//   NEX_MIGRATION_TARGET=ijvqdvsvwtwxzcqmoqit \
//     node scripts/apply-nex-migration-127.mjs

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";

const NEX_EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";
const MIGRATION_FILE = "127_nex_surface_health_event.sql";

const EXPECTED_COLUMNS = [
  "id",
  "correlation_id",
  "surface",
  "visual_theme",
  "component_module",
  "occurred_at",
  "error_classification",
  "recovery_action",
  "app_version",
  "theme_version",
  "client_environment",
  "failure_signature",
  "lifecycle_state",
  "state_history",
  "occurrence_count",
  "created_at",
  "updated_at",
];

// ────────────────────────────────────────────────────────────────────
// .env loader + target protection (reused verbatim from Migration 126)
// ────────────────────────────────────────────────────────────────────

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

function parseDatabaseTarget(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port || "5432",
    database: u.pathname.replace(/^\//, "") || "(default)",
    user: u.username || "(none)",
    sanitized: `${u.protocol}//${u.username}:***@${u.hostname}:${u.port || "5432"}${u.pathname}`,
  };
}

function extractSupabaseProjectRef(target) {
  const hostMatch = target.host.match(/^db\.([a-z0-9]{20})\.supabase\.co$/);
  if (hostMatch) return { source: "direct-host", projectRef: hostMatch[1] };
  if (/\.pooler\.supabase\.com$/.test(target.host)) {
    const userMatch = target.user.match(/^postgres\.([a-z0-9]{20})$/);
    if (userMatch) return { source: "pooler-username", projectRef: userMatch[1] };
    throw new Error(
      `target protection failed: pooler host '${target.host}' but username '${target.user}' is not in 'postgres.<project_ref>' form.`,
    );
  }
  throw new Error(
    `target protection failed: hostname '${target.host}' is not an identifiable Supabase project.`,
  );
}

function assertTargetMatchesExpectation() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL missing · check .env.local");
  }
  const target = parseDatabaseTarget(process.env.DATABASE_URL);
  const operatorAssertion = process.env.NEX_MIGRATION_TARGET || "";

  console.log("--- Target protection ---");
  console.log(`  DATABASE_URL:`);
  console.log(`    host:     ${target.host}`);
  console.log(`    user:     ${target.user}`);
  console.log(`    sanitized: ${target.sanitized}`);
  console.log(`  NEX_EXPECTED_PROJECT_REF (hardcoded): ${NEX_EXPECTED_PROJECT_REF}`);
  console.log(`  NEX_MIGRATION_TARGET (operator):     ${operatorAssertion || "(unset)"}`);

  if (!operatorAssertion) {
    throw new Error(
      "NEX_MIGRATION_TARGET env var is required. " +
      `Example: NEX_MIGRATION_TARGET=${NEX_EXPECTED_PROJECT_REF} node scripts/apply-nex-migration-127.mjs`,
    );
  }
  if (operatorAssertion !== NEX_EXPECTED_PROJECT_REF) {
    throw new Error(
      `NEX_MIGRATION_TARGET='${operatorAssertion}' does not match expected '${NEX_EXPECTED_PROJECT_REF}'.`,
    );
  }
  const extracted = extractSupabaseProjectRef(target);
  console.log(`  DATABASE_URL project identity: ${extracted.projectRef} (via ${extracted.source})`);
  if (extracted.projectRef !== NEX_EXPECTED_PROJECT_REF) {
    throw new Error(
      `DATABASE_URL project identity '${extracted.projectRef}' does not match expected '${NEX_EXPECTED_PROJECT_REF}'.`,
    );
  }
  console.log(`  ✓ target protection: all three identifiers agree`);
  return target;
}

// ────────────────────────────────────────────────────────────────────
// Pre-flight
// ────────────────────────────────────────────────────────────────────

async function preflight(pg) {
  console.log("\n--- Pre-apply pre-flight ---");
  const history = await pg.query(
    `SELECT version FROM nex_migration_history WHERE version = '127'`,
  );
  if (history.rows.length > 0) {
    throw new Error("pre-flight failed: nex_migration_history already contains version 127");
  }
  console.log("  ✓ migration_history does NOT contain version 127");

  const tableCheck = await pg.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='nex_surface_health_event' LIMIT 1`,
  );
  if (tableCheck.rows.length > 0) {
    throw new Error(
      "pre-flight failed: nex_surface_health_event already exists · ambiguous partial state",
    );
  }
  console.log("  ✓ nex_surface_health_event table does NOT yet exist");
}

// ────────────────────────────────────────────────────────────────────
// Post-apply verification
// ────────────────────────────────────────────────────────────────────

async function postApplyVerify(pg) {
  console.log("\n--- Post-apply verification (6-point checklist) ---");

  // 1 · migration_history row present
  const history = await pg.query(
    `SELECT version, description FROM nex_migration_history WHERE version = '127'`,
  );
  if (history.rows.length === 0) {
    throw new Error("post-apply failed: migration_history row for 127 missing");
  }
  if (!history.rows[0].description.includes("nex_surface_health_event")) {
    throw new Error(
      `post-apply failed: migration_history description does not mention 'nex_surface_health_event'. Got: '${history.rows[0].description}'`,
    );
  }
  console.log(`  ✓ [1] migration_history row present`);

  // 2 · table + columns
  const cols = await pg.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='nex_surface_health_event'
      ORDER BY column_name`,
  );
  const colNames = new Set(cols.rows.map((r) => r.column_name));
  const missing = EXPECTED_COLUMNS.filter((c) => !colNames.has(c));
  if (missing.length > 0) {
    throw new Error(`post-apply failed: missing columns ${missing.join(", ")}`);
  }
  console.log(`  ✓ [2] nex_surface_health_event has all ${EXPECTED_COLUMNS.length} expected columns`);

  // 3 · CHECK constraints (closed-set enums)
  const checks = await pg.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conrelid = 'nex_surface_health_event'::regclass
        AND contype = 'c'
      ORDER BY conname`,
  );
  const checkText = checks.rows.map((r) => r.def).join(" | ");
  const requiredEnums = [
    "render_runtime_error",
    "fallback-active",
    "verified",
    "fallback",
    "retry",
    "degrade",
  ];
  for (const token of requiredEnums) {
    if (!checkText.includes(token)) {
      throw new Error(
        `post-apply failed: CHECK constraints do not reference required enum value '${token}'`,
      );
    }
  }
  console.log(`  ✓ [3] CHECK constraints enforce closed-set enums (${checks.rows.length} CHECKs present)`);

  // 4 · Legal-transition trigger rejects an illegal transition.
  //     Insert a transient row in savepoint, attempt illegal, rollback.
  await pg.query("SAVEPOINT trigger_test_illegal_transition");
  let illegalRejected = false;
  try {
    const inserted = await pg.query(
      `INSERT INTO nex_surface_health_event
         (surface, visual_theme, component_module, error_classification,
          recovery_action, failure_signature, lifecycle_state, state_history)
       VALUES ('verify-test', 'verify-test', 'verify-test',
               'render_runtime_error', 'fallback',
               'verify-test-signature-illegal',
               'fallback-active',
               '[{"from":null,"to":"detected","at":"2026-10-03T00:00:00Z","reason":null},{"from":"detected","to":"fallback-active","at":"2026-10-03T00:00:00Z","reason":null}]'::jsonb)
       RETURNING id`,
    );
    const rowId = inserted.rows[0].id;
    try {
      // Illegal: fallback-active → verified (must go through investigating → fixed).
      await pg.query(
        `UPDATE nex_surface_health_event SET lifecycle_state = 'verified' WHERE id = $1`,
        [rowId],
      );
    } catch (_e) {
      illegalRejected = true;
    }
  } finally {
    await pg.query("ROLLBACK TO SAVEPOINT trigger_test_illegal_transition");
  }
  if (!illegalRejected) {
    throw new Error(
      "post-apply failed: legal-transition trigger did NOT reject fallback-active → verified",
    );
  }
  console.log("  ✓ [4] legal-transition trigger rejects fallback-active → verified");

  // 5 · Verify-while-active guard rejects verified when another row of the
  //     same signature is in fallback-active.
  await pg.query("SAVEPOINT trigger_test_verify_rule");
  let verifyRejected = false;
  try {
    // Row A: walk the lifecycle to 'fixed' so it's eligible to be verified.
    const a = await pg.query(
      `INSERT INTO nex_surface_health_event
         (surface, visual_theme, component_module, error_classification,
          recovery_action, failure_signature, lifecycle_state, state_history)
       VALUES ('verify-test', 'verify-test', 'verify-test',
               'render_runtime_error', 'fallback',
               'verify-test-signature-conflict',
               'fallback-active',
               '[]'::jsonb)
       RETURNING id`,
    );
    const aId = a.rows[0].id;
    await pg.query(
      `UPDATE nex_surface_health_event SET lifecycle_state = 'investigating' WHERE id = $1`,
      [aId],
    );
    await pg.query(
      `UPDATE nex_surface_health_event SET lifecycle_state = 'fixed' WHERE id = $1`,
      [aId],
    );

    // Row B: a NEW incident, same signature, still fallback-active.
    await pg.query(
      `INSERT INTO nex_surface_health_event
         (surface, visual_theme, component_module, error_classification,
          recovery_action, failure_signature, lifecycle_state, state_history)
       VALUES ('verify-test', 'verify-test', 'verify-test',
               'render_runtime_error', 'fallback',
               'verify-test-signature-conflict',
               'fallback-active',
               '[]'::jsonb)`,
    );

    // Attempt to verify Row A · must be rejected.
    try {
      await pg.query(
        `UPDATE nex_surface_health_event SET lifecycle_state = 'verified' WHERE id = $1`,
        [aId],
      );
    } catch (_e) {
      verifyRejected = true;
    }
  } finally {
    await pg.query("ROLLBACK TO SAVEPOINT trigger_test_verify_rule");
  }
  if (!verifyRejected) {
    throw new Error(
      "post-apply failed: verify-while-active trigger did NOT reject verified while conflict exists",
    );
  }
  console.log("  ✓ [5] verify-while-active trigger rejects verified while another row is fallback-active");

  // 6 · RLS is enabled.
  const rls = await pg.query(
    `SELECT relrowsecurity FROM pg_class WHERE relname = 'nex_surface_health_event'`,
  );
  if (rls.rows.length === 0 || rls.rows[0].relrowsecurity !== true) {
    throw new Error("post-apply failed: RLS not enabled on nex_surface_health_event");
  }
  console.log("  ✓ [6] RLS is enabled on nex_surface_health_event");

  // Prove the table is empty of leaked test data from the verifications.
  const residual = await pg.query(`SELECT count(*)::int AS n FROM nex_surface_health_event`);
  if (residual.rows[0].n !== 0) {
    throw new Error(
      `post-apply warning: nex_surface_health_event has ${residual.rows[0].n} residual rows · savepoint rollback should have cleaned them`,
    );
  }
  console.log("  ✓ [sanity] nex_surface_health_event is empty (no leaked test rows)");
}

// ────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────

async function main() {
  loadEnv();

  let target;
  try {
    target = assertTargetMatchesExpectation();
  } catch (e) {
    console.error("\n═══════════════════════════════════════════");
    console.error("TARGET PROTECTION FAILED · NO DB CONTACT MADE");
    console.error(e instanceof Error ? e.message : String(e));
    console.error("═══════════════════════════════════════════");
    process.exitCode = 1;
    return;
  }

  console.log(`\nConnecting to ${target.sanitized} ...`);
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  try {
    const idRow = await pg.query(
      `SELECT current_database() AS db, version() AS version`,
    );
    console.log(
      `  server: db=${idRow.rows[0].db} · ${String(idRow.rows[0].version).slice(0, 60)}...`,
    );

    await preflight(pg);

    console.log(`\n--- Applying ${MIGRATION_FILE} ---`);
    const sql = fs.readFileSync(
      path.join(process.cwd(), "nex-supabase", "migrations", MIGRATION_FILE),
      "utf8",
    );
    await pg.query(sql);
    console.log("  ✓ migration SQL executed and committed without error");

    await postApplyVerify(pg);

    console.log("\n═══════════════════════════════════════════");
    console.log("MIGRATION 127 APPLIED · ALL 6 VERIFICATION POINTS PASSED");
    console.log("═══════════════════════════════════════════");
  } catch (e) {
    console.error("\n═══════════════════════════════════════════");
    console.error("MIGRATION 127 FAILED");
    console.error(e instanceof Error ? e.message : String(e));
    console.error("═══════════════════════════════════════════");
    console.error(
      "If this failure happened during target protection or preflight · nothing was mutated.",
    );
    console.error(
      "If this failure happened during the migration SQL itself · the single-transaction BEGIN/COMMIT means PostgreSQL rolled it back atomically.",
    );
    console.error(
      "If this failure happened during post-apply verification · Migration 127 has already committed. Rollback block is in the SQL header.",
    );
    process.exitCode = 1;
  } finally {
    await pg.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}

export {
  parseDatabaseTarget,
  extractSupabaseProjectRef,
  assertTargetMatchesExpectation,
};
