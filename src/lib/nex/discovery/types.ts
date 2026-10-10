// src/lib/nex/discovery/types.ts
//
// UWI · Wave 3.3 · Discovery + governance shared types.
// Founder-authorised programme.
//
// Every discovery/fetch primitive shares this vocabulary so the
// orchestrator can compose them without ad-hoc adapters.

// ─── Discovery-ladder tier vocabulary ──────────────────────────────
// Ordered preference (higher tier is cheaper + more reliable):
export type DiscoveryTier =
  | "api"        // Structured JSON/GraphQL — always prefer if available
  | "feed"       // RSS/Atom/JSON Feed
  | "sitemap"    // sitemap.xml (with sitemap index recursion)
  | "cdx"        // Common Crawl / archive CDX index
  | "search"     // Public search engine result set (last resort discovery)
  | "html";      // Recursive HTML crawl (most expensive, most fragile)

// ─── Governance / policy ────────────────────────────────────────────
export interface Jurisdiction {
  code: "GLOBAL" | "EU" | "UK" | "US" | "ID" | "SG" | "MY" | "TH" | "AU" | "CA" | string;
  /** RFC 9309 posture flags. */
  robots_hard_gate: true; // literally `true` — cannot be disabled per founder rule
  tdm_opt_out_respected: boolean;
  gdpr_scope: boolean;
  ccpa_scope: boolean;
  copyright_regime: "berne" | "us_fair_use" | "id_uu_hak_cipta" | string;
}

// ─── URL identity ──────────────────────────────────────────────────
export interface CanonicalUrl {
  readonly raw: string;
  readonly normalised: string;
  readonly host: string;
  readonly canonical_key: string; // used for dedup
}

// ─── Robots gate result (HARD GATE) ─────────────────────────────────
export type RobotsDecision =
  | { allow: true; crawl_delay_ms: number | null; matched_group: string | null }
  | { allow: false; reason: string; matched_rule: string | null };

// ─── Politeness scheduling ──────────────────────────────────────────
export interface PolitenessOutcome {
  scheduled_at_ms: number;
  waited_ms: number;
  source: "token_bucket" | "crawl_delay" | "none";
}

// ─── Freshness / conditional GET ────────────────────────────────────
export interface FreshnessSnapshot {
  etag: string | null;
  last_modified_iso: string | null;
  content_hash: string | null;
  first_seen_iso: string;
  last_fetched_iso: string;
}

export interface ConditionalFetchOutcome {
  status: number;
  changed: boolean; // false if 304 or content-hash unchanged
  bytes: Uint8Array | null; // null if not changed
  headers: Record<string, string>;
  final_url: CanonicalUrl;
  redirects: readonly CanonicalUrl[];
  freshness_snapshot: FreshnessSnapshot;
  duration_ms: number;
}

// ─── Content normalisation ──────────────────────────────────────────
export interface ExtractionOutcome {
  ok: boolean;
  title: string | null;
  main_text: string | null;    // Readability output
  markdown: string | null;      // Turndown output
  language: string | null;
  byline: string | null;
  excerpt: string | null;
  extraction_quality: "clean" | "partial" | "boilerplate_heavy" | "empty";
  warnings: readonly string[];
}

// ─── Sitemap parsing ────────────────────────────────────────────────
export interface SitemapEntry {
  loc: CanonicalUrl;
  lastmod_iso: string | null;
  changefreq: string | null;
  priority: number | null;
}
export interface SitemapParseOutcome {
  is_index: boolean;
  child_sitemaps: readonly CanonicalUrl[]; // populated if is_index=true
  urls: readonly SitemapEntry[];
  parse_errors: readonly string[];
}

// ─── Failure classification (10 first-class classes per founder §14) ──
export type DiscoveryFailureClass =
  | "robots_denied"
  | "not_modified_304"
  | "timeout"
  | "malformed_html_or_xml"
  | "redirect_chain_exceeded"
  | "duplicate_url"
  | "canonical_changed"
  | "source_unavailable"
  | "rate_limited"
  | "partial_extraction";

export interface DiscoveryFailure {
  failure_class: DiscoveryFailureClass;
  url: CanonicalUrl;
  detail: string;
  ts_iso: string;
}

// ─── Provenance / evidence record (WARC-shaped) ─────────────────────
export interface EvidenceRecord {
  record_id: string;              // deterministic id (D2 idempotency-key)
  record_type: "response" | "request" | "metadata" | "revisit";
  target_url: CanonicalUrl;
  fetched_at_iso: string;
  content_type: string | null;
  content_length: number | null;
  content_hash_sha256: string | null;
  headers: Record<string, string>;
  body_ref: string | null;          // path/handle to body storage (or null if inline)
  source_class: string;             // e.g. "bmkg.go.id" (used for D5 bulkhead)
  provenance_chain: readonly {
    stage: string;
    at_iso: string;
    detail?: string;
  }[];
  robots_decision: RobotsDecision;
  politeness: PolitenessOutcome;
  extraction: ExtractionOutcome | null;
  failure: DiscoveryFailure | null;
}

// ─── Discovery orchestration input ──────────────────────────────────
export interface DiscoveryRequest {
  seed_url: string;
  jurisdiction: Jurisdiction;
  preferred_tier: DiscoveryTier;
  workflow_id: string;
  activity_name: string;
  attempt_id: string | number;
  deadline_ms?: number;
}
