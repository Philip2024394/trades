// Maximise worldwide payment-method coverage on the existing PMC.
// Attempts to enable EVERY method Stripe supports for subscriptions.
// Methods the account doesn't yet have capability for will be rejected
// — the script logs which ones the owner must request in Dashboard.

import { readFileSync } from "node:fs";

const ENV_TEXT = readFileSync("C:\\Users\\Victus\\trades\\.env.local", "utf-8");
const SK = (ENV_TEXT.match(/^STRIPE_SECRET_KEY=(.+)$/m) ?? [])[1]?.trim();
if (!SK) throw new Error("STRIPE_SECRET_KEY missing");

async function stripeRaw(path, method, body) {
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${SK}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  return { ok: r.ok, status: r.status, json: await r.json() };
}

// Read account capabilities so we only ATTEMPT methods that are active.
const acct = await stripeRaw("/account", "GET");
const caps = acct.json.capabilities ?? {};
const active = Object.entries(caps)
  .filter(([, v]) => v === "active")
  .map(([k]) => k);

console.log("Active capabilities on the account:");
active.forEach((c) => console.log(`  ✓ ${c}`));
console.log("");

// Map Stripe capability names → PMC payment-method names. Only the
// ones already active will be enabled.
const CAP_TO_PMC = {
  card_payments: "card",
  link_payments: "link",
  ideal_payments: "ideal",
  bancontact_payments: "bancontact",
  giropay_payments: "giropay",
  eps_payments: "eps",
  p24_payments: "p24",
  klarna_payments: "klarna",
  blik_payments: "blik",
  sepa_debit_payments: "sepa_debit",
  bacs_debit_payments: "bacs_debit",
  us_bank_account_ach_payments: "us_bank_account",
  au_becs_debit_payments: "au_becs_debit",
  affirm_payments: "affirm",
  afterpay_clearpay_payments: "afterpay_clearpay",
  alipay_payments: "alipay",
  wechat_pay_payments: "wechat_pay",
  cashapp_payments: "cashapp",
  oxxo_payments: "oxxo",
  paynow_payments: "paynow",
  promptpay_payments: "promptpay",
  multibanco_payments: "multibanco",
  mobilepay_payments: "mobilepay",
  konbini_payments: "konbini",
  twint_payments: "twint",
  zip_payments: "zip"
};

// PMC always implicitly includes wallets (apple_pay, google_pay) via
// the card capability. We add them explicitly too.
const toEnable = ["card", "link", "apple_pay", "google_pay"];
for (const cap of active) {
  const pmcName = CAP_TO_PMC[cap];
  if (pmcName && !toEnable.includes(pmcName)) toEnable.push(pmcName);
}

console.log("Will request enable on PMC:");
toEnable.forEach((m) => console.log(`  → ${m}`));
console.log("");

const list = await stripeRaw("/payment_method_configurations?limit=10", "GET");
const existing = list.json.data?.find((c) => c.name === "Trade Off — Subscriptions");

const body = toEnable
  .map((m) => `${m}[display_preference][preference]=on`)
  .concat(["name=Trade%20Off%20%E2%80%94%20Subscriptions"])
  .join("&");

const resp = existing
  ? await stripeRaw(`/payment_method_configurations/${existing.id}`, "POST", body)
  : await stripeRaw("/payment_method_configurations", "POST", body);

if (resp.ok) {
  console.log(`✓ PMC ${existing ? "updated" : "created"} (${resp.json.id})`);
  const enabled = Object.entries(resp.json)
    .filter(
      ([k, v]) =>
        typeof v === "object" &&
        v !== null &&
        "display_preference" in v &&
        v.display_preference?.preference === "on"
    )
    .map(([k]) => k);
  console.log(`  Enabled methods (${enabled.length}): ${enabled.join(", ")}`);
} else {
  console.log(`✗ PMC update failed: ${resp.status}`);
  console.log(`  ${resp.json.error?.message ?? JSON.stringify(resp.json)}`);
}

// Capabilities NOT yet active — these the owner has to request in
// Dashboard. Worth flagging so they know what's missing.
const allWantedCaps = Object.keys(CAP_TO_PMC);
const inactive = allWantedCaps.filter((c) => caps[c] !== "active");
console.log("");
console.log("Capabilities NOT active (request in Dashboard → Payments → Payment methods):");
inactive.forEach((c) => console.log(`  - ${c} (${CAP_TO_PMC[c]})`));
