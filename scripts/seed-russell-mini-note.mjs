// Seed a proper "What's included" note on Russell's mini_excavator so
// the 8-line clamp + Show more toggle has meaningful content.

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

const note =
  "Every mini excavator hire from Russell Haines includes the machine, a full tank of diesel, one standard ditching bucket, and a walk-round pre-hire inspection with the customer.\n\n" +
  "Also included as standard: PAT-tested control panel, working beacon, roll-over protection (ROPS) certificate, statutory LOLER cert for any lifting attachments, and a laminated operator quick-reference guide inside the cab.\n\n" +
  "Optional extras charged at hire: additional buckets (grading, ditching, rock, riddle), hydraulic breaker attachment, auger with earth or rock bits, quick-hitch for fast bucket changes, and CPCS-carded operator at the daily rate shown.\n\n" +
  "Delivery is included free within our 10-mile Leeds zone (LS postcodes). Regional delivery across Yorkshire is charged at £2.50 per mile each way. National delivery is quoted per job — WhatsApp us the site postcode for a same-day quote.\n\n" +
  "Damage waiver options: theft-only cover at £8/day (£500 excess), full damage waiver at £15/day (£250 excess), or bring your own hired-in insurance certificate showing Russell Haines Plant Hire as loss payee.\n\n" +
  "Fuel policy: return with a full tank or pay £2/L to refuel — cheaper than our workshop rate. Weekend hire (Fri afternoon to Mon morning) charged as one day. Bank holiday hire carries a 25% surcharge. Refundable £500 deposit taken as a card pre-auth on delivery.\n\n" +
  "Every machine is serviced every 250 engine hours by our on-site workshop. Full service history available on request. 24/7 breakdown line printed on the cab — any fault stopping production is replaced same day within our local zone.";

const upd = await q(`
  UPDATE hammerex_trade_off_listings
     SET plant_hire = jsonb_set(plant_hire, '{categories,mini_excavator,note}', '${JSON.stringify(note).replace(/'/g, "''")}'::jsonb, true)
   WHERE slug = '${slug}'
   RETURNING id;
`);
console.log("Mini excavator note seeded:", upd);
