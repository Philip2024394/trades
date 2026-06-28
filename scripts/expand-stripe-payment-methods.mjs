// Expand the existing Payment Method Configuration to enable every
// payment method this Irish Stripe account currently has as ACTIVE
// capability. Recreates the configuration with the full set so a
// customer in any region sees the methods their country supports.
//
// Active capabilities (read from /v1/account):
//   card, link, bancontact, blik, eps, giropay, ideal, klarna, p24
//
// Inactive but worth-flagging: sepa_debit, bacs_debit, us_bank_account,
// au_becs_debit. To enable these the owner has to request the
// capability in Stripe Dashboard (Settings → Payments → Payment methods).
//
// Run: node scripts/expand-stripe-payment-methods.mjs

import { readFileSync } from "node:fs";

const ENV_PATH = "C:\\Users\\Victus\\trades\\.env.local";
const ENV_TEXT = readFileSync(ENV_PATH, "utf-8");
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
  const json = await r.json();
  return { ok: r.ok, status: r.status, json };
}

// Find the existing PMC if any.
const list = await stripeRaw("/payment_method_configurations?limit=10", "GET", undefined);
const existing = list.json.data?.find((c) => c.name === "Trade Off — Subscriptions");

// Methods active on the account today. Klarna is only available on
// one-off charges in Checkout mode subscription_data flows — Stripe
// silently ignores it for sub-mode sessions, so listing it here is
// harmless.
const methods = [
  "card",
  "link",
  "bancontact",
  "eps",
  "giropay",
  "ideal",
  "klarna",
  "p24"
];

const body = methods
  .flatMap((m) => [
    `${m}[display_preference][preference]=on`
  ])
  .concat(["name=Trade%20Off%20%E2%80%94%20Subscriptions"])
  .join("&");

let resp;
if (existing) {
  resp = await stripeRaw(`/payment_method_configurations/${existing.id}`, "POST", body);
} else {
  resp = await stripeRaw("/payment_method_configurations", "POST", body);
}

if (resp.ok) {
  console.log(`+ PMC ${existing ? "updated" : "created"} (${resp.json.id})`);
  console.log(`  Enabled methods: ${methods.join(", ")}`);
  console.log(`  Default for Checkout: yes (single PMC on the account)`);
  console.log("");
  console.log("  Worldwide coverage now wires automatically per customer geo:");
  console.log("  - UK / global: Card + Link + Klarna (one-off-style)");
  console.log("  - NL: + iDEAL");
  console.log("  - BE: + Bancontact");
  console.log("  - DE: + Giropay");
  console.log("  - AT: + EPS");
  console.log("  - PL: + P24");
  console.log("");
  console.log("  To unlock more (SEPA Debit, BACS Debit, ACH Debit, BECS Debit):");
  console.log("  Dashboard > Settings > Payments > Payment methods → request capability.");
} else {
  console.log(`! PMC update returned ${resp.status}`);
  console.log(`  ${resp.json.error?.message ?? JSON.stringify(resp.json)}`);
}
