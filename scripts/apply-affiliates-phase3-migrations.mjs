// Apply the seven Phase-3 affiliate migrations:
//   1. 20260701100000_xrated_affiliate_level.sql
//   2. 20260701101000_xrated_affiliate_campaigns.sql
//   3. 20260701102000_xrated_affiliate_marketing_required_level.sql
//   4. 20260701103000_xrated_affiliate_api_tokens.sql
//   5. 20260701104000_xrated_affiliate_landing_pages.sql
//   6. 20260701105000_xrated_affiliate_fraud_flags.sql
//   7. 20260701106000_xrated_affiliate_fraud_cron.sql
//
// Each statement uses ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT
// EXISTS / CREATE INDEX IF NOT EXISTS so re-runs are safe.
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
  "20260701100000_xrated_affiliate_level.sql",
  "20260701101000_xrated_affiliate_campaigns.sql",
  "20260701102000_xrated_affiliate_marketing_required_level.sql",
  "20260701103000_xrated_affiliate_api_tokens.sql",
  "20260701104000_xrated_affiliate_landing_pages.sql",
  "20260701105000_xrated_affiliate_fraud_flags.sql",
  "20260701106000_xrated_affiliate_fraud_cron.sql"
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

// Verify each surface.
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
          (select count(*) from information_schema.columns
            where table_schema='public' and table_name='hammerex_affiliates'
              and column_name in ('level','level_promoted_at','fraud_flags','requires_review')) as affiliate_cols,
          (select count(*) from information_schema.tables
            where table_schema='public'
              and table_name in (
                'hammerex_affiliate_campaigns',
                'hammerex_affiliate_api_tokens',
                'hammerex_affiliate_landing_pages'
              )) as new_tables,
          (select count(*) from information_schema.columns
            where table_schema='public' and table_name='hammerex_affiliate_commissions'
              and column_name='campaign_id') as commission_campaign_col,
          (select count(*) from information_schema.columns
            where table_schema='public' and table_name='hammerex_affiliate_marketing_assets'
              and column_name='required_level') as marketing_required_level_col;
      `
    })
  }
);
console.log("Verify:", await verify.text());
