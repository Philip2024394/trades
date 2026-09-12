#!/usr/bin/env node
import pg from "pg";
const url = process.env.NEX_KF_POSTGRES_URL ?? process.env.NEX_TAXONOMY_POSTGRES_URL;
const pool = new pg.Pool({ connectionString: url });
try {
  const s = await pool.query(
    `SELECT answer_status, trust, COUNT(*)::int AS n
       FROM nex.question_variant WHERE domain='accommodation'
       GROUP BY answer_status, trust ORDER BY n DESC`
  );
  console.log("question_variant by (status · trust):");
  for (const r of s.rows) console.log(`  ${r.answer_status} · ${r.trust}: ${r.n}`);

  const g = await pool.query(
    `SELECT COUNT(*)::int AS total, SUM(times_seen)::int AS demand
       FROM nex.knowledge_gap WHERE domain='accommodation'`
  );
  console.log(`\nknowledge_gap: total=${g.rows[0].total}, sum(times_seen)=${g.rows[0].demand}`);

  const gh = await pool.query(
    `SELECT intent_slug, COUNT(*)::int AS gaps, SUM(times_seen)::int AS demand
       FROM nex.knowledge_gap WHERE domain='accommodation' AND resolved_at IS NULL
       GROUP BY intent_slug ORDER BY demand DESC LIMIT 8`
  );
  console.log("\ntop 8 open gap intents:");
  for (const r of gh.rows) console.log(`  ${r.intent_slug}: ${r.gaps} gaps · ${r.demand} demand`);
} finally { await pool.end(); }
