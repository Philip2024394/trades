// src/lib/nex/language/question-resolver.test.ts
//
// Founder BEGIN 2026-09-11 · Layer 2 acceptance tests. Depends on
// scripts/nex-english-brain-e2-questions.mjs having populated nex.questions.

import { describe, it, expect, beforeAll } from "vitest";
import { matchQuestion, invalidateQuestionCache } from "./question-resolver";
import { Client } from "pg";

const PGURL = process.env.NEX_LANGUAGE_POSTGRES_URL
  ?? process.env.NEX_TAXONOMY_POSTGRES_URL
  ?? process.env.NEX_POSTGRES_URL
  ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";

let SEED_PRESENT = false;
beforeAll(async () => {
  invalidateQuestionCache();
  const c = new Client({ connectionString: PGURL });
  try {
    await c.connect();
    const r = await c.query("SELECT question_id FROM nex.questions LIMIT 1");
    SEED_PRESENT = r.rows.length > 0;
  } finally { try { await c.end(); } catch { /* ignore */ } }
});

describe("matchQuestion · Layer 2 patterns", () => {
  it("matches 'what does migration mean' → explain with entity=migration", async () => {
    if (!SEED_PRESENT) return;
    const m = await matchQuestion("what does migration mean");
    expect(m).not.toBeNull();
    expect(m!.intent_slug).toBe("explain");
    expect(m!.entities.entity).toBe("migration");
    expect(m!.answer_type).toBe("definition");
  });

  it("matches 'what is a route' → explain with entity=route", async () => {
    if (!SEED_PRESENT) return;
    const m = await matchQuestion("what is a route");
    expect(m).not.toBeNull();
    expect(m!.intent_slug).toBe("explain");
    expect(m!.entities.entity).toBe("route");
  });

  it("matches 'define postgres' → explain with entity=postgres", async () => {
    if (!SEED_PRESENT) return;
    const m = await matchQuestion("define postgres");
    expect(m).not.toBeNull();
    expect(m!.intent_slug).toBe("explain");
    expect(m!.entities.entity).toBe("postgres");
  });

  it("matches 'chuck in a new endpoint' → add_feature with entity=new endpoint", async () => {
    if (!SEED_PRESENT) return;
    const m = await matchQuestion("chuck in a new endpoint");
    expect(m).not.toBeNull();
    expect(m!.intent_slug).toBe("add_feature");
    expect(m!.entities.entity).toBe("new endpoint");
  });

  it("matches 'add a migration for user_preferences table' → add_migration", async () => {
    if (!SEED_PRESENT) return;
    const m = await matchQuestion("add a migration for user_preferences table");
    expect(m).not.toBeNull();
    expect(m!.intent_slug).toBe("add_migration");
    expect(m!.entities.entity).toBe("user_preferences table");
  });

  it("matches 'sort out the login route' → fix_bug", async () => {
    if (!SEED_PRESENT) return;
    const m = await matchQuestion("sort out the login route");
    expect(m).not.toBeNull();
    expect(m!.intent_slug).toBe("fix_bug");
    expect(m!.entities.entity).toBe("the login route");
  });

  it("matches 'what can you programe' → capabilities · no entity", async () => {
    if (!SEED_PRESENT) return;
    const m = await matchQuestion("what can you programe");
    expect(m).not.toBeNull();
    expect(m!.intent_slug).toBe("capabilities");
    expect(m!.answer_type).toBe("list");
  });

  it("matches bare 'hey' → small_talk", async () => {
    if (!SEED_PRESENT) return;
    const m = await matchQuestion("hey");
    expect(m).not.toBeNull();
    expect(m!.intent_slug).toBe("small_talk");
  });

  it("returns null for gibberish", async () => {
    if (!SEED_PRESENT) return;
    const m = await matchQuestion("xkcd wibble frobnicate zorp");
    expect(m).toBeNull();
  });

  it("prefers the LONGER literal pattern when two could match", async () => {
    if (!SEED_PRESENT) return;
    // 'add a new migration' is longer than 'add a {entity}' · should win
    const m = await matchQuestion("add a new migration");
    expect(m).not.toBeNull();
    expect(m!.intent_slug).toBe("add_migration");
  });

  it("attaches concept_id when the pattern names one", async () => {
    if (!SEED_PRESENT) return;
    const m = await matchQuestion("add a new migration");
    expect(m!.concept_id).not.toBeNull();
  });
});
