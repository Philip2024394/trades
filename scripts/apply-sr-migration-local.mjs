#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const url = process.env.NEX_TAXONOMY_POSTGRES_URL;
if (!url) { console.error("NEX_TAXONOMY_POSTGRES_URL missing"); process.exit(1); }
const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
const pool = new pg.Pool({ connectionString: url, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });
const sql = readFileSync(join(process.cwd(), "deploy", "postgres", "init", "148_nex_semantic_index.sql"), "utf8");

try {
  console.log("applying 148_nex_semantic_index.sql to", new URL(url).host);
  await pool.query(sql);
  const check = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='nex' AND table_name IN ('semantic_entity_index','semantic_question_index') ORDER BY 1"
  );
  console.log("new tables:", check.rows.map((r) => r.table_name).join(", "));
  if (check.rowCount !== 2) { console.error("expected 2 tables"); process.exit(1); }
  console.log("OK");
} catch (e) { console.error("migration failed:", e.message); process.exit(1); }
finally { await pool.end(); }
