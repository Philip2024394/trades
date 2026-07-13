// Apply the free-tier slug expiry migration:
//   20260713140000_free_slug_expiry.sql
//
// Adds last_login_at, slug_expiry_warning_at, slug_expiry_stage columns
// to hammerex_trade_off_listings plus the hot-path index used by the
// /api/cron/free-slug-expiry cron. Backfills existing rows so the
// first cron run doesn't immediately expire everyone.

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

const file = "20260713140000_free_slug_expiry.sql";
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
console.log(`${file}: ${r.status}`);
console.log(txt);
if (!r.ok) process.exit(1);
