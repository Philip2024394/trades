// Patch Stuart's plant_hire config: seed the 3 labelled machine images
// (forklift, scissor_lift, mini_excavator) and enable the new forklift
// category with sensible defaults. Leaves every other field alone.

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

const slug = "demo-stuart-kingsley-building-merchant-hull";

const IMG = {
  forklift:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2009_42_26%20AM.png?updatedAt=1782873768924",
  scissor_lift:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2009_45_06%20AM.png?updatedAt=1782873925022",
  mini_excavator:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2009_46_36%20AM.png?updatedAt=1782874016313"
};

const forkliftConfig = {
  enabled: true,
  price_day_pence: 8000,
  price_week_pence: 26000,
  price_month_pence: 75000,
  operator_premium_day_pence: 18000,
  note: "Counterbalance forklifts for yard pallet handling. Valid licence required.",
  cart_enabled: false,
  sub_types: ["2.5T diesel", "3T LPG", "Container mast"],
  image_url: IMG.forklift
};

const forkliftJson = JSON.stringify(forkliftConfig).replace(/'/g, "''");

const upd = await q(`
  UPDATE hammerex_trade_off_listings
     SET plant_hire = jsonb_set(
       jsonb_set(
         jsonb_set(
           plant_hire,
           '{categories,forklift}',
           '${forkliftJson}'::jsonb,
           true
         ),
         '{categories,scissor_lift,image_url}',
         '"${IMG.scissor_lift}"'::jsonb,
         true
       ),
       '{categories,mini_excavator,image_url}',
       '"${IMG.mini_excavator}"'::jsonb,
       true
     )
   WHERE slug = '${slug}'
   RETURNING id;
`);
console.log("Patched images for forklift + scissor_lift + mini_excavator:", upd);
