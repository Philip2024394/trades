#!/usr/bin/env node
// scripts/kf-generate-loop.mjs
// Run N generation batches, threading cursor through each. Exits when either
// exhausted or the target variant count is reached.

import pg from "pg";
import { makeAccommodationQuestionGenerator } from "../src/lib/nex/live-chat-completion/question-factory/accommodation-generator.js";

const url = process.env.NEX_KF_POSTGRES_URL ?? process.env.NEX_TAXONOMY_POSTGRES_URL;
if (!url) { console.error("URL missing"); process.exit(1); }
const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
const pool = new pg.Pool({ connectionString: url, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });

const TARGET = Number(process.env.KF_TARGET ?? 10000);
const BATCH_SIZE = Number(process.env.KF_BATCH_SIZE ?? 2000);
const MAX_BATCHES = Number(process.env.KF_MAX_BATCHES ?? 100);

const gen = makeAccommodationQuestionGenerator({ sourcePool: pool, kfPool: pool });

let cursor = null;
let batches = 0;
let inserted = 0;
let updated = 0;
const t0 = Date.now();

while (batches < MAX_BATCHES) {
  const res = await gen.generateBatch({ max_variants: BATCH_SIZE, cursor });
  batches++;
  // Extract insert/update counts from generation_notes for progress
  const notes = res.generation_notes.join(" ");
  const iMatch = notes.match(/inserted=(\d+)/);
  const uMatch = notes.match(/updated=(\d+)/);
  const bi = iMatch ? parseInt(iMatch[1], 10) : 0;
  const bu = uMatch ? parseInt(uMatch[1], 10) : 0;
  inserted += bi;
  updated += bu;
  console.log(`batch ${batches} · inserted=${bi} updated=${bu} cursor=${cursor ?? "<start>"} → next=${res.next_cursor} · exhausted=${res.exhausted}`);
  if (res.exhausted) break;
  cursor = res.next_cursor;
  // Also check current total against target
  const cnt = await pool.query(`SELECT COUNT(*)::int AS n FROM nex.question_variant WHERE domain='accommodation'`);
  if (cnt.rows[0].n >= TARGET) {
    console.log(`reached target ${TARGET} (actual=${cnt.rows[0].n}). Stopping.`);
    break;
  }
}

const elapsed = Date.now() - t0;
const stats = await pool.query(
  `SELECT
     COUNT(*)::int AS total,
     COUNT(*) FILTER (WHERE answer_status='candidate')::int AS candidate,
     COUNT(*) FILTER (WHERE answer_status='answered')::int AS answered,
     COUNT(*) FILTER (WHERE answer_status='unknown')::int AS unknown_count,
     COUNT(*) FILTER (WHERE answer_status='conflicting')::int AS conflicting,
     COUNT(DISTINCT entity_ref)::int AS unique_entities,
     COUNT(DISTINCT intent_slug)::int AS unique_intents,
     COUNT(*) FILTER (WHERE language='en')::int AS lang_en,
     COUNT(*) FILTER (WHERE language='id')::int AS lang_id
   FROM nex.question_variant WHERE domain='accommodation'`
);
console.log(`\n=== FINAL ===`);
console.log(`batches=${batches} inserted=${inserted} updated=${updated} elapsed=${elapsed}ms`);
console.log(stats.rows[0]);

await pool.end();
