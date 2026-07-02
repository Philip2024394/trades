// Turn Russell Haines Plant Hire (Leeds) into the flagship Plant Hire
// TEMPLATE profile. Copies Stuart Kingsley's fully-configured plant_hire
// blob (31 machines, all sections, waivers, delivery zones, sample
// specs / reviews / images) onto Russell, then enables the add-on and
// sets plant-hire-flavoured hero copy + banner.

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

const src = "demo-stuart-kingsley-building-merchant-hull";
const dst = "demo-russell-haines-plant-hire-leeds";

// Copy Stuart's plant_hire, but override yard address + depot postcode
// to Leeds so the delivery calculator + collect address make sense.
const upd = await q(`
  WITH stuart AS (
    SELECT plant_hire
      FROM hammerex_trade_off_listings
     WHERE slug = '${src}'
     LIMIT 1
  )
  UPDATE hammerex_trade_off_listings
     SET plant_hire =
       jsonb_set(
         jsonb_set(
           jsonb_set(
             jsonb_set(
               jsonb_set(
                 jsonb_set(
                   (SELECT plant_hire FROM stuart),
                   '{yard_address}',
                   '"Russell Haines Plant Hire\\nUnit 4 Aire Valley Industrial Estate\\nLeeds LS10 1LG"'::jsonb,
                   true
                 ),
                 '{depot_postcode}',
                 '"LS10 1LG"'::jsonb,
                 true
               ),
               '{headline_text}',
               '"Every Machine You Need. On Your Site."'::jsonb,
               true
             ),
             '{custom_note}',
             '"Family-run yard on the outskirts of Leeds. 30 years hiring plant across Yorkshire. 24/7 breakdown line on every hire."'::jsonb,
             true
           ),
           '{years_hiring}',
           '30'::jsonb,
           true
         ),
         '{delivery_zones}',
         '${JSON.stringify([
           {
             label: "Local (Leeds + LS postcodes)",
             free_radius_miles: 10,
             price_per_mile_pence: null,
             fixed_price_pence: 0,
             note: "Free within 10 miles both ways."
           },
           {
             label: "Regional (Yorkshire + Humberside)",
             free_radius_miles: null,
             price_per_mile_pence: 250,
             fixed_price_pence: null,
             note: "£2.50/mile each way beyond 10 miles."
           },
           {
             label: "National",
             free_radius_miles: null,
             price_per_mile_pence: null,
             fixed_price_pence: null,
             note: "Quoted per job — WhatsApp us the site postcode."
           }
         ]).replace(/'/g, "''")}'::jsonb,
         true
       ),
       addons_enabled = COALESCE(addons_enabled, '{}'::jsonb)
         || jsonb_build_object('plant_hire', true),
       hero_text_line1  = 'Russell Haines',
       hero_text_line2  = 'Plant Hire',
       hero_text_tagline = 'Every Machine You Need. On Your Site.',
       custom_app_hero_url =
         'https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2003_29_54%20PM.png?updatedAt=1782894616434',
       theme_color = '#FFB300'
   WHERE slug = '${dst}'
   RETURNING id, slug;
`);
console.log("Russell Haines seeded as Plant Hire template:", upd);
