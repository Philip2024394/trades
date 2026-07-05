// Cold-start defaults for the recommender.
//
// PRD §7.3: when a merchant hasn't answered the wizard, we still want a
// sensible ranked list. This module maps a merchant's primary_trade to
// a small set of default outcomes.
//
// Rules:
//   • Merchants (any *-merchant, aggregate-supplier, tool-merchant, etc.)
//     → product-sales + trade-account (they're B2B counter shops).
//   • Emergency-first trades (roofer, plumber, electrician, locksmith)
//     → phone-calls + emergency-callout + local-coverage.
//   • Everything else (service trades)
//     → quote-requests + local-coverage.
//
// Kept simple + deterministic so the merchant can override in one tap.

import type { OutcomeSlug } from "./types";

const MERCHANT_TRADES = new Set([
  "building-merchant",
  "builders-supplies",
  "timber-merchant",
  "tool-merchant",
  "fixings-supplier",
  "aggregate-supplier",
  "concrete-supplier",
  "roofing-supplier",
  "plumbing-merchant",
  "electrical-wholesaler"
]);

const EMERGENCY_TRADES = new Set([
  "roofer",
  "flat-roofing",
  "commercial-roofing",
  "emergency-roofing",
  "plumber",
  "heating-engineer",
  "gas-engineer",
  "electrician",
  "locksmith",
  "recovery-service"
]);

const HIRE_TRADES = new Set([
  "plant-hire",
  "excavator-hire",
  "dumper-hire",
  "telehandler-hire",
  "crane-hire",
  "access-platform-hire",
  "heavy-machinery",
  "skip-hire",
  "van-hire",
  "welfare-unit-hire"
]);

export function coldStartOutcomes(tradeSlug: string | null): OutcomeSlug[] {
  if (!tradeSlug) return ["quote-requests", "local-coverage"];
  if (MERCHANT_TRADES.has(tradeSlug))
    return ["product-sales", "trade-account", "local-coverage"];
  if (EMERGENCY_TRADES.has(tradeSlug))
    return ["phone-calls", "emergency-callout", "local-coverage"];
  if (HIRE_TRADES.has(tradeSlug))
    return ["equipment-hire", "phone-calls", "local-coverage"];
  return ["quote-requests", "local-coverage"];
}
