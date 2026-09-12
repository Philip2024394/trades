#!/usr/bin/env node
// scripts/nex-english-brain-e2-questions.mjs
//
// Founder BEGIN 2026-09-11 · E2 · seed nex.questions with canonical
// natural-English surface patterns. Each pattern says: "when a founder
// says something like THIS, the intent is X, the entities are these
// slots, and the expected answer type is Y".
//
// Placeholders in surface_pattern use `{entity}` syntax · the question
// resolver later extracts the actual token where {entity} sits.
//
// Guardian checks: surface_pattern must contain at least one non-whitespace
// character · intent_slug must be lower_snake_case · answer_type in enum.

import pg from "pg";
const { Client } = pg;

const PGURL = process.env.NEX_LANGUAGE_POSTGRES_URL
  ?? process.env.NEX_TAXONOMY_POSTGRES_URL
  ?? process.env.NEX_POSTGRES_URL
  ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";

const CAPTURED_BY = "e2_question_builder_2026_09_11";
const SOURCE_REF = "e2_seed_layer2_founder_authorized_continue";

// ═══════════════════════════════════════════════════════════════════
// Layer 2 · question surface patterns
// ═══════════════════════════════════════════════════════════════════
// answer_type: "definition" | "steps" | "list" | "fact" | "clarify" | "unknown"
// intent_slug: matches CODE_INTENT_REGISTRY slugs
// entity_slots: [{ name, kind }]  · kind in "noun_phrase" | "path" | "identifier"
// concept_key (optional): links to nex.concepts.canonical_key for direct lookup

const PATTERNS = [
  // ── Definition questions ────────────────────────────────
  { surface_pattern: "what is a {entity}",           intent_slug: "explain",        entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "definition", confidence: 0.95 },
  { surface_pattern: "what is {entity}",             intent_slug: "explain",        entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "definition", confidence: 0.95 },
  { surface_pattern: "what are {entity}",            intent_slug: "explain",        entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "definition", confidence: 0.9 },
  { surface_pattern: "what does {entity} mean",      intent_slug: "explain",        entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "definition", confidence: 0.97 },
  { surface_pattern: "what does {entity} do",        intent_slug: "explain",        entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "definition", confidence: 0.9 },
  { surface_pattern: "meaning of {entity}",          intent_slug: "explain",        entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "definition", confidence: 0.95 },
  { surface_pattern: "define {entity}",              intent_slug: "explain",        entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "definition", confidence: 0.98 },
  { surface_pattern: "definition of {entity}",       intent_slug: "explain",        entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "definition", confidence: 0.95 },
  { surface_pattern: "explain {entity}",             intent_slug: "explain",        entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "definition", confidence: 0.9 },
  { surface_pattern: "explain what {entity} is",     intent_slug: "explain",        entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "definition", confidence: 0.95 },
  { surface_pattern: "walk me through {entity}",     intent_slug: "explain",        entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "steps",      confidence: 0.9 },
  { surface_pattern: "walk me through what {entity} means", intent_slug: "explain", entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "definition", confidence: 0.9 },
  { surface_pattern: "how does {entity} work",       intent_slug: "explain",        entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "definition", confidence: 0.92 },

  // ── Operational · add ────────────────────────────────────
  { surface_pattern: "add a {entity}",               intent_slug: "add_feature",    entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "unknown",    confidence: 0.85 },
  { surface_pattern: "create a {entity}",            intent_slug: "add_feature",    entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "unknown",    confidence: 0.85 },
  { surface_pattern: "build a {entity}",             intent_slug: "add_feature",    entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "unknown",    confidence: 0.85 },
  { surface_pattern: "chuck in a {entity}",          intent_slug: "add_feature",    entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "unknown",    confidence: 0.85 },
  { surface_pattern: "bung in a {entity}",           intent_slug: "add_feature",    entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "unknown",    confidence: 0.85 },
  { surface_pattern: "knock up a {entity}",          intent_slug: "add_feature",    entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "unknown",    confidence: 0.85 },
  { surface_pattern: "add a new endpoint at {path}", intent_slug: "add_api_route",  entity_slots: [{ name: "path", kind: "path" }],          answer_type: "unknown",    confidence: 0.95 },
  { surface_pattern: "add a route at {path}",        intent_slug: "add_api_route",  entity_slots: [{ name: "path", kind: "path" }],          answer_type: "unknown",    confidence: 0.95 },
  { surface_pattern: "add a migration for {entity}", intent_slug: "add_migration",  entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "unknown",    confidence: 0.95, concept_key: "migration" },
  { surface_pattern: "add a new migration",          intent_slug: "add_migration",  entity_slots: [],                                       answer_type: "unknown",    confidence: 0.9,  concept_key: "migration" },
  { surface_pattern: "add tests for {entity}",       intent_slug: "add_test",       entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "unknown",    confidence: 0.95, concept_key: "test" },
  { surface_pattern: "write tests for {entity}",     intent_slug: "add_test",       entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "unknown",    confidence: 0.95, concept_key: "test" },

  // ── Operational · fix ────────────────────────────────────
  { surface_pattern: "fix {entity}",                 intent_slug: "fix_bug",        entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "unknown",    confidence: 0.85 },
  { surface_pattern: "sort out {entity}",            intent_slug: "fix_bug",        entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "unknown",    confidence: 0.9 },
  { surface_pattern: "patch up {entity}",            intent_slug: "fix_bug",        entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "unknown",    confidence: 0.9 },
  { surface_pattern: "why is {entity} broken",       intent_slug: "fix_bug",        entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "unknown",    confidence: 0.92 },
  { surface_pattern: "why does {entity} fail",       intent_slug: "fix_bug",        entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "unknown",    confidence: 0.9 },
  { surface_pattern: "{entity} is broken",           intent_slug: "fix_bug",        entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "unknown",    confidence: 0.88 },

  // ── Operational · refactor ───────────────────────────────
  { surface_pattern: "refactor {entity}",            intent_slug: "refactor",       entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "unknown",    confidence: 0.95, concept_key: "refactor" },
  { surface_pattern: "rename {entity}",              intent_slug: "refactor",       entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "unknown",    confidence: 0.9 },
  { surface_pattern: "clean up {entity}",            intent_slug: "refactor",       entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "unknown",    confidence: 0.88 },
  { surface_pattern: "tidy up {entity}",             intent_slug: "refactor",       entity_slots: [{ name: "entity", kind: "noun_phrase" }], answer_type: "unknown",    confidence: 0.88 },

  // ── Meta / capabilities ──────────────────────────────────
  { surface_pattern: "what can you do",              intent_slug: "capabilities",   entity_slots: [], answer_type: "list", confidence: 0.98 },
  { surface_pattern: "what can you code",            intent_slug: "capabilities",   entity_slots: [], answer_type: "list", confidence: 0.98 },
  { surface_pattern: "what can you programe",        intent_slug: "capabilities",   entity_slots: [], answer_type: "list", confidence: 0.98 },
  { surface_pattern: "what can you program",         intent_slug: "capabilities",   entity_slots: [], answer_type: "list", confidence: 0.98 },
  { surface_pattern: "how can you help",             intent_slug: "capabilities",   entity_slots: [], answer_type: "list", confidence: 0.95 },
  { surface_pattern: "what are you capable of",      intent_slug: "capabilities",   entity_slots: [], answer_type: "list", confidence: 0.95 },
  { surface_pattern: "list your capabilities",       intent_slug: "capabilities",   entity_slots: [], answer_type: "list", confidence: 0.95 },
  { surface_pattern: "hi",                           intent_slug: "small_talk",     entity_slots: [], answer_type: "fact", confidence: 0.85 },
  { surface_pattern: "hey",                          intent_slug: "small_talk",     entity_slots: [], answer_type: "fact", confidence: 0.85 },
  { surface_pattern: "hello",                        intent_slug: "small_talk",     entity_slots: [], answer_type: "fact", confidence: 0.85 },
];

const VALID_ANSWER_TYPES = new Set(["definition", "steps", "list", "fact", "clarify", "unknown"]);
const VALID_INTENT_SLUGS = new Set(["explain", "add_feature", "fix_bug", "refactor", "add_migration", "add_api_route", "add_test", "explain_error", "capabilities", "small_talk"]);
const INTENT_SLUG_RE = /^[a-z][a-z0-9_]*$/;

function guardQuestion(q) {
  if (!q.surface_pattern || q.surface_pattern.trim().length < 2) return { ok: false, reason: "surface_pattern_empty" };
  if (!INTENT_SLUG_RE.test(q.intent_slug)) return { ok: false, reason: `intent_slug_format:${q.intent_slug}` };
  if (!VALID_INTENT_SLUGS.has(q.intent_slug)) return { ok: false, reason: `intent_slug_unknown:${q.intent_slug}` };
  if (!VALID_ANSWER_TYPES.has(q.answer_type)) return { ok: false, reason: `answer_type_invalid:${q.answer_type}` };
  if (!Array.isArray(q.entity_slots)) return { ok: false, reason: "entity_slots_not_array" };
  if (q.confidence < 0 || q.confidence > 1) return { ok: false, reason: "confidence_range" };
  return { ok: true };
}

async function main() {
  const c = new Client({ connectionString: PGURL });
  await c.connect();
  const stats = { patterns_seen: 0, patterns_inserted: 0, patterns_updated: 0, evidence_inserted: 0, guardian_rejects: 0 };
  try {
    for (const p of PATTERNS) {
      stats.patterns_seen++;
      const g = guardQuestion(p);
      if (!g.ok) { console.log(`  ✗ ${p.surface_pattern}: ${g.reason}`); stats.guardian_rejects++; continue; }
      // Resolve optional concept_id
      let conceptId = null;
      if (p.concept_key) {
        const r = await c.query(`SELECT concept_id FROM nex.concepts WHERE canonical_key=$1`, [p.concept_key]);
        conceptId = r.rows[0]?.concept_id ?? null;
      }
      // Dedupe by surface_pattern
      const existing = await c.query(`SELECT question_id FROM nex.questions WHERE surface_pattern=$1 LIMIT 1`, [p.surface_pattern]);
      if (existing.rows.length > 0) {
        await c.query(
          `UPDATE nex.questions SET intent_slug=$2, entity_slots=$3::jsonb, concept_id=$4, answer_type=$5, confidence=$6, status='authoritative' WHERE question_id=$1`,
          [existing.rows[0].question_id, p.intent_slug, JSON.stringify(p.entity_slots), conceptId, p.answer_type, p.confidence]
        );
        stats.patterns_updated++;
      } else {
        const row = (await c.query(
          `INSERT INTO nex.questions (surface_pattern, intent_slug, entity_slots, concept_id, answer_type, confidence, status)
           VALUES ($1, $2, $3::jsonb, $4, $5, $6, 'authoritative')
           RETURNING question_id`,
          [p.surface_pattern, p.intent_slug, JSON.stringify(p.entity_slots), conceptId, p.answer_type, p.confidence]
        )).rows[0];
        await c.query(
          `INSERT INTO nex.evidence (subject_kind, subject_id, source_ref, trust_layer, confidence, captured_by)
           VALUES ('question', $1, $2, 'canonical_verified', $3, $4)`,
          [row.question_id, SOURCE_REF, p.confidence, CAPTURED_BY]
        );
        stats.patterns_inserted++;
        stats.evidence_inserted++;
      }
      console.log(`  ✓ ${p.surface_pattern} → ${p.intent_slug} (${p.answer_type})`);
    }
    console.log("\n=== Layer 2 seed complete ===");
    console.log("stats:", JSON.stringify(stats));
  } finally { await c.end(); }
}

main().catch(e => { console.error(e); process.exit(1); });
