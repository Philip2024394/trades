// Seed Russell's plant hire page with realistic content for the 6 new
// showcase sections: video centre, trade accounts, drivers wanted, meet
// the team, parts counter, wide-load compliance.

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

const videoCenter = {
  enabled: true,
  heading: "Watch the fleet on-site.",
  subheading:
    "Real jobs, real machines, real muck. Videos filmed by our operators — tap any thumbnail to see the machine in action, then jump straight to its detail page.",
  videos: [
    {
      youtube_url: "https://www.youtube.com/watch?v=6VYFsFTdgYc",
      title: "5T midi excavator — Wetherby drainage cut",
      description:
        "Kubota KX057-4 opening a 300mm land drain across a residential paddock. Three-piece boom, quick-hitch bucket swap on the fly.",
      location: "Wetherby, LS22",
      linked_machine_slug: "midi_excavator",
      thumbnail_url: "",
      duration_label: "2:14",
      date_uploaded: "2026-06-14"
    },
    {
      youtube_url: "https://www.youtube.com/watch?v=DrpVeQd_gt0",
      title: "Beavertail delivery run — Leeds to Doncaster",
      description:
        "Iveco Daily 7.5T beavertail dropping a 1.8T Kubota mini digger to a garden groundworks site. From yard to unload in 45 minutes.",
      location: "Doncaster, DN1",
      linked_machine_slug: "mini_excavator",
      thumbnail_url: "",
      duration_label: "1:52",
      date_uploaded: "2026-06-20"
    },
    {
      youtube_url: "https://www.youtube.com/watch?v=xmZjuLu6bC0",
      title: "Telehandler at work — Bradford housebuild",
      description:
        "Manitou MT625 lifting bagged aggregate onto a 3-storey slab. 4.5m reach, 2.5T lift, tight-turn skid manoeuvres.",
      location: "Bradford, BD5",
      linked_machine_slug: "telehandler",
      thumbnail_url: "",
      duration_label: "3:08",
      date_uploaded: "2026-06-25"
    }
  ]
};

const tradeAccounts = {
  enabled: true,
  online_application_enabled: true,
  pdf_download_enabled: false,
  pdf_url: "",
  heading: "Open a Russell Haines trade account",
  subheading:
    "30 days from invoice, weekly statements, priority delivery. Set up once, valid across every machine, every haulage lane and the parts counter.",
  benefits: [
    "30 days from invoice",
    "Weekly consolidated statements",
    "Priority delivery slots",
    "Preferential rates on 4-week+ hires",
    "One account across fleet + haulage + parts",
    "No card surcharges"
  ],
  credit_limit_min_pence: 50000,
  credit_limit_max_pence: 1500000,
  min_years_trading: 2,
  require_bank_details: true,
  require_trade_references: 2,
  require_insurance_cert: true,
  turnaround_days: 2,
  terms_of_service:
    "Trade accounts are subject to a credit check and two satisfactory trade references. Payment terms are net 30 days from invoice date. Overdue accounts are subject to statutory late-payment interest and may be suspended pending settlement. Personal guarantees may be required for limited companies with under 3 years' trading. We reserve the right to reduce or withdraw credit at any time on written notice."
};

const driverRecruitment = {
  enabled: true,
  online_application_enabled: true,
  pdf_download_enabled: false,
  pdf_url: "",
  heading: "We're hiring drivers.",
  subheading:
    "Steady loads, modern fleet, tickets paid. If you've got a CPC card, digitacho and know how to strap a machine properly — we want to hear from you.",
  positions_available: ["plant_driver", "low_loader_driver", "beavertail_driver", "yard_driver"],
  benefits: [
    "Steady weekly loads — Yorkshire + Humber patch",
    "Modern DAF + Iveco fleet",
    "Weekly pay every Friday",
    "Overtime + weekend uplift",
    "Ongoing CPC training paid",
    "Uniform + PPE supplied",
    "Long-service bonus"
  ],
  base_location: "Leeds LS10 (yard) — home-run daily",
  salary_range_display: "£38,000–£48,000 + overtime",
  min_years_experience: 2,
  require_cpc_card: true,
  require_digitacho: true,
  require_stgo_experience: false,
  require_plant_experience: true,
  full_time_available: true,
  part_time_available: false,
  owner_driver_available: true,
  turnaround_days: 3,
  terms_of_service:
    "All positions subject to satisfactory references, a driving-licence check via DVLA and a right-to-work check. Owner-drivers must hold their own O-licence and provide a copy of their insurance schedule (public liability and goods-in-transit). Probation period 3 months."
};

const team = {
  enabled: true,
  heading: "Direct lines to the yard.",
  subheading:
    "Skip the switchboard — every call goes straight to the person handling it. Yard is manned 07:00–17:00 Mon–Fri, 08:00–12:00 Sat.",
  members: [
    {
      name: "Russell Haines",
      role: "Owner + yard manager",
      photo_url: "",
      phone: "0113 000 0001",
      extension: "101",
      whatsapp: "+447700900101",
      email: "russell@russellhaines.co.uk",
      hours: "Mon–Fri 07:00–17:00",
      specialities: ["Long hires", "Groundworks specialist", "Deposit + credit"]
    },
    {
      name: "Sarah Watts",
      role: "Hire desk + dispatch",
      photo_url: "",
      phone: "0113 000 0001",
      extension: "102",
      whatsapp: "+447700900102",
      email: "sarah@russellhaines.co.uk",
      hours: "Mon–Fri 07:00–17:00, Sat 08:00–12:00",
      specialities: ["Same-day delivery", "Attachment swaps", "Bookings"]
    },
    {
      name: "Mick Hardcastle",
      role: "Parts counter + spares",
      photo_url: "",
      phone: "0113 000 0001",
      extension: "103",
      whatsapp: "+447700900103",
      email: "parts@russellhaines.co.uk",
      hours: "Mon–Fri 07:00–17:00",
      specialities: ["Filters + hoses", "Manuals", "Ex-fleet spares"]
    },
    {
      name: "Dan Ellery",
      role: "Fleet mechanic + breakdowns",
      photo_url: "",
      phone: "0113 000 0001",
      extension: "104",
      whatsapp: "+447700900104",
      email: "dan@russellhaines.co.uk",
      hours: "24/7 on breakdown line",
      specialities: ["Mobile repair", "Hydraulic diagnostics", "LOLER"]
    }
  ]
};

const partsCounter = {
  enabled: true,
  heading: "Yard counter — parts, hoses, filters, tracks.",
  subheading:
    "Walk-in and phone-order. If it fits on the shelf, it goes out same day when the delivery truck's already lined up.",
  phone: "0113 000 0001",
  whatsapp: "+447700900103",
  email: "parts@russellhaines.co.uk",
  hours_summary: "Mon–Fri 07:00–17:00 · Sat 08:00–12:00",
  same_day_cutoff: "Order before 14:00 for same-day dispatch",
  minimum_order_pence: 2500,
  delivery_available: true,
  manual_library_url: "",
  address: "Unit 4, Cross Green Approach, Leeds LS9 0SG",
  terms_of_service:
    "Same-day dispatch subject to stock and courier availability. Manufacturer warranty applies. Returns accepted within 14 days on unused parts with proof of purchase; special-order parts non-returnable.",
  categories: [
    {
      name: "Hydraulic hoses (made to length)",
      description:
        "1/4\" to 1\" BSP, JIC, ORFS. Cut and crimped while you wait — bring the failed hose, walk out with a replacement.",
      manual_url: "",
      in_stock: true,
      lead_time: "Same day"
    },
    {
      name: "Filters — fuel, oil, air, hydraulic",
      description:
        "Full range for JCB, Kubota, Manitou, Bomag, Wacker Neuson. Bring the machine PIN — we cross-reference.",
      manual_url: "",
      in_stock: true,
      lead_time: "Same day"
    },
    {
      name: "Rubber tracks + steel tracks",
      description:
        "Mini + midi excavator sizes 230mm–450mm. Steel track links for larger machines to order.",
      manual_url: "",
      in_stock: true,
      lead_time: "Next day"
    },
    {
      name: "Buckets + quick-hitches",
      description:
        "0.8T–14T bucket range, 300mm–1500mm widths. Auto and pin-hitch swap.",
      manual_url: "",
      in_stock: false,
      lead_time: "3–5 days"
    },
    {
      name: "Belts + fan blades",
      description:
        "Drive belts, alternator belts, fan blades — most common OEM references stocked.",
      manual_url: "",
      in_stock: true,
      lead_time: "Same day"
    },
    {
      name: "Lubricants + fluids",
      description:
        "Engine oil, hydraulic fluid (ISO 46/68), grease cartridges, coolant, DEF/AdBlue.",
      manual_url: "",
      in_stock: true,
      lead_time: "Same day"
    }
  ]
};

const complianceInfo = {
  enabled: true,
  heading: "Wide load, nationwide delivery, fully compliant.",
  subheading:
    "Every abnormal load leaves our yard legally sorted — STGO categorised, escorts booked, VR1 filed. If your job sits outside our published zone rates, one WhatsApp and we build a bespoke quote within 30 minutes.",
  wide_load_note:
    "Wide loads (over 2.55m), long loads (over 18.65m) and heavy loads (over 44T) travel under STGO Category 1, 2 or 3 depending on weight, with our operator's licence on file with the DVSA. VR1 forms are filed to National Highways two clear working days before dispatch. Private escort vehicles supplied for loads over 3.0m wide; police escort arranged (customer notified of lead time) for loads over 3.5m wide.",
  nationwide_note:
    "Nationwide coverage subject to lane availability. If your postcode isn't listed on our delivery zones page, WhatsApp us the pickup + delivery postcodes plus the machine weight — we quote inside 30 minutes. Ferry, tunnel and bridge routing surveyed in advance for anything over 4.5m tall.",
  extra_regs: [
    "DVSA STGO Cat 1/2/3 compliant",
    "National Highways VR1 notifications filed for you",
    "Private + police escort vehicles arranged on demand",
    "Goods-in-transit cover displayed on every quote",
    "CPC + digitacho-carded drivers only",
    "Serviced trailers — annual DVSA + independent brake test",
    "Route surveys walked in person for constrained lanes",
    "£10m public liability + £5m employer's liability"
  ],
  route_survey_note:
    "Route surveys mandatory for loads over 4.95m tall or 3.5m wide. Included in-zone; charged separately for surveys outside our home zone (typically £250–£750 depending on distance and complexity).",
  emergency_line_note:
    "Broken down on the network? Call the 24/7 breakdown line — printed on every trailer and hire dispatch note. Local SLA 4h, national SLA 24h."
};

async function set(field, blob) {
  const upd = await q(`
    UPDATE hammerex_trade_off_listings
       SET plant_hire = jsonb_set(plant_hire, '{${field}}', '${JSON.stringify(blob).replace(/'/g, "''")}'::jsonb, true)
     WHERE slug = 'demo-russell-haines-plant-hire-leeds'
     RETURNING id;
  `);
  console.log(`Russell ${field} seeded:`, upd);
}

await set("video_center", videoCenter);
await set("trade_accounts", tradeAccounts);
await set("driver_recruitment", driverRecruitment);
await set("team", team);
await set("parts_counter", partsCounter);
await set("compliance_info", complianceInfo);

console.log("\nAll 6 new sections seeded for Russell.");
