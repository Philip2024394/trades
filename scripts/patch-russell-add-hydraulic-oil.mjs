// Append a "Hydraulic oil (bulk barrel)" service to Russell's
// priced_services array with the merchant-supplied image.

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
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2011_41_57%20AM.png";

const newSvc = {
  name: "Hydraulic oil (bulk barrel)",
  unit: "205L barrel",
  price: 385,
  image_url: IMG,
  description:
    "205L barrels of ISO VG 46 / 68 hydraulic oil for plant machinery. Rotella, Shell Tellus and Mobil DTE grades stocked. Delivered on the same run as your machine hire."
};

const [row] = await q(
  `SELECT priced_services FROM hammerex_trade_off_listings WHERE slug='${slug}';`
);
const svcs = Array.isArray(row.priced_services) ? row.priced_services : [];
const already = svcs.some((s) => s.name === "Hydraulic oil (bulk barrel)");
const next = already ? svcs : [...svcs, newSvc];

const upd = await q(`
  UPDATE hammerex_trade_off_listings
     SET priced_services = '${JSON.stringify(next).replace(/'/g, "''")}'::jsonb
   WHERE slug = '${slug}'
   RETURNING id, jsonb_array_length(priced_services) as n;
`);
console.log("Services now:", upd);
