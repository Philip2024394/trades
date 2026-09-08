// src/lib/nex/intelligence-storage-grid/accommodation/gap-engine.ts
//
// NEX Accommodation Agent · Gap Engine (Phase 1)
// Founder BEGIN 2026-09-08 · Indonesia Complete Country Intelligence Mission
//
// Implements §5, §6, §7:
//   §5 Continuously determine WHAT DO WE NOT KNOW?
//        (per-property + per-geography missing intelligence detection)
//   §6 Prioritise gaps by measurable signals
//        (coverage · demand · destination importance · cross-domain value ·
//         freshness pressure · source availability · resolvability ·
//         confidence · activity/accommodation relevance)
//   §7 Actively identify under-covered destinations
//        (low NEX coverage + strong tourism evidence → priority research)
//
// This module DETECTS gaps and PRIORITISES them. It does NOT scrape,
// does NOT fabricate, does NOT modify canonical data. When paired with
// the (deferred) continuous worker BEGIN, gap output becomes the worker's
// research queue.
//
// Pure functions + typed contracts. No side effects. No I/O beyond
// caller-provided data.
//
// Composes with:
//   property-schema.ts     (WorldClassPropertyRecord shape · which fields count as "known")
//   activity-taxonomy.ts   (which activity/attraction categories are worth mining)
//   country-profile.ts     (which per-country research questions are unanswered)
//   acceptance-questions.ts (which travelller-questions cannot yet be answered)

import type { CountryCode } from "../types";
import type { WorldClassPropertyRecord } from "./property-schema";
import { ACCEPTANCE_QUESTIONS, type AcceptanceCategory } from "./acceptance-questions";
import { getCountryProfile } from "./country-profile";

// ═══════════════════════════════════════════════════════════════════
// §5 · GAP KINDS (what NEX might not know about a property/geography)
// ═══════════════════════════════════════════════════════════════════

/**
 * Every discovered gap is one of these kinds. New kinds may be added over
 * time but existing slugs MUST NOT be renamed (they land in ledger/queue
 * records with long-lived provenance).
 */
export type GapKind =
  // Property-scope gaps
  | "MISSING_PROPERTY"                    // property expected but no record
  | "MISSING_ROOMS"                       // property has no room inventory
  | "MISSING_BEDS"                        // rooms exist but no bed configuration
  | "MISSING_FACILITIES"                  // no facility assertions
  | "MISSING_SERVICES"                    // no service assertions
  | "MISSING_FOOD"                        // no food/drink info
  | "MISSING_BREAKFAST"                   // no breakfast information
  | "MISSING_IMAGES"                      // zero images
  | "MISSING_POLICIES"                    // check-in/out/pet/child unknown
  | "MISSING_ACCESSIBILITY"               // wheelchair etc unknown
  | "MISSING_COORDINATES"                 // no lat/lon
  | "MISSING_ADDRESS"                     // no address
  | "MISSING_CATEGORY"                    // canonical category unknown
  | "MISSING_STAR_RATING"                 // property has no star rating (if applicable)
  | "MISSING_ROOM_COUNT"                  // property has no room-count
  | "MISSING_AMENITIES"                   // amenity list empty
  // Nearby-scope gaps
  | "MISSING_NEARBY_RESTAURANTS"          // no nearby food links
  | "MISSING_NEARBY_CAFES"                // no nearby café links
  | "MISSING_NEARBY_BARS"                 // no nearby bar links
  | "MISSING_NEARBY_ATTRACTIONS"          // no nearby attraction links
  | "MISSING_NEARBY_NATURE"               // no nearby nature links (lake/waterfall/beach/mountain)
  | "MISSING_NEARBY_ACTIVITIES"           // no nearby activity links (hiking/diving/etc)
  | "MISSING_NEARBY_WALKS"                // no walk/trail links
  | "MISSING_NEARBY_TRANSPORT"            // no nearby transport hub
  // Evidence-scope gaps
  | "MISSING_EVIDENCE"                    // any field asserted without source_ref
  | "STALE_INFORMATION"                   // freshness state = STALE / REFRESH_REQUIRED
  | "CONFLICTING_INFORMATION"             // knowledge_status = CONFLICT_FLAGGED
  | "WEAK_CONFIDENCE"                     // confidence below threshold
  | "MISSING_SOURCE"                      // no source_records entry at all
  // Geography-scope gaps (per-geographic-unit)
  | "GEO_UNIT_NOT_STARTED"                // §4 state = NOT_STARTED
  | "GEO_UNIT_PARTIALLY_COVERED"          // some properties but coverage low
  | "GEO_UNIT_SOURCE_UNAVAILABLE"         // §4 state = SOURCE_UNAVAILABLE
  | "GEO_UNIT_STALE"                      // §4 state = STALE
  // Cross-domain relationship gaps
  | "MISSING_CROSSDOMAIN_FOOD"            // no Food-domain relationship where one is expected
  | "MISSING_CROSSDOMAIN_TRANSPORT";      // no Transport-domain relationship where one is expected

export const GAP_KINDS: readonly GapKind[] = Object.freeze([
  "MISSING_PROPERTY","MISSING_ROOMS","MISSING_BEDS","MISSING_FACILITIES","MISSING_SERVICES",
  "MISSING_FOOD","MISSING_BREAKFAST","MISSING_IMAGES","MISSING_POLICIES","MISSING_ACCESSIBILITY",
  "MISSING_COORDINATES","MISSING_ADDRESS","MISSING_CATEGORY","MISSING_STAR_RATING",
  "MISSING_ROOM_COUNT","MISSING_AMENITIES",
  "MISSING_NEARBY_RESTAURANTS","MISSING_NEARBY_CAFES","MISSING_NEARBY_BARS",
  "MISSING_NEARBY_ATTRACTIONS","MISSING_NEARBY_NATURE","MISSING_NEARBY_ACTIVITIES",
  "MISSING_NEARBY_WALKS","MISSING_NEARBY_TRANSPORT",
  "MISSING_EVIDENCE","STALE_INFORMATION","CONFLICTING_INFORMATION","WEAK_CONFIDENCE","MISSING_SOURCE",
  "GEO_UNIT_NOT_STARTED","GEO_UNIT_PARTIALLY_COVERED","GEO_UNIT_SOURCE_UNAVAILABLE","GEO_UNIT_STALE",
  "MISSING_CROSSDOMAIN_FOOD","MISSING_CROSSDOMAIN_TRANSPORT",
]);

// ═══════════════════════════════════════════════════════════════════
// §5 · GAP RECORD
// ═══════════════════════════════════════════════════════════════════

/**
 * A single detected gap. `subject_kind` distinguishes property-scope from
 * geography-scope. `resolvability_score` is the caller-chosen 0..1 signal
 * for how likely this gap can be resolved with available sources — the
 * prioritiser (§6) uses it in scoring.
 */
export interface GapRecord {
  gap_id: string;                          // stable uuid or #GAP-YYYY-XXXXX
  gap_kind: GapKind;
  subject_kind: "PROPERTY" | "GEO_UNIT" | "CROSSDOMAIN";
  subject_ref: string;                     // property public_listing_ref OR geo unit slug
  country_code: CountryCode;
  region: string | null;
  city: string | null;
  discovered_at_iso: string;
  /** Underlying signals (all optional · undefined → 0). */
  demand_signal: number;                   // 0..1 · user demand for this info
  destination_importance: number;          // 0..1 · destination value
  crossdomain_leverage: number;            // 0..1 · how many other agents benefit
  freshness_pressure: number;              // 0..1 · how stale is it
  source_availability: number;             // 0..1 · can we legitimately research it
  resolvability_score: number;             // 0..1 · caller estimate of how solvable
  confidence_current: number;              // 0..1 · current confidence in what we do know
  activity_relevance: number;              // 0..1 · relevance to travellers
  accommodation_relevance: number;         // 0..1 · relevance to accommodation intent
  /** Computed priority (see prioritiseGap()). */
  priority: number;                        // 0..1 · deterministic weighted score
  priority_bucket: "HIGH" | "MEDIUM" | "LOW";
}

// ═══════════════════════════════════════════════════════════════════
// §6 · PRIORITISATION (deterministic · never LLM · never fabricated)
// ═══════════════════════════════════════════════════════════════════

/**
 * §6 priority weights. Sums to 1.0 so `priority` is bounded [0, 1].
 * Weights chosen to reflect the Founder's ordering:
 *   demand + destination importance dominate (§6)
 *   crossdomain leverage rewards multi-agent value (§6)
 *   freshness_pressure prevents stagnation
 *   source_availability + resolvability rebalance toward actionable work
 *   confidence_current is INVERTED (low confidence = higher priority)
 *   activity/accommodation relevance ensures we don't drift to unrelated data
 *
 * Adjustable via env NEX_ACCOMMODATION_GAP_WEIGHTS_JSON if required, but the
 * defaults are what the Founder BEGIN implies.
 */
export const GAP_PRIORITY_WEIGHTS = Object.freeze({
  demand_signal: 0.18,
  destination_importance: 0.14,
  crossdomain_leverage: 0.10,
  freshness_pressure: 0.10,
  source_availability: 0.10,
  resolvability_score: 0.10,
  confidence_current_inverted: 0.10,       // (1 - confidence_current)
  activity_relevance: 0.09,
  accommodation_relevance: 0.09,
});

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Compute deterministic priority score for a gap. Range [0, 1]. Higher =
 * more urgent. Bucket boundaries: HIGH >= 0.66 · MEDIUM >= 0.33 · else LOW.
 *
 * §7 discipline: geo units with LOW nex coverage but HIGH destination
 * importance naturally score higher — that is the Founder's under-covered
 * destination discovery mandate encoded numerically.
 */
export function prioritiseGap(input: Omit<GapRecord, "gap_id" | "priority" | "priority_bucket">): { priority: number; priority_bucket: "HIGH" | "MEDIUM" | "LOW" } {
  const w = GAP_PRIORITY_WEIGHTS;
  const priority =
    w.demand_signal              * clamp01(input.demand_signal) +
    w.destination_importance     * clamp01(input.destination_importance) +
    w.crossdomain_leverage       * clamp01(input.crossdomain_leverage) +
    w.freshness_pressure         * clamp01(input.freshness_pressure) +
    w.source_availability        * clamp01(input.source_availability) +
    w.resolvability_score        * clamp01(input.resolvability_score) +
    w.confidence_current_inverted * (1 - clamp01(input.confidence_current)) +
    w.activity_relevance         * clamp01(input.activity_relevance) +
    w.accommodation_relevance    * clamp01(input.accommodation_relevance);

  const bucket = priority >= 0.66 ? "HIGH" : priority >= 0.33 ? "MEDIUM" : "LOW";
  return { priority: Math.round(priority * 1000) / 1000, priority_bucket: bucket };
}

// ═══════════════════════════════════════════════════════════════════
// §5 · PROPERTY-SCOPE GAP DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Detect all property-scope gaps for a single WorldClassPropertyRecord.
 * Returns detected gaps unprioritised (caller may attach signals + call
 * prioritiseGap(); see detectAndPrioritiseGaps() convenience below).
 *
 * Rules are STRUCTURAL — a field is "missing" only when it is null,
 * undefined, or empty. NEVER assume presence.
 */
export function detectPropertyGaps(record: Partial<WorldClassPropertyRecord>): readonly Omit<GapRecord, "priority" | "priority_bucket">[] {
  const now = new Date().toISOString();
  const cc: CountryCode = record.location?.country_code ?? "??";
  const region = record.location?.region ?? null;
  const city = record.location?.city ?? null;
  const subjectRef = record.identity?.public_listing_ref ?? record.identity?.canonical_property_id ?? "unknown";

  const gaps: Omit<GapRecord, "priority" | "priority_bucket">[] = [];
  const push = (gap_kind: GapKind, over: Partial<Omit<GapRecord, "gap_id" | "gap_kind" | "subject_kind" | "priority" | "priority_bucket">> = {}) => {
    gaps.push({
      gap_id: `#GAP-${gap_kind}-${subjectRef}-${gaps.length + 1}`,
      gap_kind,
      subject_kind: "PROPERTY",
      subject_ref: subjectRef,
      country_code: cc,
      region,
      city,
      discovered_at_iso: now,
      demand_signal: 0,
      destination_importance: 0,
      crossdomain_leverage: 0,
      freshness_pressure: 0,
      source_availability: 0,
      resolvability_score: 0,
      confidence_current: 0,
      activity_relevance: 0,
      accommodation_relevance: 0.9,          // property gaps always high accommodation-relevance
      ...over,
    });
  };

  // Structural gaps
  if (!record.identity?.canonical_category) push("MISSING_CATEGORY");
  if (record.location?.latitude == null || record.location?.longitude == null) push("MISSING_COORDINATES");
  if (!record.location?.address_full && !record.location?.street) push("MISSING_ADDRESS");
  if (!record.rooms || record.rooms.length === 0) push("MISSING_ROOMS");
  else if (record.rooms.every((r) => !r.bed_configurations || r.bed_configurations.length === 0)) push("MISSING_BEDS");
  if (!record.facilities || record.facilities.length === 0) push("MISSING_FACILITIES");
  if (!record.services || record.services.length === 0) push("MISSING_SERVICES");
  if (!record.food_and_drink) {
    push("MISSING_FOOD");
    push("MISSING_BREAKFAST");
  } else if (!record.food_and_drink.breakfast || record.food_and_drink.breakfast.kind === "NONE") {
    push("MISSING_BREAKFAST");
  }
  if (!record.images || record.images.length === 0) push("MISSING_IMAGES");
  if (!record.policies?.check_in_time || !record.policies?.check_out_time) push("MISSING_POLICIES");
  if (!record.accessibility || record.accessibility.wheelchair_access == null) push("MISSING_ACCESSIBILITY");
  if (!record.nearby || record.nearby.length === 0) {
    push("MISSING_NEARBY_RESTAURANTS", { crossdomain_leverage: 0.6 });
    push("MISSING_NEARBY_CAFES", { crossdomain_leverage: 0.5 });
    push("MISSING_NEARBY_ATTRACTIONS", { activity_relevance: 0.8 });
    push("MISSING_NEARBY_NATURE", { activity_relevance: 0.9, destination_importance: 0.7 });
    push("MISSING_NEARBY_ACTIVITIES", { activity_relevance: 0.9 });
    push("MISSING_NEARBY_TRANSPORT", { crossdomain_leverage: 0.7 });
  }

  // Evidence-scope gaps
  if (!record.evidence || record.evidence.total_evidence_refs === 0) push("MISSING_EVIDENCE");
  if (record.freshness?.stale_field_count && record.freshness.stale_field_count > 0) push("STALE_INFORMATION", { freshness_pressure: 0.7 });
  if (record.evidence?.conflicting_field_count && record.evidence.conflicting_field_count > 0) push("CONFLICTING_INFORMATION", { freshness_pressure: 0.5 });
  if (record.quality?.overall_confidence != null && record.quality.overall_confidence < 0.5) push("WEAK_CONFIDENCE", { confidence_current: record.quality.overall_confidence });

  return gaps;
}

// ═══════════════════════════════════════════════════════════════════
// §7 · GEOGRAPHY-SCOPE GAP DETECTION
// ═══════════════════════════════════════════════════════════════════

/** Coverage-state input for a geographic unit. Matches indonesia-coverage-queue.ts states (§4). */
export type GeoUnitCoverageState =
  | "NOT_STARTED" | "DISCOVERING" | "RESEARCHING" | "PARTIALLY_COVERED"
  | "COVERED" | "STALE" | "SOURCE_UNAVAILABLE" | "BLOCKED" | "UNKNOWN";

export interface GeoUnitInput {
  geo_unit_slug: string;                   // e.g. "id-yogyakarta"
  country_code: CountryCode;
  region: string | null;                   // e.g. "Java"
  city: string | null;                     // e.g. "Yogyakarta"
  district: string | null;
  coverage_state: GeoUnitCoverageState;
  property_count: number;
  target_property_count: number | null;    // MODELED · null if unknown
  tourism_evidence_strength: number;       // 0..1 · MEASURED where possible · UNKNOWN → 0
  last_researched_iso: string | null;
}

export function detectGeoUnitGaps(unit: GeoUnitInput): readonly Omit<GapRecord, "priority" | "priority_bucket">[] {
  const now = new Date().toISOString();
  const gaps: Omit<GapRecord, "priority" | "priority_bucket">[] = [];
  const push = (gap_kind: GapKind, over: Partial<Omit<GapRecord, "gap_id" | "gap_kind" | "subject_kind" | "priority" | "priority_bucket">> = {}) => {
    gaps.push({
      gap_id: `#GAP-${gap_kind}-${unit.geo_unit_slug}-${gaps.length + 1}`,
      gap_kind,
      subject_kind: "GEO_UNIT",
      subject_ref: unit.geo_unit_slug,
      country_code: unit.country_code,
      region: unit.region,
      city: unit.city,
      discovered_at_iso: now,
      demand_signal: 0,
      destination_importance: clamp01(unit.tourism_evidence_strength),
      crossdomain_leverage: 0.3,
      freshness_pressure: 0,
      source_availability: 0,
      resolvability_score: 0.5,
      confidence_current: 0,
      activity_relevance: 0.5,
      accommodation_relevance: 0.9,
      ...over,
    });
  };

  if (unit.coverage_state === "NOT_STARTED") {
    push("GEO_UNIT_NOT_STARTED", {
      // §7: high destination importance + low coverage = HIGH priority
      resolvability_score: 0.6,
    });
  }
  if (unit.coverage_state === "PARTIALLY_COVERED") {
    push("GEO_UNIT_PARTIALLY_COVERED");
  }
  if (unit.coverage_state === "SOURCE_UNAVAILABLE") {
    push("GEO_UNIT_SOURCE_UNAVAILABLE", { source_availability: 0.0, resolvability_score: 0.1 });
  }
  if (unit.coverage_state === "STALE") {
    push("GEO_UNIT_STALE", { freshness_pressure: 0.8 });
  }
  return gaps;
}

// ═══════════════════════════════════════════════════════════════════
// Convenience · detect + prioritise + sort
// ═══════════════════════════════════════════════════════════════════

/**
 * Detect gaps for a batch of properties + geo units, prioritise them, and
 * return sorted HIGH→LOW. Never fabricates: an empty input returns empty.
 */
export function detectAndPrioritiseGaps(input: {
  properties: readonly Partial<WorldClassPropertyRecord>[];
  geo_units: readonly GeoUnitInput[];
  signal_defaults?: {
    demand_signal_by_country?: Partial<Record<CountryCode, number>>;
    destination_importance_by_city?: Partial<Record<string, number>>;
  };
}): readonly GapRecord[] {
  const out: GapRecord[] = [];
  for (const p of input.properties) {
    const gaps = detectPropertyGaps(p);
    for (const g of gaps) {
      const demand = input.signal_defaults?.demand_signal_by_country?.[g.country_code] ?? g.demand_signal;
      const destImp = (g.city && input.signal_defaults?.destination_importance_by_city?.[g.city]) ?? g.destination_importance;
      const withSignals = { ...g, demand_signal: demand, destination_importance: destImp };
      const p12d = prioritiseGap(withSignals);
      out.push({ ...withSignals, ...p12d });
    }
  }
  for (const u of input.geo_units) {
    const gaps = detectGeoUnitGaps(u);
    for (const g of gaps) {
      const demand = input.signal_defaults?.demand_signal_by_country?.[g.country_code] ?? g.demand_signal;
      const destImp = (u.city && input.signal_defaults?.destination_importance_by_city?.[u.city]) ?? g.destination_importance;
      const withSignals = { ...g, demand_signal: demand, destination_importance: destImp };
      const p12d = prioritiseGap(withSignals);
      out.push({ ...withSignals, ...p12d });
    }
  }
  return out.sort((a, b) => b.priority - a.priority);
}

// ═══════════════════════════════════════════════════════════════════
// §25 · MAP GAPS TO UNANSWERABLE ACCEPTANCE QUESTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * For a given property, list which §25 acceptance questions cannot yet be
 * answered because of the current gaps. This lets the composer explain
 * "I don't yet know X" honestly rather than fabricating.
 */
export function unanswerableQuestionsForProperty(record: Partial<WorldClassPropertyRecord>): readonly {
  question_slug: string;
  category: AcceptanceCategory;
  founder_text: string;
  reason: string;
}[] {
  const gaps = detectPropertyGaps(record);
  const gapKinds = new Set(gaps.map((g) => g.gap_kind));
  const out: { question_slug: string; category: AcceptanceCategory; founder_text: string; reason: string }[] = [];
  for (const q of ACCEPTANCE_QUESTIONS) {
    // Rough mapping · sufficient for a v1 gap→question projection
    let unanswerable = false;
    let reason = "";
    if (q.category === "BEDS" && (gapKinds.has("MISSING_BEDS") || gapKinds.has("MISSING_ROOMS"))) { unanswerable = true; reason = gapKinds.has("MISSING_ROOMS") ? "no room inventory recorded" : "no bed configuration recorded"; }
    if (q.category === "ROOM" && gapKinds.has("MISSING_ROOMS")) { unanswerable = true; reason = "no room inventory recorded"; }
    if (q.category === "OCCUPANCY" && (gapKinds.has("MISSING_ROOMS") || gapKinds.has("MISSING_BEDS"))) { unanswerable = true; reason = "no room/bed inventory recorded"; }
    if (q.category === "FACILITIES" && gapKinds.has("MISSING_FACILITIES")) { unanswerable = true; reason = "no facility assertions recorded"; }
    if (q.category === "SERVICES" && gapKinds.has("MISSING_SERVICES")) { unanswerable = true; reason = "no service assertions recorded"; }
    if (q.category === "FOOD" && gapKinds.has("MISSING_FOOD")) { unanswerable = true; reason = "no food/drink info recorded"; }
    if (q.category === "BREAKFAST" && gapKinds.has("MISSING_BREAKFAST")) { unanswerable = true; reason = "no breakfast info recorded"; }
    if (q.category === "IMAGES" && gapKinds.has("MISSING_IMAGES")) { unanswerable = true; reason = "no images recorded"; }
    if (q.category === "POLICIES" && gapKinds.has("MISSING_POLICIES")) { unanswerable = true; reason = "check-in/out or policy fields unknown"; }
    if (q.category === "LOCATION" && gapKinds.has("MISSING_COORDINATES")) { unanswerable = true; reason = "coordinates unknown"; }
    if (q.category === "NEARBY" && (gapKinds.has("MISSING_NEARBY_RESTAURANTS") || gapKinds.has("MISSING_NEARBY_ATTRACTIONS"))) { unanswerable = true; reason = "no nearby relationships populated"; }
    if (unanswerable) out.push({ question_slug: q.slug, category: q.category, founder_text: q.founder_text, reason });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════
// §28 · MAP TO COUNTRY-DISCOVERY QUESTIONS (research plan enrichment)
// ═══════════════════════════════════════════════════════════════════

/**
 * If a country has a seed profile with research_gaps populated, surface them
 * as GapRecords so they enter the same prioritisation stream. Uses the
 * profile's discovered_at_iso (from country-profile.ts) rather than "now".
 */
export function countryProfileGaps(country_code: CountryCode): readonly Omit<GapRecord, "priority" | "priority_bucket">[] {
  const profile = getCountryProfile(country_code);
  if (!profile) return [];
  return profile.research_gaps.map((g, i) => ({
    gap_id: `#GAP-COUNTRYPROFILE-${country_code}-${i + 1}`,
    // Country profile gap_kind isn't in the GapKind enum; map to closest structural kind
    gap_kind: "GEO_UNIT_NOT_STARTED" as GapKind,
    subject_kind: "GEO_UNIT",
    subject_ref: `country:${country_code}`,
    country_code,
    region: null,
    city: null,
    discovered_at_iso: g.discovered_at_iso,
    demand_signal: 0.4,
    destination_importance: 0.5,
    crossdomain_leverage: 0.4,
    freshness_pressure: 0.3,
    source_availability: 0.5,
    resolvability_score: 0.5,
    confidence_current: 0.2,
    activity_relevance: 0.5,
    accommodation_relevance: 0.9,
  }));
}

// ═══════════════════════════════════════════════════════════════════
// Stats + invariants
// ═══════════════════════════════════════════════════════════════════

export function assertGapEngineInvariants(): void {
  const seen = new Set<string>();
  for (const k of GAP_KINDS) {
    if (seen.has(k)) throw new Error(`gap-engine: duplicate GapKind "${k}"`);
    seen.add(k);
  }
  // Weights must sum to ~1.0
  const totalWeight = Object.values(GAP_PRIORITY_WEIGHTS).reduce((a, b) => a + b, 0);
  if (Math.abs(totalWeight - 1.0) > 0.001) {
    throw new Error(`gap-engine: priority weights sum to ${totalWeight} · must be 1.0`);
  }
}

export function gapEngineRegistryStats(): { gap_kinds: number; weights_total: number; buckets: readonly ["HIGH", "MEDIUM", "LOW"] } {
  const total = Object.values(GAP_PRIORITY_WEIGHTS).reduce((a, b) => a + b, 0);
  return { gap_kinds: GAP_KINDS.length, weights_total: Math.round(total * 1000) / 1000, buckets: ["HIGH", "MEDIUM", "LOW"] };
}
