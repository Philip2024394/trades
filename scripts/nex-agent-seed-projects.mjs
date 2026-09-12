#!/usr/bin/env node
// scripts/nex-agent-seed-projects.mjs
//
// Founder 2026-09-10 · V1.3-T · seed 4 projects.
// 2 SEEN (nex1 practices) · 2 UNSEEN (never used for training · ONLY for evaluation).
// Passing an UNSEEN project is the strongest possible signal that nex1 has
// GENERALIZED rather than memorised the lesson corpus.
// Idempotent · uses project_key as unique identifier.

import { Client } from "pg";

const PROJECTS = [
  // ─── SEEN #1 · small ── health endpoint
  {
    project_key: "seen_small_health_endpoint",
    title: "Add /api/nex/health endpoint",
    description: "Add a new API route at /api/nex/health that returns { ok, ts_iso, version }. Follows all NEX conventions · no new dependencies.",
    difficulty: "small",
    unseen_evaluation: false,
    competency_domains: ["architecture_reading", "api_structure", "feature_planning", "testing", "project_completion"],
    brief_material: { canonical_kind: "api_route", suggested_path: "src/app/api/nex/health/route.ts" },
    milestones: [
      { id: "m1", name: "Pick canonical path", kind: "pick_path", material: { kind: "api_route", name: "nex/health" }, passing_criteria: { must_include: ["src/app/api/", "route.ts"], requires_field: ["canonical_path", "canonical_template"], min_understanding_score: 0.7 } },
      { id: "m2", name: "Compose plan", kind: "plan", material: { description: "Add /api/nex/health returning { ok, ts_iso, version }", suggested_path: "src/app/api/nex/health/route.ts" }, passing_criteria: { must_include: ["route.ts", "typecheck", "runtime=nodejs"], requires_field: ["plan_steps", "verification_gates", "would_create_file"], min_understanding_score: 0.7 } },
      { id: "m3", name: "Verify plan includes gates", kind: "verify", material: { plan_to_verify: { verification_gates: ["typecheck", "lint", "unit_tests", "architecture_scan"] } }, passing_criteria: { must_include: ["typecheck", "lint"], requires_field: ["has_typecheck", "has_lint", "has_tests", "verdict"], min_understanding_score: 0.75 } },
    ],
    passing_criteria: { min_understanding_score: 0.7 },
  },
  // ─── SEEN #2 · medium ── the founder's example
  {
    project_key: "seen_medium_nex_service_capability",
    title: "Add a NEX service exposing health · version · capabilities",
    description: "Add a new NEX service that exposes health, version and capability information, integrates with existing NEX conventions (leading // comment · pg direct · no @supabase/*), has tests, and does not introduce dependencies.",
    difficulty: "medium",
    unseen_evaluation: false,
    competency_domains: ["architecture_reading", "api_structure", "feature_planning", "testing", "dependency_rejection", "project_completion"],
    brief_material: { canonical_kind: "api_route" },
    milestones: [
      { id: "m1", name: "Reject bad snippet using supabase", kind: "reject", material: { snippet: "import { createClient } from '@supabase/supabase-js';\nexport async function GET(){ return {ok:true}; }" }, passing_criteria: { must_reject: ["@supabase/"], must_include: ["rejected", "adr"], requires_field: ["verdict", "violations_detected"], min_understanding_score: 0.7 } },
      { id: "m2", name: "Pick canonical path", kind: "pick_path", material: { kind: "api_route", name: "nex/capabilities" }, passing_criteria: { must_include: ["src/app/api/", "route.ts"], requires_field: ["canonical_path"], min_understanding_score: 0.7 } },
      { id: "m3", name: "Compose plan · no new deps", kind: "plan", material: { description: "Service exposing health + version + capabilities · no new deps · has tests", suggested_path: "src/app/api/nex/capabilities/route.ts" }, passing_criteria: { must_include: ["route.ts", "test", "adr-0300"], must_reject: ["@supabase/"], requires_field: ["plan_steps", "verification_gates", "doctrine_refs"], min_understanding_score: 0.65 } },
      { id: "m4", name: "Verify plan gates", kind: "verify", material: { plan_to_verify: { verification_gates: ["typecheck", "lint", "unit_tests", "architecture_scan"] } }, passing_criteria: { must_include: ["typecheck", "lint"], requires_field: ["has_tests"], min_understanding_score: 0.75 } },
    ],
    passing_criteria: { min_understanding_score: 0.65 },
  },
  // ─── UNSEEN #1 · small ── the founder's example · NEVER trained on
  {
    project_key: "unseen_small_user_preferences",
    title: "[UNSEEN EVAL] Store + retrieve user preference during chat",
    description: "Add a new NEX API feature that stores a user's preference (key/value pair per user) and retrieves it during conversation processing. Figure out: where it belongs · what storage · what security rules · what tests. Nothing in the lesson corpus explicitly teaches this.",
    difficulty: "small",
    unseen_evaluation: true,
    competency_domains: ["unseen_task_success", "database_reasoning", "api_structure", "feature_planning", "security_reasoning"],
    brief_material: { canonical_kind: "api_route + migration + library" },
    milestones: [
      { id: "m1", name: "Pick canonical API path for preference save", kind: "pick_path", material: { kind: "api_route", name: "nex/user-preferences" }, passing_criteria: { must_include: ["src/app/api/", "route.ts"], requires_field: ["canonical_path"], min_understanding_score: 0.7 } },
      { id: "m2", name: "Compose migration SQL for nex.user_preferences", kind: "compose_sql", material: { schema: "nex", table: "user_preferences", columns: ["user_id UUID NOT NULL", "preference_key TEXT NOT NULL", "preference_value JSONB NOT NULL", "updated_at TIMESTAMPTZ NOT NULL DEFAULT now()", "PRIMARY KEY (user_id, preference_key)"] }, passing_criteria: { must_include: ["CREATE TABLE", "IF NOT EXISTS", "ROLLBACK"], requires_field: ["composed_sql", "has_rollback_block", "uses_if_not_exists"], min_understanding_score: 0.7 } },
      { id: "m3", name: "Reject a bad implementation using supabase auth", kind: "reject", material: { snippet: "import { createClient } from '@supabase/auth-helpers-nextjs';\nconst supabase = createClient();\nawait supabase.from('user_prefs').insert({user_id, key, value});" }, passing_criteria: { must_reject: ["@supabase/", "createClient"], must_include: ["rejected", "adr"], requires_field: ["verdict", "violations_detected"], min_understanding_score: 0.65 } },
      { id: "m4", name: "Plan the full feature", kind: "plan", material: { description: "Store user preferences · retrieve during chat · pg direct · no supabase · has tests", suggested_path: "src/app/api/nex/user-preferences/route.ts" }, passing_criteria: { must_include: ["route.ts", "test", "pg"], must_reject: ["@supabase/"], requires_field: ["plan_steps", "verification_gates"], min_understanding_score: 0.6 } },
      { id: "m5", name: "Verify plan gates", kind: "verify", material: { plan_to_verify: { verification_gates: ["typecheck", "lint", "unit_tests", "architecture_scan"] } }, passing_criteria: { must_include: ["typecheck"], requires_field: ["has_tests"], min_understanding_score: 0.75 } },
    ],
    passing_criteria: { min_understanding_score: 0.65 },
  },
  // ─── UNSEEN #2 · medium ── rate-limit middleware · adjacent to nothing in the corpus
  {
    project_key: "unseen_medium_rate_limit_middleware",
    title: "[UNSEEN EVAL] Rate-limit middleware for API routes",
    description: "Add a rate-limit middleware for NEX API routes with configurable requests-per-minute per route. Must not introduce new deps. Must be doctrine-compliant. Figure out where middleware lives in Next.js apps and how to structure it.",
    difficulty: "medium",
    unseen_evaluation: true,
    competency_domains: ["unseen_task_success", "architecture_reading", "api_structure", "security_reasoning", "feature_planning"],
    brief_material: {},
    milestones: [
      { id: "m1", name: "Explain existing agent-runtime rate governor", kind: "explain", material: { path: "src/lib/nex-hq/provider-rate-governor.ts" }, passing_criteria: { must_include: ["rate", "governor"], requires_field: ["target_path"], min_understanding_score: 0.5 } },
      { id: "m2", name: "Pick canonical library path", kind: "pick_path", material: { kind: "library", name: "api-rate-limit" }, passing_criteria: { must_include: ["src/lib/nex/", "index.ts"], requires_field: ["canonical_path"], min_understanding_score: 0.7 } },
      { id: "m3", name: "Plan the middleware", kind: "plan", material: { description: "Rate limit middleware · configurable RPM per route · no new deps · uses pg for shared state", suggested_path: "src/lib/nex/api-rate-limit/index.ts" }, passing_criteria: { must_include: ["typecheck", "test"], must_reject: ["@supabase/"], requires_field: ["plan_steps", "verification_gates"], min_understanding_score: 0.6 } },
      { id: "m4", name: "Reject an implementation that uses Redis as a new dep", kind: "reject", material: { snippet: "import Redis from 'ioredis';\nconst redis = new Redis(process.env.REDIS_URL);\nawait redis.incr('rate:'+ip);" }, passing_criteria: { must_include: ["dependency", "adr"], requires_field: ["verdict", "violations_detected"], min_understanding_score: 0.4 } },
    ],
    passing_criteria: { min_understanding_score: 0.55 },
  },
];

async function main() {
  const c = new Client({ connectionString: process.env.NEX_TAXONOMY_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev" });
  await c.connect();
  let inserted = 0, updated = 0;
  for (const P of PROJECTS) {
    const has = await c.query(`SELECT project_id FROM nex_agent.projects WHERE project_key=$1`, [P.project_key]);
    if (has.rows.length === 0) {
      await c.query(
        `INSERT INTO nex_agent.projects (project_key, title, description, brief_material, milestones, expected_outcome, passing_criteria, unseen_evaluation, difficulty, competency_domains, curated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'claude_mentor')`,
        [P.project_key, P.title, P.description, JSON.stringify(P.brief_material), JSON.stringify(P.milestones), JSON.stringify({}), JSON.stringify(P.passing_criteria), P.unseen_evaluation, P.difficulty, JSON.stringify(P.competency_domains)],
      );
      inserted++;
    } else {
      await c.query(
        `UPDATE nex_agent.projects SET title=$1, description=$2, brief_material=$3, milestones=$4, passing_criteria=$5, unseen_evaluation=$6, difficulty=$7, competency_domains=$8 WHERE project_key=$9`,
        [P.title, P.description, JSON.stringify(P.brief_material), JSON.stringify(P.milestones), JSON.stringify(P.passing_criteria), P.unseen_evaluation, P.difficulty, JSON.stringify(P.competency_domains), P.project_key],
      );
      updated++;
    }
  }
  console.log(`projects · seeded ${inserted} new · updated ${updated} existing`);
  const stats = await c.query(`SELECT unseen_evaluation, count(*)::int c FROM nex_agent.projects GROUP BY unseen_evaluation`);
  for (const r of stats.rows) console.log(`  ${r.unseen_evaluation ? "UNSEEN" : "SEEN "} · ${r.c}`);
  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
