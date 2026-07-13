// Migration state audit — check what's in supabase_migrations.schema_migrations
// vs what's on disk, and identify tables that ARE live vs MISSING per file.
//
// Non-destructive. Read-only.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const envText = readFileSync(
  "C:\\Users\\Victus\\hammer\\.env.tools.local",
  "utf-8"
);
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";

async function q(sql) {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: sql })
    }
  );
  return await r.json();
}

const MIGRATIONS_DIR = "C:\\Users\\Victus\\trades\\supabase\\migrations";

// 1. On-disk migration files.
const onDisk = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql") && !f.startsWith("_"))
  .sort();
console.log(`── ${onDisk.length} on-disk migration files ──`);
console.log(`First: ${onDisk[0]}`);
console.log(`Last:  ${onDisk[onDisk.length - 1]}`);

// 2. Applied via Supabase CLI tracking table.
const cliTracked = await q(
  `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;`
);
console.log(`\n── ${cliTracked.length} CLI-tracked migrations ──`);
for (const row of cliTracked) console.log(`  ${row.version}`);

// 3. Extract CREATE TABLE and CREATE INDEX and CREATE FUNCTION targets
//    from each on-disk file. For each target, check if it exists in DB.
console.log(`\n── Scanning each on-disk file for effects ──`);

const allTables = await q(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public';`
);
const liveTables = new Set(allTables.map((r) => r.table_name));

// Also gather every column on those tables so we can check ALTER TABLE
// ADD COLUMN effects too.
const allCols = await q(
  `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public';`
);
const liveCols = new Set(allCols.map((r) => `${r.table_name}.${r.column_name}`));

const results = [];
for (const file of onDisk) {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
  // Find CREATE TABLE targets
  const created = [
    ...sql.matchAll(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi)
  ].map((m) => m[1]);
  // Find ALTER TABLE ... ADD COLUMN targets
  const altered = [
    ...sql.matchAll(
      /ALTER TABLE\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+ADD COLUMN(?:\s+IF NOT EXISTS)?\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi
    )
  ].map((m) => ({ table: m[1], column: m[2] }));

  const missingTables = created.filter((t) => !liveTables.has(t));
  const missingCols = altered.filter(
    (a) => !liveCols.has(`${a.table}.${a.column}`)
  );

  const applied =
    created.length === 0 || missingTables.length === 0;
  const partialCols = missingCols.length > 0;

  results.push({
    file,
    createsCount: created.length,
    missingTables,
    missingCols: missingCols.map((a) => `${a.table}.${a.column}`),
    fullyApplied: applied && !partialCols
  });
}

// Summarise: which files have effects missing?
const unappliedTables = results.filter((r) => r.missingTables.length > 0);
const unappliedCols = results.filter((r) => r.missingCols.length > 0);
console.log(
  `\n── ${unappliedTables.length} files create tables that DON'T EXIST in DB ──`
);
for (const r of unappliedTables) {
  console.log(`  ${r.file}`);
  for (const t of r.missingTables) console.log(`    · CREATE TABLE ${t}`);
}
console.log(
  `\n── ${unappliedCols.length} files add columns that DON'T EXIST in DB ──`
);
for (const r of unappliedCols) {
  console.log(`  ${r.file}`);
  for (const c of r.missingCols) console.log(`    · ADD COLUMN ${c}`);
}

const fullyApplied = results.filter((r) => r.fullyApplied);
console.log(
  `\n── Summary: ${fullyApplied.length}/${results.length} files appear fully applied ──`
);
