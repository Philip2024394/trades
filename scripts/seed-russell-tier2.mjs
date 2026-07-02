// Seed Russell with tier-2 + tier-3 sections turned on with realistic
// UK plant-hire content.

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

const trustSignals = {
  enabled: true,
  heading: "Vetted, insured, audited.",
  subheading:
    "Every credential you'd expect from a national brand — plus the paperwork on the wall to prove it.",
  accreditations: [
    { slug: "safecontractor", label: "SafeContractor Approved", logo_url: "", cert_number: "" },
    { slug: "chas", label: "CHAS Accredited", logo_url: "", cert_number: "" },
    { slug: "iso_9001", label: "ISO 9001", logo_url: "", cert_number: "" },
    { slug: "iso_14001", label: "ISO 14001", logo_url: "", cert_number: "" },
    { slug: "iso_45001", label: "ISO 45001", logo_url: "", cert_number: "" },
    { slug: "fors_gold", label: "FORS Gold", logo_url: "", cert_number: "" },
    { slug: "hae", label: "HAE / EHA Member", logo_url: "", cert_number: "" },
    { slug: "cpa", label: "CPA Member", logo_url: "", cert_number: "" }
  ],
  google_reviews_embed_url: "",
  google_place_id: "",
  trustpilot_embed_url: "",
  trustpilot_business_id: "",
  insurance_cert_url: "",
  insurance_cover_pence: 1_000_000_000,
  awards: [
    { title: "Yorkshire Plant Hire Business of the Year", year: "2025", issuer: "Yorkshire Post" },
    { title: "HAE Skills Award — Apprentice Development", year: "2024", issuer: "Hire Association Europe" },
    { title: "SafeContractor Approved — 8 consecutive years", year: "2018–2026", issuer: "SafeContractor" }
  ],
  net_promoter_score: 72
};

const cdmPack = {
  enabled: true,
  heading: "CDM 2015 site safety pack",
  subheading:
    "Auto-generated site risk pack per hire — PDF ready to hand to the principal contractor. Add to any hire, or free with hires over £1,000.",
  pdf_url: "",
  price_pence: 1000,
  auto_included_on_hires_over_pence: 100000,
  bullets: [
    "Machine risk assessment (COSHH + noise + vibration)",
    "Method statement template — pre-fills your site details",
    "PPE + operator sign-off sheet",
    "Site emergency contacts card",
    "24/7 breakdown escalation path",
    "Handed over on delivery, digitally + paper"
  ],
  terms_of_service: ""
};

const machineFinder = {
  enabled: true,
  heading: "Which machine do I need?",
  subheading:
    "5 questions, instant shortlist. Not sure between a mini digger and a tracked dumper? We pick for you.",
  questions: []
};

const siteCalculator = {
  enabled: true,
  heading: "Site services calculator",
  subheading:
    "Type your area + depth — get tonnes, mixes and a delivery quote. Same-day mixed loads if we're already going out.",
  materials: [],
  waste_factor_percent: 10
};

const repeatLadder = {
  enabled: true,
  heading: "The more you hire, the less you pay.",
  subheading: "Automatic — no code, no card, no application. Tier stays live for 24 months from your last hire.",
  tiers: [
    { hires_required: 3, discount_percent: 5, label: "3rd hire onwards" },
    { hires_required: 6, discount_percent: 10, label: "6th hire — Silver" },
    { hires_required: 12, discount_percent: 15, label: "12th hire — Gold" },
    { hires_required: 24, discount_percent: 20, label: "24th hire — Platinum" }
  ],
  reset_after_months: 24
};

const notifyWhenFree = {
  enabled: true,
  heading: "Machine you want on hire? We'll ping you.",
  subheading:
    "Tap the machine, drop your WhatsApp — we message you the day it returns. No spam, one message per machine."
};

const bulkQuote = {
  enabled: true,
  heading: "5+ machines? 4+ weeks? Skip the tile-by-tile.",
  subheading:
    "Project hires get one bespoke quote — often 10–20% off list. WhatsApp the spec, we reply inside 30 minutes.",
  min_machines: 5,
  min_duration_weeks: 4,
  discount_hint_percent: 20
};

const closureCalendar = {
  enabled: true,
  heading: "Upcoming yard closures",
  subheading: "Bank holidays + planned closures — book around us, not into a locked gate.",
  weekend_note: "Saturdays 08:00–12:00 · Sundays closed",
  closures: [
    { date: "2026-08-25", label: "August bank holiday", half_day: false },
    { date: "2026-12-24", label: "Christmas Eve", half_day: true },
    { date: "2026-12-25", label: "Christmas Day", half_day: false },
    { date: "2026-12-26", label: "Boxing Day", half_day: false },
    { date: "2026-12-31", label: "New Year's Eve", half_day: true },
    { date: "2027-01-01", label: "New Year's Day", half_day: false },
    { date: "2027-04-02", label: "Good Friday", half_day: false },
    { date: "2027-04-05", label: "Easter Monday", half_day: false },
    { date: "2027-05-03", label: "Early May bank holiday", half_day: false },
    { date: "2027-05-31", label: "Spring bank holiday", half_day: false }
  ]
};

const subHire = {
  enabled: true,
  heading: "Sub-hire network — never a &ldquo;sorry, out of stock&rdquo;",
  subheading:
    "If our own fleet is out, we pull the same machine from a vetted partner in the Yorkshire + Humber network. Same rates, same insurance, same delivery SLA — you pay what you'd pay us.",
  partners: [
    { name: "GAP Group Leeds", logo_url: "", note: "Cross-hire on midi excavators + rollers" },
    { name: "Selwood Pumps", logo_url: "", note: "Dewatering + pump specialists" },
    { name: "Bomag NE", logo_url: "", note: "Rollers + compaction" },
    { name: "Speedy Hire Leeds Depot", logo_url: "", note: "Tool hire cross-supply" }
  ],
  markup_percent: 0
};

async function set(field, blob) {
  const upd = await q(`
    UPDATE hammerex_trade_off_listings
       SET plant_hire = jsonb_set(plant_hire, '{${field}}', '${JSON.stringify(blob).replace(/'/g, "''")}'::jsonb, true)
     WHERE slug = 'demo-russell-haines-plant-hire-leeds'
     RETURNING id;
  `);
  console.log(`Russell ${field}:`, upd);
}

await set("trust_signals", trustSignals);
await set("cdm_pack", cdmPack);
await set("machine_finder", machineFinder);
await set("site_calculator", siteCalculator);
await set("repeat_ladder", repeatLadder);
await set("notify_when_free", notifyWhenFree);
await set("bulk_quote", bulkQuote);
await set("closure_calendar", closureCalendar);
await set("sub_hire", subHire);

console.log("\nRussell tier-2 + tier-3 seeded.");
