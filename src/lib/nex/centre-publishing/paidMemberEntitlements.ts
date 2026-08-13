// Paid Refacing Member entitlements · single source of truth for what
// benefits a paid member gets across NEX surfaces.
//
// Canonical spec: docs/refacing/REFACING-MEMBER-ENTITLEMENT-SPEC.md
//
// Philip 2026-08-13 business model:
//   Claim + Pay → Active Paid Trade Member (SAME listing_id, forward-only)
//   Paid trade member gets ACCESS + ELIGIBILITY (never a guarantee of volume):
//     ✅ E1 Professional trade listing         (card renders "partner" badge)
//     ✅ E2 NEX Trade Chat access              (open inbox · Chat infra pending)
//     ✅ E3 Trade Exchange routing eligibility (IN the pool · Exchange picks per enquiry)
//     ✅ E4 Enhanced profile control           (via claim workflow when wired)
//
// Being IN the pool (E3) is NOT the same as receiving every enquiry — the Trade
// Exchange evaluates suitability per-enquiry (service match, geography,
// capability, availability, qualification rank).
//
// Design intent:
//   Every surface that needs to check "can this business receive X?" imports
//   from THIS module. When the future Trade Chat + Lead systems ship, they
//   check `canReceiveNexLeads(seed)` / `canAccessNexTradeChat(seed)` here —
//   never re-implement the rule elsewhere.
//
// GOVERNANCE RULE (Philip 2026-08-13):
//   `refacing_qualification` (A+/A/B/C) is EVIDENCE + RANKING · NOT a gate.
//   A paid member with qualification `B` still receives leads · they may just
//   rank below an A+ member when the future ranking layer ships.

import type { DirectorySeed } from "./directorySeedLoader";

/**
 * Is this business listed on public NEX surfaces (Trade Center + Refacing directory)?
 *
 * Today: every seed with `status === "listed"` + `visibility === "public"` appears
 * in the feed regardless of directory_state. Unclaimed listings show "Unclaimed"
 * badge · claimed/paid members show the trust pip. Both are visible.
 *
 * This helper exists so future code that needs to filter has one place to check.
 */
export function isListedInTradeCenter(seed: Pick<DirectorySeed, "status" | "visibility">): boolean {
  return seed.status === "listed" && seed.visibility === "public";
}

/**
 * Is this business a paying NEX member entitled to the full paid-member benefits?
 *
 * Payment is the single gate for entitlements — never qualification, never claim
 * lifecycle beyond `directory_state`. Cancelled/expired subscriptions handled
 * separately by the Stripe webhook flipping `directory_state` back to "claimed".
 */
export function isPaidMember(seed: Pick<DirectorySeed, "directory_state">): boolean {
  return seed.directory_state === "paid_member";
}

/**
 * Is this business ELIGIBLE to be routed homeowner enquiries via NEX?
 *
 * RULE: paid_member alone. No qualification gate. Qualification affects ranking
 * only (and only once the ranking layer ships).
 *
 * Eligibility ≠ delivery. Being eligible puts the trade in the routing pool;
 * the Trade Exchange still evaluates suitability per-enquiry (service match,
 * geography, capability, availability). See
 * docs/refacing/REFACING-MEMBER-ENTITLEMENT-SPEC.md § 4.
 *
 * When the NEX-native routing lands (or the trades AI Visualiser lead system
 * is bridged into NEX), it MUST call this — not a copy of the rule.
 */
export function canReceiveNexLeads(seed: Pick<DirectorySeed, "directory_state">): boolean {
  return isPaidMember(seed);
}

/**
 * Can this business access the NEX Trade Chat app?
 *
 * RULE: paid_member alone. Chat access is a paid-member benefit.
 *
 * The NEX Trade Chat app doesn't exist yet in the NEX project · when it ships,
 * it MUST call this to gate access. The trades Construction Notebook chat
 * (a different product) is unrelated.
 */
export function canAccessNexTradeChat(seed: Pick<DirectorySeed, "directory_state">): boolean {
  return isPaidMember(seed);
}

/**
 * Is this business ELIGIBLE for Refacing Trade Exchange routing? Same predicate
 * as canReceiveNexLeads today · kept as a distinct name so a future
 * refacing-specific routing engine can differentiate if needed.
 *
 * Eligibility ≠ selection. The Exchange filters this eligible pool by service
 * match, geography, capability, availability, then ranks by qualification.
 *
 * NOTE (Philip 2026-08-13): refacing_qualification (A+/A/B/C) MUST NOT gate
 * this. It is preserved for ranking/quality display only.
 */
export function canReceiveRefacingRouting(seed: Pick<DirectorySeed, "directory_state">): boolean {
  return isPaidMember(seed);
}

/**
 * All paid-member benefits in one call · returns a snapshot for UI display.
 * Add fields here as new benefits get connected · single source of truth.
 */
export type PaidMemberBenefits = {
  listedInTradeCenter: boolean;
  paidMember: boolean;
  canReceiveLeads: boolean;
  canAccessTradeChat: boolean;
  canReceiveRefacingRouting: boolean;
};

export function paidMemberBenefits(seed: Pick<DirectorySeed, "directory_state" | "status" | "visibility">): PaidMemberBenefits {
  return {
    listedInTradeCenter:       isListedInTradeCenter(seed),
    paidMember:                isPaidMember(seed),
    canReceiveLeads:           canReceiveNexLeads(seed),
    canAccessTradeChat:        canAccessNexTradeChat(seed),
    canReceiveRefacingRouting: canReceiveRefacingRouting(seed),
  };
}
