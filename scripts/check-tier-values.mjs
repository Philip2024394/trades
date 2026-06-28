// Quick check of distinct tier values in the live DB.
import { readFileSync } from "node:fs";

const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const tokenMatch = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
const token = tokenMatch[1].trim();
const ref = "msdonkkechxzgagyguoe";

const sql = `SELECT tier, COUNT(*) AS n FROM public.hammerex_trade_off_listings GROUP BY tier ORDER BY n DESC;`;
const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql })
});
console.log(await r.text());

const sql2 = `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname LIKE '%tier%';`;
const r2 = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql2 })
});
console.log(await r2.text());
