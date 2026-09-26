// scripts/verify-bridge3.mjs
// Quick verification that Bridge 3 tables + RLS policies landed.
import { Client } from "pg";
import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const pg = new Client({ connectionString: process.env.DATABASE_URL });
await pg.connect();
try {
  const tables = await pg.query(
    `select table_name from information_schema.tables
      where table_name in ('nex_peer_conversation','nex_peer_message')
      order by table_name`
  );
  console.log("tables:", tables.rows.map((r) => r.table_name).join(", ") || "(none)");

  const policies = await pg.query(
    `select tablename, policyname from pg_policies
      where tablename in ('nex_peer_conversation','nex_peer_message')
      order by tablename, policyname`
  );
  console.log("policies:");
  for (const p of policies.rows) console.log(`  · ${p.tablename}.${p.policyname}`);

  const hist = await pg.query(
    `select version, description, applied_at from nex_migration_history
      where version = '047'`
  );
  if (hist.rows.length > 0) {
    console.log(`history: ${hist.rows[0].version} · ${hist.rows[0].description}`);
  } else {
    console.warn("history: no row for 047");
  }
} finally {
  await pg.end();
}
