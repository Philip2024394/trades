// Apply Supabase migrations via the Management API.
// Node 18+ (fetch built in).
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

function loadEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  const text = readFileSync(file, "utf-8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [k, ...rest] = line.split("=");
    out[k.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

async function applyMigration(token, ref, sqlPath) {
  const sql = readFileSync(sqlPath, "utf-8");
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: sql })
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  const env = loadEnv(".env.tools.local");
  const token = env.SUPABASE_ACCESS_TOKEN;
  const ref = env.SUPABASE_PROJECT_REF;
  if (!token || !ref) {
    console.error("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF in .env.tools.local");
    process.exit(1);
  }

  const migrations = process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : [
        "supabase/migrations/20260710120000_reviews.sql",
        "supabase/migrations/20260710130000_canteens.sql",
        "supabase/migrations/20260710140000_uploads_usage.sql",
        "supabase/migrations/20260710150000_merchant_recovery.sql"
      ];

  let failures = 0;
  for (const m of migrations) {
    const name = path.basename(m);
    process.stdout.write(`── ${name}\n`);
    const { ok, status, body } = await applyMigration(token, ref, m);
    const mark = ok ? "✓" : "✗";
    process.stdout.write(`  ${mark} status=${status} ${body.slice(0, 400)}\n\n`);
    if (!ok) failures += 1;
  }

  process.stdout.write(`Done. ${migrations.length - failures}/${migrations.length} succeeded.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
