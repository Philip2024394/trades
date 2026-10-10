// WO-CRAWLER-INTERNET-01 · authorised source registry.
//
// Founder-locked 2026-09-13 · NEX Continuous Multi-Source Crawler Directive:
//   - NEX crawlers must NEVER depend on a single source
//   - One source failing must NEVER stop the workforce
//   - Failed sources rotate to cooldown; other authorised sources take over
//   - Every source has a per-host policy
//   - Source health tracked for scheduler
//
// The registry is founder-authorised. Adding a new source is a WO.

import type { HostPolicy } from "./host-rate-limiter";

// ── Source class ────────────────────────────────────────────────────────

export type SourceClass =
  | "academic_publication"     // arXiv, etc.
  | "official_documentation"   // Node.js docs, MDN, etc.
  | "official_repository"      // GitHub releases feeds
  | "standards_organisation"   // W3C, IETF
  | "rss_atom_feed"            // generic public feeds
  | "public_technical_feed";

// ── Authorised source ──────────────────────────────────────────────────

export interface AuthorisedSource {
  readonly source_id: string;
  readonly source_class: SourceClass;
  readonly host: string;
  readonly url_template: string;
  readonly params: Readonly<Record<string, string | string[]>>;
  readonly access_method: "GET_HTTPS";
  readonly parser_kind: "atom_xml" | "rss_xml" | "html_doc" | "json";
  readonly authorised: true;
  readonly priority: number;                    // 1 = highest
  readonly policy: Partial<Omit<HostPolicy, "host">>;
  readonly notes: string;
}

// ── Registered sources ─────────────────────────────────────────────────

export const AUTHORISED_SOURCES: readonly AuthorisedSource[] = Object.freeze([
  {
    source_id: "arxiv-cs-se",
    source_class: "academic_publication",
    host: "export.arxiv.org",
    url_template: "https://export.arxiv.org/api/query?search_query=cat:cs.SE&start={start}&max_results={max_results}",
    params: { start: ["0", "5", "10"], max_results: ["5"] },
    access_method: "GET_HTTPS", parser_kind: "atom_xml", authorised: true, priority: 1,
    policy: { min_interval_ms: 3_000, initial_backoff_ms: 60_000 },
    notes: "arXiv API · Atom feed · rate-limited per arXiv terms",
  },
  {
    source_id: "arxiv-cs-dc",
    source_class: "academic_publication",
    host: "export.arxiv.org",
    url_template: "https://export.arxiv.org/api/query?search_query=cat:cs.DC&start={start}&max_results={max_results}",
    params: { start: ["0", "5"], max_results: ["5"] },
    access_method: "GET_HTTPS", parser_kind: "atom_xml", authorised: true, priority: 2,
    policy: { min_interval_ms: 3_000, initial_backoff_ms: 60_000 },
    notes: "arXiv distributed-computing category",
  },
  {
    source_id: "arxiv-cs-lg",
    source_class: "academic_publication",
    host: "export.arxiv.org",
    url_template: "https://export.arxiv.org/api/query?search_query=cat:cs.LG&start={start}&max_results={max_results}",
    params: { start: ["0", "5"], max_results: ["5"] },
    access_method: "GET_HTTPS", parser_kind: "atom_xml", authorised: true, priority: 3,
    policy: { min_interval_ms: 3_000, initial_backoff_ms: 60_000 },
    notes: "arXiv machine-learning category",
  },
  {
    source_id: "nodejs-blog-atom",
    source_class: "official_documentation",
    host: "nodejs.org",
    url_template: "https://nodejs.org/en/feed/blog.xml",
    params: {},
    access_method: "GET_HTTPS", parser_kind: "atom_xml", authorised: true, priority: 4,
    policy: { min_interval_ms: 60_000, initial_backoff_ms: 300_000 },
    notes: "Node.js official blog feed",
  },
  {
    source_id: "github-node-releases",
    source_class: "official_repository",
    host: "github.com",
    url_template: "https://github.com/nodejs/node/releases.atom",
    params: {},
    access_method: "GET_HTTPS", parser_kind: "atom_xml", authorised: true, priority: 5,
    policy: { min_interval_ms: 60_000, initial_backoff_ms: 300_000 },
    notes: "Node.js official releases feed",
  },
]);

// ── Source health tracking ─────────────────────────────────────────────

export interface SourceHealth {
  readonly source_id: string;
  requests_total: number;
  success_count: number;
  fail_429: number;
  fail_5xx: number;
  fail_timeout: number;
  fail_other: number;
  last_success_at: string | null;
  last_failure_at: string | null;
  cooling_off_until: string | null;
  average_latency_ms: number;
  latency_samples: number[];                     // last 10 samples
  last_updated_at: string;
}

const healthByCollection = new Map<string, SourceHealth>();

export function getSourceHealth(source_id: string): SourceHealth {
  let h = healthByCollection.get(source_id);
  if (!h) {
    h = {
      source_id, requests_total: 0, success_count: 0,
      fail_429: 0, fail_5xx: 0, fail_timeout: 0, fail_other: 0,
      last_success_at: null, last_failure_at: null, cooling_off_until: null,
      average_latency_ms: 0, latency_samples: [],
      last_updated_at: new Date().toISOString(),
    };
    healthByCollection.set(source_id, h);
  }
  return h;
}

export function recordSourceOutcome(input: {
  source_id: string;
  outcome: "OK" | "RATE_LIMITED_429" | "TRANSIENT_5XX" | "TIMEOUT" | "NETWORK_ERROR" | "OTHER";
  latency_ms: number;
  cooling_off_until?: string | null;
}): void {
  const h = getSourceHealth(input.source_id);
  h.requests_total++;
  const now = new Date().toISOString();
  h.last_updated_at = now;
  h.latency_samples.push(input.latency_ms);
  if (h.latency_samples.length > 10) h.latency_samples.shift();
  h.average_latency_ms = Math.round(h.latency_samples.reduce((s, v) => s + v, 0) / h.latency_samples.length);
  switch (input.outcome) {
    case "OK": h.success_count++; h.last_success_at = now; h.cooling_off_until = null; break;
    case "RATE_LIMITED_429": h.fail_429++; h.last_failure_at = now; if (input.cooling_off_until) h.cooling_off_until = input.cooling_off_until; break;
    case "TRANSIENT_5XX": h.fail_5xx++; h.last_failure_at = now; if (input.cooling_off_until) h.cooling_off_until = input.cooling_off_until; break;
    case "TIMEOUT": h.fail_timeout++; h.last_failure_at = now; break;
    default: h.fail_other++; h.last_failure_at = now; break;
  }
}

// ── Source rotation scheduler ──────────────────────────────────────────

function buildUrlForSource(s: AuthorisedSource, now: Date): string {
  const nowMs = now.getTime();
  const start = Array.isArray(s.params.start) ? s.params.start[nowMs % s.params.start.length] : (s.params.start ?? "0");
  const max_results = Array.isArray(s.params.max_results) ? s.params.max_results[0] : (s.params.max_results ?? "5");
  return s.url_template
    .replaceAll("{start}", String(start))
    .replaceAll("{max_results}", String(max_results));
}

/**
 * Founder-locked: return sources in priority order, skipping any whose
 * source-health is cooling off. Callers must ALSO check per-host rate
 * limiter before fetching — different sources may share a host.
 */
export function listEligibleSources(now: Date = new Date()): Array<{ source: AuthorisedSource; url: string }> {
  const nowMs = now.getTime();
  const eligible = AUTHORISED_SOURCES
    .filter((s) => {
      const h = healthByCollection.get(s.source_id);
      if (!h) return true;
      if (!h.cooling_off_until) return true;
      return Date.parse(h.cooling_off_until) < nowMs;
    })
    .sort((a, b) => a.priority - b.priority);
  return eligible.map((s) => ({ source: s, url: buildUrlForSource(s, now) }));
}

/** Convenience: highest-priority eligible source, or null. */
export function pickNextEligibleSource(now: Date = new Date()): { source: AuthorisedSource; url: string } | null {
  const list = listEligibleSources(now);
  return list[0] ?? null;
}

/** All eligible sources (for HQ display). */
export function listAllSourceHealth(): SourceHealth[] {
  const result: SourceHealth[] = [];
  for (const s of AUTHORISED_SOURCES) result.push(getSourceHealth(s.source_id));
  return result;
}
