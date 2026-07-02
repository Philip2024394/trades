// Seed Stuart Kingsley's plant_hire config + enable the addon.
//
// Fills all 12 categories with sensible UK 2026 rates, seeds fleet
// brands, 3 waiver options, 3 delivery zones, bulk tiers, FAQ, trust
// bar and the supplied banner URL.

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

const BANNER =
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_17_59%20PM.png?updatedAt=1782919107938";

const cfg = {
  categories: {
    mini_excavator: {
      enabled: true,
      price_day_pence: 12000,
      price_week_pence: 45000,
      price_month_pence: 135000,
      operator_premium_day_pence: 20000,
      note: "Bring photo ID + utility bill. £500 deposit.",
      cart_enabled: false,
      sub_types: ["Kubota U10-5", "JCB 8018", "Takeuchi TB216", "Yanmar SV17"],
      image_url: ""
    },
    midi_excavator: {
      enabled: true,
      price_day_pence: 22000,
      price_week_pence: 80000,
      price_month_pence: 250000,
      operator_premium_day_pence: 22000,
      note: "5T–14T. CPCS card required if used on a commercial site.",
      cart_enabled: false,
      sub_types: ["Kubota KX060", "JCB 8085", "Hitachi ZX55", "Takeuchi TB260"],
      image_url: ""
    },
    dumper: {
      enabled: true,
      price_day_pence: 9000,
      price_week_pence: 30000,
      price_month_pence: 90000,
      operator_premium_day_pence: 18000,
      note: "Skip loader, tracked and swivel variants.",
      cart_enabled: false,
      sub_types: ["1T skip", "3T tracked", "6T swivel"],
      image_url: ""
    },
    telehandler: {
      enabled: true,
      price_day_pence: 20000,
      price_week_pence: 70000,
      price_month_pence: 220000,
      operator_premium_day_pence: 22000,
      note: "6m to 25m reach. Forks + bucket included.",
      cart_enabled: false,
      sub_types: ["Manitou MT625", "Merlo 25.6", "JCB 525-60"],
      image_url: ""
    },
    roller: {
      enabled: true,
      price_day_pence: 10000,
      price_week_pence: 32000,
      price_month_pence: 95000,
      operator_premium_day_pence: 18000,
      note: "Pedestrian, ride-on and tandem drum rollers.",
      cart_enabled: false,
      sub_types: ["Bomag BW71E", "Bomag BW120AD", "Wacker Neuson RD16"],
      image_url: ""
    },
    scissor_lift: {
      enabled: true,
      price_day_pence: 12000,
      price_week_pence: 38000,
      price_month_pence: 110000,
      operator_premium_day_pence: 0,
      note: "IPAF ticket required for commercial site use.",
      cart_enabled: false,
      sub_types: ["Genie GS-1930", "Genie GS-2646", "Skyjack SJ4626"],
      image_url: ""
    },
    cherry_picker: {
      enabled: true,
      price_day_pence: 18000,
      price_week_pence: 55000,
      price_month_pence: 165000,
      operator_premium_day_pence: 20000,
      note: "10m to 26m working height.",
      cart_enabled: false,
      sub_types: ["Genie Z-45", "Nifty HR12", "Niftylift SD34"],
      image_url: ""
    },
    skid_steer: {
      enabled: true,
      price_day_pence: 14000,
      price_week_pence: 45000,
      price_month_pence: 135000,
      operator_premium_day_pence: 20000,
      note: "Tight-access compact loaders. Multiple attachments.",
      cart_enabled: false,
      sub_types: ["Bobcat S70", "Bobcat S650", "Kubota SSV65"],
      image_url: ""
    },
    breaker: {
      enabled: true,
      price_day_pence: 4000,
      price_week_pence: 12000,
      price_month_pence: 35000,
      operator_premium_day_pence: 0,
      note: "Hand-held Kango or hydraulic on-machine.",
      cart_enabled: true,
      sub_types: ["Kango 950S", "Bosch GSH 11 VC", "Hydraulic (excavator mount)"],
      image_url: ""
    },
    generator: {
      enabled: true,
      price_day_pence: 5000,
      price_week_pence: 15000,
      price_month_pence: 45000,
      operator_premium_day_pence: 0,
      note: "Petrol and diesel. Site-safe 110V or 240V.",
      cart_enabled: true,
      sub_types: ["2kVA petrol", "6kVA diesel", "20kVA silent tow"],
      image_url: ""
    },
    welfare_unit: {
      enabled: true,
      price_day_pence: 9000,
      price_week_pence: 28000,
      price_month_pence: 85000,
      operator_premium_day_pence: 0,
      note: "Solar + generator hybrid. WC, kitchen, drying area.",
      cart_enabled: false,
      sub_types: ["6-man mobile welfare", "8-man static", "Anti-vandal cabin"],
      image_url: ""
    },
    attachments: {
      enabled: true,
      price_day_pence: 3000,
      price_week_pence: 9000,
      price_month_pence: 25000,
      operator_premium_day_pence: 0,
      note: "Buckets, augers, grabs, thumbs, tilt heads.",
      cart_enabled: true,
      sub_types: ["Ditching bucket", "Rock bucket", "Auger", "Hydraulic thumb", "Rotating grab"],
      image_url: ""
    }
  },
  modes: { collect: true, delivery: true, operator: true, long_term: true },
  years_hiring: 22,
  cpa_terms: true,
  hired_in_insured: true,
  cpcs_operators: true,
  hse_audited: true,
  turnaround_text: "Same-day local delivery",
  fuel_policy: "refuel_on_return",
  fuel_refuel_pence_per_litre: 200,
  weekend_rate_percent: 100,
  bank_holiday_surcharge_percent: 25,
  deposit_pence: 50000,
  min_operator_age: 21,
  cpcs_required: false,
  yard_address: "Stuart Kingsley Building Merchant\nBilton Way\nHull HU8 8DZ",
  yard_open_from: "07:00",
  yard_open_to: "17:00",
  banner_image_url: BANNER,
  illustration_image_url: "",
  custom_note:
    "Family-run yard on the outskirts of Hull. 22 years hiring plant across East Yorkshire. 24/7 breakdown line on every hire.",
  trust_benefits: [
    "CPA Terms & Conditions",
    "Hired-In Insured",
    "CPCS-carded Operators",
    "HSE-audited fleet",
    "Same-day local delivery",
    "24/7 breakdown line",
    "Weekend hire available",
    "Trade accounts welcome"
  ],
  plant_brands: [
    { name: "JCB", logo_url: null },
    { name: "Kubota", logo_url: null },
    { name: "Bomag", logo_url: null },
    { name: "Manitou", logo_url: null },
    { name: "Merlo", logo_url: null },
    { name: "Genie", logo_url: null },
    { name: "Bobcat", logo_url: null },
    { name: "Thwaites", logo_url: null },
    { name: "Takeuchi", logo_url: null },
    { name: "Wacker Neuson", logo_url: null }
  ],
  waiver_options: [
    {
      slug: "theft_only",
      label: "Theft-only cover",
      price_day_pence: 800,
      excess_pence: 50000,
      note: "Covers theft only. £500 excess. Add on request at hire."
    },
    {
      slug: "full_waiver",
      label: "Full damage waiver",
      price_day_pence: 1500,
      excess_pence: 25000,
      note: "Covers theft + accidental damage. £250 excess. Recommended for site work."
    },
    {
      slug: "own_certificate",
      label: "Your own hired-in insurance",
      price_day_pence: 0,
      excess_pence: null,
      note: "Bring a valid certificate showing us as loss payee — no waiver charge."
    }
  ],
  delivery_zones: [
    {
      label: "Local (Hull + HU postcodes)",
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
  ],
  bulk_tiers: [
    { min_period_days: 14, label: "5% off 2-week+ hires" },
    { min_period_days: 28, label: "10% off month+ hires" },
    { min_period_days: 84, label: "15% off 3-month+ hires" },
    { min_period_days: 168, label: "WhatsApp for a 6-month contract quote" }
  ],
  trade_customers: [
    "Builders",
    "Groundworkers",
    "Landscapers",
    "Drainage contractors",
    "Roofers",
    "Scaffolders",
    "Fencing contractors",
    "Housebuilders",
    "Housing associations",
    "Local councils",
    "Farmers",
    "Self-builders"
  ],
  faq: [
    { q: "What do I need to hire a machine self-drive?", a: "Photo ID (driving licence or passport) and a recent utility bill or bank statement. No trade account needed — same as Travis Perkins TP Hire. For machines above 3.5T on the road you'll also need the correct entitlement on your licence." },
    { q: "Do I need a CPCS card?", a: "On any commercial or construction site, yes — CPCS or NPORS for plant, IPAF for MEWPs. For private / domestic sites (your own garden, a farm), no card is legally required but you must operate safely." },
    { q: "Is delivery included?", a: "Delivery is free within our 10-mile local zone. Beyond that we charge £2.50/mile each way, or quote per job for national hires. Collection back to our yard follows the same rates." },
    { q: "What about fuel?", a: "Diesel is excluded — return with a full tank or pay our refuel charge (£2/L). Electric machines (scissors, small MEWPs) charge included." },
    { q: "How does the damage waiver work?", a: "You choose at hire: theft-only, full waiver, or bring your own hired-in insurance certificate. Full waiver has £250 excess; theft-only has £500. Insurance without waiver is at your own risk." },
    { q: "What are the weekend rates?", a: "Delivered Friday afternoon, collected Monday morning = 1 day charge. Delivered any other combination is charged pro-rata to the daily rate." },
    { q: "Can I hire with an operator?", a: "Yes — for most machines we can supply a CPCS-carded operator at the day-rate premium shown. Book 24 hours in advance minimum." },
    { q: "What if the machine breaks down?", a: "Call the 24/7 breakdown line printed on the cab. Any fault that stops production is replaced same day within our local zone, next day nationally. Damage caused by misuse is chargeable." },
    { q: "Do I need to provide a deposit?", a: "Yes for self-drive hire — £500 refundable, taken as a card pre-auth on delivery and released on safe return. Long-term contracts (28+ days) may waive the deposit against a trade account." },
    { q: "Can I extend the hire?", a: "Yes — WhatsApp us before your end date. Extensions roll onto whichever tier gives you the best rate (day → week → month automatically). Failing to notify results in the machine being classed as overdue and chargeable at the day rate." }
  ],
  promo_banner: { enabled: false, text: "", cta_label: "", cta_href: "" },
  headline_text: "Every Machine You Need. On Your Site.",
  section_headings: {
    trust_benefits: "",
    brands: "",
    what_we_hire: "",
    how_to_hire: "",
    delivery: "",
    waivers: "",
    bulk: "",
    trade_customers: "",
    related_products: "",
    faq: ""
  },
  explanatory_paragraphs: [],
  mode_bodies: { collect: "", delivery: "", operator: "", long_term: "" },
  related_product_categories: ["safety_workwear", "hand_tools", "fuel_lubricants"]
};

const slug = "demo-stuart-kingsley-building-merchant-hull";

// Escape single-quotes for SQL literal.
const json = JSON.stringify(cfg).replace(/'/g, "''");

const upd = await q(`
  UPDATE hammerex_trade_off_listings
     SET plant_hire = '${json}'::jsonb,
         addons_enabled = COALESCE(addons_enabled, '{}'::jsonb) || jsonb_build_object('plant_hire', true)
   WHERE slug = '${slug}'
   RETURNING id, slug;
`);
console.log("Seeded Stuart's plant_hire config + enabled addon:", upd);
