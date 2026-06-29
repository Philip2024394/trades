// Apply the monthly-alert + pending→approved cron migration.
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
  "C:\\Users\\Victus\\trades\\supabase\\migrations\\20260629210000_xrated_affiliates_monthly_alert_cron.sql",
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
console.log("Affiliate cron migration applied:", txt);
