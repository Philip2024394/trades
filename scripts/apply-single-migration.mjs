import { readFileSync } from "node:fs";
const envText = readFileSync(
  "C:\\Users\\Victus\\hammer\\.env.tools.local",
  "utf-8"
);
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";
const file = process.argv[2];
if (!file) {
  console.error("Usage: node apply-single-migration.mjs <filename>");
  process.exit(1);
}
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
console.log((await r.text()).slice(0, 500));
