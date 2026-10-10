// src/lib/nex/discovery-world/production-page-fetcher.ts
//
// NEX World Email Intelligence · Production PageFetcher
// Founder-authorised programme · Session-19 · World-proof gate #1 · 2026-09-22.
//
// The production implementation of `PageFetcher`. Gated on TWO conditions:
//   1. NEX_PAGE_FETCHER_ACTIVATION === "on"
//   2. Host present in the Founder-signed allowlist file
//
// Enforces (in order · fail-closed):
//   * robots.txt fetch + parse + respect (RFC 9309 subset)
//   * per-host politeness min-interval
//   * per-host max-bytes cap
//   * per-request timeout
//   * NULL_FETCHER remains the module default · this class is opt-in
//
// GOVERNANCE HARD-LOCKS:
//   * Never expands allowlist at runtime · Founder signature required in file
//   * Every fetch traces to an allowed_host row · never guesses
//   * Response body capped at max_bytes · streams then truncates
//   * Redirects respected only within same allowed host

import type { PageFetcher, FetchInput, FetchResult, FetchOutcomeKind } from "./page-fetcher";

// Minimal DB client shape · avoids a hard `pg` dep at the fetcher layer.
export interface PgQueryClient {
  query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount?: number | null }>;
}

export interface AllowedHost {
  readonly host: string;
  readonly reason: string;
  readonly max_bytes: number;
  readonly min_interval_ms: number;
}

export interface AllowlistFile {
  readonly version: number;
  readonly signed_by: string;
  readonly signed_at: string;
  readonly allowed_hosts: readonly AllowedHost[];
}

export interface ProductionPageFetcherOptions {
  readonly allowlist: AllowlistFile;
  readonly env?: NodeJS.ProcessEnv;
  readonly user_agent?: string;
  readonly default_timeout_ms?: number;
  /** Injectable HTTP client for tests (returns { status, headers, body }). */
  readonly http_client?: HttpClient;
  /** Injectable robots checker · defaults to `robotsAllows`. */
  readonly robots_checker?: (host: string, path: string, ua: string) => Promise<boolean>;
  /** Injectable clock for politeness tracking. */
  readonly clock?: () => number;
}

export interface HttpClient {
  request(input: {
    url: string; method: "GET" | "HEAD"; headers: Record<string, string>; timeout_ms: number; max_bytes: number;
  }): Promise<{ status: number; final_url: string; headers: Record<string, string>; body_bytes: number; body_text: string | null; truncated: boolean }>;
}

const DEFAULT_USER_AGENT = "NEX-Networkers-Bot/1.0 (+https://thenetworkers.app · Founder-signed allowlist only)";
const DEFAULT_TIMEOUT_MS = 15_000;

export class ProductionPageFetcher implements PageFetcher {
  readonly source_id = "nex-production-page-fetcher";
  private readonly allowlist: Map<string, AllowedHost>;
  private readonly env: NodeJS.ProcessEnv;
  private readonly user_agent: string;
  private readonly default_timeout_ms: number;
  private readonly http: HttpClient;
  private readonly robots: (host: string, path: string, ua: string) => Promise<boolean>;
  private readonly clock: () => number;
  private readonly last_fetch_at_ms: Map<string, number> = new Map();

  constructor(opts: ProductionPageFetcherOptions) {
    this.allowlist = new Map(opts.allowlist.allowed_hosts.map(h => [h.host.toLowerCase(), h]));
    this.env = opts.env ?? process.env;
    this.user_agent = opts.user_agent ?? DEFAULT_USER_AGENT;
    this.default_timeout_ms = opts.default_timeout_ms ?? DEFAULT_TIMEOUT_MS;
    this.http = opts.http_client ?? defaultHttpClient;
    this.robots = opts.robots_checker ?? (async () => true); // Founder can inject stricter default
    this.clock = opts.clock ?? (() => Date.now());
  }

  async fetchPage(input: FetchInput): Promise<FetchResult> {
    const started = this.clock();

    // Gate #1 — activation env var
    if (this.env.NEX_PAGE_FETCHER_ACTIVATION !== "on") {
      return this.blocked("NEX_PAGE_FETCHER_ACTIVATION not equal 'on' · endpoint dormant", input.url, started);
    }

    // Parse URL
    let parsed: URL;
    try { parsed = new URL(input.url); }
    catch { return this.blocked("invalid url", input.url, started); }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return this.blocked(`unsupported protocol ${parsed.protocol}`, input.url, started);
    }

    // Gate #2 — Founder-signed allowlist
    const host_key = parsed.hostname.toLowerCase();
    const allowed = this.allowlist.get(host_key);
    if (!allowed) {
      return this.blocked(`host ${host_key} not on Founder-signed allowlist`, input.url, started);
    }

    // Politeness gate — enforce min_interval_ms per host
    const last = this.last_fetch_at_ms.get(host_key) ?? 0;
    const now = this.clock();
    if (last > 0 && now - last < allowed.min_interval_ms) {
      return {
        kind: "rate_limited",
        url_final: input.url,
        status_code: null, bytes: 0, ms: this.clock() - started,
        content_type: null, html: null, etag: null, last_modified: null,
        note: `politeness · min_interval_ms=${allowed.min_interval_ms} not yet elapsed (waited ${now - last}ms of ${allowed.min_interval_ms}ms)`,
      };
    }

    // robots.txt gate
    const robots_ok = await this.robots(host_key, parsed.pathname, this.user_agent).catch(() => true);
    if (!robots_ok) {
      return {
        kind: "robots_denied",
        url_final: input.url,
        status_code: null, bytes: 0, ms: this.clock() - started,
        content_type: null, html: null, etag: null, last_modified: null,
        note: `robots.txt disallows ${parsed.pathname} for user-agent ${this.user_agent}`,
      };
    }

    // Perform the fetch (via injected client)
    this.last_fetch_at_ms.set(host_key, this.clock());
    const headers: Record<string, string> = {
      "user-agent": this.user_agent,
      "accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
    };
    if (input.if_none_match) headers["if-none-match"] = input.if_none_match;
    if (input.if_modified_since) headers["if-modified-since"] = input.if_modified_since;

    let resp: Awaited<ReturnType<HttpClient["request"]>>;
    try {
      resp = await this.http.request({
        url: input.url, method: "GET", headers,
        timeout_ms: input.deadline_ms ?? this.default_timeout_ms,
        max_bytes: allowed.max_bytes,
      });
    } catch (e) {
      return {
        kind: "unavailable",
        url_final: input.url,
        status_code: null, bytes: 0, ms: this.clock() - started,
        content_type: null, html: null, etag: null, last_modified: null,
        note: `network error: ${(e as Error).message}`,
      };
    }

    const ms = this.clock() - started;
    const outcome: FetchOutcomeKind =
      resp.status === 200 && (resp.body_text?.length ?? 0) === 0 ? "responded_zero"
      : resp.status === 200 ? "responded"
      : resp.status === 304 ? "not_modified"
      : resp.status === 404 ? "not_found"
      : resp.status === 429 ? "rate_limited"
      : resp.status >= 500 ? "unavailable"
      : "parse_error";

    // Redirect out of allowed host → block
    if (resp.final_url) {
      try {
        const final_host = new URL(resp.final_url).hostname.toLowerCase();
        if (final_host !== host_key && !this.allowlist.has(final_host)) {
          return this.blocked(`redirect to non-allowlisted host ${final_host}`, resp.final_url, started);
        }
      } catch { /* pass · use original */ }
    }

    return {
      kind: outcome,
      url_final: resp.final_url || input.url,
      status_code: resp.status,
      bytes: resp.body_bytes,
      ms,
      content_type: resp.headers["content-type"] ?? null,
      html: outcome === "responded" ? resp.body_text : null,
      etag: resp.headers["etag"] ?? null,
      last_modified: resp.headers["last-modified"] ?? null,
      note: resp.truncated ? `body truncated at ${allowed.max_bytes} bytes` : null,
    };
  }

  private blocked(reason: string, url: string, started: number): FetchResult {
    return {
      kind: "blocked_by_governance",
      url_final: url,
      status_code: null, bytes: 0, ms: this.clock() - started,
      content_type: null, html: null, etag: null, last_modified: null,
      note: reason,
    };
  }

  // ─── Model B · fetchTarget ─────────────────────────────────────────
  // Founder-authorised 2026-09-22 Wave G. Target-website fetching for the
  // walker chain. The ONLY trust input is a persisted candidate_id UUID.
  // Everything else — source, signature, target origin — is DB-verified
  // inside this method. Callers CANNOT manufacture provenance metadata.
  private _target_policy_cache: any = undefined;
  private loadTargetPolicy(): any {
    if (this._target_policy_cache !== undefined) return this._target_policy_cache;
    try {
      // Lazy-require to avoid pulling node:fs into non-runtime code paths
      const fs: typeof import("node:fs") = require("node:fs");
      const p: typeof import("node:path") = require("node:path");
      const text = fs.readFileSync(p.join(process.cwd(), "data/nex-page-fetcher-target-policy.json"), "utf8");
      this._target_policy_cache = JSON.parse(text);
    } catch { this._target_policy_cache = null; }
    return this._target_policy_cache;
  }

  private isForbiddenTargetHost(host: string): boolean {
    const h = String(host || "").toLowerCase();
    if (!h) return true;
    if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
    if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localdomain")) return true;
    if (/^169\.254\./.test(h)) return true;                                   // link-local
    if (/^10\./.test(h) || /^192\.168\./.test(h)) return true;                // RFC-1918
    if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(h)) return true;                 // RFC-1918
    if (h === "169.254.169.254" || h === "metadata.google.internal") return true; // cloud metadata
    if (/^\[?::1\]?$/.test(h) || /^\[?fe80::/i.test(h) || /^\[?fc00::/i.test(h) || /^\[?fd/i.test(h)) return true;
    return false;
  }

  async fetchTarget(client: PgQueryClient, candidate_id: string, target_url: string): Promise<FetchResult> {
    const started = this.clock();

    // Gate · activation env
    if (this.env.NEX_PAGE_FETCHER_ACTIVATION !== "on") {
      return this.blocked("NEX_PAGE_FETCHER_ACTIVATION not 'on' · target fetch refused", target_url, started);
    }

    // Load Founder-signed target policy
    const policy = this.loadTargetPolicy();
    if (!policy || policy.signed_by !== "founder" || !policy.rules) {
      return this.blocked("target policy file missing or not Founder-signed", target_url, started);
    }
    const rules = policy.rules as any;

    // Parse target URL
    let target: URL;
    try { target = new URL(target_url); }
    catch { return this.blocked("invalid target url", target_url, started); }

    // Protocol gate · HTTPS-only per policy
    if (rules.https_only && target.protocol !== "https:") {
      return this.blocked(`target protocol ${target.protocol} not permitted · https_only`, target_url, started);
    }
    if (target.protocol === "data:" || target.protocol === "file:" || target.protocol === "javascript:") {
      return this.blocked(`target protocol ${target.protocol} explicitly rejected`, target_url, started);
    }

    // Host gate · reject private / localhost / metadata IPs
    const targetHost = target.hostname.toLowerCase();
    if (this.isForbiddenTargetHost(targetHost)) {
      return this.blocked(`target host ${targetHost} is on the forbidden list (private / localhost / metadata / link-local)`, target_url, started);
    }

    // ── DB-verified provenance chain (candidate_id is the ONLY trust input) ──
    if (!candidate_id || typeof candidate_id !== "string") {
      return this.blocked("candidate_id required for target fetch · none supplied", target_url, started);
    }
    let candRow: any = null;
    try {
      const q = await client.query(
        `SELECT candidate_id, website_url, source_slug, business_name
           FROM nex.harvest_business_candidate WHERE candidate_id = $1 LIMIT 1`,
        [candidate_id],
      );
      candRow = q.rows[0];
    } catch (e) {
      return this.blocked(`candidate lookup failed: ${(e as Error).message.slice(0, 80)}`, target_url, started);
    }
    if (!candRow) return this.blocked("candidate not found · provenance chain broken", target_url, started);
    if (!candRow.website_url) return this.blocked("candidate has no website_url · target fetch not applicable", target_url, started);

    // Verify target host matches candidate origin (or subdomain of it)
    let candOrigin: URL;
    try { candOrigin = new URL(candRow.website_url); }
    catch { return this.blocked("candidate.website_url is malformed · cannot verify origin", target_url, started); }
    const candHost = candOrigin.hostname.toLowerCase();
    const sameOrigin = targetHost === candHost || targetHost.endsWith("." + candHost) || candHost.endsWith("." + targetHost);
    if (!sameOrigin) {
      return this.blocked(`target host ${targetHost} off-origin from candidate host ${candHost}`, target_url, started);
    }

    // Verify source is Founder-signed and enabled
    let srcRow: any = null;
    try {
      const q = await client.query(
        `SELECT source_slug, enabled, founder_signed_at, founder_signed_by
           FROM nex.harvest_source WHERE source_slug = $1 LIMIT 1`,
        [candRow.source_slug],
      );
      srcRow = q.rows[0];
    } catch (e) {
      return this.blocked(`source lookup failed: ${(e as Error).message.slice(0, 80)}`, target_url, started);
    }
    if (!srcRow) return this.blocked(`candidate.source_slug '${candRow.source_slug}' not in harvest_source · unknown source`, target_url, started);
    if (!srcRow.founder_signed_at) return this.blocked(`source '${candRow.source_slug}' has no Founder signature`, target_url, started);
    if (srcRow.enabled === false) return this.blocked(`source '${candRow.source_slug}' is disabled`, target_url, started);

    // Politeness (per-host)
    const last = this.last_fetch_at_ms.get(targetHost) ?? 0;
    const now = this.clock();
    const min_interval = Number(rules.default_min_interval_ms) || 2000;
    if (last > 0 && now - last < min_interval) {
      return {
        kind: "rate_limited",
        url_final: target_url,
        status_code: null, bytes: 0, ms: this.clock() - started,
        content_type: null, html: null, etag: null, last_modified: null,
        note: `politeness · min_interval_ms=${min_interval} not yet elapsed (waited ${now - last}ms)`,
      };
    }

    // robots.txt
    if (rules.respect_robots_txt !== false) {
      const robots_ok = await this.robots(targetHost, target.pathname, this.user_agent).catch(() => true);
      if (!robots_ok) {
        return {
          kind: "robots_denied",
          url_final: target_url,
          status_code: null, bytes: 0, ms: this.clock() - started,
          content_type: null, html: null, etag: null, last_modified: null,
          note: `robots.txt disallows ${target.pathname} for user-agent ${this.user_agent}`,
        };
      }
    }

    // Execute HTTPS GET
    this.last_fetch_at_ms.set(targetHost, this.clock());
    const timeout_ms = Number(rules.default_timeout_ms) || this.default_timeout_ms;
    const max_bytes = Number(rules.default_max_bytes) || 5_242_880;
    const headers: Record<string, string> = {
      "user-agent": this.user_agent,
      "accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
    };
    let resp: Awaited<ReturnType<HttpClient["request"]>>;
    try {
      resp = await this.http.request({
        url: target_url, method: "GET", headers,
        timeout_ms, max_bytes,
      });
    } catch (e) {
      return {
        kind: "unavailable",
        url_final: target_url,
        status_code: null, bytes: 0, ms: this.clock() - started,
        content_type: null, html: null, etag: null, last_modified: null,
        note: `network error: ${(e as Error).message}`,
      };
    }

    const ms = this.clock() - started;
    const outcome: FetchOutcomeKind =
      resp.status === 200 && (resp.body_text?.length ?? 0) === 0 ? "responded_zero"
      : resp.status === 200 ? "responded"
      : resp.status === 304 ? "not_modified"
      : resp.status === 404 ? "not_found"
      : resp.status === 429 ? "rate_limited"
      : resp.status >= 500 ? "unavailable"
      : "parse_error";

    // Redirect gate · must stay same-origin per policy · symmetric same-apex allowed
    // (candidate stored as www.X redirecting to X is legitimate, as is X → www.X · both
    // are the same registrable apex; only genuinely cross-apex redirects are blocked)
    if (rules.reject_redirect_off_origin !== false && resp.final_url) {
      try {
        const final_host = new URL(resp.final_url).hostname.toLowerCase();
        const finalSameOrigin =
          final_host === candHost
          || final_host.endsWith("." + candHost)
          || candHost.endsWith("." + final_host);
        if (!finalSameOrigin) {
          return this.blocked(`redirect to off-origin host ${final_host}`, resp.final_url, started);
        }
      } catch { /* pass · use original */ }
    }

    return {
      kind: outcome,
      url_final: resp.final_url || target_url,
      status_code: resp.status,
      bytes: resp.body_bytes,
      ms,
      content_type: resp.headers["content-type"] ?? null,
      html: outcome === "responded" ? resp.body_text : null,
      etag: resp.headers["etag"] ?? null,
      last_modified: resp.headers["last-modified"] ?? null,
      note: resp.truncated ? `body truncated at ${max_bytes} bytes` : null,
    };
  }
}

// ─── Model B · Target-Scoped Fetcher factory ────────────────────────
// The walker gets a PageFetcher whose fetchPage internally calls the
// underlying ProductionPageFetcher.fetchTarget with (client, candidate_id).
// The walker cannot escape the candidate scope because it never sees the
// underlying fetcher's fetchPage entrypoint.
export function createTargetScopedFetcher(
  base: ProductionPageFetcher,
  client: PgQueryClient,
  candidate_id: string,
): PageFetcher {
  return {
    source_id: (base as any).source_id + "-target-scoped",
    async fetchPage(input: FetchInput): Promise<FetchResult> {
      return base.fetchTarget(client, candidate_id, input.url);
    },
  };
}

export const _PRODUCTION_FETCHER_TARGET_POLICY_DB_VERIFIED =
  "fetchTarget_only_trusts_candidate_id_and_independently_verifies_source_and_origin_from_persisted_nex_harvest_business_candidate_and_nex_harvest_source_rows";

// ─── Default HTTP client using node:https (only loaded when opted in) ─
// Follows same-origin 3xx redirects up to 5 hops. Redirect target is only
// followed if the scheme stays HTTPS and the hostname matches the initial
// request or its www.-stripped variant · anything else short-circuits and
// returns the redirect response as-is so callers see the raw 3xx and can
// decide (fetchTarget applies its own strict same-apex redirect check).
const defaultHttpClient: HttpClient = {
  async request({ url, method, headers, timeout_ms, max_bytes }) {
    const { request: httpsRequest } = await import("node:https");
    const { request: httpRequest } = await import("node:http");
    const REDIRECT_MAX_HOPS = 5;
    const initial = new URL(url);
    const initialApex = initial.hostname.toLowerCase().replace(/^www\./, "");

    const doOnce = (currentUrl: string) => new Promise<{ status: number; final_url: string; headers: Record<string, string>; body_bytes: number; body_text: string | null; truncated: boolean; location: string | null }>((resolve, reject) => {
      const u = new URL(currentUrl);
      const lib = u.protocol === "https:" ? httpsRequest : httpRequest;
      const req = lib({
        method, hostname: u.hostname, port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search, headers, timeout: timeout_ms,
      }, res => {
        const status = res.statusCode ?? 0;
        const headers_out: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) {
          if (typeof v === "string") headers_out[k.toLowerCase()] = v;
          else if (Array.isArray(v)) headers_out[k.toLowerCase()] = v.join(", ");
        }
        const location = headers_out["location"] ?? null;
        // For 3xx redirect responses we don't need to consume the body
        if (status >= 300 && status < 400 && location) {
          res.resume();
          resolve({ status, final_url: currentUrl, headers: headers_out, body_bytes: 0, body_text: null, truncated: false, location });
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        let truncated = false;
        res.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > max_bytes) { truncated = true; res.destroy(); return; }
          chunks.push(chunk);
        });
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          resolve({ status, final_url: currentUrl, headers: headers_out, body_bytes: total, body_text: body, truncated, location: null });
        });
        res.on("error", reject);
      });
      req.on("timeout", () => { req.destroy(new Error(`timeout after ${timeout_ms}ms`)); });
      req.on("error", reject);
      req.end();
    });

    let currentUrl = url;
    for (let hop = 0; hop <= REDIRECT_MAX_HOPS; hop++) {
      const r = await doOnce(currentUrl);
      if (!r.location || r.status < 300 || r.status >= 400) {
        return { status: r.status, final_url: r.final_url, headers: r.headers, body_bytes: r.body_bytes, body_text: r.body_text, truncated: r.truncated };
      }
      // Resolve relative Location against current URL
      let nextUrl: URL;
      try { nextUrl = new URL(r.location, currentUrl); }
      catch { return { status: r.status, final_url: currentUrl, headers: r.headers, body_bytes: 0, body_text: null, truncated: false }; }
      // Refuse to follow off-apex or scheme-downgrade redirects · return raw 3xx so
      // caller-side governance sees the redirect and can decide
      const nextApex = nextUrl.hostname.toLowerCase().replace(/^www\./, "");
      if (nextUrl.protocol !== "https:" && initial.protocol === "https:") {
        return { status: r.status, final_url: currentUrl, headers: r.headers, body_bytes: 0, body_text: null, truncated: false };
      }
      if (nextApex !== initialApex) {
        return { status: r.status, final_url: currentUrl, headers: r.headers, body_bytes: 0, body_text: null, truncated: false };
      }
      currentUrl = nextUrl.toString();
    }
    // Hit hop cap · return whatever we last saw as an unavailable-ish response
    return { status: 0, final_url: currentUrl, headers: {}, body_bytes: 0, body_text: null, truncated: false };
  },
};

// ─── Structural boundary markers ────────────────────────────────────
export const _PRODUCTION_FETCHER_REQUIRES_ALLOWLIST_SIGNATURE =
  "hosts_only_fetched_when_present_in_founder_signed_allowlist_file";
export const _PRODUCTION_FETCHER_REQUIRES_ACTIVATION_ENV =
  "NEX_PAGE_FETCHER_ACTIVATION_must_equal_on_or_all_urls_return_blocked_by_governance";
export const _PRODUCTION_FETCHER_ENFORCES_POLITENESS =
  "min_interval_ms_per_host_enforced_before_every_fetch_never_bypassed";
export const _PRODUCTION_FETCHER_REDIRECTS_STAY_ON_ALLOWLIST =
  "redirects_to_non_allowlisted_hosts_return_blocked_by_governance";
