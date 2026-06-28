// Configures everything in the user's live Stripe account that the
// Management API will let us do without a Dashboard click. Reads the
// secret key from .env.local.
//
// Concretely:
//  1. Updates account business_profile (name, url, support_email,
//     product_description, MCC). Improves Stripe Risk review odds for
//     the "xratedtrade" domain.
//  2. Creates a Customer Portal configuration with cancel + update +
//     invoice + plan swap enabled. Eliminates the manual "go to
//     Dashboard, click Save once" step that was blocking the Manage
//     Subscription button.
//  3. Creates a Payment Method Configuration that enables card +
//     Apple Pay + Google Pay + BACS Direct Debit (UK) so subscribers
//     have lower-cost alternatives to card.
//  4. Updates every existing checkout-flow to use automatic payment
//     methods (handled by editing /api/stripe/checkout/route.ts in a
//     companion edit, not this script).
//
// Run: node scripts/configure-stripe-account.mjs

import { readFileSync } from "node:fs";

const ENV_PATH = "C:\\Users\\Victus\\trades\\.env.local";
const ENV_TEXT = readFileSync(ENV_PATH, "utf-8");
const SK = (ENV_TEXT.match(/^STRIPE_SECRET_KEY=(.+)$/m) ?? [])[1]?.trim();
if (!SK) throw new Error("STRIPE_SECRET_KEY missing from .env.local");

function readEnv(name) {
  return (ENV_TEXT.match(new RegExp(`^${name}=(.+)$`, "m")) ?? [])[1]?.trim() ?? "";
}

const TIER_PAID_MONTHLY = readEnv("STRIPE_PRICE_PAID_MONTHLY");
const TIER_PAID_ANNUAL = readEnv("STRIPE_PRICE_PAID_ANNUAL");
const TIER_VERIFIED_MONTHLY = readEnv("STRIPE_PRICE_VERIFIED_MONTHLY");
const TIER_VERIFIED_ANNUAL = readEnv("STRIPE_PRICE_VERIFIED_ANNUAL");

async function stripe(path, method, params) {
  const body =
    method === "GET" || !params
      ? undefined
      : Object.entries(params)
          .flatMap(([k, v]) => {
            if (Array.isArray(v)) {
              return v.flatMap((item, i) => {
                if (item && typeof item === "object") {
                  return Object.entries(item).map(
                    ([sk, sv]) =>
                      `${encodeURIComponent(k)}[${i}][${encodeURIComponent(sk)}]=${encodeURIComponent(
                        Array.isArray(sv) ? sv[0] : sv
                      )}`
                  );
                }
                return `${encodeURIComponent(k)}[${i}]=${encodeURIComponent(item)}`;
              });
            }
            if (v && typeof v === "object") {
              return Object.entries(v).map(([sk, sv]) => {
                if (Array.isArray(sv)) {
                  return sv
                    .map(
                      (item, i) =>
                        `${encodeURIComponent(k)}[${encodeURIComponent(sk)}][${i}]=${encodeURIComponent(item)}`
                    )
                    .join("&");
                }
                return `${encodeURIComponent(k)}[${encodeURIComponent(sk)}]=${encodeURIComponent(sv)}`;
              });
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
  return { ok: r.ok, status: r.status, json };
}

// 1. Business profile — give Stripe Risk the construction-trades context.
console.log("== Business profile ==");
const bp = await stripe("/account", "POST", {
  "business_profile[name]": "Trade Off",
  "business_profile[url]": "https://xratedtrade.com",
  "business_profile[support_email]": "support@xratedtrade.com",
  "business_profile[support_url]": "https://xratedtrade.com/legal/refunds",
  "business_profile[product_description]":
    "Subscription SaaS for UK construction tradespeople. Public profile pages, customer reviews, catalogue + cart features for merchant trades, lead-capture tools. £14.99/mo or £139.99/yr recurring. Trading name 'Xrated Trades' / 'Trade Off'. No physical product shipped — pure digital service. The 'X' in the brand name signals quality rating, not adult content.",
  "business_profile[mcc]": "5817",
  // 5817 = Digital Goods - Applications. Most accurate MCC for a
  // pure-SaaS subscription business. Stripe Risk uses MCC for industry
  // categorisation.
  settings: {
    branding: {
      primary_color: "#FFB300",
      secondary_color: "#0A0A0A"
    }
  }
});
if (bp.ok) {
  console.log(`  + business_profile updated`);
  console.log(`    name: ${bp.json.business_profile?.name}`);
  console.log(`    support: ${bp.json.business_profile?.support_email}`);
} else {
  console.log(`  ! business_profile update returned ${bp.status}`);
  console.log(`    ${JSON.stringify(bp.json.error?.message ?? bp.json)}`);
  console.log(`    Some fields may need to be set in Dashboard manually.`);
}

// 2. Customer Portal configuration — fully API-driven so no Dashboard
//    click is required. The default config is what the portal API uses.
console.log("\n== Customer Portal ==");
const portalConfig = {
  "business_profile[headline]": "Manage your Trade Off subscription",
  "business_profile[privacy_policy_url]": "https://xratedtrade.com/legal/privacy",
  "business_profile[terms_of_service_url]": "https://xratedtrade.com/legal/terms",
  "features[customer_update][enabled]": "true",
  "features[customer_update][allowed_updates][]": "email",
  "features[invoice_history][enabled]": "true",
  "features[payment_method_update][enabled]": "true",
  "features[subscription_cancel][enabled]": "true",
  "features[subscription_cancel][mode]": "at_period_end",
  "features[subscription_cancel][cancellation_reason][enabled]": "true",
  "features[subscription_cancel][cancellation_reason][options][]": "too_expensive",
  // Stripe lets us collect up to 8 reasons. Comma-pasting more options
  // would be possible but four is a sensible default — enough signal
  // without overwhelming the form.
  "features[subscription_update][enabled]": "true",
  "features[subscription_update][default_allowed_updates][]": "price",
  "features[subscription_update][proration_behavior]": "create_prorations",
  default_return_url: "https://xratedtrade.com/trade-off/edit"
};
// Append additional cancel reasons.
portalConfig["features[subscription_cancel][cancellation_reason][options][1]"] = "missing_features";
portalConfig["features[subscription_cancel][cancellation_reason][options][2]"] = "switched_service";
portalConfig["features[subscription_cancel][cancellation_reason][options][3]"] = "other";

// For subscription_update we need to declare which products are
// swappable. List Paid + Verified with both billing intervals.
const products = [
  {
    product: null, // resolve after lookup
    priceKey: "trades_app_paid",
    priceIds: [TIER_PAID_MONTHLY, TIER_PAID_ANNUAL]
  },
  {
    product: null,
    priceKey: "trades_app_verified",
    priceIds: [TIER_VERIFIED_MONTHLY, TIER_VERIFIED_ANNUAL]
  }
];

for (const p of products) {
  const lookup = await stripe(
    `/products/search?query=${encodeURIComponent(`metadata['xrated_slug']:'${p.priceKey}' AND active:'true'`)}`,
    "GET"
  );
  if (lookup.ok && lookup.json.data?.[0]) {
    p.product = lookup.json.data[0].id;
  }
}

products.forEach((p, idx) => {
  if (!p.product) return;
  portalConfig[`features[subscription_update][products][${idx}][product]`] = p.product;
  p.priceIds.forEach((pid, j) => {
    if (pid) portalConfig[`features[subscription_update][products][${idx}][prices][${j}]`] = pid;
  });
});

// Look for an existing default portal config so we don't accumulate.
const existingPortals = await stripe("/billing_portal/configurations?is_default=true&limit=1", "GET");
const existingDefault = existingPortals.json.data?.[0];
let portalResp;
if (existingDefault) {
  portalResp = await stripe(`/billing_portal/configurations/${existingDefault.id}`, "POST", portalConfig);
  if (portalResp.ok) console.log(`  = portal config updated (${existingDefault.id})`);
} else {
  portalResp = await stripe("/billing_portal/configurations", "POST", portalConfig);
  if (portalResp.ok) console.log(`  + portal config created (${portalResp.json.id})`);
}
if (!portalResp.ok) {
  console.log(`  ! portal config returned ${portalResp.status}`);
  console.log(`    ${JSON.stringify(portalResp.json.error?.message ?? portalResp.json)}`);
}

// 3. Payment Method Configuration — enable BACS Direct Debit + card +
//    link + wallets so subscribers have a lower-cost alternative to card.
console.log("\n== Payment methods ==");
const pmcResp = await stripe("/payment_method_configurations", "POST", {
  name: "Trade Off — Subscriptions",
  "card[display_preference][preference]": "on",
  "link[display_preference][preference]": "on",
  "apple_pay[display_preference][preference]": "on",
  "google_pay[display_preference][preference]": "on",
  "bacs_debit[display_preference][preference]": "on"
});
if (pmcResp.ok) {
  console.log(`  + payment-method config created (${pmcResp.json.id})`);
  console.log(`    Cards always on. Link, Apple Pay, Google Pay, BACS DD opt-in.`);
  console.log(`    Note: BACS requires account-level activation in Dashboard.`);
} else {
  console.log(`  ! payment-method config returned ${pmcResp.status}`);
  console.log(`    ${JSON.stringify(pmcResp.json.error?.message ?? pmcResp.json)}`);
}

console.log("\nDone.");
