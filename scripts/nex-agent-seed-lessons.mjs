#!/usr/bin/env node
// scripts/nex-agent-seed-lessons.mjs
//
// Founder 2026-09-10 · seed 5 canonical training lessons for NEX1.
// Idempotent · uses lesson_key as unique identifier.
// The seed set covers: read+explain · reject-bad-code · protected-file identification ·
// canonical-path selection · doctrine recognition · small feature planning.

import { Client } from "pg";

const LESSONS = [
  {
    lesson_key: "explain_control_plane",
    lesson_kind: "explain_module",
    difficulty: "foundational",
    title: "Read + explain: agent-runtime/control-plane.ts",
    description: "Read the control-plane module. Summarise its purpose using only its top-of-file comment.",
    material: { path: "src/lib/nex/agent-runtime/control-plane.ts" },
    expected_answer: { must_reference: ["spawn", "detached", "unref", "founder authorization"] },
    passing_criteria: {
      must_include: ["control plane", "spawn", "detached", "founder"],
      requires_field: ["tool", "target_path", "summary"],
      min_understanding_score: 0.7,
    },
  },
  {
    lesson_key: "reject_supabase_import",
    lesson_kind: "reject_bad_code",
    difficulty: "foundational",
    title: "Reject: @supabase/supabase-js in a new module",
    description: "Look at the code snippet. Identify what's wrong and propose a NEX-compliant alternative.",
    material: {
      snippet: "import { createClient } from '@supabase/supabase-js';\nconst client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);\nexport async function getUser(id) { return client.from('users').select('*').eq('id', id).single(); }",
    },
    expected_answer: {
      verdict: "REJECTED",
      reasons: ["ADR-0300 · phase out supabase", "no new @supabase/* imports"],
      correct_approach: "route to `pg` directly · use pool from lib/nex/postgres",
    },
    passing_criteria: {
      must_reject: ["@supabase/", "createClient"],
      must_include: ["rejected", "adr"],
      requires_field: ["verdict", "violations_detected", "rationale"],
      min_understanding_score: 0.75,
    },
  },
  {
    lesson_key: "identify_protected_files_batch",
    lesson_kind: "identify_protected_files",
    difficulty: "foundational",
    title: "Identify: which of these paths are protected?",
    description: "Given a list of paths, run architecture_scan and flag every protected one with the rule that protects it.",
    material: {
      paths: [
        "src/lib/tierCatalog.ts",
        "src/lib/nex/agent-runtime/watchdog.ts",
        "src/app/api/nex/health/route.ts",
        "docs/DECISIONS/0022-merchant-images-no-third-party-copy.md",
        "db/migrations/999_new_hypothetical.sql",
        "rules/architecture.json",
      ],
    },
    expected_answer: {
      protected_hits: ["src/lib/tierCatalog.ts", "rules/architecture.json", "src/lib/nex/agent-runtime/watchdog.ts", "docs/DECISIONS/0022-merchant-images-no-third-party-copy.md"],
      append_only_permitted: ["db/migrations/999_new_hypothetical.sql"],
    },
    passing_criteria: {
      must_include: ["tierCatalog.ts", "architecture.json", "watchdog.ts", "docs/DECISIONS/"],
      requires_field: ["protected_paths", "info_paths", "rationale"],
      min_understanding_score: 0.7,
    },
  },
  {
    lesson_key: "pick_canonical_path_api_route",
    lesson_kind: "pick_canonical_path",
    difficulty: "foundational",
    title: "Pick canonical path for: a new API route",
    description: "Given kind='api_route' + name='/nex/health/deep', return the canonical file path per rules/architecture.json.",
    material: { kind: "api_route", name: "nex/health/deep" },
    expected_answer: { canonical_path_should_end_with: "route.ts", canonical_path_should_start_with: "src/app/api/" },
    passing_criteria: {
      must_include: ["src/app/api/", "route.ts"],
      requires_field: ["canonical_template", "canonical_path", "rationale"],
      min_understanding_score: 0.75,
    },
  },
  {
    lesson_key: "plan_health_endpoint_feature",
    lesson_kind: "implement_small_feature",
    difficulty: "foundational",
    title: "Plan: /api/nex/health returns { ok, ts_iso }",
    description: "Produce a plan (files · steps · verification) for a minimum health-check endpoint. Do NOT introduce any new dependency.",
    material: {
      description: "Add a new API route /api/nex/health that returns { ok: true, ts_iso: <ISO>, uptime_sec: <number> }",
      suggested_path: "src/app/api/nex/health/route.ts",
    },
    expected_answer: {
      files_to_create: ["src/app/api/nex/health/route.ts"],
      verification_gates: ["typecheck", "lint", "unit_tests"],
      must_not_add_dependencies: true,
    },
    passing_criteria: {
      must_include: ["route.ts", "typecheck", "lint"],
      must_reject: ["@supabase/", "supabase"],
      requires_field: ["description", "would_create_file", "plan_steps"],
      min_understanding_score: 0.7,
    },
  },
];

async function main() {
  const c = new Client({ connectionString: process.env.NEX_TAXONOMY_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev" });
  await c.connect();
  let inserted = 0, updated = 0;
  for (const L of LESSONS) {
    const existing = await c.query(`SELECT lesson_id FROM nex_agent.lessons WHERE lesson_key = $1`, [L.lesson_key]);
    if (existing.rows.length > 0) {
      await c.query(
        `UPDATE nex_agent.lessons SET lesson_kind=$1, title=$2, description=$3, material=$4, expected_answer=$5, passing_criteria=$6, difficulty=$7 WHERE lesson_key=$8`,
        [L.lesson_kind, L.title, L.description, JSON.stringify(L.material), JSON.stringify(L.expected_answer), JSON.stringify(L.passing_criteria), L.difficulty, L.lesson_key],
      );
      updated++;
    } else {
      await c.query(
        `INSERT INTO nex_agent.lessons (lesson_key, lesson_kind, title, description, material, expected_answer, passing_criteria, difficulty, curated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'claude_mentor')`,
        [L.lesson_key, L.lesson_kind, L.title, L.description, JSON.stringify(L.material), JSON.stringify(L.expected_answer), JSON.stringify(L.passing_criteria), L.difficulty],
      );
      inserted++;
    }
  }
  console.log(`seeded ${inserted} new lessons · updated ${updated} existing`);
  await c.end();
}
main().catch(e => { console.error("fatal:", e.message); process.exit(1); });
