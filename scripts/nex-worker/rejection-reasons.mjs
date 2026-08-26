// NEX Worker Rejection Reasons · shared vocabulary + counter + cycle-outcome.
//
// Phase 1 of the discovery-loosening arc (2026-08-25 · Philip greenlight).
// Constitutional pin: instrument first, then decide. No gate policy change.
//
// Consumed by every walker path:
//   · scripts/nex-acquisition/engine.mjs        (food · accommodation)
//   · scripts/nex-shop/_market-walker-discover.mjs (market)
//   · scripts/nex-transport-acquisition/_transport-walker-cycle.mjs (transport)
//
// Written into worker_cycle_run.summary as:
//   { rejected_by_reason: { CONTACT_MISSING: 47, MALFORMED: 3, ... },
//     cycle_outcome: "PROVIDER_EMPTY" | "PROVIDER_ERROR" | "ALL_DEDUPED"
//                  | "ALL_REJECTED"   | "PARTIAL"        | "PRODUCTIVE"
//                  | "NO_NEW_CANDIDATES" }
//
// No schema change · summary is already jsonb.

export const REJECTION_REASONS = Object.freeze({
  CONTACT_MISSING:  "CONTACT_MISSING",   // gate 3 · no WhatsApp AND no phone
  INELIGIBLE:       "INELIGIBLE",        // gate 4 · killswitch/suppress/cooldown/cap
  MALFORMED:        "MALFORMED",         // shape check · name < 2 chars / bad ids
  GEO_MISS:         "GEO_MISS",          // outside declared city bbox
  CATEGORY_MISS:    "CATEGORY_MISS",     // classifier confidence 0 for target vertical
  MATCHED_EXISTING: "MATCHED_EXISTING",  // dedupe hit · not new (informational)
  OTHER:            "OTHER",             // catch-all · always log the raw reason too
});

export const CYCLE_OUTCOMES = Object.freeze({
  PROVIDER_EMPTY:     "PROVIDER_EMPTY",      // provider returned zero rows
  PROVIDER_ERROR:     "PROVIDER_ERROR",      // provider call itself failed
  ALL_DEDUPED:        "ALL_DEDUPED",         // every processed row matched existing
  ALL_REJECTED:       "ALL_REJECTED",        // every processed row hit a gate
  PARTIAL:            "PARTIAL",             // some new · some rejected/deduped
  PRODUCTIVE:         "PRODUCTIVE",          // new records with negligible loss
  NO_NEW_CANDIDATES:  "NO_NEW_CANDIDATES",   // no new · reason unclear
  BUDGET_EXHAUSTED:   "BUDGET_EXHAUSTED",    // P8 · cost-oracle blocked the cycle before any provider call
});

const VALID_REASONS = new Set(Object.values(REJECTION_REASONS));

export function createRejectionCounter() {
  const counts = Object.create(null);
  for (const r of VALID_REASONS) counts[r] = 0;
  return {
    increment(reason, n = 1) {
      const key = VALID_REASONS.has(reason) ? reason : REJECTION_REASONS.OTHER;
      counts[key] += n;
    },
    get(reason) { return counts[reason] ?? 0; },
    total() {
      let t = 0;
      for (const r of VALID_REASONS) if (r !== REJECTION_REASONS.MATCHED_EXISTING) t += counts[r];
      return t;
    },
    toObject() {
      const out = {};
      for (const r of VALID_REASONS) if (counts[r] > 0) out[r] = counts[r];
      return out;
    },
  };
}

export function computeCycleOutcome({
  recordsProcessed = 0,
  recordsNew = 0,
  recordsRejected = 0,
  matchedExisting = 0,
  providerReturned = null,
  providerErrored = 0,
  budgetExhausted = false,
} = {}) {
  // P8 · cost-oracle short-circuit. BUDGET_EXHAUSTED wins over every other
  // classification because the walker never actually queried a provider ·
  // any "processed / rejected / deduped" counts would be misleading.
  if (budgetExhausted) return CYCLE_OUTCOMES.BUDGET_EXHAUSTED;

  if (providerErrored > 0 && recordsProcessed === 0) return CYCLE_OUTCOMES.PROVIDER_ERROR;
  if (recordsProcessed === 0 && (providerReturned === 0 || providerReturned === null)) {
    return CYCLE_OUTCOMES.PROVIDER_EMPTY;
  }
  if (recordsProcessed > 0 && recordsNew === 0) {
    if (matchedExisting === recordsProcessed) return CYCLE_OUTCOMES.ALL_DEDUPED;
    if (recordsRejected === recordsProcessed) return CYCLE_OUTCOMES.ALL_REJECTED;
    if (matchedExisting + recordsRejected === recordsProcessed) return CYCLE_OUTCOMES.ALL_DEDUPED;
    return CYCLE_OUTCOMES.NO_NEW_CANDIDATES;
  }
  if (recordsNew > 0 && (recordsRejected > 0 || matchedExisting > 0)) return CYCLE_OUTCOMES.PARTIAL;
  if (recordsNew > 0) return CYCLE_OUTCOMES.PRODUCTIVE;
  return CYCLE_OUTCOMES.NO_NEW_CANDIDATES;
}
