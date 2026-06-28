// One-shot Stripe configuration script.
//
// Creates the 12 products + 14 recurring prices + 1 webhook endpoint
// the trades app charges against. Reads the live secret key from
// `.env.local`, then rewrites that same file with the resulting price
// IDs + webhook signing secret so the Next.js app picks them up.
//
// IDEMPOTENT: products are looked up by metadata[`xrated_slug`] before
// creation. Prices are looked up by metadata[`xrated_key`]. Re-running
// will not duplicate — it will reuse existing rows. The webhook is
// looked up by url match.
//
// Run: node scripts/setup-stripe.mjs

import { readFileSync, writeFileSync } from "node:fs";

const ENV_PATH = "C:\\Users\\Victus\\trades\\.env.local";
const ENV_TEXT = readFileSync(ENV_PATH, "utf-8");

const SK = (ENV_TEXT.match(/^STRIPE_SECRET_KEY=(.+)$/m) ?? [])[1]?.trim();
if (!SK) throw new Error("STRIPE_SECRET_KEY missing from .env.local");

// Production webhook URL. Adjust if your deploy URL differs.
const WEBHOOK_URL = process.env.STRIPE_WEBHOOK_URL ?? "https://xratedtrade.com/api/stripe/webhook";

async function stripe(path, method, params) {
  const body =
    method === "GET" || !params
      ? undefined
      : Object.entries(params)
          .flatMap(([k, v]) => {
            if (Array.isArray(v)) {
              return v.map((item, i) => `${encodeURIComponent(k)}[${i}]=${encodeURIComponent(item)}`);
            }
            if (v && typeof v === "object") {
              return Object.entries(v).map(
                ([sk, sv]) => `${encodeURIComponent(k)}[${encodeURIComponent(sk)}]=${encodeURIComponent(sv)}`
              );
            }
            return [`${encodeURIComponent(k)}=${encodeURIComponent(v)}`];
          })
          .join("&");
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${SK}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const json = await r.json();
  if (!r.ok) {
    throw new Error(`Stripe ${path} ${r.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function findOrCreateProduct({ slug, name, description }) {
  // Look up by metadata via search API (Stripe's search lets us filter by metadata).
  const found = await stripe(
    `/products/search?query=${encodeURIComponent(`metadata['xrated_slug']:'${slug}' AND active:'true'`)}`,
    "GET"
  );
  if (found.data?.length) {
    console.log(`  = product ${slug} (${found.data[0].id})`);
    return found.data[0];
  }
  const created = await stripe("/products", "POST", {
    name,
    description,
    metadata: { xrated_slug: slug }
  });
  console.log(`  + product ${slug} (${created.id})`);
  return created;
}

async function findOrCreatePrice({ productId, key, unit_amount, interval, nickname }) {
  const found = await stripe(
    `/prices/search?query=${encodeURIComponent(`metadata['xrated_key']:'${key}' AND active:'true'`)}`,
    "GET"
  );
  if (found.data?.length) {
    console.log(`  = price ${key} (${found.data[0].id})`);
    return found.data[0];
  }
  const created = await stripe("/prices", "POST", {
    currency: "gbp",
    unit_amount,
    nickname,
    product: productId,
    recurring: { interval },
    metadata: { xrated_key: key }
  });
  console.log(`  + price ${key} (${created.id})`);
  return created;
}

async function findOrCreateWebhook() {
  const found = await stripe("/webhook_endpoints", "GET");
  const existing = found.data?.find((w) => w.url === WEBHOOK_URL);
  if (existing) {
    console.log(`  = webhook ${WEBHOOK_URL} (${existing.id})`);
    // Whisec is only returned at creation time. If we found an existing
    // webhook we can't read its secret — caller must reuse what was
    // previously stored in .env.local, or rotate it manually.
    return { id: existing.id, secret: null };
  }
  const created = await stripe("/webhook_endpoints", "POST", {
    url: WEBHOOK_URL,
    enabled_events: [
      "checkout.session.completed",
      "customer.subscription.updated",
      "customer.subscription.deleted"
    ],
    description: "Xrated Trades — subscription lifecycle"
  });
  console.log(`  + webhook ${WEBHOOK_URL} (${created.id})`);
  return { id: created.id, secret: created.secret };
}

console.log("== Tier products ==");
const paidProduct = await findOrCreateProduct({
  slug: "trades_app_paid",
  name: "Xrated Trades — Paid tier",
  description: "Brandable xratedtrade.com/<slug> profile, white-label, full features."
});
const verifiedProduct = await findOrCreateProduct({
  slug: "trades_app_verified",
  name: "Xrated Trades — Verified tier",
  description: "Everything in Paid plus Companies House-verified badge and trust differentiators."
});

console.log("\n== Tier prices ==");
const paidMonthly = await findOrCreatePrice({
  productId: paidProduct.id,
  key: "paid_monthly",
  unit_amount: 1499,
  interval: "month",
  nickname: "Paid · Monthly"
});
const paidAnnual = await findOrCreatePrice({
  productId: paidProduct.id,
  key: "paid_annual",
  unit_amount: 13999,
  interval: "year",
  nickname: "Paid · Annual"
});
const verifiedMonthly = await findOrCreatePrice({
  productId: verifiedProduct.id,
  key: "verified_monthly",
  unit_amount: 1999,
  interval: "month",
  nickname: "Verified · Monthly"
});
const verifiedAnnual = await findOrCreatePrice({
  productId: verifiedProduct.id,
  key: "verified_annual",
  unit_amount: 19999,
  interval: "year",
  nickname: "Verified · Annual"
});

console.log("\n== Add-on products + prices ==");
const ADDONS = [
  { slug: "trade_center", name: "Trade Center", desc: "Catalogue + cart for merchant trades.", pence: 500 },
  { slug: "services_grid", name: "Services Prices", desc: "Priced services grid with descriptions.", pence: 400 },
  { slug: "downloads", name: "Downloads", desc: "Downloadable brochures, spec sheets, certificates.", pence: 200 },
  { slug: "job_diary", name: "Job Diary", desc: "Showcase live and recent jobs with photos.", pence: 400 },
  { slug: "wholesale_mode", name: "Wholesale Mode", desc: "B2B trade pricing tier with account-only viewing.", pence: 700 },
  { slug: "custom_domain", name: "Custom Domain", desc: "Use your own domain instead of xratedtrade.com.", pence: 500 },
  { slug: "lead_alerts", name: "Lead Alerts", desc: "Instant WhatsApp + email pings on new enquiries.", pence: 400 },
  { slug: "materials_network", name: "Materials Network", desc: "Cross-promote merchants you trust, earn commission.", pence: 300 },
  { slug: "quote_pipeline", name: "Quote Pipeline", desc: "Lightweight CRM for quote requests.", pence: 500 },
  { slug: "faq_page", name: "FAQ Page", desc: "Dedicated FAQ surface with rich images.", pence: 200 }
];

const ADDON_RESULTS = {};
for (const a of ADDONS) {
  const prod = await findOrCreateProduct({
    slug: `addon_${a.slug}`,
    name: a.name,
    description: a.desc
  });
  const price = await findOrCreatePrice({
    productId: prod.id,
    key: `addon_${a.slug}`,
    unit_amount: a.pence,
    interval: "month",
    nickname: `${a.name} · Monthly`
  });
  ADDON_RESULTS[a.slug] = price.id;
}

console.log("\n== Webhook endpoint ==");
const webhook = await findOrCreateWebhook();

// Rewrite .env.local with the resolved IDs.
const replacements = {
  STRIPE_PRICE_PAID_MONTHLY: paidMonthly.id,
  STRIPE_PRICE_PAID_ANNUAL: paidAnnual.id,
  STRIPE_PRICE_VERIFIED_MONTHLY: verifiedMonthly.id,
  STRIPE_PRICE_VERIFIED_ANNUAL: verifiedAnnual.id,
  STRIPE_PRICE_ADDON_TRADE_CENTER: ADDON_RESULTS.trade_center,
  STRIPE_PRICE_ADDON_SERVICES_GRID: ADDON_RESULTS.services_grid,
  STRIPE_PRICE_ADDON_DOWNLOADS: ADDON_RESULTS.downloads,
  STRIPE_PRICE_ADDON_JOB_DIARY: ADDON_RESULTS.job_diary,
  STRIPE_PRICE_ADDON_WHOLESALE_MODE: ADDON_RESULTS.wholesale_mode,
  STRIPE_PRICE_ADDON_CUSTOM_DOMAIN: ADDON_RESULTS.custom_domain,
  STRIPE_PRICE_ADDON_LEAD_ALERTS: ADDON_RESULTS.lead_alerts,
  STRIPE_PRICE_ADDON_MATERIALS_NETWORK: ADDON_RESULTS.materials_network,
  STRIPE_PRICE_ADDON_QUOTE_PIPELINE: ADDON_RESULTS.quote_pipeline,
  STRIPE_PRICE_ADDON_FAQ_PAGE: ADDON_RESULTS.faq_page
};
if (webhook.secret) {
  replacements.STRIPE_WEBHOOK_SECRET = webhook.secret;
}

let newEnv = ENV_TEXT;
for (const [k, v] of Object.entries(replacements)) {
  if (!v) continue;
  const re = new RegExp(`^${k}=.*$`, "m");
  if (re.test(newEnv)) {
    newEnv = newEnv.replace(re, `${k}=${v}`);
  } else {
    newEnv += `\n${k}=${v}`;
  }
}
writeFileSync(ENV_PATH, newEnv);

console.log(`\nDone.`);
console.log(`  ${webhook.secret ? "Webhook secret written to .env.local" : "Webhook secret NOT rewritten (endpoint already existed — copy it from Stripe Dashboard manually)"}.`);
console.log("  Restart the dev server so .env.local is re-read.");
