// src/lib/nex/intelligence-storage-grid/accommodation/fact-computer.ts
//
// Founder BEGIN 2026-09-09 · FACT COMPUTER (P2)
//
// Turns one AccommodationRow + its per-field provenance + its enrichment
// evidence into a structured FactBundle keyed by canonical intent slug.
//
// Zero fabrication:
//   - if canonical column is null AND no evidence row exists → { unknown: true }
//   - "unknown: true" is a VERIFIED FACT (we honestly do not know) · not a hole
//   - unknown facts are the Gap Engine's feed
//
// Composer never touches an accommodation row directly. Only reads FactBundle.

import { INTENT_REGISTRY, type IntentDefinition } from "./intent-registry";
import type {
  AccommodationRow,
  FieldProvenanceRow,
} from "./adapter-postgres";

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export type TrustLayer =
  | "canonical_verified"    // Row column present AND provenance trust_layer is verified/authoritative
  | "canonical_unverified"  // Row column present but provenance says weak
  | "evidence_verified"     // From enrichment_evidence with confidence ≥ 0.7
  | "evidence_provisional"  // From enrichment_evidence with confidence 0.4-0.7
  | "unknown";              // Nothing to say. Gap Engine feed.

export interface StructuredFact {
  intent_slug: string;
  answer_kind: IntentDefinition["answer_kind"];
  value: unknown;                    // primitive OR array OR object OR null
  trust: TrustLayer;
  verified: boolean;                 // convenience for composer
  unknown: boolean;                  // convenience for composer
  source: string | null;             // e.g. "canonical:business_name" · "evidence:opening_hours"
  source_reference: string | null;   // provenance.source_reference or evidence url
  written_at: string | null;         // ISO timestamp of last write
  evidence_confidence: number | null;
  /** If true · caller should enqueue a Gap Engine ticket for this (intent, listing_ref). */
  enqueue_gap: boolean;
}

/**
 * Optional third input · row from nex.accommodation_enrichment_evidence.
 * Column names match the real schema written by gap-cycle.ts.
 */
export interface EnrichmentEvidenceRow {
  business_ref: string;
  field_name: string;
  /** Text value written by the extractor (e.g. "Mon-Fri 08:00-22:00"). */
  value: string | null;
  /** Jsonb payload with extractor metadata (rule · snapshot_keys · etc). */
  raw_payload: Record<string, unknown> | null;
  confidence: number | null;
  source: string | null;
  source_type: string | null;
  discovered_at: Date | string | null;
}

export interface FactBundle {
  listing_ref: string;
  business_name: string;
  facts: Record<string, StructuredFact>;
  computed_at: string;
  intents_answered: number;
  intents_unknown: number;
  gap_tickets_proposed: readonly {
    listing_ref: string;
    intent_slug: string;
    field_name: string;
  }[];
}

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

const VERIFIED_TRUST_LAYERS = new Set([
  "verified", "authoritative", "operator_declared", "canonical",
]);

function pickProvenance(
  provenance: readonly FieldProvenanceRow[],
  fields: readonly string[],
): FieldProvenanceRow | null {
  for (const p of provenance) if (fields.includes(p.field_name)) return p;
  return null;
}

function pickEvidence(
  evidence: readonly EnrichmentEvidenceRow[],
  fields: readonly string[],
): EnrichmentEvidenceRow | null {
  for (const e of evidence) if (fields.includes(e.field_name)) return e;
  return null;
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

// Map an intent to the AccommodationRow field(s) that carry its value
function readCanonicalValue(row: AccommodationRow, fields: readonly string[]): unknown {
  for (const f of fields) {
    const v = (row as unknown as Record<string, unknown>)[f];
    if (!isEmpty(v)) return v;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// Amenity-array-contains predicate (Refinement 1 · 2026-09-09)
// For amenity intents (wifi/pool/parking/...) the canonical field is the
// amenities[] array. The intent encodes the specific amenity token via
// evidence_field_names like "amenities:wifi". This helper returns:
//   true  → array contains a matching entry (case-insensitive + alias-aware)
//   false → array present but NO matching entry (verified "no wifi")
//   null  → array is empty/missing → caller returns unknown
// ═══════════════════════════════════════════════════════════════════

const AMENITY_ALIASES: Record<string, readonly string[]> = Object.freeze({
  wifi:       ["wifi", "wi-fi", "wi fi", "internet", "free wifi", "free wi-fi", "wireless"],
  ac:         ["ac", "air conditioning", "air_conditioning", "air-conditioning", "aircon", "a/c"],
  pool:       ["pool", "swimming pool", "swimming_pool", "outdoor pool", "indoor pool"],
  parking:    ["parking", "car park", "carpark", "car_park", "free parking", "valet parking", "valet"],
  gym:        ["gym", "fitness centre", "fitness center", "fitness", "workout"],
  spa:        ["spa", "wellness", "wellness centre", "massage", "sauna"],
  laundry:    ["laundry", "laundry service", "washing"],
  elevator:   ["elevator", "lift"],
  balcony:    ["balcony", "balconies", "terrace"],
  breakfast:  ["breakfast", "free breakfast", "breakfast included", "brekky", "morning meal", "buffet breakfast"],
  restaurant: ["restaurant", "onsite restaurant"],
  bar:        ["bar", "cocktail bar", "lounge bar", "bar/lounge"],
});

function extractAmenityToken(evidenceFieldNames: readonly string[]): string | null {
  for (const f of evidenceFieldNames) {
    if (f.startsWith("amenities:")) return f.slice("amenities:".length);
  }
  return null;
}

function amenityArrayContains(amenities: readonly unknown[], token: string): boolean {
  const aliases = AMENITY_ALIASES[token] ?? [token];
  for (const a of amenities) {
    if (typeof a !== "string") continue;
    const al = a.toLowerCase().trim();
    for (const m of aliases) if (al.includes(m)) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════
// Per-intent value resolver · deterministic ladder
//   1. canonical column (verified via provenance) → canonical_verified
//   2. canonical column (no provenance signal)     → canonical_unverified
//   3. evidence row (confidence ≥ 0.7)             → evidence_verified
//   4. evidence row (confidence 0.4-0.7)           → evidence_provisional
//   5. nothing                                     → unknown (gap ticket)
// ═══════════════════════════════════════════════════════════════════

function computeFact(
  intent: IntentDefinition,
  row: AccommodationRow,
  provenance: readonly FieldProvenanceRow[],
  evidence: readonly EnrichmentEvidenceRow[],
): StructuredFact {
  const canonicalValue = readCanonicalValue(row, intent.canonical_fields);
  const provRow = pickProvenance(provenance, intent.canonical_fields.length > 0 ? intent.canonical_fields : intent.evidence_field_names);
  const evRow = pickEvidence(evidence, intent.evidence_field_names);

  // Refinement 1 · amenity-array-contains predicate
  // If intent canonical field is "amenities" AND evidence carries an
  // "amenities:X" token AND the row has an amenities array → resolve to a
  // boolean (contains alias-aware). Prevents "Wi-Fi: wifi, air_conditioning."
  // and other whole-array leaks.
  const amenityToken = intent.canonical_fields.includes("amenities")
    ? extractAmenityToken(intent.evidence_field_names)
    : null;
  if (amenityToken && Array.isArray(canonicalValue)) {
    const contains = amenityArrayContains(canonicalValue as unknown[], amenityToken);
    const verified = !!provRow && VERIFIED_TRUST_LAYERS.has(provRow.trust_layer);
    return {
      intent_slug: intent.slug,
      answer_kind: intent.answer_kind,
      value: contains,
      trust: verified ? "canonical_verified" : "canonical_unverified",
      verified,
      unknown: false,
      source: `canonical:amenities[${amenityToken}]`,
      source_reference: provRow?.source_reference ?? null,
      written_at: provRow?.written_at ? new Date(provRow.written_at).toISOString() : null,
      evidence_confidence: null,
      enqueue_gap: false,
    };
  }

  // Ladder step 1 · canonical + verified provenance
  if (!isEmpty(canonicalValue) && provRow && VERIFIED_TRUST_LAYERS.has(provRow.trust_layer)) {
    return {
      intent_slug: intent.slug,
      answer_kind: intent.answer_kind,
      value: canonicalValue,
      trust: "canonical_verified",
      verified: true,
      unknown: false,
      source: `canonical:${provRow.field_name}`,
      source_reference: provRow.source_reference,
      written_at: provRow.written_at ? new Date(provRow.written_at).toISOString() : null,
      evidence_confidence: null,
      enqueue_gap: false,
    };
  }
  // Ladder step 2 · canonical but weak/no provenance
  if (!isEmpty(canonicalValue)) {
    return {
      intent_slug: intent.slug,
      answer_kind: intent.answer_kind,
      value: canonicalValue,
      trust: "canonical_unverified",
      verified: false,
      unknown: false,
      source: `canonical:${intent.canonical_fields[0] ?? "unknown"}`,
      source_reference: provRow?.source_reference ?? null,
      written_at: provRow?.written_at ? new Date(provRow.written_at).toISOString() : null,
      evidence_confidence: null,
      enqueue_gap: false,
    };
  }
  // Ladder step 3-4 · evidence rows
  if (evRow) {
    const value = evRow.value ?? null;
    const conf = typeof evRow.confidence === "number" ? evRow.confidence : 0.5;
    return {
      intent_slug: intent.slug,
      answer_kind: intent.answer_kind,
      value,
      trust: conf >= 0.7 ? "evidence_verified" : "evidence_provisional",
      verified: conf >= 0.7,
      unknown: false,
      source: `evidence:${evRow.field_name}${evRow.source ? `:${evRow.source}` : ""}`,
      source_reference: evRow.source ?? null,
      written_at: evRow.discovered_at ? new Date(evRow.discovered_at).toISOString() : null,
      evidence_confidence: conf,
      enqueue_gap: false,
    };
  }
  // Ladder step 5 · UNKNOWN · honest gap
  return {
    intent_slug: intent.slug,
    answer_kind: intent.answer_kind,
    value: null,
    trust: "unknown",
    verified: false,
    unknown: true,
    source: null,
    source_reference: null,
    written_at: null,
    evidence_confidence: null,
    enqueue_gap: intent.auto_enqueue_gap_on_unknown,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Public API · build the full bundle
// ═══════════════════════════════════════════════════════════════════

export function computeFactBundle(input: {
  row: AccommodationRow;
  provenance: readonly FieldProvenanceRow[];
  evidence?: readonly EnrichmentEvidenceRow[];
}): FactBundle {
  const { row, provenance, evidence = [] } = input;
  const facts: Record<string, StructuredFact> = {};
  const gapTickets: { listing_ref: string; intent_slug: string; field_name: string }[] = [];
  let answered = 0;
  let unknown = 0;

  for (const intent of INTENT_REGISTRY) {
    // Skip intents whose answer_kind is "relationship" · these are computed by
    // a separate relationship-fact-computer at query time (need Postgres access
    // to the food/attractions/transport tables). Not fabricating here.
    if (intent.answer_kind === "relationship") continue;

    const fact = computeFact(intent, row, provenance, evidence);
    facts[intent.slug] = fact;
    if (fact.unknown) {
      unknown++;
      if (fact.enqueue_gap) {
        gapTickets.push({
          listing_ref: row.public_listing_ref,
          intent_slug: intent.slug,
          field_name: intent.canonical_fields[0] ?? intent.evidence_field_names[0] ?? intent.slug,
        });
      }
    } else {
      answered++;
    }
  }

  return {
    listing_ref: row.public_listing_ref,
    business_name: row.business_name,
    facts,
    computed_at: new Date().toISOString(),
    intents_answered: answered,
    intents_unknown: unknown,
    gap_tickets_proposed: gapTickets,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Bulk variant · for the precompute cycle
// ═══════════════════════════════════════════════════════════════════

export function computeFactBundlesBulk(inputs: {
  row: AccommodationRow;
  provenance: readonly FieldProvenanceRow[];
  evidence?: readonly EnrichmentEvidenceRow[];
}[]): FactBundle[] {
  return inputs.map(computeFactBundle);
}
