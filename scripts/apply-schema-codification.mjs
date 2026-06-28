// One-shot: apply the schema-codification migrations to the live
// hammerex Supabase project, in chronological order. Idempotent — every
// migration uses ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS,
// so re-runs are safe even when the Hammerex side already created the
// objects.
//
// Run with:  node scripts/apply-schema-codification.mjs

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
if (!tokenMatch) throw new Error("SUPABASE_ACCESS_TOKEN missing from .env.tools.local");
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";

const MIGRATIONS_DIR = "C:\\Users\\Victus\\trades\\supabase\\migrations";

// Walk only the codification batch — anything dated 20260628080000+.
const targets = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql") && /^2026062808\d{4}_/.test(f))
  .sort();

if (targets.length === 0) {
  console.error("No codification migrations found (expected 2026062808nnnnn_*.sql)");
  process.exit(1);
}

console.log(`Applying ${targets.length} migration(s) in order:`);
for (const file of targets) console.log("  -", file);

async function runOne(file) {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: sql })
  });
  const txt = await r.text();
  return { ok: r.ok, status: r.status, body: txt };
}

const results = [];
for (const file of targets) {
  process.stdout.write(`\n[apply] ${file} ... `);
  const res = await runOne(file);
  if (!res.ok) {
    console.error(`FAILED (${res.status})`);
    console.error(res.body);
    process.exit(1);
  }
  console.log("ok");
  results.push({ file, status: res.status, body: res.body });
}

console.log("\nAll migrations applied.\n");

// Verification queries — column presence + table presence.
const verificationSql = `
SELECT 'listings.' || column_name AS object
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'hammerex_trade_off_listings'
  AND column_name IN (
    'twitter','snapchat','reddit','google',
    'payment_methods',
    'retail_shipping_uk_pence','retail_shipping_uk_areas','retail_shipping_international',
    'terms_url','privacy_url','returns_url','about_url',
    'paid_expires_at','last_payment_plan',
    'recommendations'
  )
UNION ALL
SELECT 'products.' || column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'hammerex_xrated_products'
  AND column_name IN ('product_kind','warranty_header','warranty_text','returns_text')
UNION ALL
SELECT 'reviews.' || column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'hammerex_xrated_reviews'
  AND column_name IN ('customer_avatar_url')
UNION ALL
SELECT 'table:' || table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'hammerex_xrated_quotes',
    'hammerex_verified_waitlist',
    'hammerex_trade_off_verified_plus_applications',
    'hammerex_trade_off_yard_posts',
    'hammerex_trade_off_yard_reactions'
  )
ORDER BY 1;
`;

const vr = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ query: verificationSql })
});
const vTxt = await vr.text();
console.log("Verification result:");
console.log(vTxt);
