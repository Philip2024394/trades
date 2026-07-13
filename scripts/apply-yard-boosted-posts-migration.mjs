import { readFileSync } from "node:fs";
const envText = readFileSync(
  "C:\\Users\\Victus\\hammer\\.env.tools.local",
  "utf-8"
);
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";
const file = "20260708210000_yard_boosted_posts.sql";
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
console.log(`${file}: ${r.status}`);
console.log(await r.text());
if (!r.ok) process.exit(1);
