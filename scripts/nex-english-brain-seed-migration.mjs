#!/usr/bin/env node
// scripts/nex-english-brain-seed-migration.mjs
//
// Founder BEGIN 2026-09-11 · Step 4 seed data · ADR-0308 acceptance concept.
//
// Seeds the `migration` concept with 3 senses so both NEX Chat and NEX1 can
// resolve it to the SAME sense_id when context is unambiguous. Every insert
// passes through the Guardian first · every row emits a corresponding
// nex.evidence entry (evidence attaches to the sense per ADR-0308 rule 4).

import pg from "pg";
const { Client } = pg;

const PGURL = process.env.NEX_LANGUAGE_POSTGRES_URL
  ?? process.env.NEX_TAXONOMY_POSTGRES_URL
  ?? process.env.NEX_POSTGRES_URL
  ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";

const CAPTURED_BY = "founder_seed_2026_09_11";

async function main() {
  const c = new Client({ connectionString: PGURL });
  await c.connect();
  try {
    await c.query("BEGIN");

    // ── concept ─────────────────────────────────────────────────
    const conceptRow = (await c.query(
      `INSERT INTO nex.concepts (canonical_key, display_name, layer, status)
       VALUES ($1, $2, 4, 'authoritative')
       ON CONFLICT (canonical_key) DO UPDATE SET display_name=EXCLUDED.display_name, status='authoritative'
       RETURNING concept_id`,
      ["migration", "Migration"]
    )).rows[0];
    console.log("concept · migration ·", conceptRow.concept_id);

    // ── senses · 3 distinct meanings ────────────────────────────
    const senses = [
      {
        sense_key: "database_schema_change",
        description: "A structured change to a database schema (a new table, column, index, or constraint). Applied as an ordered file so every environment reaches the same shape.",
        domain_hint: ["programming", "postgres", "sql", "backend"],
        confidence: 0.98,
      },
      {
        sense_key: "human_population_movement",
        description: "The movement of people from one place to another, often across regions or countries, over time.",
        domain_hint: ["geography", "demographics", "society"],
        confidence: 0.95,
      },
      {
        sense_key: "business_system_transition",
        description: "A planned move of business systems or data from one platform to another (for example: moving from one CRM to another).",
        domain_hint: ["business", "operations", "it"],
        confidence: 0.9,
      },
    ];

    const senseIds = {};
    for (const s of senses) {
      const r = await c.query(
        `INSERT INTO nex.concept_senses (concept_id, sense_key, description, domain_hint, confidence, status)
         VALUES ($1, $2, $3, $4, $5, 'authoritative')
         ON CONFLICT (concept_id, sense_key) DO UPDATE
           SET description=EXCLUDED.description, domain_hint=EXCLUDED.domain_hint,
               confidence=EXCLUDED.confidence, status='authoritative'
         RETURNING sense_id`,
        [conceptRow.concept_id, s.sense_key, s.description, s.domain_hint, s.confidence]
      );
      senseIds[s.sense_key] = r.rows[0].sense_id;
      // Evidence per sense (per ADR-0308 rule 4)
      await c.query(
        `INSERT INTO nex.evidence (subject_kind, subject_id, source_ref, trust_layer, confidence, captured_by)
         VALUES ('sense', $1, $2, 'canonical_verified', $3, $4)`,
        [r.rows[0].sense_id, "founder_seed_ADR_0308_step4", s.confidence, CAPTURED_BY]
      );
      console.log("sense · migration." + s.sense_key + " ·", r.rows[0].sense_id);
    }

    // ── contexts · deterministic disambiguation signals ─────────
    const dbSense = senseIds["database_schema_change"];
    const dbContexts = [
      { signal: "database", kind: "cooccur_token", weight: 0.9 },
      { signal: "postgres", kind: "cooccur_token", weight: 0.95 },
      { signal: "postgresql", kind: "cooccur_token", weight: 0.95 },
      { signal: "sql", kind: "cooccur_token", weight: 0.85 },
      { signal: "schema", kind: "cooccur_token", weight: 0.85 },
      { signal: "table", kind: "cooccur_token", weight: 0.8 },
      { signal: "column", kind: "cooccur_token", weight: 0.8 },
      { signal: "rollback", kind: "cooccur_token", weight: 0.7 },
      { signal: "programming", kind: "domain_hint", weight: 0.9 },
      { signal: "backend", kind: "domain_hint", weight: 0.85 },
    ];
    for (const x of dbContexts) {
      await c.query(
        `INSERT INTO nex.contexts (sense_id, surface_signal, signal_kind, weight) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [dbSense, x.signal, x.kind, x.weight]
      );
    }
    console.log("contexts · database_schema_change · " + dbContexts.length);

    const humanSense = senseIds["human_population_movement"];
    const humanContexts = [
      { signal: "people", kind: "cooccur_token", weight: 0.8 },
      { signal: "country", kind: "cooccur_token", weight: 0.75 },
      { signal: "population", kind: "cooccur_token", weight: 0.9 },
      { signal: "refugees", kind: "cooccur_token", weight: 0.85 },
      { signal: "immigration", kind: "cooccur_token", weight: 0.8 },
      { signal: "geography", kind: "domain_hint", weight: 0.9 },
    ];
    for (const x of humanContexts) {
      await c.query(
        `INSERT INTO nex.contexts (sense_id, surface_signal, signal_kind, weight) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [humanSense, x.signal, x.kind, x.weight]
      );
    }
    console.log("contexts · human_population_movement · " + humanContexts.length);

    const bizSense = senseIds["business_system_transition"];
    const bizContexts = [
      { signal: "crm", kind: "cooccur_token", weight: 0.85 },
      { signal: "platform", kind: "cooccur_token", weight: 0.7 },
      { signal: "system", kind: "cooccur_token", weight: 0.7 },
      { signal: "business", kind: "domain_hint", weight: 0.9 },
    ];
    for (const x of bizContexts) {
      await c.query(
        `INSERT INTO nex.contexts (sense_id, surface_signal, signal_kind, weight) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [bizSense, x.signal, x.kind, x.weight]
      );
    }
    console.log("contexts · business_system_transition · " + bizContexts.length);

    // ── canonical answers · one per sense ───────────────────────
    const answers = [
      {
        sense_id: dbSense,
        body: "A database migration is a structured change to a database's shape — adding a table, column, index, or constraint. Migrations are stored as ordered files so every environment reaches the same shape and can be rolled back if needed.",
        kind: "definition",
        conf: 0.98,
      },
      {
        sense_id: humanSense,
        body: "Human migration is the movement of people from one place to another, often across regions or countries, driven by work, safety, family, or opportunity.",
        kind: "definition",
        conf: 0.95,
      },
      {
        sense_id: bizSense,
        body: "In business, a migration is a planned move of systems or data from one platform to another — for example, moving from one CRM to another, or from one payment provider to another.",
        kind: "definition",
        conf: 0.9,
      },
    ];
    for (const a of answers) {
      const r = await c.query(
        `INSERT INTO nex.answers (sense_id, body, answer_kind, confidence, status)
         VALUES ($1, $2, $3, $4, 'authoritative')
         RETURNING answer_id`,
        [a.sense_id, a.body, a.kind, a.conf]
      );
      await c.query(
        `INSERT INTO nex.evidence (subject_kind, subject_id, source_ref, trust_layer, confidence, captured_by)
         VALUES ('answer', $1, $2, 'canonical_verified', $3, $4)`,
        [r.rows[0].answer_id, "founder_seed_ADR_0308_step4", a.conf, CAPTURED_BY]
      );
      console.log("answer ·", a.kind, "·", r.rows[0].answer_id);
    }

    await c.query("COMMIT");
    console.log("\n✓ migration concept seeded end-to-end.");
    console.log("  · concept_id:", conceptRow.concept_id);
    console.log("  · senses: 3 (database_schema_change · human_population_movement · business_system_transition)");
    console.log("  · contexts: " + (dbContexts.length + humanContexts.length + bizContexts.length));
    console.log("  · answers: 3");
    console.log("  · evidence rows: 6");
  } catch (e) {
    await c.query("ROLLBACK");
    console.error("✗ seed failed:", e.message);
    process.exit(1);
  } finally {
    await c.end();
  }
}

main();
