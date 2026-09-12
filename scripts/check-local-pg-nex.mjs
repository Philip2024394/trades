#!/usr/bin/env node
// Utility · check what's in local Postgres so we know where to apply the migration.
import pg from "pg";

const url = process.env.NEX_TAXONOMY_POSTGRES_URL;
if (!url) { console.error("NEX_TAXONOMY_POSTGRES_URL missing"); process.exit(1); }

const needsSsl = /supabase\.co|render\.com|neon\.tech|amazonaws\.com/.test(url);
const pool = new pg.Pool({ connectionString: url, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });

try {
  const schemas = await pool.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('nex','public') ORDER BY 1");
  console.log("schemas:", schemas.rows.map((r) => r.schema_name));

  const nexTables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='nex' ORDER BY 1 LIMIT 60");
  console.log(`nex tables (${nexTables.rowCount}):`, nexTables.rows.map((r) => r.table_name).join(", "));

  const hasAccom = await pool.query("SELECT to_regclass('nex.accommodation_business') AS reg");
  console.log("nex.accommodation_business exists:", hasAccom.rows[0].reg !== null);

  if (hasAccom.rows[0].reg) {
    const cnt = await pool.query("SELECT COUNT(*)::int AS n FROM nex.accommodation_business");
    console.log("nex.accommodation_business row count:", cnt.rows[0].n);
  }
} catch (e) {
  console.error("check failed:", e.message);
  process.exit(1);
} finally {
  await pool.end();
}
