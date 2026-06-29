// Seed Stuart's missing lat/lng (Hull city centre) + a sensible
// services_offered array so the new merchant "Services & Area"
// section renders the map + chips on the home page.

import { readFileSync } from "node:fs";
const envText = readFileSync("C:\\Users\\Victus\\hammer\\.env.tools.local", "utf-8");
const token = envText.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)[1].trim();
const ref = "msdonkkechxzgagyguoe";
const SLUG = "demo-stuart-kingsley-building-merchant-hull";

// Hull city centre — anywhere on the Humber works; the radar pin sits
// here and a 5km soft circle marks the daily-delivery zone.
const HULL_LAT = 53.7457;
const HULL_LNG = -0.3367;

const SERVICES = [
  "Plasterboard & boards",
  "Timber & joinery",
  "Bagged plaster & render",
  "Aggregates & ballast",
  "Cement, mortar & fixings",
  "Insulation",
  "Roofing supplies",
  "Damp-proof course",
  "Garden timber & fence panels",
  "Sheds & summerhouses",
  "Trade-account bulk delivery",
  "Site-build quotations"
];

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

const servicesArray =
  "ARRAY[" +
  SERVICES.map((s) => "$$" + s + "$$").join(",") +
  "]::text[]";

await q(`
  UPDATE hammerex_trade_off_listings
     SET lat = ${HULL_LAT},
         lng = ${HULL_LNG},
         services_offered = ${servicesArray},
         updated_at = now()
   WHERE slug = '${SLUG}';
`);

const after = await q(`
  SELECT lat, lng, array_length(services_offered, 1) AS services_n
    FROM hammerex_trade_off_listings WHERE slug = '${SLUG}';
`);
console.log(JSON.stringify(after, null, 2));
