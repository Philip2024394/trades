#!/usr/bin/env node
// scripts/nex-agent-seed-v13t-adr.mjs
//
// Founder 2026-09-10 · V1.3-T · seed 3 ADR IMPACT lessons.
// Trains nex1 to reason about WHY a change is allowed, not merely whether it compiles.

import { Client } from "pg";

const LESSONS = [
  {
    lesson_key: "adr_impact_supabase_new_feature",
    lesson_kind: "adr_impact",
    difficulty: "intermediate",
    competency_domain_key: "adr_impact_reasoning",
    title: "ADR IMPACT · feature that would introduce @supabase/*",
    description: "Given this feature description, produce an ADR IMPACT report. Every relevant ADR must be adjudicated PASS/FAIL/ATTENTION with reasoning.",
    material: {
      feature_description: "Add a new API route /api/nex/users that uses @supabase/supabase-js to fetch user records from a Supabase project.",
    },
    expected_answer: { blockers_should_include: ["ADR-0300", "D-002"], overall_verdict: "blocked" },
    passing_criteria: {
      must_include: ["adr-0300", "fail", "supabase"],
      requires_field: ["impacts", "overall_verdict", "blockers"],
      min_understanding_score: 0.65,
    },
  },
  {
    lesson_key: "adr_impact_clean_health_endpoint",
    lesson_kind: "adr_impact",
    difficulty: "intermediate",
    competency_domain_key: "adr_impact_reasoning",
    title: "ADR IMPACT · clean feature that should PASS every ADR",
    description: "Given this benign feature, produce an ADR IMPACT report. All ADRs should be PASS.",
    material: {
      feature_description: "Add a new API route /api/nex/health that returns { ok: true, ts_iso, uptime_sec }. Uses only Node built-ins. Includes a unit test.",
    },
    expected_answer: { blockers_should_be_empty: true, overall_verdict: "safe" },
    passing_criteria: {
      must_include: ["pass", "safe"],
      requires_field: ["impacts", "overall_verdict"],
      min_understanding_score: 0.6,
    },
  },
  {
    lesson_key: "adr_impact_image_copy_from_google",
    lesson_kind: "adr_impact",
    difficulty: "intermediate",
    competency_domain_key: "adr_impact_reasoning",
    title: "ADR IMPACT · feature that would copy Google Business Profile images",
    description: "This feature would violate ADR-0022. Produce the ADR IMPACT report showing the block.",
    material: {
      feature_description: "Add a cron that iterates through claimed merchants and copies their Google Business Profile photos from googleusercontent.com/.../photo URLs into NEX's image manifest so we can display them in the directory.",
    },
    expected_answer: { blockers_should_include: ["ADR-0022"], overall_verdict: "blocked" },
    passing_criteria: {
      must_include: ["adr-0022", "fail", "image"],
      requires_field: ["impacts", "overall_verdict", "blockers"],
      min_understanding_score: 0.6,
    },
  },
];

async function main() {
  const c = new Client({ connectionString: process.env.NEX_TAXONOMY_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev" });
  await c.connect();
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
  console.log(`V1.3-T ADR IMPACT lessons · seeded ${inserted} new · updated ${updated} existing`);
  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
