import { readFileSync } from "node:fs";
const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";

const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    query: `SELECT column_name FROM information_schema.columns
              WHERE table_name='hammerex_trade_off_listings'
                AND (column_name ILIKE '%logo%' OR column_name ILIKE '%image%'
                     OR column_name ILIKE '%avatar%' OR column_name ILIKE '%brand%'
                     OR column_name ILIKE '%profile%')
              ORDER BY column_name;`
  })
});
console.log(await r.text());
