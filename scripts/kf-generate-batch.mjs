#!/usr/bin/env node
// scripts/kf-generate-batch.mjs
// Run ONE generation batch against the accommodation reference generator.
// Prints entity bootstrap + variants inserted/updated + dup rate.
// Repeatedly running this script advances the cursor and fills more variants.

import pg from "pg";
import { makeAccommodationQuestionGenerator } from "../src/lib/nex/live-chat-completion/question-factory/accommodation-generator.js";

// tsx runtime — the .ts import is fine here.

const url = process.env.NEX_KF_POSTGRES_URL ?? process.env.NEX_TAXONOMY_POSTGRES_URL;
if (!url) { console.error("NEX_KF_POSTGRES_URL / NEX_TAXONOMY_POSTGRES_URL missing"); process.exit(1); }
const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
const pool = new pg.Pool({ connectionString: url, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });

const gen = makeAccommodationQuestionGenerator({ sourcePool: pool, kfPool: pool });

const maxVariants = Number(process.env.KF_MAX_VARIANTS ?? 2000);
const cursor = process.env.KF_CURSOR ?? null;

console.log(`Running batch · max_variants=${maxVariants} cursor=${cursor ?? "<start>"}`);
const t0 = Date.now();
const res = await gen.generateBatch({ max_variants: maxVariants, cursor });
console.log(`batch complete in ${Date.now() - t0}ms · exhausted=${res.exhausted} next_cursor=${res.next_cursor}`);
for (const n of res.generation_notes) console.log(`  ${n}`);

const stats = await pool.query(
  `SELECT
     COUNT(*)::int AS total,
     COUNT(*) FILTER (WHERE answer_status = 'candidate')::int AS candidate,
     COUNT(*) FILTER (WHERE answer_status = 'answered')::int AS answered,
     COUNT(*) FILTER (WHERE answer_status = 'unknown')::int AS unknown_count,
     COUNT(DISTINCT entity_ref)::int AS unique_entities,
     COUNT(DISTINCT intent_slug)::int AS unique_intents
   FROM nex.question_variant WHERE domain = 'accommodation'`
);
console.log("\nnex.question_variant state (accommodation):");
console.log(stats.rows[0]);

await pool.end();
