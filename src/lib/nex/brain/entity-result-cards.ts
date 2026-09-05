// src/lib/nex/brain/entity-result-cards.ts
//
// Universal Entity Result Card Contract
// Philip 2026-09-06 · AUTHORIZE · UNIVERSAL ENTITY INTELLIGENCE
//
// PURPOSE (§5 §6 §7 §12)
//   Compose an EntityResultCard payload the client can render. The
//   card contract EXTENDS the existing PresentedCard from
//   presentation.ts with:
//     · A structured AttributeMap (§10 UNKNOWN ≠ NO)
//     · Selected highlight attributes (§7 information prioritization)
//     · An InformationCoverage metric (§13)
//     · Reference identity (result_position, ref_id) so a follow-up
//       "does the second one have a pool?" can resolve deterministically
//
// SEPARATION (§12)
//   Entity intelligence (what NEX actually knows) is in the projection
//   maps. Presentation (what is useful to show) is in the highlight
//   selection. They are separate stages.

import { presentRecords, type PresentedCard, type PresentedCardSet } from "./presentation";
import type { WorldRecord, WorldVertical } from "./world-adapters/types";
import {
  projectAttributes,
  computeCoverage,
  findAttributeByKeyword,
  ATTRIBUTE_CONTRACTS,
  type AttributeMap,
  type AttributeMapEntry,
  type AttributeState,
  type EvidenceTier,
  type InformationCoverage,
} from "./entity-attribute-contract";

// ─── Types ──────────────────────────────────────────────────────

export type EntityResultCard = {
  /** Underlying PresentedCard · unchanged shape · UI compatible. */
  card: PresentedCard;
  /** 1-based result position for reference resolution. */
  position: number;
  /** Stable reference identity · maps to session.entities.refId. */
  ref_id: string;
  /** Structured attribute state per contract. */
  attributes: AttributeMap;
  /** Ordered subset of KNOWN_YES attribute ids to prominently feature. §7 §19
   *  These are owner-verified · UI can render without any hedge. */
  highlights: string[];
  /** Ordered subset of UNVERIFIED attribute ids · UI should render these
   *  with an "unverified" affordance (badge / tooltip / different colour).
   *  Separate from `highlights` so a client can choose to omit them when
   *  space is tight. */
  unverified_highlights: string[];
  /** Coverage metric for observability. §13 */
  coverage: InformationCoverage;
};

export type EntityResultCardSet = {
  vertical: WorldVertical;
  cards: EntityResultCard[];
  total_available: number;
  headline: string;
  caveat?: string;
};

// ─── Highlight priority · calm cards, no dump ────────────────────
//
// §7 · "select useful information based on user request, entity type,
// verified availability, relevance, information quality". These are the
// ORDER of preference · we take up to N whose state is KNOWN_YES.

const HIGHLIGHT_PRIORITY: Record<WorldVertical, string[]> = {
  accommodation: [
    // Villa-specific attributes first when relevant (accommodation
    // vertical spans both hotel and villa · when the record.category is
    // villa, these attribute ids will surface if present).
    "bedrooms", "bathrooms", "capacity", "private_pool", "full_kitchen",
    "pool", "wifi", "ac", "parking", "breakfast", "restaurant",
    "laundry", "airport_transfer", "gym", "spa",
    "room_service", "housekeeping",
    "room_count",
    "star_rating", "rating",
    "phone", "whatsapp", "website",
  ],
  food: [
    "delivery", "takeaway", "reservations",
    "vegetarian", "vegan", "halal",
    "outdoor_seating", "wifi", "parking",
    "rating",
    "phone", "whatsapp", "website",
  ],
  service: [
    "emergency", "free_quote",
    "personal_trainer", "group_classes", "showers",
    "phone", "whatsapp", "website",
  ],
  commerce: [
    "price",
    "phone", "whatsapp", "website",
  ],
  transport: [
    "price",
    "phone", "whatsapp",
  ],
  places: [],
};

const DEFAULT_HIGHLIGHT_LIMIT = 6;

/** Split priority-ordered attributes into (KNOWN_YES highlights) +
 *  (UNVERIFIED highlights). UNVERIFIED attributes get their own bucket
 *  so the UI can render them with an unverified affordance rather than
 *  silently mixing them into confident highlights (§7 "UNVERIFIED is
 *  not presented as verified"). */
function selectHighlights(
  attributes: AttributeMap,
  priorityOrder: string[],
  highlightLimit: number,
): { highlights: string[]; unverified_highlights: string[] } {
  const stateById = new Map<string, AttributeState>();
  for (const a of attributes) stateById.set(a.attribute.id, a.state);
  const highlights: string[] = [];
  const unverified_highlights: string[] = [];
  for (const id of priorityOrder) {
    const s = stateById.get(id);
    if (s === "KNOWN_YES" && highlights.length < highlightLimit) highlights.push(id);
    else if (s === "UNVERIFIED" && unverified_highlights.length < highlightLimit) unverified_highlights.push(id);
  }
  return { highlights, unverified_highlights };
}

// ─── Public projection ─────────────────────────────────────────

/** Project a raw retrieval result into the universal card contract. */
export function projectEntityResultCardSet(input: {
  records: readonly WorldRecord[];
  totalAvailable: number;
  vertical: WorldVertical;
  max?: number;
  highlightLimit?: number;
}): EntityResultCardSet {
  const max = input.max ?? 3;
  const set = presentRecords({
    records: input.records,
    totalAvailable: input.totalAvailable,
    vertical: input.vertical,
    max,
  });

  const highlightLimit = input.highlightLimit ?? DEFAULT_HIGHLIGHT_LIMIT;
  const priorityOrder = HIGHLIGHT_PRIORITY[input.vertical] ?? [];

  const cards: EntityResultCard[] = set.cards.map((card, i) => {
    const rec = input.records[i];
    const attributes = projectAttributes(rec);
    const { highlights, unverified_highlights } = selectHighlights(attributes, priorityOrder, highlightLimit);
    return {
      card,
      position: i + 1,
      ref_id: `place:${input.vertical}:${rec.id}`,
      attributes,
      highlights,
      unverified_highlights,
      coverage: computeCoverage(rec),
    };
  });

  return {
    vertical: input.vertical,
    cards,
    total_available: set.totalAvailable,
    headline: set.headline,
    caveat: set.caveat,
  };
}

// ─── Alternative projection: from an existing PresentedCardSet ──
//
// Route.ts receives a `world_cards: PresentedCardSet` from the Brain
// orchestrator — it doesn't hold the raw WorldRecord[] there. This
// entry point projects a full EntityResultCardSet using only the
// PresentedCard fields (amenities[], actions[], verified, etc.),
// which is sufficient for facility attribute intelligence.

function normalizeToken(s: string): string {
  return s.toLowerCase().trim().replace(/[-_]/g, " ").replace(/\s+/g, " ");
}

/**
 * §7 6-valued state semantics (Philip 2026-09-06 · v2):
 *   - `card.verified === true` OR `card.ownershipState ∈ {claimed, member}`
 *     → owner-verified tier · positive evidence resolves to KNOWN_YES.
 *   - Otherwise (typical `unclaimed` / `invited` directory listing) →
 *     positive evidence resolves to UNVERIFIED.
 *   - No positive evidence → UNKNOWN.
 *   - PresentedCard does not carry an updatedAt, so STALE cannot be
 *     produced from this projection path. STALE is only reachable via
 *     the full-record `projectAttributes()` entry point.
 *   - CONFLICTING and KNOWN_NO are reserved · no source produces them
 *     from PresentedCard alone.
 */
function projectAttributesFromPresented(card: PresentedCard): {
  attributes: AttributeMapEntry[];
  coverage: InformationCoverage;
} {
  const contract = ATTRIBUTE_CONTRACTS[card.vertical] ?? [];
  const amenityTokens = new Set(
    (card.amenities ?? []).map(normalizeToken).filter(Boolean),
  );
  const actionKinds = new Set((card.actions ?? []).filter((a) => !a.disabled).map((a) => a.kind));
  // Evidence tier for this PresentedCard.
  const isOwnerVerified = card.verified === true
    || card.ownershipState === "claimed"
    || card.ownershipState === "member";
  const positiveState: AttributeState = isOwnerVerified ? "KNOWN_YES" : "UNVERIFIED";
  const positiveTier: EvidenceTier = isOwnerVerified ? "owner_verified" : "directory";

  const positive = (attr: (typeof contract)[number], evidence: AttributeMapEntry["evidence"]): AttributeMapEntry => ({
    attribute: attr, state: positiveState, evidence, evidenceTier: positiveTier,
  });

  const entries: AttributeMapEntry[] = contract.map((attr) => {
    // Derive contact/website presence from PresentedCard.actions kinds.
    if (attr.id === "phone" && actionKinds.has("call"))         return positive(attr, "field");
    if (attr.id === "whatsapp" && actionKinds.has("whatsapp"))  return positive(attr, "field");
    if (attr.id === "website" && actionKinds.has("website"))    return positive(attr, "field");
    if (attr.id === "coordinates" && actionKinds.has("directions")) return positive(attr, "field");
    if (attr.id === "star_rating" && typeof card.starRating === "number") return positive(attr, "field");
    if (attr.id === "rating" && typeof card.rating === "number") return positive(attr, "field");
    if (attr.id === "price" && card.price != null)              return positive(attr, "field");
    // Amenity-token match.
    if (attr.keywords.length > 0) {
      for (const kw of attr.keywords) {
        if (amenityTokens.has(normalizeToken(kw))) {
          return positive(attr, "amenity_token");
        }
      }
    }
    return { attribute: attr, state: "UNKNOWN" };
  });
  let known_yes = 0, known_no = 0, unknown = 0, unverified = 0, conflicting = 0, stale = 0;
  for (const e of entries) {
    switch (e.state) {
      case "KNOWN_YES":    known_yes++; break;
      case "KNOWN_NO":     known_no++; break;
      case "UNKNOWN":      unknown++; break;
      case "UNVERIFIED":   unverified++; break;
      case "CONFLICTING":  conflicting++; break;
      case "STALE":        stale++; break;
    }
  }
  const total = entries.length;
  const coverage: InformationCoverage = {
    vertical: card.vertical,
    total_attributes: total,
    known_yes, known_no, unknown, unverified, conflicting, stale,
    coverage_pct: total === 0 ? 0 : Math.round((known_yes / total) * 100),
    evidence_pct: total === 0 ? 0 : Math.round(((known_yes + unverified) / total) * 100),
  };
  return { attributes: entries, coverage };
}

/** Project from a PresentedCardSet · route.ts-facing entry point. */
export function projectEntityResultCardSetFromPresented(input: {
  presented: PresentedCardSet;
  highlightLimit?: number;
}): EntityResultCardSet {
  const highlightLimit = input.highlightLimit ?? DEFAULT_HIGHLIGHT_LIMIT;
  const priorityOrder = HIGHLIGHT_PRIORITY[input.presented.vertical] ?? [];

  const cards: EntityResultCard[] = input.presented.cards.map((card, i) => {
    const { attributes, coverage } = projectAttributesFromPresented(card);
    const { highlights, unverified_highlights } = selectHighlights(attributes, priorityOrder, highlightLimit);
    return {
      card,
      position: i + 1,
      ref_id: `place:${input.presented.vertical}:${card.id}`,
      attributes,
      highlights,
      unverified_highlights,
      coverage,
    };
  });
  return {
    vertical: input.presented.vertical,
    cards,
    total_available: input.presented.totalAvailable,
    headline: input.presented.headline,
    caveat: input.presented.caveat,
  };
}

// (findAttributeByKeyword re-export for observability)
export { findAttributeByKeyword };

// ─── Convenience: display serialization for a session cache ─────

/** Serialize an EntityResultCard down to a minimal form to store on
 *  the session for cheap follow-up resolution. */
export type EntityCardMemo = {
  position: number;
  ref_id: string;
  name: string;
  vertical: WorldVertical;
  highlights: string[];
  unverified_highlights: string[];
  /** id → state · flat map for O(1) lookup at follow-up time. Full
   *  6-state alphabet so the attribute-query gate can render
   *  UNVERIFIED / STALE / CONFLICTING replies distinct from UNKNOWN. */
  attribute_states: Record<string, AttributeState>;
  /** id → evidence tier for KNOWN_YES / UNVERIFIED / STALE entries.
   *  Undefined for UNKNOWN. Used by attribute-query to word replies. */
  attribute_evidence_tiers: Record<string, EvidenceTier | undefined>;
};

export function memoize(cards: EntityResultCard[]): EntityCardMemo[] {
  return cards.map((c) => {
    const states: Record<string, AttributeState> = {};
    const tiers: Record<string, EvidenceTier | undefined> = {};
    for (const a of c.attributes) {
      states[a.attribute.id] = a.state;
      tiers[a.attribute.id] = a.evidenceTier;
    }
    return {
      position: c.position,
      ref_id: c.ref_id,
      name: c.card.name,
      vertical: c.card.vertical,
      highlights: c.highlights,
      unverified_highlights: c.unverified_highlights,
      attribute_states: states,
      attribute_evidence_tiers: tiers,
    };
  });
}
