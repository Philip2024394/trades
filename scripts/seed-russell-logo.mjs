// Set Russell's logo to the new ChatGPT-generated mark.

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

const logoUrl =
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2001_55_03%20PM.png";

const upd = await q(`
  UPDATE hammerex_trade_off_listings
     SET avatar_url = '${logoUrl}'
   WHERE slug = 'demo-russell-haines-plant-hire-leeds'
   RETURNING id, slug, avatar_url;
`);
console.log("Russell logo set:", upd);
