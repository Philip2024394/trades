#!/usr/bin/env node
// scripts/nex-agent-seed-v12t.mjs
//
// Founder 2026-09-10 · V1.2-T training seed · adds:
//   1. 11th competency domain "reasoning_diagnosis"
//   2. 5 new lessons around DB / migration / self-repair reasoning
//   3. Backfills competency_domain_key on any lesson that still lacks it
// Idempotent · safe to re-run.

import { Client } from "pg";

const NEW_COMPETENCY = {
  domain_key: "reasoning_diagnosis",
  domain_label: "Reasoning diagnosis",
  description: "Given an unknown verification failure · reads the affected code · forms a structured hypothesis (cause + patch shape + confidence) for reviewer approval.",
  target_score: 5,
  required_for_tier: "HIGH",
};

const LESSONS = [
  {
    lesson_key: "diagnose_ts2339_missing_property",
    lesson_kind: "reject_bad_code",
    difficulty: "intermediate",
    competency_domain_key: "reasoning_diagnosis",
    title: "Diagnose: TS2339 · property does not exist",
    description: "Read the snippet + the fake typecheck output. Form a structured diagnosis: cause · patch_shape · confidence.",
    material: {
      snippet: "function f(user: { name: string }) { console.log(user.emailAdress); }",
      pretend_finding: { rule: "TS2339", file: "src/foo.ts", line: 1, message: "Property 'emailAdress' does not exist on type '{ name: string; }'." },
    },
    expected_answer: { verdict: "diagnose_only", suggested_shape_should_mention: ["typo", "type widening", "narrowing"] },
    passing_criteria: { must_include: ["typo", "property", "type"], requires_field: ["snippet", "verdict"], min_understanding_score: 0.6 },
  },
  {
    lesson_key: "pick_migration_number",
    lesson_kind: "pick_canonical_path",
    difficulty: "intermediate",
    competency_domain_key: "migration_reasoning",
    title: "Pick canonical path for: next migration file",
    description: "Given kind='migration_new_pg' + name='add_founder_kudos', return the canonical path template. Then reason about which NUMBER to use.",
    material: { kind: "migration_new_pg", name: "add_founder_kudos" },
    expected_answer: { path_starts_with: "db/migrations/", path_ends_with: ".sql", pick_next_available_number: true },
    passing_criteria: { must_include: ["db/migrations/", ".sql"], requires_field: ["canonical_path", "rationale"], min_understanding_score: 0.7 },
  },
  {
    lesson_key: "identify_write_target_never_allowed",
    lesson_kind: "identify_protected_files",
    difficulty: "intermediate",
    competency_domain_key: "database_reasoning",
    title: "Identify: paths writeFileSafe MUST refuse",
    description: "Given a set of paths a proposed patch wants to write to, identify every one writeFileSafe should refuse.",
    material: {
      paths: [
        "data/nex-agent-workspaces/task-abc12345/src/app/api/health/route.ts",
        "data/nex-agent-workspaces/task-abc12345/rules/architecture.json",
        "src/app/api/nex/health/route.ts",
        "data/nex-agent-workspaces/task-abc12345/db/migrations/999_foo.sql",
      ],
    },
    expected_answer: { must_refuse: ["rules/architecture.json", "src/app/api/", "db/migrations/"] },
    passing_criteria: { must_include: ["rules", "protected", "migrations"], requires_field: ["protected_paths", "rationale"], min_understanding_score: 0.7 },
  },
  {
    lesson_key: "reject_bad_migration_delete",
    lesson_kind: "reject_bad_code",
    difficulty: "intermediate",
    competency_domain_key: "migration_reasoning",
    title: "Reject: migration that DELETEs rows without transaction",
    description: "Look at this SQL. Identify what's wrong for a production migration.",
    material: {
      snippet: "-- 042_cleanup.sql\nDELETE FROM nex.accommodation_business WHERE claim_status = 'discovered';\nCREATE TABLE new_thing (id UUID PRIMARY KEY);",
    },
    expected_answer: {
      verdict: "REJECTED",
      reasons: ["no BEGIN/COMMIT transaction", "no rollback SQL comment", "DELETE without WHERE guard is high-risk", "modifies existing table without ALTER"],
    },
    passing_criteria: { must_reject: ["DELETE FROM", "no rollback"], must_include: ["rejected", "rollback"], requires_field: ["verdict", "violations_detected"], min_understanding_score: 0.6 },
  },
  {
    lesson_key: "plan_repair_ts2802_matchAll",
    lesson_kind: "implement_small_feature",
    difficulty: "intermediate",
    competency_domain_key: "self_repair",
    title: "Plan: repair for TS2802 matchAll iteration",
    description: "Given a TS2802 finding on matchAll, describe the deterministic fix and why it's safe.",
    material: {
      description: "TS2802 on line 42 of foo.ts: 'Type RegExpStringIterator can only be iterated through when using the --downlevelIteration flag'",
      suggested_path: "src/foo.ts",
      failing_line_context: "for (const m of str.matchAll(rx)) { ... }",
    },
    expected_answer: { fix_shape: "wrap matchAll in Array.from()", is_deterministic: true, is_safe: true },
    passing_criteria: { must_include: ["array.from", "matchall"], requires_field: ["description", "would_create_file", "plan_steps"], min_understanding_score: 0.5 },
  },
];

async function main() {
  const c = new Client({ connectionString: process.env.NEX_TAXONOMY_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev" });
  await c.connect();

  // 1. Add reasoning_diagnosis competency
  const existing = await c.query(`SELECT competency_id FROM nex_agent.competencies WHERE domain_key=$1`, [NEW_COMPETENCY.domain_key]);
  if (existing.rows.length === 0) {
    await c.query(`INSERT INTO nex_agent.competencies (domain_key, domain_label, description, target_score, required_for_tier) VALUES ($1,$2,$3,$4,$5)`,
      [NEW_COMPETENCY.domain_key, NEW_COMPETENCY.domain_label, NEW_COMPETENCY.description, NEW_COMPETENCY.target_score, NEW_COMPETENCY.required_for_tier]);
    console.log("competency added: reasoning_diagnosis");
  } else {
    await c.query(`UPDATE nex_agent.competencies SET domain_label=$1, description=$2, target_score=$3, required_for_tier=$4, last_updated_at=now() WHERE domain_key=$5`,
      [NEW_COMPETENCY.domain_label, NEW_COMPETENCY.description, NEW_COMPETENCY.target_score, NEW_COMPETENCY.required_for_tier, NEW_COMPETENCY.domain_key]);
    console.log("competency updated: reasoning_diagnosis");
  }

  // 2. Seed lessons
  let inserted = 0, updated = 0;
  for (const L of LESSONS) {
    const has = await c.query(`SELECT lesson_id FROM nex_agent.lessons WHERE lesson_key=$1`, [L.lesson_key]);
    if (has.rows.length === 0) {
      await c.query(
        `INSERT INTO nex_agent.lessons (lesson_key, lesson_kind, title, description, material, expected_answer, passing_criteria, difficulty, competency_domain_key, curated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'claude_mentor')`,
        [L.lesson_key, L.lesson_kind, L.title, L.description, JSON.stringify(L.material), JSON.stringify(L.expected_answer), JSON.stringify(L.passing_criteria), L.difficulty, L.competency_domain_key],
      );
      inserted++;
    } else {
      await c.query(
        `UPDATE nex_agent.lessons SET lesson_kind=$1, title=$2, description=$3, material=$4, expected_answer=$5, passing_criteria=$6, difficulty=$7, competency_domain_key=$8 WHERE lesson_key=$9`,
        [L.lesson_kind, L.title, L.description, JSON.stringify(L.material), JSON.stringify(L.expected_answer), JSON.stringify(L.passing_criteria), L.difficulty, L.competency_domain_key, L.lesson_key],
      );
      updated++;
    }
  }
  console.log(`V1.2-T lessons · seeded ${inserted} new · updated ${updated} existing`);
  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
