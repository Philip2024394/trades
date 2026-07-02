// Enable Russell's haulage service (Product A + Product B) with
// realistic UK 2026 rates. Set the operator's licence + terms.

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

const cfg = {
  enabled: true,
  own_fleet_enabled: true,
  third_party_enabled: true,
  delivery_first_mile_pence: 5000,
  delivery_per_mile_pence: 250,
  delivery_minimum_pence: 15000,
  trailer_bands: [
    {
      slug: "beavertail",
      label: "Beavertail (up to 10T)",
      weight_from_kg: 0,
      weight_to_kg: 10000,
      fixed_pence: 25000,
      per_mile_pence: 200,
      quote_only: false,
      image_url: ""
    },
    {
      slug: "low_loader",
      label: "Low loader (10–25T)",
      weight_from_kg: 10001,
      weight_to_kg: 25000,
      fixed_pence: 40000,
      per_mile_pence: 300,
      quote_only: false,
      image_url: ""
    },
    {
      slug: "step_frame",
      label: "Step-frame low loader (25–40T)",
      weight_from_kg: 25001,
      weight_to_kg: 40000,
      fixed_pence: 60000,
      per_mile_pence: 400,
      quote_only: false,
      image_url: ""
    },
    {
      slug: "heavy_haulage",
      label: "Heavy haulage / STGO Cat 2 (40–80T)",
      weight_from_kg: 40001,
      weight_to_kg: 80000,
      fixed_pence: 90000,
      per_mile_pence: 600,
      quote_only: false,
      image_url: ""
    },
    {
      slug: "modular_spmt",
      label: "Modular / SPMT (80T+ abnormal)",
      weight_from_kg: 80001,
      weight_to_kg: 999999,
      fixed_pence: null,
      per_mile_pence: null,
      quote_only: true,
      image_url: ""
    }
  ],
  non_runner_surcharge_pence: 30000,
  escort_per_day_pence: 35000,
  police_escort_notification_pence: 25000,
  weekend_multiplier_percent: 150,
  overnight_standby_pence: 30000,
  insurance_percent: 50,
  handles_notifications: true,
  operators_licence_number: "OB1234567",
  goods_in_transit_cover_pence: 25_000_000,
  terms_of_service:
    "By submitting this haulage request you accept: (1) rates shown are estimates confirmed within 30 minutes; (2) the customer is responsible for accurate transit dimensions and weight — machines that exceed declared dimensions may be refused at pickup and a wasted-journey fee will apply; (3) escort requirements are indicative — final routing decisions rest with our dispatch team based on live bridge/route data; (4) STGO / VR1 / bridge-swept notifications are handled by us where the toggle is set at booking, otherwise the customer must provide proof of notification; (5) all machines must be presented for loading in the condition declared — hidden damage discovered on inspection may result in refusal or renegotiated pricing; (6) goods-in-transit insurance is provided up to the cover value shown — higher-value declarations must be pre-agreed; (7) weekend, overnight and same-day surcharges are additive to base rates; (8) wasted-journey fee = 50% of quoted base + all incurred mileage."
};

const upd = await q(`
  UPDATE hammerex_trade_off_listings
     SET plant_hire = jsonb_set(plant_hire, '{haulage_service}', '${JSON.stringify(cfg).replace(/'/g, "''")}'::jsonb, true)
   WHERE slug = 'demo-russell-haines-plant-hire-leeds'
   RETURNING id;
`);
console.log("Russell haulage_service seeded:", upd);
