// One-shot applier for migration 100.
import { readFileSync } from "fs";
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev" });
const sql = readFileSync("deploy/postgres/init/100_nex_provider_rate_governor.sql", "utf8");
console.log("Applying 100_nex_provider_rate_governor.sql ...");
await pool.query(sql);
const t1 = await pool.query(`SELECT provider, min_interval_ms, max_concurrent FROM nex.provider_rate_config ORDER BY provider`);
console.log("Providers:", t1.rows);
const t2 = await pool.query(`SELECT count(*)::int AS active FROM nex.provider_rate_lease WHERE released_at IS NULL`);
console.log("Active leases:", t2.rows[0].active);
await pool.end();
console.log("✓ migration applied");
