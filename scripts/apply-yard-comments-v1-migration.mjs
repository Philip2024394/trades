// Apply the Yard v3 comments migration:
//   20260708170000_yard_comments_v1.sql
//
// Creates:
//   • hammerex_yard_comments
//   • hammerex_yard_comment_reactions
//   • hammerex_yard_comment_flags
//   • comment_count denormalisation + triggers on hammerex_trade_off_yard_posts

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

const file = "20260708170000_yard_comments_v1.sql";
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
