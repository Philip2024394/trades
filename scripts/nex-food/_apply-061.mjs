import pg from "pg";
import { readFileSync } from "node:fs";
const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });
const sql = readFileSync("C:/Users/Victus/trades/deploy/postgres/init/061_nex_food_commercial_universe.sql", "utf8");
try { await pool.query(sql); console.log("migration 061 applied ok"); }
catch (err) { console.log("FAIL:", err.message); await pool.end(); process.exit(1); }
const r = await pool.query(`SELECT * FROM nex.food_universe_ratio`);
console.log("");
console.log("── Universe ratio · CURRENT ──");
const row = r.rows[0];
console.log(`  DISCOVERY UNIVERSE  : ${row.discovery_universe}`);
console.log(`  COMMERCIAL UNIVERSE : ${row.commercial_universe}`);
console.log(`  RATIO               : ${row.commercial_ratio ? (Number(row.commercial_ratio) * 100).toFixed(1) + "%" : "n/a"}`);
await pool.end();
