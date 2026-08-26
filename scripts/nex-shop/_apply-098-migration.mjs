// One-shot migration applier · additive · reversible.
import { readFileSync } from "fs";
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev" });
const sql = readFileSync("deploy/postgres/init/098_nex_marketplace_quantity_pricing.sql", "utf8");
console.log("Applying 098_nex_marketplace_quantity_pricing.sql ...");
await pool.query(sql);
const cols = await pool.query(`SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_schema='nex' AND table_name='mp_product' AND column_name='qty_price_tiers'`);
console.log("Column:", cols.rows);
const constraints = await pool.query(`SELECT conname FROM pg_constraint WHERE conrelid = 'nex.mp_product'::regclass AND conname LIKE 'qty%'`);
console.log("Constraints:", constraints.rows.map(r => r.conname));
await pool.end();
console.log("✓ migration applied");
