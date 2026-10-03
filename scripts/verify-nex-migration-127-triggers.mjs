#!/usr/bin/env node
// scripts/verify-nex-migration-127-triggers.mjs
//
// Post-apply trigger verification for Migration 127 · run after
// apply-nex-migration-127.mjs has already committed the schema. Uses
// explicit BEGIN; ... ROLLBACK; (not SAVEPOINT) so it works through
// the Supabase pooler's autocommit mode.
//
// Proves:
//   1. legal-transition trigger rejects fallback-active → verified
//   2. verify-while-active trigger rejects verified while another row
//      with the same signature is in fallback-active
//
// All test rows are rolled back · the table remains empty after.

import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";

async function main() {
  loadEnv();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");
  if (!process.env.DATABASE_URL.includes(EXPECTED_PROJECT_REF)) {
    throw new Error(`DATABASE_URL must target ${EXPECTED_PROJECT_REF}`);
  }

  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  try {
    // ── Test 1: legal-transition trigger ─────────────────────────────
    console.log("--- Test 1 · legal-transition trigger ---");
    await pg.query("BEGIN");
    try {
      const insert = await pg.query(
        `INSERT INTO nex_surface_health_event
           (surface, visual_theme, component_module, error_classification,
            recovery_action, failure_signature, lifecycle_state, state_history)
         VALUES ('verify-test', 'verify-test', 'verify-test',
                 'render_runtime_error', 'fallback',
                 'verify-test-signature-illegal',
                 'fallback-active', '[]'::jsonb)
         RETURNING id`,
      );
      const id = insert.rows[0].id;

      let rejected = false;
      try {
        // Illegal: fallback-active → verified.
        await pg.query(
          `UPDATE nex_surface_health_event SET lifecycle_state = 'verified' WHERE id = $1`,
          [id],
        );
      } catch (e) {
        rejected = true;
        console.log(`  trigger raised: ${e.message.split("\n")[0]}`);
      }
      if (!rejected) {
        throw new Error("legal-transition trigger did NOT reject fallback-active → verified");
      }
      console.log("  ✓ fallback-active → verified was rejected");
    } finally {
      await pg.query("ROLLBACK");
    }

    // ── Test 2: verify-while-active trigger ──────────────────────────
    console.log("\n--- Test 2 · verify-while-active trigger ---");
    await pg.query("BEGIN");
    try {
      // Row A: walked up to 'fixed' (eligible for verified).
      const a = await pg.query(
        `INSERT INTO nex_surface_health_event
           (surface, visual_theme, component_module, error_classification,
            recovery_action, failure_signature, lifecycle_state, state_history)
         VALUES ('verify-test', 'verify-test', 'verify-test',
                 'render_runtime_error', 'fallback',
                 'verify-test-signature-conflict',
                 'fallback-active', '[]'::jsonb)
         RETURNING id`,
      );
      const aId = a.rows[0].id;
      await pg.query(
        `UPDATE nex_surface_health_event SET lifecycle_state='investigating' WHERE id=$1`,
        [aId],
      );
      await pg.query(
        `UPDATE nex_surface_health_event SET lifecycle_state='fixed' WHERE id=$1`,
        [aId],
      );

      // Row B: same signature, still fallback-active.
      await pg.query(
        `INSERT INTO nex_surface_health_event
           (surface, visual_theme, component_module, error_classification,
            recovery_action, failure_signature, lifecycle_state, state_history)
         VALUES ('verify-test', 'verify-test', 'verify-test',
                 'render_runtime_error', 'fallback',
                 'verify-test-signature-conflict',
                 'fallback-active', '[]'::jsonb)`,
      );

      // Attempt to verify Row A · must be rejected.
      let rejected = false;
      try {
        await pg.query(
          `UPDATE nex_surface_health_event SET lifecycle_state='verified' WHERE id=$1`,
          [aId],
        );
      } catch (e) {
        rejected = true;
        console.log(`  trigger raised: ${e.message.split("\n")[0]}`);
      }
      if (!rejected) {
        throw new Error("verify-while-active trigger did NOT reject verified during conflict");
      }
      console.log("  ✓ verified rejected while another row of same signature is fallback-active");
    } finally {
      await pg.query("ROLLBACK");
    }

    // ── Residual check ───────────────────────────────────────────────
    const residual = await pg.query(`SELECT count(*)::int AS n FROM nex_surface_health_event`);
    if (residual.rows[0].n !== 0) {
      throw new Error(`residual rows found: ${residual.rows[0].n} (rollback should have cleaned up)`);
    }
    console.log("\n✓ table is clean · no test rows persisted");

    // ── RLS check ────────────────────────────────────────────────────
    const rls = await pg.query(
      `SELECT relrowsecurity FROM pg_class WHERE relname = 'nex_surface_health_event'`,
    );
    if (!rls.rows[0]?.relrowsecurity) throw new Error("RLS not enabled");
    console.log("✓ RLS is enabled");

    console.log("\n═══════════════════════════════════════════");
    console.log("MIGRATION 127 TRIGGERS VERIFIED");
    console.log("═══════════════════════════════════════════");
  } finally {
    await pg.end();
  }
}

main().catch((e) => {
  console.error("VERIFICATION FAILED:", e.message);
  process.exitCode = 1;
});
