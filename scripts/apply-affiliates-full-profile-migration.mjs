// Apply 20260701110000_xrated_affiliates_full_profile.sql.
//
// Adds avatar_url, address_line_1, address_line_2, city, postal_code,
// state_region, bio to public.hammerex_affiliates. Idempotent via
// ADD COLUMN IF NOT EXISTS, so safe to re-run.
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

const file = "20260701110000_xrated_affiliates_full_profile.sql";
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

// Verify all seven columns are present.
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
        select column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'hammerex_affiliates'
          and column_name in (
            'avatar_url',
            'address_line_1',
            'address_line_2',
            'city',
            'postal_code',
            'state_region',
            'bio'
          )
        order by column_name;
      `
    })
  }
);
console.log("Verify:", await verify.text());
