#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const url = process.env.NEX_TAXONOMY_POSTGRES_URL;
if (!url) { console.error("NEX_TAXONOMY_POSTGRES_URL missing"); process.exit(1); }
const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
const pool = new pg.Pool({ connectionString: url, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });
const sql = readFileSync(join(process.cwd(), "deploy", "postgres", "init", "149_nex_safety_observability.sql"), "utf8");

try {
  console.log("applying 149_nex_safety_observability.sql to", new URL(url).host);
  await pool.query(sql);
  const check = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='nex' AND table_name = 'moderation_event'"
  );
  if (check.rowCount !== 1) { console.error("expected moderation_event"); process.exit(1); }
  console.log("OK");
} catch (e) { console.error("migration failed:", e.message); process.exit(1); }
finally { await pool.end(); }
