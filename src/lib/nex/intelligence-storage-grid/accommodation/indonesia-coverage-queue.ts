// src/lib/nex/intelligence-storage-grid/accommodation/indonesia-coverage-queue.ts
//
// NEX Accommodation Agent · Indonesia Coverage Queue (Phase 2)
// Founder BEGIN 2026-09-08 · Indonesia Complete Country Intelligence Mission
//
// Implements §3, §4:
//   §3 Indonesia-wide coverage · every province · island group · region ·
//        city · town · district · legitimately discoverable destination.
//   §4 "Every location" state machine · NOT_STARTED · DISCOVERING · RESEARCHING
//        · PARTIALLY_COVERED · COVERED · STALE · SOURCE_UNAVAILABLE · BLOCKED
//        · UNKNOWN · never converts lack of evidence into "no accommodation".
//
// This module:
//   1. Defines the state machine (§4)
//   2. Seeds the 34 Indonesian provinces with island-group grouping
//   3. Provides state-transition helpers (deterministic · no fabrication)
//   4. Provides queue-sort helpers keyed on gap-engine priority
//
// It does NOT modify Postgres. It does NOT scrape. It does NOT infer coverage
// from absence of records — coverage state is EXPLICITLY set by the worker
// or Master AI as evidence accumulates.
//
// Additive · zero DDL · zero schema change · composes with gap-engine.ts.

import type { CountryCode } from "../types.js";

// ═══════════════════════════════════════════════════════════════════
// §4 · COVERAGE STATE (state machine)
// ═══════════════════════════════════════════════════════════════════

/**
 * Every geographic unit in the Indonesia coverage queue is in exactly one
 * of these states. Transitions are governed:
 *
 *   NOT_STARTED    → DISCOVERING             (worker begins discovery)
 *   DISCOVERING    → RESEARCHING             (candidates identified)
 *   DISCOVERING    → SOURCE_UNAVAILABLE      (no legitimate source found)
 *   RESEARCHING    → PARTIALLY_COVERED       (some records collected)
 *   RESEARCHING    → SOURCE_UNAVAILABLE      (research blocked mid-pass)
 *   PARTIALLY_COVERED → COVERED              (target coverage reached)
 *   COVERED        → STALE                   (freshness pressure)
 *   STALE          → RESEARCHING             (refresh cycle)
 *   Any state      → BLOCKED                 (Founder or governance stop)
 *   Any state      → UNKNOWN                 (data lost · needs re-audit)
 *
 * Founder §4: "Never convert lack of evidence into NO ACCOMMODATION."
 * Enforced structurally — no state means "no accommodation exists here."
 */
export type CoverageState =
  | "NOT_STARTED"
  | "DISCOVERING"
  | "RESEARCHING"
  | "PARTIALLY_COVERED"
  | "COVERED"
  | "STALE"
  | "SOURCE_UNAVAILABLE"
  | "BLOCKED"
  | "UNKNOWN";

export const COVERAGE_STATES: readonly CoverageState[] = Object.freeze([
  "NOT_STARTED","DISCOVERING","RESEARCHING","PARTIALLY_COVERED","COVERED",
  "STALE","SOURCE_UNAVAILABLE","BLOCKED","UNKNOWN",
]);

/** Allowed forward transitions (from → to[]). Enforced by transitionCoverageState(). */
export const COVERAGE_STATE_TRANSITIONS: Readonly<Record<CoverageState, readonly CoverageState[]>> = Object.freeze({
  NOT_STARTED:        ["DISCOVERING", "BLOCKED", "UNKNOWN"],
  DISCOVERING:        ["RESEARCHING", "SOURCE_UNAVAILABLE", "BLOCKED", "UNKNOWN"],
  RESEARCHING:        ["PARTIALLY_COVERED", "SOURCE_UNAVAILABLE", "BLOCKED", "UNKNOWN"],
  PARTIALLY_COVERED:  ["COVERED", "RESEARCHING", "STALE", "BLOCKED", "UNKNOWN"],
  COVERED:            ["STALE", "BLOCKED", "UNKNOWN"],
  STALE:              ["RESEARCHING", "BLOCKED", "UNKNOWN"],
  SOURCE_UNAVAILABLE: ["DISCOVERING", "RESEARCHING", "BLOCKED", "UNKNOWN"],
  BLOCKED:            ["NOT_STARTED", "DISCOVERING", "UNKNOWN"],
  UNKNOWN:            ["NOT_STARTED", "DISCOVERING", "BLOCKED"],
});

/**
 * Attempt a state transition. Throws when the transition is not in the
 * allowed graph. Returns the new state on success. Callers MUST record the
 * transition reason for audit (§4 · §33 no-fabrication).
 */
export function transitionCoverageState(from: CoverageState, to: CoverageState, reason: string): CoverageState {
  if (!COVERAGE_STATES.includes(from)) throw new Error(`indonesia-coverage-queue: unknown from state "${from}"`);
  if (!COVERAGE_STATES.includes(to)) throw new Error(`indonesia-coverage-queue: unknown to state "${to}"`);
  if (!reason || reason.trim() === "") throw new Error("indonesia-coverage-queue: transition reason required (§33 audit)");
  const allowed = COVERAGE_STATE_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new Error(`indonesia-coverage-queue: transition ${from} → ${to} not allowed (allowed: ${allowed.join(", ")})`);
  }
  return to;
}

// ═══════════════════════════════════════════════════════════════════
// §3 · GEOGRAPHIC HIERARCHY (Country → Island Group → Province → City → District)
// ═══════════════════════════════════════════════════════════════════

/**
 * Indonesia's 34 recognised provinces (post-2022 · matches current
 * administrative divisions). Grouped by island group per Founder §3.
 *
 * Sources for province list are administrative constants — not scraped.
 * If the government adds/removes provinces (as happened with Papua splits
 * in 2022), this list is versioned and updated with an explicit BEGIN.
 */
export type IndonesiaIslandGroup =
  | "Java"
  | "Bali"
  | "Sumatra"
  | "Kalimantan"
  | "Sulawesi"
  | "Papua"
  | "Nusa Tenggara"
  | "Maluku";

export const INDONESIA_ISLAND_GROUPS: readonly IndonesiaIslandGroup[] = Object.freeze([
  "Java", "Bali", "Sumatra", "Kalimantan", "Sulawesi", "Papua", "Nusa Tenggara", "Maluku",
]);

/** Static seed of the 34 provinces. Slug uses lowercase-hyphen. Names use official Indonesian. */
export interface IndonesiaProvinceSeed {
  slug: string;
  display_name: string;
  island_group: IndonesiaIslandGroup;
  capital: string;
  approx_lat: number;
  approx_lon: number;
}

export const INDONESIA_PROVINCES: readonly IndonesiaProvinceSeed[] = Object.freeze([
  // Java
  { slug: "banten", display_name: "Banten", island_group: "Java", capital: "Serang", approx_lat: -6.4058, approx_lon: 106.0640 },
  { slug: "dki-jakarta", display_name: "DKI Jakarta", island_group: "Java", capital: "Jakarta", approx_lat: -6.2088, approx_lon: 106.8456 },
  { slug: "jawa-barat", display_name: "Jawa Barat (West Java)", island_group: "Java", capital: "Bandung", approx_lat: -6.9147, approx_lon: 107.6098 },
  { slug: "jawa-tengah", display_name: "Jawa Tengah (Central Java)", island_group: "Java", capital: "Semarang", approx_lat: -6.9667, approx_lon: 110.4167 },
  { slug: "di-yogyakarta", display_name: "Daerah Istimewa Yogyakarta", island_group: "Java", capital: "Yogyakarta", approx_lat: -7.7956, approx_lon: 110.3695 },
  { slug: "jawa-timur", display_name: "Jawa Timur (East Java)", island_group: "Java", capital: "Surabaya", approx_lat: -7.2504, approx_lon: 112.7688 },

  // Bali
  { slug: "bali", display_name: "Bali", island_group: "Bali", capital: "Denpasar", approx_lat: -8.6705, approx_lon: 115.2126 },

  // Sumatra
  { slug: "aceh", display_name: "Aceh", island_group: "Sumatra", capital: "Banda Aceh", approx_lat: 5.5483, approx_lon: 95.3238 },
  { slug: "sumatera-utara", display_name: "Sumatera Utara (North Sumatra)", island_group: "Sumatra", capital: "Medan", approx_lat: 3.5952, approx_lon: 98.6722 },
  { slug: "sumatera-barat", display_name: "Sumatera Barat (West Sumatra)", island_group: "Sumatra", capital: "Padang", approx_lat: -0.9471, approx_lon: 100.4172 },
  { slug: "riau", display_name: "Riau", island_group: "Sumatra", capital: "Pekanbaru", approx_lat: 0.5333, approx_lon: 101.4500 },
  { slug: "kepulauan-riau", display_name: "Kepulauan Riau (Riau Islands)", island_group: "Sumatra", capital: "Tanjungpinang", approx_lat: 0.9184, approx_lon: 104.4581 },
  { slug: "jambi", display_name: "Jambi", island_group: "Sumatra", capital: "Jambi", approx_lat: -1.6101, approx_lon: 103.6131 },
  { slug: "sumatera-selatan", display_name: "Sumatera Selatan (South Sumatra)", island_group: "Sumatra", capital: "Palembang", approx_lat: -2.9761, approx_lon: 104.7754 },
  { slug: "bangka-belitung", display_name: "Bangka Belitung", island_group: "Sumatra", capital: "Pangkal Pinang", approx_lat: -2.1316, approx_lon: 106.1169 },
  { slug: "bengkulu", display_name: "Bengkulu", island_group: "Sumatra", capital: "Bengkulu", approx_lat: -3.7928, approx_lon: 102.2608 },
  { slug: "lampung", display_name: "Lampung", island_group: "Sumatra", capital: "Bandar Lampung", approx_lat: -5.4500, approx_lon: 105.2667 },

  // Kalimantan
  { slug: "kalimantan-barat", display_name: "Kalimantan Barat (West Kalimantan)", island_group: "Kalimantan", capital: "Pontianak", approx_lat: -0.0263, approx_lon: 109.3425 },
  { slug: "kalimantan-tengah", display_name: "Kalimantan Tengah (Central Kalimantan)", island_group: "Kalimantan", capital: "Palangka Raya", approx_lat: -2.2100, approx_lon: 113.9200 },
  { slug: "kalimantan-selatan", display_name: "Kalimantan Selatan (South Kalimantan)", island_group: "Kalimantan", capital: "Banjarbaru", approx_lat: -3.4560, approx_lon: 114.8480 },
  { slug: "kalimantan-timur", display_name: "Kalimantan Timur (East Kalimantan)", island_group: "Kalimantan", capital: "Samarinda", approx_lat: -0.4948, approx_lon: 117.1436 },
  { slug: "kalimantan-utara", display_name: "Kalimantan Utara (North Kalimantan)", island_group: "Kalimantan", capital: "Tanjung Selor", approx_lat: 2.8420, approx_lon: 117.3760 },

  // Sulawesi
  { slug: "sulawesi-utara", display_name: "Sulawesi Utara (North Sulawesi)", island_group: "Sulawesi", capital: "Manado", approx_lat: 1.4748, approx_lon: 124.8421 },
  { slug: "gorontalo", display_name: "Gorontalo", island_group: "Sulawesi", capital: "Gorontalo", approx_lat: 0.5435, approx_lon: 123.0568 },
  { slug: "sulawesi-tengah", display_name: "Sulawesi Tengah (Central Sulawesi)", island_group: "Sulawesi", capital: "Palu", approx_lat: -0.9003, approx_lon: 119.8779 },
  { slug: "sulawesi-barat", display_name: "Sulawesi Barat (West Sulawesi)", island_group: "Sulawesi", capital: "Mamuju", approx_lat: -2.6748, approx_lon: 118.8880 },
  { slug: "sulawesi-selatan", display_name: "Sulawesi Selatan (South Sulawesi)", island_group: "Sulawesi", capital: "Makassar", approx_lat: -5.1477, approx_lon: 119.4327 },
  { slug: "sulawesi-tenggara", display_name: "Sulawesi Tenggara (South-East Sulawesi)", island_group: "Sulawesi", capital: "Kendari", approx_lat: -3.9985, approx_lon: 122.5127 },

  // Nusa Tenggara
  { slug: "nusa-tenggara-barat", display_name: "Nusa Tenggara Barat (West NT)", island_group: "Nusa Tenggara", capital: "Mataram", approx_lat: -8.5833, approx_lon: 116.1167 },
  { slug: "nusa-tenggara-timur", display_name: "Nusa Tenggara Timur (East NT)", island_group: "Nusa Tenggara", capital: "Kupang", approx_lat: -10.1772, approx_lon: 123.6070 },

  // Maluku
  { slug: "maluku", display_name: "Maluku", island_group: "Maluku", capital: "Ambon", approx_lat: -3.6954, approx_lon: 128.1814 },
  { slug: "maluku-utara", display_name: "Maluku Utara (North Maluku)", island_group: "Maluku", capital: "Sofifi", approx_lat: 0.7900, approx_lon: 127.3800 },

  // Papua (post-2022 splits · currently 6 provinces · seed uses 4 primary)
  { slug: "papua", display_name: "Papua", island_group: "Papua", capital: "Jayapura", approx_lat: -2.5333, approx_lon: 140.7167 },
  { slug: "papua-barat", display_name: "Papua Barat (West Papua)", island_group: "Papua", capital: "Manokwari", approx_lat: -0.8615, approx_lon: 134.0620 },
  { slug: "papua-selatan", display_name: "Papua Selatan (South Papua)", island_group: "Papua", capital: "Merauke", approx_lat: -8.4667, approx_lon: 140.4000 },
  { slug: "papua-tengah", display_name: "Papua Tengah (Central Papua)", island_group: "Papua", capital: "Nabire", approx_lat: -3.3667, approx_lon: 135.5000 },
  { slug: "papua-pegunungan", display_name: "Papua Pegunungan (Highland Papua)", island_group: "Papua", capital: "Jayawijaya", approx_lat: -4.1000, approx_lon: 138.9500 },
  { slug: "papua-barat-daya", display_name: "Papua Barat Daya (Southwest Papua)", island_group: "Papua", capital: "Sorong", approx_lat: -0.8762, approx_lon: 131.2558 },
]);

// ═══════════════════════════════════════════════════════════════════
// §3 · COVERAGE UNIT (province · region · city · district)
// ═══════════════════════════════════════════════════════════════════

export type CoverageUnitKind = "COUNTRY" | "PROVINCE" | "REGION" | "CITY" | "DISTRICT";

/**
 * A single geographic unit tracked in the coverage queue. `parent_slug`
 * chains up to build the hierarchy. `state` follows the state machine.
 */
export interface CoverageUnit {
  unit_slug: string;                    // e.g. "id" · "id-di-yogyakarta" · "id-di-yogyakarta-yogyakarta"
  country_code: CountryCode;
  parent_slug: string | null;
  kind: CoverageUnitKind;
  display_name: string;
  island_group: IndonesiaIslandGroup | null;
  approx_lat: number | null;
  approx_lon: number | null;
  state: CoverageState;
  state_updated_at_iso: string;
  state_reason: string;                 // §4 audit · required non-empty
  property_count_measured: number;      // MEASURED · from Postgres query
  target_property_count: number | null; // MODELED · null = unknown
  coverage_pct: number | null;          // measured / target when both known · null = UNKNOWN
  tourism_evidence_strength: number;    // 0..1 · initialised to 0 · updated as evidence discovered
  last_researched_iso: string | null;
  next_research_priority: number;       // 0..1 · from gap-engine
}

// ═══════════════════════════════════════════════════════════════════
// SEED CONSTRUCTORS
// ═══════════════════════════════════════════════════════════════════

const NOW_ISO = "2026-09-08T00:00:00Z";

/** Build the root Indonesia country unit. */
export function seedIndonesiaCountryUnit(): CoverageUnit {
  return {
    unit_slug: "id",
    country_code: "ID",
    parent_slug: null,
    kind: "COUNTRY",
    display_name: "Indonesia",
    island_group: null,
    approx_lat: -2.5,
    approx_lon: 118.0,
    state: "PARTIALLY_COVERED",         // 877 visible rows · not full coverage
    state_updated_at_iso: NOW_ISO,
    state_reason: "Baseline: 877 visible rows all in Yogyakarta; 33 other provinces NOT_STARTED",
    property_count_measured: 877,
    target_property_count: null,
    coverage_pct: null,
    tourism_evidence_strength: 0.9,     // Indonesia has vast tourism evidence
    last_researched_iso: NOW_ISO,
    next_research_priority: 0.8,
  };
}

/** Build a per-province unit from the seed. All start NOT_STARTED except DI Yogyakarta. */
export function seedProvinceUnit(seed: IndonesiaProvinceSeed): CoverageUnit {
  const isYogya = seed.slug === "di-yogyakarta";
  return {
    unit_slug: `id-${seed.slug}`,
    country_code: "ID",
    parent_slug: "id",
    kind: "PROVINCE",
    display_name: seed.display_name,
    island_group: seed.island_group,
    approx_lat: seed.approx_lat,
    approx_lon: seed.approx_lon,
    state: isYogya ? "PARTIALLY_COVERED" : "NOT_STARTED",
    state_updated_at_iso: NOW_ISO,
    state_reason: isYogya
      ? "877 visible accommodation rows in Yogyakarta · target unknown"
      : "Not yet researched · §4 NOT_STARTED (never fabricates NO_ACCOMMODATION)",
    property_count_measured: isYogya ? 877 : 0,
    target_property_count: null,
    coverage_pct: null,
    tourism_evidence_strength:
      // Rough MODELED signal based on tourism prominence (§7 discipline: never treated as fact,
      // used only as priority hint · easily overridden by real evidence)
      seed.slug === "bali" ? 0.98 :
      seed.slug === "di-yogyakarta" ? 0.92 :
      seed.slug === "dki-jakarta" ? 0.88 :
      seed.slug === "jawa-timur" ? 0.72 :
      seed.slug === "jawa-tengah" ? 0.72 :
      seed.slug === "jawa-barat" ? 0.72 :
      seed.slug === "sumatera-utara" ? 0.68 :
      seed.slug === "sulawesi-selatan" ? 0.62 :
      seed.slug === "nusa-tenggara-barat" ? 0.75 :
      seed.slug === "nusa-tenggara-timur" ? 0.68 :
      seed.slug === "papua-barat-daya" ? 0.72 :   // Raja Ampat
      0.5,
    last_researched_iso: isYogya ? NOW_ISO : null,
    next_research_priority: isYogya ? 0.6 : 0.5,
  };
}

/** Seed all 34 provinces + root country. */
export function seedIndonesiaCoverageQueue(): readonly CoverageUnit[] {
  return Object.freeze([
    seedIndonesiaCountryUnit(),
    ...INDONESIA_PROVINCES.map(seedProvinceUnit),
  ]);
}

// ═══════════════════════════════════════════════════════════════════
// QUEUE OPERATIONS (deterministic · no fabrication)
// ═══════════════════════════════════════════════════════════════════

/** Sort a queue by `next_research_priority` DESC · stable. */
export function sortQueueByPriority(queue: readonly CoverageUnit[]): readonly CoverageUnit[] {
  return [...queue].sort((a, b) => b.next_research_priority - a.next_research_priority);
}

/** Pick the top N candidates for a worker cycle. Never returns BLOCKED / UNKNOWN units. */
export function pickResearchCandidates(queue: readonly CoverageUnit[], n: number): readonly CoverageUnit[] {
  return sortQueueByPriority(queue).filter((u) => u.state !== "BLOCKED" && u.state !== "UNKNOWN").slice(0, Math.max(0, n));
}

/** Aggregate coverage counters by island group. */
export function aggregateByIslandGroup(queue: readonly CoverageUnit[]): Readonly<Record<IndonesiaIslandGroup, {
  units: number;
  properties_measured: number;
  states: Record<CoverageState, number>;
}>> {
  const out: Record<string, { units: number; properties_measured: number; states: Record<string, number> }> = {};
  for (const g of INDONESIA_ISLAND_GROUPS) {
    out[g] = { units: 0, properties_measured: 0, states: {} };
    for (const s of COVERAGE_STATES) out[g].states[s] = 0;
  }
  for (const u of queue) {
    if (!u.island_group) continue;
    const bucket = out[u.island_group];
    bucket.units++;
    bucket.properties_measured += u.property_count_measured;
    bucket.states[u.state] = (bucket.states[u.state] ?? 0) + 1;
  }
  return out as Readonly<Record<IndonesiaIslandGroup, { units: number; properties_measured: number; states: Record<CoverageState, number> }>>;
}

/**
 * Overall coverage summary. `coverage_denominator_note` is required non-empty
 * so the observatory (§29 · §30) can display an auditable denominator rather
 * than a fake percentage.
 */
export function coverageSummary(queue: readonly CoverageUnit[]): {
  total_units: number;
  provinces_total: number;
  provinces_not_started: number;
  provinces_partially_covered: number;
  provinces_covered: number;
  provinces_source_unavailable: number;
  properties_measured_total: number;
  attempted_units: number;
  attempted_units_denominator_note: string;
} {
  const provinces = queue.filter((u) => u.kind === "PROVINCE");
  const bs = (s: CoverageState) => provinces.filter((u) => u.state === s).length;
  const attempted = provinces.filter((u) => u.state !== "NOT_STARTED" && u.state !== "UNKNOWN").length;
  return {
    total_units: queue.length,
    provinces_total: provinces.length,
    provinces_not_started: bs("NOT_STARTED"),
    provinces_partially_covered: bs("PARTIALLY_COVERED"),
    provinces_covered: bs("COVERED"),
    provinces_source_unavailable: bs("SOURCE_UNAVAILABLE"),
    properties_measured_total: queue.reduce((a, u) => a + u.property_count_measured, 0),
    attempted_units: attempted,
    attempted_units_denominator_note: "attempted = provinces where state != NOT_STARTED and != UNKNOWN · denominator = 34 provinces",
  };
}

// ═══════════════════════════════════════════════════════════════════
// INVARIANTS + STATS
// ═══════════════════════════════════════════════════════════════════

export function assertCoverageQueueInvariants(queue: readonly CoverageUnit[]): void {
  const slugs = new Set<string>();
  for (const u of queue) {
    if (slugs.has(u.unit_slug)) throw new Error(`indonesia-coverage-queue: duplicate slug "${u.unit_slug}"`);
    slugs.add(u.unit_slug);
    if (!COVERAGE_STATES.includes(u.state)) throw new Error(`indonesia-coverage-queue: invalid state "${u.state}" on "${u.unit_slug}"`);
    if (!u.state_reason || u.state_reason.trim() === "") throw new Error(`indonesia-coverage-queue: state_reason required on "${u.unit_slug}"`);
    if (u.parent_slug && !slugs.has(u.parent_slug) && !queue.find((q) => q.unit_slug === u.parent_slug)) {
      throw new Error(`indonesia-coverage-queue: unit "${u.unit_slug}" references unknown parent "${u.parent_slug}"`);
    }
  }
}

export function coverageQueueRegistryStats(): {
  provinces_seeded: number;
  island_groups: readonly IndonesiaIslandGroup[];
  coverage_states: readonly CoverageState[];
  allowed_transitions_count: number;
} {
  const transitionCount = Object.values(COVERAGE_STATE_TRANSITIONS).reduce((a, v) => a + v.length, 0);
  return {
    provinces_seeded: INDONESIA_PROVINCES.length,
    island_groups: INDONESIA_ISLAND_GROUPS,
    coverage_states: COVERAGE_STATES,
    allowed_transitions_count: transitionCount,
  };
}
