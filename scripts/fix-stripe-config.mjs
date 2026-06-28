// Second-pass fixes for the Stripe account:
//   1. Statement descriptor change from "BOXALOTA" to "TRADE OFF" via
//      the account API. Stripe blocks `POST /v1/account` for some
//      standalone-account fields, so we try the minimal-payload route.
//   2. Customer Portal config with correctly-encoded cancellation
//      reasons array. Previous run failed with a 400 because the
//      `options[]` repeating-key notation collided with mixed indexed
//      access.

import { readFileSync } from "node:fs";

const ENV_PATH = "C:\\Users\\Victus\\trades\\.env.local";
const ENV_TEXT = readFileSync(ENV_PATH, "utf-8");
const SK = (ENV_TEXT.match(/^STRIPE_SECRET_KEY=(.+)$/m) ?? [])[1]?.trim();
if (!SK) throw new Error("STRIPE_SECRET_KEY missing");

function readEnv(name) {
  return (ENV_TEXT.match(new RegExp(`^${name}=(.+)$`, "m")) ?? [])[1]?.trim() ?? "";
}

async function stripeRaw(path, method, formBody) {
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${SK}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formBody
  });
  const json = await r.json();
  return { ok: r.ok, status: r.status, json };
}

// 1. Statement descriptor — minimal payload, only the two fields we
//    actually want to change. Maybe Stripe gates per-field for
//    standalone accounts.
console.log("== Statement descriptor ==");
const sdBody = [
  "settings[payments][statement_descriptor]=TRADE%20OFF",
  "settings[card_payments][statement_descriptor_prefix]=TRADEOFF"
].join("&");
const sd = await stripeRaw("/account", "POST", sdBody);
if (sd.ok) {
  console.log(`  + statement descriptor updated`);
  console.log(`    payments.statement_descriptor: ${sd.json.settings?.payments?.statement_descriptor}`);
  console.log(`    card_payments.statement_descriptor_prefix: ${sd.json.settings?.card_payments?.statement_descriptor_prefix}`);
} else {
  console.log(`  ! statement descriptor update returned ${sd.status}`);
  console.log(`    ${sd.json.error?.message ?? JSON.stringify(sd.json)}`);
  console.log(`    Fallback: change in Dashboard at Settings > Business > Public details > Statement descriptor`);
}

// 2. Customer Portal config — fully indexed array notation. No mixed
//    `[]` empty index. Look up tier products via metadata so we don't
//    hardcode product IDs.
console.log("\n== Customer Portal ==");

const TIER_PAID_MONTHLY = readEnv("STRIPE_PRICE_PAID_MONTHLY");
const TIER_PAID_ANNUAL = readEnv("STRIPE_PRICE_PAID_ANNUAL");
const TIER_VERIFIED_MONTHLY = readEnv("STRIPE_PRICE_VERIFIED_MONTHLY");
const TIER_VERIFIED_ANNUAL = readEnv("STRIPE_PRICE_VERIFIED_ANNUAL");

async function findProductBySlug(slug) {
  const q = encodeURIComponent(`metadata['xrated_slug']:'${slug}' AND active:'true'`);
  const r = await stripeRaw(`/products/search?query=${q}`, "GET", undefined);
  return r.json.data?.[0]?.id ?? null;
}

const paidProductId = await findProductBySlug("trades_app_paid");
const verifiedProductId = await findProductBySlug("trades_app_verified");

// Build the form body manually — explicit indices everywhere, encoded
// once. This is the bit my generic encoder was getting wrong.
const e = encodeURIComponent;
const lines = [
  `business_profile[headline]=${e("Manage your Trade Off subscription")}`,
  `business_profile[privacy_policy_url]=${e("https://xratedtrade.com/legal/privacy")}`,
  `business_profile[terms_of_service_url]=${e("https://xratedtrade.com/legal/terms")}`,
  `default_return_url=${e("https://xratedtrade.com/trade-off/edit")}`,

  `features[customer_update][enabled]=true`,
  `features[customer_update][allowed_updates][0]=email`,

  `features[invoice_history][enabled]=true`,
  `features[payment_method_update][enabled]=true`,

  `features[subscription_cancel][enabled]=true`,
  `features[subscription_cancel][mode]=at_period_end`,
  `features[subscription_cancel][cancellation_reason][enabled]=true`,
  `features[subscription_cancel][cancellation_reason][options][0]=too_expensive`,
  `features[subscription_cancel][cancellation_reason][options][1]=missing_features`,
  `features[subscription_cancel][cancellation_reason][options][2]=switched_service`,
  `features[subscription_cancel][cancellation_reason][options][3]=other`,

  `features[subscription_update][enabled]=true`,
  `features[subscription_update][default_allowed_updates][0]=price`,
  `features[subscription_update][proration_behavior]=create_prorations`
];

if (paidProductId) {
  lines.push(`features[subscription_update][products][0][product]=${e(paidProductId)}`);
  if (TIER_PAID_MONTHLY) lines.push(`features[subscription_update][products][0][prices][0]=${e(TIER_PAID_MONTHLY)}`);
  if (TIER_PAID_ANNUAL) lines.push(`features[subscription_update][products][0][prices][1]=${e(TIER_PAID_ANNUAL)}`);
}
if (verifiedProductId) {
  lines.push(`features[subscription_update][products][1][product]=${e(verifiedProductId)}`);
  if (TIER_VERIFIED_MONTHLY) lines.push(`features[subscription_update][products][1][prices][0]=${e(TIER_VERIFIED_MONTHLY)}`);
  if (TIER_VERIFIED_ANNUAL) lines.push(`features[subscription_update][products][1][prices][1]=${e(TIER_VERIFIED_ANNUAL)}`);
}

const portalBody = lines.join("&");

// Existing default config? Update it. Otherwise create.
const existing = await stripeRaw("/billing_portal/configurations?is_default=true&limit=1", "GET", undefined);
const existingDefault = existing.json.data?.[0];
let portalResp;
if (existingDefault) {
  portalResp = await stripeRaw(`/billing_portal/configurations/${existingDefault.id}`, "POST", portalBody);
  if (portalResp.ok) console.log(`  = portal config updated (${existingDefault.id})`);
} else {
  portalResp = await stripeRaw("/billing_portal/configurations", "POST", portalBody);
  if (portalResp.ok) console.log(`  + portal config created (${portalResp.json.id})`);
}
if (!portalResp.ok) {
  console.log(`  ! portal config returned ${portalResp.status}`);
  console.log(`    ${portalResp.json.error?.message ?? JSON.stringify(portalResp.json)}`);
}

console.log("\nDone.");
