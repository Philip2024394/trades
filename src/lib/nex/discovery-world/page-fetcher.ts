// src/lib/nex/discovery-world/page-fetcher.ts
//
// NEX World Email Intelligence · Part 4/6 · PageFetcher abstraction
// Founder-authorised programme · session-2 · 2026-09-21.
//
// **HARD GOVERNANCE BOUNDARY**: this file defines an INTERFACE.
// The walker + extractor NEVER call `fetch()` directly. Every network
// access flows through an injected PageFetcher. Production fetchers
// route through Wave 3.3 `discoverAndFetch` which enforces:
//   * robots.txt (RFC 9309 hard-gate)
//   * politeness / rate-limits / adaptive throttling
//   * allowlist (M26-signed authority for production hosts)
//   * evidence records + provenance
//   * conditional-fetch + freshness
//
// Test fetchers are in-memory fixtures. The walker's tests exercise the
// full logic without any network call.
//
// Doctrine correction preserved: "continuous permitted public evidence
// discovery, not unlimited harvesting." A PageFetcher may legitimately
// return `blocked_by_governance` for a URL not on the allowlist.

export type FetchOutcomeKind =
  | "responded"                   // 2xx · body available
  | "responded_zero"               // 200 · body empty
  | "not_modified"                 // 304 · cache still valid
  | "not_found"                    // 404 · resource absent
  | "unavailable"                  // network / timeout / DNS
  | "rate_limited"                 // 429 or backoff signalled
  | "robots_denied"                // robots.txt disallow
  | "blocked_by_governance"        // allowlist / policy refusal
  | "parse_error";                 // response fetched but unusable

export interface FetchInput {
  readonly url: string;
  readonly deadline_ms?: number;
  readonly if_none_match?: string;
  readonly if_modified_since?: string;
}

export interface FetchResult {
  readonly kind: FetchOutcomeKind;
  readonly url_final: string;                  // after redirects
  readonly status_code: number | null;
  readonly bytes: number;
  readonly ms: number;
  readonly content_type: string | null;
  readonly html: string | null;                 // present only on 'responded'
  readonly etag: string | null;
  readonly last_modified: string | null;
  readonly note: string | null;                 // human-readable diagnostic
}

/** The single production seam. Nothing in this module ever calls fetch()
 *  itself. A concrete implementation is injected at the cron edge. */
export interface PageFetcher {
  readonly source_id: string;                   // e.g. "wave-3-discover-and-fetch"
  fetchPage(input: FetchInput): Promise<FetchResult>;
}

// ─── Default null-safe fetcher · fails closed with blocked_by_governance ─
/** When no production fetcher is configured, every URL is refused. This
 *  is the correct default: NEX never fetches a URL just because someone
 *  handed it one. Allowlist expansion is a Founder decision. */
export const NULL_FETCHER: PageFetcher = {
  source_id: "null-fetcher",
  async fetchPage(input) {
    return {
      kind: "blocked_by_governance",
      url_final: input.url,
      status_code: null,
      bytes: 0,
      ms: 0,
      content_type: null,
      html: null,
      etag: null,
      last_modified: null,
      note: "no production page fetcher configured · allowlist expansion is a Founder decision",
    };
  },
};

// ─── Test fixture fetcher · used only by acceptance ──────────────────
export interface FixturePage {
  readonly url: string;
  readonly html: string;
  readonly content_type?: string;
  readonly etag?: string;
  readonly last_modified?: string;
}

export function makeFixtureFetcher(pages: ReadonlyArray<FixturePage>, opts: { source_id?: string; latency_ms?: number } = {}): PageFetcher {
  const byUrl = new Map<string, FixturePage>();
  for (const p of pages) byUrl.set(normalizeFixtureUrl(p.url), p);
  return {
    source_id: opts.source_id ?? "fixture",
    async fetchPage(input) {
      const key = normalizeFixtureUrl(input.url);
      const hit = byUrl.get(key);
      if (!hit) {
        return { kind: "not_found", url_final: input.url, status_code: 404, bytes: 0, ms: opts.latency_ms ?? 0, content_type: null, html: null, etag: null, last_modified: null, note: "fixture: not defined" };
      }
      return {
        kind: "responded",
        url_final: hit.url,
        status_code: 200,
        bytes: Buffer.byteLength(hit.html, "utf8"),
        ms: opts.latency_ms ?? 0,
        content_type: hit.content_type ?? "text/html; charset=utf-8",
        html: hit.html,
        etag: hit.etag ?? null,
        last_modified: hit.last_modified ?? null,
        note: null,
      };
    },
  };
}

function normalizeFixtureUrl(u: string): string {
  try {
    const url = new URL(u);
    return `${url.protocol}//${url.hostname}${url.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch { return u.toLowerCase().replace(/\/$/, ""); }
}
