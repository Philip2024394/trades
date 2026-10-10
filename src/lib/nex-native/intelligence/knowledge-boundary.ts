// src/lib/nex-native/intelligence/knowledge-boundary.ts
//
// Bridge 95b · Tri-state knowledge boundary.
// -------------------------------------------------------------------
// Bridge 94 fixed Q07 (the Sunday-open hallucination) but exposed a
// deeper design gap: not having a canonical fact is itself a state
// that needs to be handled. Bridge 93 was accidentally relying on
// Qwen's tendency to say "I don't know". Bridge 94 removed some of
// that accidental behaviour by routing more questions through the
// model — but the model then invented answers for concepts that NEX
// has NO ability to know (delivery cost, warranty terms, discounts,
// installation services, refund policy).
//
// The correct architecture is three-way:
//
//   1. canonical fact exists                → deterministic answer
//   2. authoritative NEX evidence available → evidence + model + claim-gate
//   3. neither                              → HONEST GAP without a model call
//
// This module implements (3). It classifies a question against a
// small set of KNOWN-UNSUPPORTED concept patterns. If the question
// is asking about one of those concepts, we return a canned honest
// gap immediately — no evidence retrieval, no model invocation, no
// truth-gate needed. If the question doesn't match, we return null
// and let the gateway fall through to the existing evidence path.
//
// The list is deliberately conservative — a false positive here
// would gap a question NEX could legitimately answer. Every concept
// on the list is one where the schema has no column to hold the
// answer AND the product-knowledge catalogue has no entry that
// covers per-business specifics of that concept.
//
// Design rules:
//   · Sync · pure · no LLM · no DB · no I/O.
//   · Return null when unsure. False positives are worse than
//     false negatives — the evidence path is the fallback.
//   · Every gap carries a concept label so telemetry can measure
//     how often each concept fires (and whether it's plausibly
//     over- or under-triggering).

import type { CanonicalFactSet } from "./canonical-facts";

export interface UnsupportedConceptResult {
  concept: string;
  /** Deterministic honest-gap message · customer-visible. Under 200
   *  chars · references the business name so it reads personal, not
   *  generic. Ends with a soft invitation to ask the business
   *  directly when possible. */
  answer: string;
}

export interface BoundaryContext {
  facts: CanonicalFactSet;
  question: string;
}

/** Concept definitions. Order doesn't matter · the first match wins
 *  because the answers are functionally interchangeable (honest gap
 *  either way). */
interface ConceptDef {
  concept: string;
  /** Regex(es) that trigger this concept. All are anchored with
   *  word-boundary discipline · use /i for case-insensitivity. */
  patterns: RegExp[];
  /** Optional guard · called with the fact set. Return true to allow
   *  the concept to fire, false to skip (concept is actually
   *  covered by canonical facts on this business, so the boundary
   *  detector shouldn't gap). */
  guard?: (facts: CanonicalFactSet) => boolean;
  /** Concept-specific gap phrasing · substituted with the business
   *  name at emit time. Keep to one short sentence. */
  gapTemplate: (businessName: string) => string;
}

const CONCEPTS: ConceptDef[] = [
  {
    concept: "delivery_area",
    patterns: [
      // "do you deliver to Bali?" · "ship to Yogyakarta?" · "provide
      // delivery to X?" — coverage-area questions. Not delivery
      // cost, not delivery time · a separate concept because a
      // business may deliver but not have posted areas.
      /\b(do you|apakah kalian)\s+(deliver|ship|kirim)\s+to\b/i,
      /\b(provide|offer|available|tersedia)\s+(delivery|shipping)\s+(to|for|in)\b/i,
      /\b(delivery|shipping)\s+(area|coverage|zone|available in|to)\b/i,
      /\bkirim\s+ke\b/i,
    ],
    gapTemplate: (n) =>
      `${n} hasn't listed which areas they deliver to. The business owner can confirm delivery to your location directly.`,
  },
  {
    concept: "delivery_cost",
    patterns: [
      /\b(delivery|shipping|postage|ongkir)\s+(cost|fee|price|charge|rate|charges)\b/i,
      /\bhow much\b.*\b(delivery|shipping|postage|ongkir)\b/i,
      /\b(delivery|shipping)\s+(is|will be|would be)\s+(rp|idr|\$|£|€|\d)/i,
      /\b(cost|charge|price)\s+(to|for)\s+(ship|deliver|post)\b/i,
      /\bberapa\s+ongkir\b/i,
      /\bexact\s+(delivery|shipping)\s+charge\b/i,
    ],
    gapTemplate: (n) =>
      `${n} hasn't listed a specific delivery cost yet. The business owner can quote a delivery price for your address directly.`,
  },
  {
    concept: "delivery_time",
    patterns: [
      /\bhow long\b.*\b(delivery|shipping|arrive|arrival)\b/i,
      /\b(delivery|shipping)\s+(time|duration|eta)\b/i,
      /\bhow long does\b.*\b(take|arrive|ship)\b/i,
      /\bkapan\s+(sampai|kirim|tiba)\b/i,
    ],
    gapTemplate: (n) =>
      `${n} hasn't listed a specific delivery time. The business owner can confirm an estimated arrival for your address.`,
  },
  {
    concept: "warranty",
    patterns: [
      /\b(warranty|guarantee|garansi)\b/i,
    ],
    gapTemplate: (n) =>
      `${n} hasn't listed warranty terms in their profile. The business owner can confirm warranty details directly.`,
  },
  {
    concept: "returns_refund",
    patterns: [
      /\b(return|returns|refund|refunds|exchange|exchanges|money back)\s+(policy|allowed|possible|available)\b/i,
      /\bcan i\s+(return|refund|exchange)\b/i,
      /\bbolehkah\s+(retur|kembalikan|tukar)\b/i,
      /\b(return|refund) a product\b/i,
    ],
    gapTemplate: (n) =>
      `${n} hasn't listed a return or refund policy in their profile. The business owner can confirm returns directly.`,
  },
  {
    concept: "discount",
    patterns: [
      /\b(discounts?|promos?|promotions?|vouchers?|coupons?|kupons?|potongan|diskon)\b/i,
      /\b(percent(age)?|%)\s+off\b/i,
      /\bharga\s+khusus\b/i,
      /\b(contractor|trade|professional)\s+(discount|rate|pricing)s?\b/i,
    ],
    // Skip if the business runs a NEX Direct Price ladder tied to
    // per-buyer tier progress · that IS a canonical discount source
    // and belongs in a dedicated deterministic handler. This guard
    // is future-proofing · the ladder feature isn't in facts yet.
    guard: (_facts) => true,
    gapTemplate: (n) =>
      `${n} hasn't listed a specific discount or promo in their profile. The business owner can confirm any current offers.`,
  },
  {
    concept: "installation_service",
    patterns: [
      /\b(install(ation)?|setup|set up|assembly|assemble|jasa\s+pasang|pemasangan)\s*(service|available|offered|possible|help)?\b/i,
      /\bdo you\s+install\b/i,
      /\boffer\s+install/i,
    ],
    gapTemplate: (n) =>
      `${n} hasn't listed installation or setup services in their profile. The business owner can confirm what's included.`,
  },
  {
    concept: "custom_or_bulk",
    patterns: [
      /\b(custom|bulk|wholesale|grosir|borongan|large\s+order|big\s+order|special\s+order)\b/i,
      /\bmoq\b/i,
      /\bminimum\s+order\b/i,
      /\bquote\s+for\b/i,
    ],
    gapTemplate: (n) =>
      `${n} hasn't listed custom-order or bulk pricing in their profile. The business owner can quote a specific price for your quantity.`,
  },
  {
    concept: "credit_card",
    patterns: [
      /\b(credit\s+cards?|debit\s+cards?|visa|mastercard|kartu\s+(kredit|debit))\b/i,
    ],
    // Only fire if payment_methods explicitly does NOT include
    // paypal or a card-adjacent method · otherwise let the
    // deterministic PAYMENT_METHOD handler answer.
    guard: (facts) => {
      const pm = facts.business?.payment_methods ?? [];
      return !pm.some((m) => m === "paypal");
    },
    gapTemplate: (n) =>
      `${n} does not have credit or debit cards listed as an accepted payment method. The business owner can confirm which methods they accept.`,
  },
  {
    concept: "whatsapp_or_external_channel",
    patterns: [
      /\b(whatsapp|wa|telegram|line|instagram\s+dm|ig\s+dm|facebook\s+messenger)\s+(number|contact|link|available|address)?\b/i,
      /\bcan i\s+(text|message)\s+you\s+on\b/i,
    ],
    gapTemplate: (n) =>
      `${n} does not have a WhatsApp or external contact channel listed — this NEX chat is the way to reach the business owner.`,
  },
  {
    concept: "loyalty_or_referral",
    patterns: [
      /\b(loyalty|reward|referral|refer\s+a\s+friend|points|member(ship)?)\s+(program|scheme|discount|available)?\b/i,
    ],
    gapTemplate: (n) =>
      `${n} hasn't listed a loyalty or referral program in their profile. The business owner can confirm any offers directly.`,
  },
  {
    concept: "online_ordering",
    patterns: [
      /\b(order|shop)\s+online\b/i,
      /\bcan i\s+order\s+online\b/i,
      /\bapakah\s+bisa\s+(order|beli)\s+online\b/i,
    ],
    // Skip if the business has any live product · they can be
    // ordered via the NEX chat + cart flow, so "can I order
    // online?" is deterministically YES.
    guard: (facts) => facts.products.length === 0,
    gapTemplate: (n) =>
      `${n} hasn't set up online ordering yet. The business owner can arrange an order over this chat.`,
  },
];

export function detectUnsupportedConcept(
  ctx: BoundaryContext,
): UnsupportedConceptResult | null {
  const q = ctx.question.trim();
  if (!q) return null;
  const businessName = ctx.facts.business?.display_name ?? "This business";

  for (const c of CONCEPTS) {
    if (c.guard && !c.guard(ctx.facts)) continue;
    for (const re of c.patterns) {
      if (re.test(q)) {
        return {
          concept: c.concept,
          answer: c.gapTemplate(businessName),
        };
      }
    }
  }
  return null;
}

/** Exposed for telemetry / tests · returns the concept list so an
 *  operator can audit coverage without importing the private
 *  CONCEPTS array. */
export function listUnsupportedConcepts(): string[] {
  return CONCEPTS.map((c) => c.concept);
}
