#!/usr/bin/env node
// scripts/nex-agent-seed-unseen-families.mjs
//
// Founder 2026-09-10 · seed one UNSEEN project per remaining family (C..G).
// Existing seeds cover: data_state (user_preferences) + api_infra (rate_limit).
// This file adds: ui · database · security · storage · ai · so all 7 families
// have at least one unseen evaluation project each.
// Idempotent.

import { Client } from "pg";

const PROJECTS = [
  {
    project_key: "unseen_ui_hq_founder_notes_panel",
    unseen_family: "ui",
    difficulty: "medium",
    title: "[UNSEEN · UI] Add HQ panel showing latest 10 founder notes",
    description: "Add a new panel in HQ that lists the 10 most recent founder notes with created_at. Uses existing HQ shell conventions · no new dependencies · no supabase.",
    competency_domains: ["unseen_task_success", "architecture_reading", "api_structure", "feature_planning"],
    milestones: [
      { id: "m1", name: "Pick canonical UI page path", kind: "pick_path", material: { kind: "page", name: "nex-head-quarters/founder-notes" }, passing_criteria: { must_include: ["src/app/", "page.tsx"], requires_field: ["canonical_path"], min_understanding_score: 0.65 } },
      { id: "m2", name: "Compose plan (read/write split · pg direct)", kind: "plan", material: { description: "HQ panel · list 10 founder notes · reuse HQShell shape · no supabase", suggested_path: "src/app/nex-head-quarters/founder-notes/page.tsx" }, passing_criteria: { must_include: ["page.tsx", "test"], must_reject: ["@supabase/"], requires_field: ["plan_steps", "verification_gates"], min_understanding_score: 0.6 } },
      { id: "m3", name: "Reject an implementation that fetches via supabase client", kind: "reject", material: { snippet: "import { createClient } from '@supabase/supabase-js';\nconst supabase = createClient(URL, KEY);\nawait supabase.from('founder_notes').select('*').limit(10);" }, passing_criteria: { must_reject: ["@supabase/"], must_include: ["rejected"], requires_field: ["verdict", "violations_detected"], min_understanding_score: 0.6 } },
    ],
    passing_criteria: { min_understanding_score: 0.6 },
  },
  {
    project_key: "unseen_database_indexed_search",
    unseen_family: "database",
    difficulty: "medium",
    title: "[UNSEEN · DB] Add indexed search on business_lead_directory.name",
    description: "Add a new migration that creates a trigram GIN index on nex.business_lead_directory.business_name for prefix search. Include rollback SQL. Do not modify existing migrations.",
    competency_domains: ["unseen_task_success", "database_reasoning", "migration_reasoning", "feature_planning"],
    milestones: [
      { id: "m1", name: "Compose migration SQL with rollback", kind: "compose_sql", material: { schema: "nex", table: "business_lead_directory_trgm_ix", columns: ["-- CREATE EXTENSION IF NOT EXISTS pg_trgm; -- (comment · engineer confirms extension)", "-- placeholder: this project is testing the SHAPE of your answer"] }, passing_criteria: { must_include: ["ROLLBACK", "IF NOT EXISTS"], requires_field: ["composed_sql", "has_rollback_block"], min_understanding_score: 0.55 } },
      { id: "m2", name: "Pick migration path (canonical)", kind: "pick_path", material: { kind: "migration_new_pg", name: "trigram_index_business_names" }, passing_criteria: { must_include: ["db/migrations/", ".sql"], requires_field: ["canonical_path"], min_understanding_score: 0.7 } },
      { id: "m3", name: "Reject: modify an existing migration file", kind: "reject", material: { snippet: "-- db/migrations/001_nex_brain_schema.sql\n-- Adding a new column to the existing migration:\nALTER TABLE nex.accommodation_business ADD COLUMN foo TEXT;\n" }, passing_criteria: { must_reject: ["modify.*migration|edit.*(\\d{3,4})_"], must_include: ["append-only", "rejected"], requires_field: ["verdict"], min_understanding_score: 0.4 } },
    ],
    passing_criteria: { min_understanding_score: 0.55 },
  },
  {
    project_key: "unseen_security_authz_boundary",
    unseen_family: "security",
    difficulty: "medium",
    title: "[UNSEEN · SEC] Add authorization boundary for /api/admin/*",
    description: "Add a middleware that checks admin cookie for every /api/admin/* route. Reject bad implementations that leak secrets or bypass the boundary.",
    competency_domains: ["unseen_task_success", "security_reasoning", "adr_impact_reasoning", "api_structure"],
    milestones: [
      { id: "m1", name: "ADR IMPACT of introducing authz middleware", kind: "adr_impact", material: { feature_description: "Add a middleware that runs on every /api/admin/* request and refuses if no admin_authed cookie present. Never logs cookie value. No new dependencies." }, passing_criteria: { must_include: ["pass", "safe"], requires_field: ["impacts", "overall_verdict"], min_understanding_score: 0.55 } },
      { id: "m2", name: "Reject: implementation that logs the cookie", kind: "reject", material: { snippet: "export function middleware(req) {\n  const cookie = req.headers.get('cookie');\n  console.log('DEBUG cookie value:', cookie);\n  if (!/admin_authed/.test(cookie ?? '')) return new Response('nope', {status:401});\n  return NextResponse.next();\n}" }, passing_criteria: { must_include: ["log", "cookie"], requires_field: ["verdict"], min_understanding_score: 0.3 } },
      { id: "m3", name: "Pick canonical middleware path", kind: "pick_path", material: { kind: "library", name: "admin-authz-middleware" }, passing_criteria: { must_include: ["src/lib/nex/"], requires_field: ["canonical_path"], min_understanding_score: 0.6 } },
    ],
    passing_criteria: { min_understanding_score: 0.55 },
  },
  {
    project_key: "unseen_storage_upload_gb",
    unseen_family: "storage",
    difficulty: "medium",
    title: "[UNSEEN · STORAGE] Add image upload → GB Storage",
    description: "Add an endpoint that accepts an image upload, validates it, and stores via NEX GB Storage (never Supabase Storage). Uses only merchant-uploaded images per ADR-0022.",
    competency_domains: ["unseen_task_success", "security_reasoning", "adr_impact_reasoning", "api_structure"],
    milestones: [
      { id: "m1", name: "ADR IMPACT (Supabase Storage vs GB Storage · third-party copy)", kind: "adr_impact", material: { feature_description: "Add /api/nex/merchant-images/upload that accepts multipart image · validates size + mime · stores via NEX GB Storage. Only merchant-uploaded images allowed." }, passing_criteria: { must_include: ["pass", "safe"], requires_field: ["impacts", "overall_verdict"], min_understanding_score: 0.5 } },
      { id: "m2", name: "Reject: implementation that copies image from googleusercontent.com", kind: "reject", material: { snippet: "const src = 'https://lh3.googleusercontent.com/xyz/photo';\nconst r = await fetch(src);\nawait storage.put('merchant/'+id, await r.arrayBuffer());" }, passing_criteria: { must_reject: ["googleusercontent"], must_include: ["adr-0022", "rejected"], requires_field: ["verdict"], min_understanding_score: 0.5 } },
      { id: "m3", name: "Pick canonical upload route path", kind: "pick_path", material: { kind: "api_route", name: "nex/merchant-images/upload" }, passing_criteria: { must_include: ["src/app/api/", "route.ts"], requires_field: ["canonical_path"], min_understanding_score: 0.7 } },
    ],
    passing_criteria: { min_understanding_score: 0.55 },
  },
  {
    project_key: "unseen_ai_truth_engine_evidence",
    unseen_family: "ai",
    difficulty: "large",
    title: "[UNSEEN · AI] Add evidence-scored answer variant · Truth Engine aware",
    description: "Add a feature that returns an LLM-drafted answer with a confidence-band per claim, and refuses to output any claim <70% confidence. Must not treat LLM output as authoritative truth (ADR-0028).",
    competency_domains: ["unseen_task_success", "adr_impact_reasoning", "security_reasoning", "feature_planning"],
    milestones: [
      { id: "m1", name: "ADR IMPACT (Truth Engine · LLM-as-truth)", kind: "adr_impact", material: { feature_description: "Add an endpoint that asks LLM to answer, tags each claim with a confidence band. Every claim <0.70 is refused. LLM output is verified via architecture_scan and evidence links." }, passing_criteria: { must_include: ["pass", "adr-0028"], requires_field: ["impacts", "overall_verdict"], min_understanding_score: 0.5 } },
      { id: "m2", name: "Reject: implementation that returns raw LLM as truth", kind: "reject", material: { snippet: "const answer = await llm.complete(prompt);\nreturn NextResponse.json({ truth: answer, confidence: 1.0 });" }, passing_criteria: { must_include: ["truth", "verify"], requires_field: ["verdict"], min_understanding_score: 0.35 } },
      { id: "m3", name: "Plan · confidence-band + refusal rule", kind: "plan", material: { description: "Endpoint returns { claims: [{ text, confidence, evidence_refs }] } · refuse claims <0.70 · verify via architecture_scan + evidence lookup", suggested_path: "src/lib/nex/evidence-answer/index.ts" }, passing_criteria: { must_include: ["test", "typecheck", "adr-0028"], requires_field: ["plan_steps"], min_understanding_score: 0.5 } },
    ],
    passing_criteria: { min_understanding_score: 0.5 },
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
        `INSERT INTO nex_agent.projects (project_key, title, description, brief_material, milestones, expected_outcome, passing_criteria, unseen_evaluation, difficulty, competency_domains, unseen_family, curated_by)
         VALUES ($1,$2,$3,'{}'::jsonb,$4,'{}'::jsonb,$5,true,$6,$7,$8,'claude_mentor')`,
        [P.project_key, P.title, P.description, JSON.stringify(P.milestones), JSON.stringify(P.passing_criteria), P.difficulty, JSON.stringify(P.competency_domains), P.unseen_family],
      );
      inserted++;
    } else {
      await c.query(
        `UPDATE nex_agent.projects SET title=$1, description=$2, milestones=$3, passing_criteria=$4, difficulty=$5, competency_domains=$6, unseen_family=$7 WHERE project_key=$8`,
        [P.title, P.description, JSON.stringify(P.milestones), JSON.stringify(P.passing_criteria), P.difficulty, JSON.stringify(P.competency_domains), P.unseen_family, P.project_key],
      );
      updated++;
    }
  }
  console.log(`unseen-family projects · seeded ${inserted} new · updated ${updated} existing`);
  const s = await c.query(`SELECT unseen_family, count(*) c FROM nex_agent.projects WHERE unseen_evaluation=true GROUP BY unseen_family ORDER BY unseen_family`);
  console.log("families now:");
  for (const r of s.rows) console.log("  " + r.unseen_family + " · " + r.c);
  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
