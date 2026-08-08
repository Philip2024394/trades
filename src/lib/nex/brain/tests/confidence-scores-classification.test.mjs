#!/usr/bin/env node
// confidence-scores-classification.test.mjs · Phase 10.3
//
// Adversarial reproduction of the confidence_scores classification_check
// CHECK-constraint failure seen in production (2 failures/24h against
// the same inbox item nx_msgwy67n_359bfd83).
//
// What we know from the investigation (read-only):
//   • DB permits EXACTLY these five strings:
//       established_practice · industry_consensus · design_opinion ·
//       experimental_concept · NEX_concept
//     (db/migrations/001_nex_brain_schema.sql · lines 308-314)
//   • TypeScript type + prompt template agree on the same 5 values
//     (types.ts:19-24 · knowledge-extractor.ts:149)
//   • completeJson only enforces JSON SYNTAX not schema · so the LLM can
//     return any string · then knowledge-extractor.ts:346 passes it
//     straight into store.insertConfidence with no normalisation.
//
// Two candidate offending values are common LLM misbehaviours:
//   A · CASE drift · "nex_concept" (lowercase-n instead of "NEX_concept")
//   B · WHITESPACE · "established practice" (space instead of underscore)
//   C · WRONG TAXONOMY · the LLM picks a value from the Comms Social
//       taxonomy ("factual" · "subjective_descriptor" · "comparative"…)
//       which lives on a different subsystem with a different enum
//   D · MADE UP · "unknown" · "claim" · "assertion" · "opinion"
//
// This test reproduces each shape against a throwaway table with the
// SAME CHECK constraint · proves which are rejected · and captures the
// Postgres error DETAIL so a future normaliser can identify offenders
// deterministically.
//
// Assertions:
//   CC1  · CREATE TABLE with the same CHECK constraint succeeds
//   CC2  · Each of the 5 valid values passes
//   CC3  · Case-drift "nex_concept" is REJECTED with the expected error
//   CC4  · Whitespace "established practice" is REJECTED
//   CC5  · Wrong-taxonomy "factual" (Comms Social vocab) is REJECTED
//   CC6  · Wrong-taxonomy "subjective_descriptor" is REJECTED
//   CC7  · Wrong-taxonomy "comparative" is REJECTED
//   CC8  · Made-up "unknown" is REJECTED
//   CC9  · Empty string "" is REJECTED
//   CC10 · Postgres error text includes "check constraint" AND the
//          constraint name so callers can classify the failure
//   CC11 · Static source assertion · extractor still passes the raw
//          LLM value without a normaliser (baseline · will invert once
//          a fix lands)
//   CC12 · Cleanup DROP succeeds

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";
const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");
const PG_URL    = process.env.NEX_POSTGRES_URL || "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";
const pool      = new Pool({ connectionString: PG_URL, max: 3 });

// Same 5 values, in the same order, as the production DB.
const VALID = [
  "established_practice",
  "industry_consensus",
  "design_opinion",
  "experimental_concept",
  "NEX_concept",
];

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

async function insertClassification(client, table, value) {
  try {
    await client.query(`INSERT INTO ${table} (record_id, classification) VALUES ($1::text, $2::text)`, [`rec-${randomUUID()}`, value]);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function main() {
  process.stdout.write("confidence-scores-classification.test.mjs\n");

  const suffix    = randomUUID().replace(/-/g, "");
  const tableName = `nex_test_conf_class_${suffix}`;
  const client    = await pool.connect();
  try {
    // CC1 · CREATE mirror table with the same CHECK constraint used in
    //       Supabase (db/migrations/001_nex_brain_schema.sql · lines 308-314)
    try {
      await client.query(`
        CREATE TABLE ${tableName} (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          record_id TEXT NOT NULL,
          classification TEXT NOT NULL CHECK (classification IN (
            'established_practice',
            'industry_consensus',
            'design_opinion',
            'experimental_concept',
            'NEX_concept'
          ))
        )`);
      record("CC1", true, `table ${tableName} created`);
    } catch (e) {
      record("CC1", false, `create failed: ${e.message}`);
      return;
    }

    // CC2 · all 5 valid values must pass
    let allValid = true;
    for (const v of VALID) {
      const r = await insertClassification(client, tableName, v);
      if (!r.ok) allValid = false;
    }
    record("CC2", allValid, `${VALID.length} valid values all accepted`);

    // CC3 · CC9 · adversarial rejections
    const bad = [
      { id: "CC3",  value: "nex_concept",           label: "case-drift · lowercase-n" },
      { id: "CC4",  value: "established practice",  label: "whitespace instead of underscore" },
      { id: "CC5",  value: "factual",               label: "wrong taxonomy · Comms Social" },
      { id: "CC6",  value: "subjective_descriptor", label: "wrong taxonomy · Comms Social" },
      { id: "CC7",  value: "comparative",           label: "wrong taxonomy · Comms Social" },
      { id: "CC8",  value: "unknown",               label: "made-up sentinel" },
      { id: "CC9",  value: "",                      label: "empty string" },
    ];
    for (const b of bad) {
      const r = await insertClassification(client, tableName, b.value);
      const rejected = !r.ok && /check constraint/i.test(r.error ?? "");
      record(b.id, rejected, `"${b.value}" · ${b.label} · ${rejected ? "rejected as expected" : "UNEXPECTEDLY ACCEPTED"}`);
    }

    // CC10 · confirm Postgres error text carries the constraint name
    const probe = await insertClassification(client, tableName, "definitely-not-valid");
    const errText = probe.error ?? "";
    const hasCheck   = /check constraint/i.test(errText);
    const hasName    = /classification_check|_check/i.test(errText);
    record("CC10", !probe.ok && hasCheck && hasName, `err='${errText.slice(0, 120)}'`);

    // CC11 · baseline static assertion · extractor still passes raw value
    //        through without normalisation. INVERTS to failure once a
    //        normaliser is added. This gives the fix commit an obvious
    //        regression signal to flip.
    const extractor = readFileSync(join(REPO, "src/lib/nex/brain/workers/knowledge-extractor.ts"), "utf8");
    const rawPassthrough = /classification:\s*claim\.classification\b/.test(extractor);
    const hasNormaliser  = /normaliseClassification|normalizeClassification|coerceClassification|VALID_CLASSIFICATIONS/.test(extractor);
    record("CC11", rawPassthrough && !hasNormaliser,
      `baseline · raw_passthrough=${rawPassthrough} normaliser_present=${hasNormaliser} · once a normaliser lands this test should FLIP and be inverted to prove the fix`);

    // CC12 · cleanup
    await client.query(`DROP TABLE ${tableName}`);
    record("CC12", true, "table dropped");
  } catch (e) {
    record("CC1-CC12", false, `exception ${e.message}`);
    try { await client.query(`DROP TABLE IF EXISTS ${tableName}`); } catch { /* best-effort */ }
  } finally {
    client.release();
  }

  const passed = results.filter((r) => r.pass).length;
  const total  = results.length;
  process.stdout.write(`\nconfidence-scores-classification: ${passed}/${total} assertions passed\n`);
  await pool.end();
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
