// One-shot applier for migration 099_nex_discovery_rotation_state.sql
import { readFileSync } from "fs";
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev" });
const sql = readFileSync("deploy/postgres/init/099_nex_discovery_rotation_state.sql", "utf8");
console.log("Applying 099_nex_discovery_rotation_state.sql ...");
await pool.query(sql);
const t = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='nex' AND table_name='discovery_rotation_state' ORDER BY ordinal_position`);
console.log("Columns:", t.rows.map(r => `${r.column_name}(${r.data_type})`).join(", "));
await pool.end();
console.log("✓ migration applied");
