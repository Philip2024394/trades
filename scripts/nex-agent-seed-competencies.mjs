#!/usr/bin/env node
// scripts/nex-agent-seed-competencies.mjs
//
// Founder 2026-09-10 · seed 10 canonical competency domains for the NEX1 ledger.
// Idempotent · uses domain_key as unique identifier.
// Also back-links the existing V1.1-T lessons to their proper competency domain.

import { Client } from "pg";

const DOMAINS = [
  { domain_key: "architecture_reading",  domain_label: "Architecture reading",   description: "Reads a NEX module and explains its purpose from top-of-file comment + imports.", target_score: 5, required_for_tier: "LOW"    },
  { domain_key: "protected_paths",       domain_label: "Protected paths",         description: "Recognizes which paths are protected + why (rules · migrations · ADRs · truth engine).", target_score: 5, required_for_tier: "LOW"    },
  { domain_key: "dependency_rejection",  domain_label: "Dependency rejection",    description: "Refuses forbidden packages (@supabase/*) and forbidden string patterns.", target_score: 5, required_for_tier: "LOW"    },
  { domain_key: "api_structure",         domain_label: "API structure",           description: "Picks canonical route path · adds leading // comment · uses runtime=nodejs / dynamic=force-dynamic correctly.", target_score: 5, required_for_tier: "MEDIUM" },
  { domain_key: "feature_planning",      domain_label: "Feature planning",        description: "Composes a plan with steps · files · acceptance test · verification gates.", target_score: 5, required_for_tier: "MEDIUM" },
  { domain_key: "testing",               domain_label: "Testing",                 description: "Writes a failing regression test first · uses vitest · minimum diff to green.", target_score: 5, required_for_tier: "MEDIUM" },
  { domain_key: "database_reasoning",    domain_label: "Database reasoning",      description: "Reads a schema · identifies FK integrity · writes SELECT queries · uses pg directly not supabase.", target_score: 5, required_for_tier: "HIGH"   },
  { domain_key: "migration_reasoning",   domain_label: "Migration reasoning",     description: "Picks next migration number · writes idempotent CREATE/ALTER · includes rollback SQL · never modifies existing.", target_score: 5, required_for_tier: "HIGH"   },
  { domain_key: "security_reasoning",    domain_label: "Security reasoning",      description: "Never logs secrets · validates inputs at boundaries · refuses PII in third-party sinks · honours founder-stop-override.", target_score: 5, required_for_tier: "HIGH"   },
  { domain_key: "self_repair",           domain_label: "Self-repair",             description: "Diagnoses verification failures · proposes deterministic patches · reverifies after every attempt · halts at 5.", target_score: 5, required_for_tier: "HIGH"   },
];

const LESSON_DOMAIN_LINKS = {
  explain_control_plane:             "architecture_reading",
  reject_supabase_import:            "dependency_rejection",
  identify_protected_files_batch:    "protected_paths",
  pick_canonical_path_api_route:     "api_structure",
  plan_health_endpoint_feature:      "feature_planning",
};

async function main() {
  const c = new Client({ connectionString: process.env.NEX_TAXONOMY_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev" });
  await c.connect();
  let inserted = 0, updated = 0;
  for (const d of DOMAINS) {
    const existing = await c.query(`SELECT competency_id FROM nex_agent.competencies WHERE domain_key = $1`, [d.domain_key]);
    if (existing.rows.length > 0) {
      await c.query(`UPDATE nex_agent.competencies SET domain_label=$1, description=$2, target_score=$3, required_for_tier=$4, last_updated_at=now() WHERE domain_key=$5`,
        [d.domain_label, d.description, d.target_score, d.required_for_tier, d.domain_key]);
      updated++;
    } else {
      await c.query(`INSERT INTO nex_agent.competencies (domain_key, domain_label, description, target_score, required_for_tier) VALUES ($1,$2,$3,$4,$5)`,
        [d.domain_key, d.domain_label, d.description, d.target_score, d.required_for_tier]);
      inserted++;
    }
  }
  console.log(`competencies · seeded ${inserted} new · updated ${updated} existing`);
  // Link existing lessons to their competency domain
  let linked = 0;
  for (const [lesson_key, domain_key] of Object.entries(LESSON_DOMAIN_LINKS)) {
    const r = await c.query(`UPDATE nex_agent.lessons SET competency_domain_key=$1 WHERE lesson_key=$2 AND (competency_domain_key IS NULL OR competency_domain_key != $1)`, [domain_key, lesson_key]);
    linked += r.rowCount ?? 0;
  }
  console.log(`lessons · linked ${linked} to competency domains`);
  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
