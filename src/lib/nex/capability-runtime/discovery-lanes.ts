// src/lib/nex/capability-runtime/discovery-lanes.ts
//
// NEX Discovery Lane Separation · Stage 12 · Read-only lane catalogue
// Founder-authorised build-lane addition · 2026-09-23.
//
// Formalises the separation that ALREADY exists in NEX between:
//   Discovery → Website Resolution → Website Acquisition → Website Walking
//     → Extraction → Classification → Entity Resolution → Evidence Recording
//
// Every lane cited here maps to a real module verified on disk. Lanes
// that NEX does not implement (Search engine, standalone Maps, headless
// Browser, Social discovery) are DELIBERATELY absent · §18 no fake
// completeness.
//
// HARD RULES:
//   _DISCOVERY_LANES_ARE_METADATA_ONLY
//   _DISCOVERY_LANES_CITE_REAL_MODULES_ONLY
//   _DISCOVERY_LANES_HONESTLY_OMIT_MISSING_LANES

// ═══════════════════════════════════════════════════════════════════════
// LANE TAXONOMY
// ═══════════════════════════════════════════════════════════════════════

/**
 * The eight lanes NEX currently has real code for. Ordering reflects the
 * pipeline flow, not a hard sequence — some lanes fan out (multiple
 * adapters implement `discovery`) and some can be skipped when their
 * inputs are already known (`website_resolution` unnecessary if the
 * discovery adapter already returned a website URL).
 *
 * Deliberately ABSENT (no real code):
 *   search_engine — no reachable search API from this runtime
 *   maps          — subsumed by discovery adapters (Nominatim / Overpass)
 *   browser       — no headless-browser subsystem
 *   social_discovery — no social platform adapter
 */
export type DiscoveryLane =
  | "discovery"              // finding a real business by name / geography
  | "website_resolution"     // resolving a business to a canonical website URL
  | "website_acquisition"    // polite HTTP fetching of permitted public pages
  | "website_walking"        // bounded per-entity walk over a fetched site
  | "extraction"             // deterministic email extraction from HTML
  | "classification"         // email type + evidence tier classification
  | "entity_resolution"      // canonical entity state machine (candidate → resolved)
  | "evidence_recording";    // persisting verified public business evidence

export const KNOWN_DISCOVERY_LANES: readonly DiscoveryLane[] = [
  "discovery",
  "website_resolution",
  "website_acquisition",
  "website_walking",
  "extraction",
  "classification",
  "entity_resolution",
  "evidence_recording",
] as const;

/**
 * Deliberately absent from the taxonomy — declared here so callers can
 * inspect what NEX chose NOT to model, and future stages can add real
 * modules if any of these become real capabilities.
 */
export const HONESTLY_ABSENT_LANES: readonly string[] = [
  "search_engine",
  "maps_standalone",
  "browser_headless",
  "social_discovery",
] as const;

// ═══════════════════════════════════════════════════════════════════════
// LANE MODULE CATALOGUE
// ═══════════════════════════════════════════════════════════════════════

export interface LaneModule {
  readonly lane: DiscoveryLane;
  readonly module_path: string;              // real file path
  readonly role: string;                     // one-line description
  readonly is_abstraction: boolean;          // true = interface/contract; false = concrete
}

/**
 * Every lane maps to at least one real module. Verified by test using
 * `fs.stat()` on each `module_path` — see discovery-lanes.test.ts.
 */
export const LANE_MODULES: readonly LaneModule[] = [
  // Discovery lane (4 concrete adapters + 2 executors)
  {
    lane: "discovery",
    module_path: "src/lib/nex/aof/adapters/nominatim-adapter.ts",
    role: "Nominatim OSM search adapter — structured place-name query",
    is_abstraction: false,
  },
  {
    lane: "discovery",
    module_path: "src/lib/nex/harvest/production-overpass-adapter.ts",
    role: "Overpass OSM query adapter — tag-based business discovery",
    is_abstraction: false,
  },
  {
    lane: "discovery",
    module_path: "src/lib/nex/aof/adapters/wikidata-adapter.ts",
    role: "Wikidata SPARQL adapter — structured knowledge-graph discovery",
    is_abstraction: false,
  },
  {
    lane: "discovery",
    module_path: "src/lib/nex/aof/adapters/companies-house-uk.ts",
    role: "Companies House UK adapter — official UK company registry",
    is_abstraction: false,
  },
  {
    lane: "discovery",
    module_path: "src/lib/nex/harvest/source-probe-executor.ts",
    role: "Executor: dispatches probe to selected adapter, writes candidates",
    is_abstraction: false,
  },

  // Website resolution — currently embedded in discovery adapters (via source tags).
  // No standalone module exists · when v3 needed website resolution, it read
  // Overpass `website` / `contact:website` tags directly from the adapter output.
  {
    lane: "website_resolution",
    module_path: "src/lib/nex/harvest/production-overpass-adapter.ts",
    role: "Website URL extraction from OSM tags (website / contact:website / url)",
    is_abstraction: false,
  },
  {
    lane: "website_resolution",
    module_path: "src/lib/nex/aof/adapters/wikidata-adapter.ts",
    role: "Website URL extraction from Wikidata property P856",
    is_abstraction: false,
  },

  // Website acquisition (polite HTTP fetching)
  {
    lane: "website_acquisition",
    module_path: "src/lib/nex/discovery-world/page-fetcher.ts",
    role: "PageFetcher abstraction · NULL_FETCHER default (blocks all)",
    is_abstraction: true,
  },
  {
    lane: "website_acquisition",
    module_path: "src/lib/nex/discovery-world/behavior-walk-fetcher.ts",
    role: "BehaviorWalkFetcher · robots.txt RFC 9309 · per-host rate limiting · fetch audit",
    is_abstraction: false,
  },
  {
    lane: "website_acquisition",
    module_path: "src/lib/nex/discovery-world/production-page-fetcher.ts",
    role: "ProductionPageFetcher · Founder-signed allowlist · dormant unless NEX_PAGE_FETCHER_ACTIVATION=on",
    is_abstraction: false,
  },

  // Website walking (bounded per-entity)
  {
    lane: "website_walking",
    module_path: "src/lib/nex/discovery-world/website-walker.ts",
    role: "walkEntityWebsite · seed priority list · max_pages_per_entity cap · deadline enforced",
    is_abstraction: false,
  },
  {
    lane: "website_walking",
    module_path: "src/lib/nex/harvest/website-walk-executor.ts",
    role: "Executor: dispatches walker + records outcome",
    is_abstraction: false,
  },

  // Extraction
  {
    lane: "extraction",
    module_path: "src/lib/nex/discovery-world/email-extractor.ts",
    role: "Pure HTML email extractor · 5 methods (JSON-LD · microdata · mailto · obfuscated · regex)",
    is_abstraction: false,
  },

  // Classification
  {
    lane: "classification",
    module_path: "src/lib/nex/discovery-world/email-classifier.ts",
    role: "Two-dimension classifier: email_type + email_evidence_tier · provider-agnostic",
    is_abstraction: false,
  },

  // Entity resolution
  {
    lane: "entity_resolution",
    module_path: "src/lib/nex/discovery-world/entity-resolution.ts",
    role: "Entity state machine · unresolved / candidate / resolved / ambiguous / rejected",
    is_abstraction: false,
  },

  // Evidence recording
  {
    lane: "evidence_recording",
    module_path: "src/lib/nex/discovery-world/business-evidence.ts",
    role: "recordBusinessEvidence · idempotent upsert into nex.discovery_business_evidence",
    is_abstraction: false,
  },
];

// ═══════════════════════════════════════════════════════════════════════
// LOOKUPS (read-only)
// ═══════════════════════════════════════════════════════════════════════

export function modulesInLane(lane: DiscoveryLane): readonly LaneModule[] {
  return LANE_MODULES.filter((m) => m.lane === lane);
}

export function lanesForModule(module_path: string): readonly DiscoveryLane[] {
  return Array.from(
    new Set(LANE_MODULES.filter((m) => m.module_path === module_path).map((m) => m.lane)),
  );
}

export function abstractionsInLane(lane: DiscoveryLane): readonly LaneModule[] {
  return LANE_MODULES.filter((m) => m.lane === lane && m.is_abstraction);
}

export function concreteImplementationsInLane(lane: DiscoveryLane): readonly LaneModule[] {
  return LANE_MODULES.filter((m) => m.lane === lane && !m.is_abstraction);
}

// ═══════════════════════════════════════════════════════════════════════
// DOCTRINE LOCKS (Stage 12)
// ═══════════════════════════════════════════════════════════════════════

export const _DISCOVERY_LANES_ARE_METADATA_ONLY =
  "Stage_12_names_and_catalogues_never_implements_or_dispatches_between_lanes";

export const _DISCOVERY_LANES_CITE_REAL_MODULES_ONLY =
  "every_LaneModule_module_path_is_verified_to_exist_on_disk_by_test";

export const _DISCOVERY_LANES_HONESTLY_OMIT_MISSING_LANES =
  "search_engine_maps_standalone_browser_headless_social_discovery_deliberately_absent_no_fake_completeness";
