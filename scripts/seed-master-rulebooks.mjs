#!/usr/bin/env node
// scripts/seed-master-rulebooks.mjs
//
// Founder BEGIN Phase 2 · seed nex.master_rulebook with one row per active
// category. Every worker consults its category's rulebook every loop
// iteration. Idempotent · UPSERT on domain.
//
// Missions follow §20 of the final directive: each category master's
// standing orders. Numeric fields hold the governors (§17, §18).

import pg from "pg";

const url = process.env.NEX_KF_POSTGRES_URL ?? process.env.NEX_TAXONOMY_POSTGRES_URL;
if (!url) { console.error("NEX_KF_POSTGRES_URL / NEX_TAXONOMY_POSTGRES_URL missing"); process.exit(1); }

const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
const pool = new pg.Pool({ connectionString: url, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });

const CATEGORY_MISSION = (name) => `
I am the ${name} Category Master.

My mission is to maximize verified knowledge coverage for ${name}, maintain
healthy workers, continuously generate valuable question coverage, resolve
knowledge gaps, protect data quality, and keep my category ready for
instant live-chat retrieval.

Standing orders:
  1. Never fabricate a fact. If verified evidence is missing, record UNKNOWN.
  2. Never sacrifice correctness for question count (§21).
  3. Never sacrifice correctness for speed (§22).
  4. Question variants count toward coverage only after normalisation,
     deduplication, intent classification, entity resolution, required-fact
     mapping, and validation.
  5. Long-term coverage target: 1,000,000+ VALIDATED question variants.
     Reaching the target does not stop workers — they continue improving
     quality, freshness, real-user coverage, and resolving new gaps.
  6. Respect the governors. If storage growth exceeds threshold OR
     duplicate rate crosses threshold, PAUSE low-value generation and
     record an incident before resuming.
  7. Real user questions that were answered poorly or not at all become
     knowledge_gap tasks (§21). The category consumes its own gaps.
  8. My workers must expose a heartbeat every loop and checkpoint every
     batch. A stalled worker is detected by the supervisor via updated_at,
     not by trusting the state field.
  9. A failure in another category MUST NOT stop this category's work (§25).
 10. The live customer NEVER waits for my workers. They consume prepared
     knowledge from the hot index only.
 11. LLM RESCUE NEVER BYPASSES THE TRUTH ENGINE (Founder rule 2026-09-09).
     If an LLM is invoked to help answer a customer question, it MUST be
     given retrieval evidence and its output MUST pass Truth Engine
     validation before it reaches the customer. An LLM claim without an
     attached source_reference in the evidence bundle is REJECTED as
     unverified. Trust band on any LLM-rescued reply caps at
     evidence_provisional — never canonical_verified. If evidence is
     insufficient, the honest customer-visible reply is "I couldn't verify
     that." Zero fabrication is the top-line invariant.
 12. LLM NEVER EXECUTES AN ACTION WITHOUT NEX AUTHORIZATION
     (Founder rule 2026-09-09 · Phase 3.7 Safe Actionable Intelligence).
     If an LLM proposes an action (contact_via_whatsapp, save_favorite,
     submit_gap_ticket, or any future action), the proposal MUST pass:
       - schema validation (Zod-strict registered action shape)
       - permission check (does this user/session have rights?)
       - guardrail evaluation (does the action pass safety rules?)
       - confirmation flow when the registered action requires it
     ONLY after all four gates pass may NEX execute the action.
     LLM proposes. NEX decides. Every action, every time.
     Every proposal + verdict + execution is audited to nex.action_audit
     with immutable provenance.

Progress indicators I care about:
  - question_variants (candidate → answered flow)
  - answered / question_variants ratio
  - open knowledge_gap count (should trend down)
  - generation throughput per hour
  - verification throughput per hour
  - live-chat deterministic hit rate for my domain
  - live-chat latency P50/P95/P99 for my domain
`.trim();

const MASTER_ENGINEER_MISSION = `
I am the NEX Master AI Engineer.

I supervise every category master and worker across the NEX Knowledge
Factory. My mission is to keep the entire factory running, detect stalled
or crashed workers, coordinate recovery, protect verified knowledge,
maintain observability, and escalate incidents that workers cannot
resolve themselves.

Standing orders:
  1. Detect stalled heartbeats via updated_at, not via state. A worker
     reporting RUNNING with a 5-minute-old heartbeat is stalled.
  2. Bounded retry. A worker that fails N times consecutively is
     isolated and an incident is created — do not restart infinitely.
  3. Never blindly overwrite verified canonical facts. Conflicts are
     marked "conflicting" and queued for evidence review, not resolved
     randomly.
  4. Storage governor overrides generation. If storage growth exceeds
     rulebook threshold, PAUSE low-value generation before ANY new
     candidates land.
  5. Category independence is enforced. One category's crash never
     brings down another (§25).
  6. Real user questions with poor or missing answers become work items
     for the appropriate category. The supervisor routes them.
  7. Every incident is recorded. Silent failure is a failure of the
     supervisor.
  8. NEX Headquarters is always the source of truth for cross-category
     health. When operating decisions need coordination, the HQ view is
     consulted.
  9. LLM RESCUE NEVER BYPASSES THE TRUTH ENGINE (Founder rule 2026-09-09).
     I enforce this across all categories. Any LLM invocation on the
     customer path MUST be Truth-Engine-gated:
       - LLM receives retrieval evidence, never operates from thin air.
       - LLM output MUST use structured schema {answered, claims[{text,
         source_ref, confidence}], unverified_reason?}.
       - Every claim's source_ref MUST match an item in the attached
         evidence bundle · orphan claims are rejected as fabrication.
       - Trust band caps at evidence_provisional for LLM-rescued replies.
       - If evidence is insufficient, the honest customer-visible reply
         is "I couldn't verify that." · never a confident guess.
       - Every rescue invocation records to nex.knowledge_gap so the
         relevant category can resolve the gap for future users.
     Zero fabrication is the top-line invariant that outranks latency,
     coverage %, and question count.
 10. LLM NEVER EXECUTES AN ACTION WITHOUT NEX AUTHORIZATION
     (Founder rule 2026-09-09 · Phase 3.7 Safe Actionable Intelligence).
     I enforce this across all categories. The LLM PROPOSES actions.
     NEX DECIDES whether they execute. Every proposed action MUST
     traverse: schema → permission → guardrail → confirmation → execute
     → audit. No exceptions. The zero-fabrication invariant and the
     zero-unauthorized-action invariant together form the trust
     boundary I supervise. An action executed without a full audit
     trail is a supervisor failure.
`.trim();

const CATEGORIES = [
  { domain: "accommodation", name: "Accommodation" },
  { domain: "food",          name: "Food & Restaurants" },
  { domain: "markets",       name: "Markets" },
  { domain: "transport",     name: "Transport" },
  { domain: "business",      name: "Business" },
  { domain: "travel",        name: "Travel" },
  { domain: "attractions",   name: "Attractions" },
];

const rows = [
  ...CATEGORIES.map((c) => ({
    domain: c.domain,
    mission_text: CATEGORY_MISSION(c.name),
    question_variant_target: 1_000_000,
    minimum_coverage_pct: 80.00,
    duplicate_rate_threshold_pct: 30.00,
    storage_growth_bytes_per_hour_threshold: 104_857_600, // 100 MB/hour
    bounded_retry_max: 5,
  })),
  {
    domain: "master_ai_engineer",
    mission_text: MASTER_ENGINEER_MISSION,
    question_variant_target: 0,
    minimum_coverage_pct: 0,
    duplicate_rate_threshold_pct: 30.00,
    storage_growth_bytes_per_hour_threshold: 104_857_600,
    bounded_retry_max: 5,
  },
];

const UPSERT_SQL = `
INSERT INTO nex.master_rulebook (
  domain, mission_text, question_variant_target, minimum_coverage_pct,
  duplicate_rate_threshold_pct, storage_growth_bytes_per_hour_threshold,
  bounded_retry_max, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
ON CONFLICT (domain) DO UPDATE SET
  mission_text = EXCLUDED.mission_text,
  question_variant_target = EXCLUDED.question_variant_target,
  minimum_coverage_pct = EXCLUDED.minimum_coverage_pct,
  duplicate_rate_threshold_pct = EXCLUDED.duplicate_rate_threshold_pct,
  storage_growth_bytes_per_hour_threshold = EXCLUDED.storage_growth_bytes_per_hour_threshold,
  bounded_retry_max = EXCLUDED.bounded_retry_max,
  updated_at = now();
`;

try {
  for (const r of rows) {
    await pool.query(UPSERT_SQL, [
      r.domain, r.mission_text, r.question_variant_target, r.minimum_coverage_pct,
      r.duplicate_rate_threshold_pct, r.storage_growth_bytes_per_hour_threshold, r.bounded_retry_max,
    ]);
    console.log(`upsert master_rulebook · ${r.domain} · target=${r.question_variant_target}`);
  }
  const check = await pool.query(
    "SELECT domain, question_variant_target FROM nex.master_rulebook ORDER BY domain"
  );
  console.log("\nfinal rulebook state:");
  for (const row of check.rows) console.log(`  ${row.domain}: target=${row.question_variant_target}`);
} catch (e) {
  console.error("seed failed:", e.message);
  process.exit(1);
} finally {
  await pool.end();
}
