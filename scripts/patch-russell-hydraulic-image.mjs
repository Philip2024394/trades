// Set the image on Russell's "Hydraulic pipe fittings" priced_service.

import { readFileSync } from "node:fs";
const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql })
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${txt}`);
  return JSON.parse(txt);
}

const slug = "demo-russell-haines-plant-hire-leeds";
const IMG =
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2011_29_45%20AM.png";

const [row] = await q(
  `SELECT priced_services FROM hammerex_trade_off_listings WHERE slug='${slug}';`
);
const svcs = row.priced_services ?? [];
const next = svcs.map((s) =>
  s.name === "Hydraulic pipe fittings" ? { ...s, image_url: IMG } : s
);

const upd = await q(`
  UPDATE hammerex_trade_off_listings
     SET priced_services = '${JSON.stringify(next).replace(/'/g, "''")}'::jsonb
   WHERE slug = '${slug}'
   RETURNING id;
`);
console.log("Hydraulic pipe fittings image set:", upd);
