// Lock the processor registry — every payment button should have a
// processor registered (real integration, handoff, or graceful stub).

import { paymentProcessors } from "./processor";
import "./processors";

const expected = [
  "stripe",
  "paypal",
  "gopay",
  "ovo",
  "dana",
  "qris",
  "razorpay",
  "cod",
  "bank_transfer",
  "klarna",
  "adyen",
  "wise",
  "coinbase",
  "mollie",
  "square",
  "cash_app",
  "alipay",
  "wechat",
  "amazon_pay",
  "linkaja",
  "grabpay",
  "zelle",
  "venmo"
];

const registered = paymentProcessors.list().map((p) => p.providerId);
console.log(`Registered processors: ${registered.length}`);
console.log(`  ${registered.sort().join(", ")}`);

let missing = 0;
for (const id of expected) {
  if (!paymentProcessors.get(id)) {
    console.error(`  MISSING: ${id}`);
    missing++;
  }
}
if (missing > 0) {
  console.error(`${missing} processor(s) missing from registry.`);
  process.exit(1);
}
console.log("Payment processors — all expected providers registered.");
