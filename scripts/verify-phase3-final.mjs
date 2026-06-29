import { readFileSync } from "node:fs";
const env = readFileSync(
  "C:\\Users\\Victus\\hammer\\.env.tools.local",
  "utf-8"
);
const token = env.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const r = await fetch(
  "https://api.supabase.com/v1/projects/msdonkkechxzgagyguoe/database/query",
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
            where table_schema='public' and table_name in (
              'hammerex_affiliate_campaigns',
              'hammerex_affiliate_api_tokens',
              'hammerex_affiliate_landing_pages'
            )) as new_tables,
          (select count(*) from information_schema.columns
            where table_schema='public' and table_name='hammerex_affiliates'
              and column_name in ('level','level_promoted_at','fraud_flags','requires_review')) as aff_cols,
          (select count(*) from information_schema.columns
            where table_schema='public' and table_name='hammerex_affiliate_commissions'
              and column_name='campaign_id') as cm_campaign,
          (select count(*) from information_schema.columns
            where table_schema='public' and table_name='hammerex_affiliate_marketing_assets'
              and column_name='required_level') as mark_lvl;
      `
    })
  }
);
console.log(await r.text());
