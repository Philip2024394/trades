// One-shot: apply the affiliate-programme migration to the live hammerex
// Supabase project. All statements are idempotent (CREATE TABLE IF NOT
// EXISTS, ADD COLUMN IF NOT EXISTS, CREATE SEQUENCE IF NOT EXISTS,
// CREATE INDEX IF NOT EXISTS) so re-runs are safe.
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

const sql = readFileSync(
  "C:\\Users\\Victus\\trades\\supabase\\migrations\\20260629200000_xrated_affiliates.sql",
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
  console.error(`Supabase ${r.status}:`, txt);
  process.exit(1);
}
console.log("Affiliate migration applied:", txt);

// Verify the seven tables + the sequence + the listings column exist.
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
                'hammerex_affiliates',
                'hammerex_affiliate_clicks',
                'hammerex_affiliate_commissions',
                'hammerex_affiliate_payment_methods',
                'hammerex_affiliate_payouts',
                'hammerex_affiliate_social_links',
                'hammerex_affiliate_audit_log'
              )) as tables_count,
          (select count(*) from information_schema.sequences
            where sequence_schema='public' and sequence_name='affiliate_id_seq') as seq_count,
          (select count(*) from information_schema.columns
            where table_schema='public'
              and table_name='hammerex_trade_off_listings'
              and column_name='affiliate_referrer_id') as col_count
      `
    })
  }
);
console.log("Verify:", await verify.text());
