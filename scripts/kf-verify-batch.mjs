#!/usr/bin/env node
// scripts/kf-verify-batch.mjs
// Run one verifier batch against the candidate queue. Prints result counts
// broken down by answer_status, and the current state of question_variant.

import pg from "pg";
import { makeAccommodationVerifier } from "../src/lib/nex/live-chat-completion/question-factory/accommodation-verifier.js";
import { makeKnowledgeGapQueue } from "../src/lib/nex/live-chat-completion/knowledge-gap-queue.js";

const url = process.env.NEX_KF_POSTGRES_URL ?? process.env.NEX_TAXONOMY_POSTGRES_URL;
if (!url) { console.error("URL missing"); process.exit(1); }
const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
const pool = new pg.Pool({ connectionString: url, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });

const gapQueue = makeKnowledgeGapQueue({ kfPool: pool });
const verifier = makeAccommodationVerifier({
  sourcePool: pool,
  kfPool: pool,
  enqueueGap: async ({ entity_ref, intent_slug }) =>
    void await gapQueue.enqueue({ domain: "accommodation", entity_ref, intent_slug, source: "verifier" }),
});

const maxVariants = Number(process.env.KF_VERIFY_MAX ?? 2000);
const t0 = Date.now();
const res = await verifier.verifyBatch({ max_variants: maxVariants });
const elapsed = Date.now() - t0;

const byStatus = {};
for (const r of res.results) byStatus[r.answer_status] = (byStatus[r.answer_status] ?? 0) + 1;

console.log(`verified ${res.results.length} variants in ${elapsed}ms · remaining_candidates=${res.remaining_candidates}`);
console.log("by status:", byStatus);

const state = await pool.query(
  `SELECT answer_status, COUNT(*)::int AS n FROM nex.question_variant
    WHERE domain='accommodation' GROUP BY answer_status ORDER BY n DESC`
);
console.log("\nquestion_variant state (accommodation):");
for (const r of state.rows) console.log(`  ${r.answer_status}: ${r.n}`);

const gaps = await pool.query(
  `SELECT COUNT(*)::int AS open FROM nex.knowledge_gap
    WHERE domain='accommodation' AND resolved_at IS NULL`
);
console.log(`\nknowledge_gap (accommodation, open): ${gaps.rows[0].open}`);

await pool.end();
