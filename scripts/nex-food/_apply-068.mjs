import pg from "pg";
import { readFileSync } from "node:fs";
const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });
const sql = readFileSync("C:/Users/Victus/trades/deploy/postgres/init/068_nex_image_intake_extension.sql", "utf8");
try { await pool.query(sql); console.log("migration 068 applied ok"); }
catch (err) { console.log("FAIL:", err.message); await pool.end(); process.exit(1); }
const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='nex' AND table_name='knowledge_inbox' AND column_name IN ('description','extraction_result') ORDER BY column_name`);
console.log("── new columns on nex.knowledge_inbox ──");
for (const r of cols.rows) console.log(`  ${r.column_name.padEnd(24)}  ${r.data_type}`);
await pool.end();
