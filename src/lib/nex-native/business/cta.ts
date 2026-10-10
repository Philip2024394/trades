// src/lib/nex-native/business/cta.ts
//
// NEX Business Experience · CTA resolution.
// Rev 6 FROZEN · 2026-10-02.
//
// CTA is customer INTENT (what the customer wants to do). It is NEVER a
// fulfilment mode. Pickup, delivery, dine-in, shipping are fulfilment
// capabilities that live INSIDE the Order intent, not CTAs themselves.
// Order TIMING (pre-order, scheduled, made-to-order) is independent of
// fulfilment mode and configures the Order intent too.
//
// Feasibility is semantic (Finding #7): a CTA is feasible when its
// required content AND its required capabilities are both present AND
// those capabilities are READY (data complete enough to actually serve
// the customer). An ENABLED flag alone is not enough.

import type {
  BusinessEngineInput,
  BusinessSubtype,
  CapabilityKey,
  ContentTypeKey,
  CtaIntent,
} from "./types";
import {
  getEffectiveCapability,
  isCapabilityReady,
} from "./capabilities";
import {
  getEffectiveContentType,
  hasContentItems,
} from "./content";

// -----------------------------------------------------------------------------
// Intent definitions · each is a semantic rule, not a single boolean.
// `requiresContentAny`  · at least one of these content types must be enabled
//                         AND have at least one actual item.
// `requiresCapabilityAny` · at least one of these capabilities must be
//                         effective AND ready. "any" because an Order can be
//                         pickup-only, dine-in-only, or delivery-only.
// `requiresCapabilityAll` · all of these must be effective AND ready.
//                         Rarely needed; used e.g. by `buy` which requires
//                         online_payment to actually transact.
// -----------------------------------------------------------------------------

interface CtaIntentDefinition {
  intent: CtaIntent;
  label: string;
  requiresContentAny?: readonly ContentTypeKey[];
  requiresCapabilityAny?: readonly CapabilityKey[];
  requiresCapabilityAll?: readonly CapabilityKey[];
}

export const CTA_INTENT_DEFINITIONS: Readonly<Record<CtaIntent, CtaIntentDefinition>> = {
  order: {
    intent: "order",
    label: "Order",
    requiresContentAny: ["menu_item", "product", "offer"],
    // At least ONE pathway (pickup / delivery / dine-in / shipping / online pay).
    requiresCapabilityAny: [
      "pickup",
      "local_delivery",
      "dine_in",
      "national_shipping",
      "international_shipping",
      "online_payment",
    ],
  },
  book: {
    intent: "book",
    label: "Book",
    requiresContentAny: ["accommodation_unit"],
    requiresCapabilityAny: ["room_booking"],
  },
  appointment: {
    intent: "appointment",
    label: "Book appointment",
    requiresContentAny: ["service"],
    requiresCapabilityAny: ["appointments"],
  },
  reserve: {
    intent: "reserve",
    label: "Reserve",
    requiresCapabilityAny: ["reservations"],
  },
  enquire: {
    intent: "enquire",
    label: "Enquire",
    requiresCapabilityAny: ["enquiry_contact"],
  },
  quote: {
    intent: "quote",
    label: "Request quote",
    requiresCapabilityAny: ["quote_request"],
  },
  callback: {
    intent: "callback",
    label: "Request callback",
    requiresCapabilityAny: ["request_callback"],
  },
  buy: {
    intent: "buy",
    label: "Buy",
    requiresContentAny: ["product", "offer"],
    requiresCapabilityAll: ["online_payment"],
  },
};

// -----------------------------------------------------------------------------
// SUBTYPE-RECOMMENDED PRIMARY CTA · soft suggestion only. Resolution still
// feasibility-checks before returning. Subtypes without an entry fall
// through to the first feasible intent in the owner's enabled set.
// -----------------------------------------------------------------------------
const RECOMMENDED_PRIMARY_CTA: Partial<Record<BusinessSubtype, CtaIntent>> = {
  // Food
  restaurant: "order",
  cafe: "order",
  bakery: "order",
  food_maker: "order",
  catering: "enquire",
  drinks: "order",
  food_delivery: "order",
  // Accommodation
  hotel: "book",
  villa: "book",
  guesthouse: "book",
  homestay: "book",
  resort: "book",
  short_rental: "book",
  // Property
  for_sale: "enquire",
  for_rent: "enquire",
  developer: "enquire",
  agent: "enquire",
  // Products
  retail: "order",
  manufacturer: "enquire",
  wholesale: "enquire",
  local_artisan: "order",
  exporter: "enquire",
  // Services
  beauty: "appointment",
  health_wellness: "appointment",
  home_services: "appointment",
  professional: "enquire",
  trade_construction: "quote",
  automotive: "appointment",
  events: "enquire",
  creative: "enquire",
};

/** Public selector for the subtype's recommended CTA. Pure function. */
export function getRecommendedPrimaryCta(subtype: BusinessSubtype): CtaIntent | null {
  return RECOMMENDED_PRIMARY_CTA[subtype] ?? null;
}

// -----------------------------------------------------------------------------
// Feasibility · semantic, two-tier (enabled + ready + content present).
// -----------------------------------------------------------------------------

export function isCtaFeasible(
  intent: CtaIntent,
  input: BusinessEngineInput,
  subtypes: readonly BusinessSubtype[],
): boolean {
  const def = CTA_INTENT_DEFINITIONS[intent];

  // Content requirement · if the intent requires some orderable content,
  // at least ONE of the listed content types must be effectively enabled
  // AND the business must have at least ONE actual item of it.
  if (def.requiresContentAny && def.requiresContentAny.length > 0) {
    const hit = def.requiresContentAny.some(
      (ct) => getEffectiveContentType(ct, input, subtypes) && hasContentItems(ct, input),
    );
    if (!hit) return false;
  }

  // Capability requirement · ANY · at least one of the listed capabilities
  // must be both effectively enabled AND ready (Finding #7).
  if (def.requiresCapabilityAny && def.requiresCapabilityAny.length > 0) {
    const hit = def.requiresCapabilityAny.some(
      (c) =>
        getEffectiveCapability(c, input, subtypes) && isCapabilityReady(c, input),
    );
    if (!hit) return false;
  }

  // Capability requirement · ALL · each listed capability must be both
  // effectively enabled AND ready.
  if (def.requiresCapabilityAll && def.requiresCapabilityAll.length > 0) {
    const everyOk = def.requiresCapabilityAll.every(
      (c) =>
        getEffectiveCapability(c, input, subtypes) && isCapabilityReady(c, input),
    );
    if (!everyOk) return false;
  }

  return true;
}

// -----------------------------------------------------------------------------
// Resolution · feasibility-first on owner preference.
//
// Order of resolution (Rev 6 §12):
//   1. Owner explicit preference, if feasible              → return
//   2. Subtype's recommended CTA, if feasible              → return
//   3. First feasible CTA from the complete catalog, in a
//      stable priority order                               → return
//   4. Final fallback: `enquire`.
//
// The architecture NEVER produces a broken CTA. If every CTA fails
// feasibility, the final fallback `enquire` is returned (which, in a
// correctly-provisioned business, is itself feasible). If even enquire
// is infeasible, the renderer suppresses the CTA entirely rather than
// show a broken button; the resolver still returns `enquire` so callers
// can decide how to present the no-action state.
// -----------------------------------------------------------------------------

/** Stable priority order for the "first feasible" sweep. More-constrained
 *  intents come first; least-constrained enquire is last. */
const FEASIBILITY_SWEEP_ORDER: readonly CtaIntent[] = [
  "book",
  "appointment",
  "reserve",
  "order",
  "buy",
  "quote",
  "callback",
  "enquire",
] as const;

export interface CtaResolution {
  intent: CtaIntent;
  source: "owner_preference" | "subtype_recommendation" | "feasibility_sweep" | "final_fallback";
  feasible: boolean;
}

export function resolvePrimaryCta(
  input: BusinessEngineInput,
  subtypes: readonly BusinessSubtype[],
): CtaResolution {
  // 1 · Owner explicit preference
  const pref = input.owner_state.cta_preference;
  if (pref) {
    if (isCtaFeasible(pref, input, subtypes)) {
      return { intent: pref, source: "owner_preference", feasible: true };
    }
    // Owner preference exists but infeasible · fall through to recommendation.
  }

  // 2 · Primary subtype's recommendation (first subtype is primary by convention)
  const primary = subtypes[0];
  if (primary) {
    const rec = getRecommendedPrimaryCta(primary);
    if (rec && isCtaFeasible(rec, input, subtypes)) {
      return { intent: rec, source: "subtype_recommendation", feasible: true };
    }
  }

  // 3 · First feasible in priority order
  for (const intent of FEASIBILITY_SWEEP_ORDER) {
    if (isCtaFeasible(intent, input, subtypes)) {
      return { intent, source: "feasibility_sweep", feasible: true };
    }
  }

  // 4 · Final fallback · enquire. Not necessarily feasible (if enquiry_contact
  //      is not enabled); flagged so the renderer can suppress the button.
  return {
    intent: "enquire",
    source: "final_fallback",
    feasible: isCtaFeasible("enquire", input, subtypes),
  };
}
