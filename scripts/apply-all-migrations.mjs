// Apply on-disk migrations in chronological order via Management API.
// Each file is applied idempotently (all use IF NOT EXISTS / IF EXISTS).
// Reports success/failure per file. Stops on hard error.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const envText = readFileSync(
  "C:\\Users\\Victus\\hammer\\.env.tools.local",
  "utf-8"
);
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";

const MIGRATIONS_DIR = "C:\\Users\\Victus\\trades\\supabase\\migrations";

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
  return { status: r.status, text: await r.text() };
}

// Snapshot the current table count so we can report "N new tables created".
const beforeRes = await q(
  `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public';`
);
const before = JSON.parse(beforeRes.text)[0].n;

const onDisk = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql") && !f.startsWith("_"))
  .sort();

console.log(`Applying ${onDisk.length} migrations (baseline: ${before} tables)`);

let ok = 0;
let skipped = 0;
let failed = 0;
const failures = [];

for (const file of onDisk) {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
  const res = await q(sql);
  if (res.status === 201 || res.status === 200) {
    ok++;
    process.stdout.write(".");
  } else {
    failed++;
    failures.push({ file, status: res.status, text: res.text });
    process.stdout.write("F");
  }
  // Newline every 40 chars for readability
  if ((ok + failed) % 40 === 0) process.stdout.write("\n");
}

console.log("\n");
console.log(`OK: ${ok}  FAIL: ${failed}  (${onDisk.length} total)`);

const afterRes = await q(
  `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public';`
);
const after = JSON.parse(afterRes.text)[0].n;
console.log(`Tables: ${before} → ${after}  (+${after - before} new)`);

if (failures.length > 0) {
  console.log("\n── Failures ──");
  for (const f of failures) {
    console.log(`\n${f.file}  (HTTP ${f.status})`);
    // Just the error message, not the full stack.
    try {
      const j = JSON.parse(f.text);
      console.log(`  ${j.message ?? f.text.slice(0, 200)}`);
    } catch {
      console.log(`  ${f.text.slice(0, 200)}`);
    }
  }
}
