// src/lib/nex/language/concept-resolver.test.ts
//
// Founder BEGIN 2026-09-11 · Step 4 acceptance test · ADR-0308.
//
// Depends on the seed script having populated the `migration` concept in
// nex_dev. If those rows are missing, tests are skipped.

import { describe, it, expect, beforeAll } from "vitest";
import { resolveConcept, fetchAnswerForSense, invalidateHotTier } from "./concept-resolver";
import { Client } from "pg";

const PGURL = process.env.NEX_LANGUAGE_POSTGRES_URL
  ?? process.env.NEX_TAXONOMY_POSTGRES_URL
  ?? process.env.NEX_POSTGRES_URL
  ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";

let SEED_PRESENT = false;
beforeAll(async () => {
  invalidateHotTier();
  const c = new Client({ connectionString: PGURL });
  try {
    await c.connect();
    const r = await c.query("SELECT concept_id FROM nex.concepts WHERE canonical_key='migration'");
    SEED_PRESENT = r.rows.length > 0;
  } finally { try { await c.end(); } catch { /* ignore */ } }
});

describe("resolveConcept · migration acceptance (ADR-0308)", () => {
  it("returns null for a concept not in the substrate", async () => {
    if (!SEED_PRESENT) return;
    const r = await resolveConcept("frobnicate_xyz");
    expect(r).toBeNull();
  });

  it("resolves migration with no context to a candidate list · ambiguous", async () => {
    if (!SEED_PRESENT) return;
    const r = await resolveConcept("migration");
    expect(r).not.toBeNull();
    expect(r!.canonical_key).toBe("migration");
    expect(r!.candidate_senses.length).toBe(3);
  });

  it("resolves 'database migration' to database_schema_change", async () => {
    if (!SEED_PRESENT) return;
    const r = await resolveConcept("migration", { cooccur_tokens: ["database"] });
    expect(r).not.toBeNull();
    expect(r!.chosen_sense).not.toBeNull();
    expect(r!.chosen_sense!.sense_key).toBe("database_schema_change");
  });

  it("resolves 'postgres migration' to database_schema_change", async () => {
    if (!SEED_PRESENT) return;
    const r = await resolveConcept("migration", { cooccur_tokens: ["postgres"] });
    expect(r).not.toBeNull();
    expect(r!.chosen_sense!.sense_key).toBe("database_schema_change");
  });

  it("resolves with domain_hint=programming to database_schema_change", async () => {
    if (!SEED_PRESENT) return;
    const r = await resolveConcept("migration", { domain_hint: ["programming"] });
    expect(r).not.toBeNull();
    expect(r!.chosen_sense!.sense_key).toBe("database_schema_change");
  });

  it("resolves 'population migration' to human_population_movement", async () => {
    if (!SEED_PRESENT) return;
    const r = await resolveConcept("migration", { cooccur_tokens: ["population"] });
    expect(r).not.toBeNull();
    expect(r!.chosen_sense!.sense_key).toBe("human_population_movement");
  });

  it("resolves 'CRM migration' to business_system_transition", async () => {
    if (!SEED_PRESENT) return;
    const r = await resolveConcept("migration", { cooccur_tokens: ["crm"] });
    expect(r).not.toBeNull();
    expect(r!.chosen_sense!.sense_key).toBe("business_system_transition");
  });

  it("SAME sense_id returned for 'database' vs 'postgres' vs 'sql' cooccur", async () => {
    if (!SEED_PRESENT) return;
    const a = await resolveConcept("migration", { cooccur_tokens: ["database"] });
    const b = await resolveConcept("migration", { cooccur_tokens: ["postgres"] });
    const c = await resolveConcept("migration", { cooccur_tokens: ["sql"] });
    expect(a!.chosen_sense!.sense_id).toBe(b!.chosen_sense!.sense_id);
    expect(b!.chosen_sense!.sense_id).toBe(c!.chosen_sense!.sense_id);
  });

  it("fetchAnswerForSense returns the canonical definition for database_schema_change", async () => {
    if (!SEED_PRESENT) return;
    const r = await resolveConcept("migration", { cooccur_tokens: ["postgresql"] });
    expect(r!.chosen_sense).not.toBeNull();
    const ans = await fetchAnswerForSense(r!.chosen_sense!.sense_id);
    expect(ans).not.toBeNull();
    expect(ans!.body.toLowerCase()).toContain("database");
    expect(ans!.answer_kind).toBe("definition");
    expect(ans!.status).toBe("authoritative");
  });
});
