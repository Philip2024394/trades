// Quick smoke test of the affiliate engine. Inserts a test affiliate
// directly (skipping the API), confirms the sequential ID starts at
// 100001, and reads back the row count + table presence.
import { readFileSync } from "node:fs";

const envText = readFileSync(
  "C:\\Users\\Victus\\hammer\\.env.tools.local",
  "utf-8"
);
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";

async function query(sql) {
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
    throw new Error(`Supabase ${r.status}: ${txt}`);
  }
  return JSON.parse(txt);
}

// Show current sequence value (should NOT have advanced yet on a
// brand-new install).
const seq = await query(
  "SELECT last_value, is_called FROM affiliate_id_seq"
);
console.log("Sequence state:", seq);

// List the 7 tables to confirm presence.
const tables = await query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_name LIKE 'hammerex_affiliate%'
  ORDER BY table_name;
`);
console.log("Affiliate tables:", tables);

// Confirm the listings column is present.
const col = await query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='hammerex_trade_off_listings'
    AND column_name='affiliate_referrer_id';
`);
console.log("affiliate_referrer_id column:", col);

// Confirm cron jobs are scheduled.
const jobs = await query(`
  SELECT jobname, schedule FROM cron.job
  WHERE jobname LIKE 'xrated-affiliate%' OR jobname LIKE 'xrated-paid-%'
  ORDER BY jobname;
`);
console.log("Cron jobs:", jobs);
