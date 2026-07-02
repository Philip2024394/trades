// Seed Russell with a realistic accepted-payments strip: enable BACS
// + card-over-phone (matches how most UK regional yards actually
// operate); leave Stripe/PayPal/GoCardless/Klarna disabled until real
// accounts are wired.

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

const gateway = {
  enabled: true,
  heading: "Pay how it suits you.",
  subheading:
    "25% deposit on confirmation locks in your machine; the balance is due on delivery. Weekly / monthly hires can be moved to a trade account on request.",
  deposit_percent: 25,
  balance_when: "on delivery",
  gateways: {
    stripe: {
      enabled: false,
      display_name: "",
      payment_url: "",
      instructions: "",
      fee_note: ""
    },
    gocardless: {
      enabled: false,
      display_name: "",
      payment_url: "",
      instructions: "",
      fee_note: ""
    },
    paypal: {
      enabled: false,
      display_name: "",
      payment_url: "",
      instructions: "",
      fee_note: ""
    },
    klarna: {
      enabled: false,
      display_name: "",
      payment_url: "",
      instructions: "",
      fee_note: ""
    },
    bacs: {
      enabled: true,
      display_name: "Bank transfer (BACS / Faster Payments)",
      payment_url: "",
      instructions:
        "Sort code · 12-34-56\nAccount · 12345678\nAccount name · Russell Haines Plant Hire Ltd\nReference · your hire ref (e.g. RHPL-2026-01234)\n\nCleared funds usually visible same day within Faster Payments window.",
      fee_note: "No fee"
    },
    card_over_phone: {
      enabled: true,
      display_name: "Card over the phone",
      payment_url: "",
      instructions:
        "Call the yard on 0113 000 0001. We take card details over the phone via the terminal in dispatch — no card data stored.",
      fee_note: "No fee"
    }
  }
};

const upd = await q(`
  UPDATE hammerex_trade_off_listings
     SET plant_hire = jsonb_set(plant_hire, '{payment_gateways}', '${JSON.stringify(gateway).replace(/'/g, "''")}'::jsonb, true)
   WHERE slug = 'demo-russell-haines-plant-hire-leeds'
   RETURNING id;
`);
console.log("Russell payment_gateways seeded:", upd);
