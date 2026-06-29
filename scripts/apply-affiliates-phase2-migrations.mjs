// Apply the three Phase-2 affiliate migrations:
//   1. 20260630100000_xrated_affiliate_marketing.sql
//   2. 20260630101000_xrated_affiliates_password_recovery.sql
//   3. 20260630102000_xrated_affiliate_social_health_cron.sql
//
// All statements are idempotent (CREATE TABLE IF NOT EXISTS, ADD
// COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, the cron block
// wraps unschedule+schedule). Re-runs are safe.
import { readFileSync } from "node:fs";

const envText = readFileSync(
  "C:\\Users\\Victus\\hammer\\.env.tools.local",
  "utf-8"
);
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
if (!tokenMatch)
  throw new Error("SUPABASE_ACCESS_TOKEN missing from .env.tools.local");
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";

const migrations = [
  "20260630100000_xrated_affiliate_marketing.sql",
  "20260630101000_xrated_affiliates_password_recovery.sql",
  "20260630102000_xrated_affiliate_social_health_cron.sql"
];

for (const file of migrations) {
  const sql = readFileSync(
    `C:\\Users\\Victus\\trades\\supabase\\migrations\\${file}`,
    "utf-8"
  );
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
  const txt = await r.text();
  if (!r.ok) {
    console.error(`! ${file} ${r.status}:`, txt);
    process.exit(1);
  }
  console.log(`+ ${file} applied:`, txt);
}

// Verify the new structure.
const verify = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: `
        select
          (select count(*) from information_schema.tables
            where table_schema='public'
              and table_name in (
                'hammerex_affiliate_marketing_assets',
                'hammerex_affiliate_marketing_downloads'
              )) as marketing_tables,
          (select count(*) from information_schema.columns
            where table_schema='public'
              and table_name='hammerex_affiliates'
              and column_name in (
                'password_recovery_token',
                'password_recovery_expires_at',
                'password_recovery_requested_at',
                'password_recovery_sent_at'
              )) as recovery_cols;
      `
    })
  }
);
console.log("Verify:", await verify.text());

// Expand the product-images bucket so PDFs are accepted. Idempotent.
const supabaseUrl =
  readEnvVal("C:\\Users\\Victus\\trades\\.env.local", "NEXT_PUBLIC_SUPABASE_URL");
const serviceKey =
  readEnvVal("C:\\Users\\Victus\\trades\\.env.local", "SUPABASE_SERVICE_ROLE_KEY");

if (supabaseUrl && serviceKey) {
  const bucketRes = await fetch(
    `${supabaseUrl}/storage/v1/bucket/product-images`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: "product-images",
        name: "product-images",
        public: true,
        allowed_mime_types: [
          "image/png",
          "image/jpeg",
          "image/webp",
          "image/gif",
          "image/svg+xml",
          "video/mp4",
          "video/quicktime",
          "video/webm",
          "application/pdf"
        ],
        file_size_limit: 50 * 1024 * 1024
      })
    }
  );
  console.log(
    "Bucket PUT product-images:",
    bucketRes.status,
    await bucketRes.text()
  );
} else {
  console.warn("[apply] Skipping bucket PUT — missing local Supabase env.");
}

function readEnvVal(path, key) {
  try {
    const txt = readFileSync(path, "utf-8");
    const m = txt.match(new RegExp(`^${key}=(.+)$`, "m"));
    return m ? m[1].trim().replace(/^"|"$/g, "") : null;
  } catch {
    return null;
  }
}
