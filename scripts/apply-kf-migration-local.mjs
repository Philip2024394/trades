#!/usr/bin/env node
// Applies deploy/postgres/init/145_nex_knowledge_factory.sql to local Postgres
// (NEX_TAXONOMY_POSTGRES_URL). Idempotent · uses IF NOT EXISTS everywhere.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const url = process.env.NEX_TAXONOMY_POSTGRES_URL;
if (!url) { console.error("NEX_TAXONOMY_POSTGRES_URL missing"); process.exit(1); }

const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
const pool = new pg.Pool({ connectionString: url, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });
const migrationPath = join(process.cwd(), "deploy", "postgres", "init", "145_nex_knowledge_factory.sql");
const sql = readFileSync(migrationPath, "utf8");

try {
  console.log("applying 145_nex_knowledge_factory.sql to", new URL(url).host);
  await pool.query(sql);
  const kfTables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='nex' AND table_name IN ('entity_index','question_variant','knowledge_gap','kf_worker_heartbeat','category_scorecard','master_rulebook') ORDER BY 1"
  );
  console.log("kf tables now present:", kfTables.rows.map((r) => r.table_name).join(", "));
  if (kfTables.rowCount !== 6) { console.error("expected 6 tables · got", kfTables.rowCount); process.exit(1); }
  console.log("OK");
} catch (e) {
  console.error("migration failed:", e.message);
  process.exit(1);
} finally {
  await pool.end();
}
