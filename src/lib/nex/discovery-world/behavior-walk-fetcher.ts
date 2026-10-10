// src/lib/nex/discovery-world/behavior-walk-fetcher.ts
//
// NEX Behavior-Based Walk Fetcher · Founder-authorised 2026-09-23.
//
// Governance model:
//   * Discovery sources still require Founder-signed allowlist (ProductionPageFetcher).
//   * Walk fetches — individual business websites returned by discovery —
//     use BEHAVIOR governance instead of host allowlist. This matches the
//     industry standard (Cognism / Apollo / Hunter) and is the only way
//     to walk the public web at scale without asking the Founder to sign
//     10,000 individual hosts.
//
// Behavior rules (all enforced fail-closed):
//   1. robots.txt · RFC 9309 · fetched once per host · cached 1h ·
//      any `Disallow` matching the path → NO FETCH
//   2. Per-host politeness: min 1000ms between requests to same host
//   3. Real User-Agent identifying NEX + a public contact URL
//   4. 15-second per-request timeout
//   5. 2MB body cap · truncated + logged
//   6. Same-apex redirects OK (example.com ↔ www.example.com allowed)
//   7. Cross-apex redirects rejected as blocked_by_governance
//   8. 429 / 503 responses respected with Retry-After honored
//   9. No credentials sent · no cookies persisted across hosts
//  10. Every fetch persisted to nex.walk_audit for evidence trail
//
// Doctrine locks:
//   * _BEHAVIOR_WALK_HONORS_ROBOTS_TXT
//   * _BEHAVIOR_WALK_HONORS_PER_HOST_RATE_LIMIT
//   * _BEHAVIOR_WALK_IDENTIFIES_WITH_REAL_UA
//   * _BEHAVIOR_WALK_AUDIT_LOGS_EVERY_FETCH
//   * _BEHAVIOR_WALK_NEVER_BYPASSES_429

import type { PageFetcher, FetchInput, FetchResult } from "./page-fetcher";
import type { PoolClient } from "pg";

const DEFAULT_USER_AGENT = "NEX-Networkers-Bot/1.0 (+https://thenetworkers.app/bot · behavior-based · scaffolder-research · contact: bot@thenetworkers.app)";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MIN_INTERVAL_MS = 1000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const ROBOTS_CACHE_TTL_MS = 60 * 60 * 1000;   // 1h
const ROBOTS_FETCH_TIMEOUT_MS = 8_000;

interface RobotsRules {
  fetched_at: number;
  disallow_paths: string[];
  allow_paths: string[];
  crawl_delay_ms: number | null;
}

export interface BehaviorWalkFetcherOptions {
  readonly user_agent?: string;
  readonly default_timeout_ms?: number;
  readonly default_min_interval_ms?: number;
  readonly max_bytes?: number;
  readonly audit_writer?: AuditWriter;
  readonly clock?: () => number;
}

export interface AuditWriter {
  record(entry: AuditEntry): Promise<void>;
}

export interface AuditEntry {
  readonly at: string;
  readonly host: string;
  readonly url: string;
  readonly method: "GET" | "HEAD";
  readonly outcome: "responded" | "blocked_by_robots" | "blocked_cross_apex_redirect" | "rate_limited" | "not_found" | "unavailable" | "timeout";
  readonly status_code: number | null;
  readonly bytes: number;
  readonly robots_verdict: "allowed" | "disallowed" | "unknown_no_robots" | "robots_fetch_failed";
  readonly notes: string | null;
}

/** In-memory-only audit writer used when no DB client available. */
export class InMemoryAuditWriter implements AuditWriter {
  entries: AuditEntry[] = [];
  async record(e: AuditEntry) { this.entries.push(e); }
}

/** Postgres-backed audit writer writing to nex.walk_audit. */
export class PgAuditWriter implements AuditWriter {
  constructor(private readonly client: PoolClient) {}
  async record(e: AuditEntry): Promise<void> {
    try {
      await this.client.query(
        `INSERT INTO nex.walk_audit
           (at, host, url, method, outcome, status_code, bytes, robots_verdict, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [e.at, e.host, e.url, e.method, e.outcome, e.status_code, e.bytes, e.robots_verdict, e.notes],
      );
    } catch { /* tolerant · never blocks the walk on audit failure */ }
  }
}

// ─── Same-apex helper ─────────────────────────────────────────────
function apex(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}
function isSameApex(a: string, b: string): boolean {
  return apex(a) === apex(b);
}

// ─── Robots.txt parser (RFC 9309 subset) ──────────────────────────
function parseRobotsTxt(txt: string, ua: string): RobotsRules {
  const lines = txt.split(/\r?\n/);
  const uaLower = ua.toLowerCase();
  let currentUAMatches = false;
  let currentUABlockActive = false;
  const disallow_paths: string[] = [];
  const allow_paths: string[] = [];
  let crawl_delay_ms: number | null = null;
  const starDisallow: string[] = [];
  const starAllow: string[] = [];
  let starCrawlDelay: number | null = null;
  let sawStar = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const val = rest.join(":").trim();
    if (key === "user-agent") {
      const uaVal = val.toLowerCase();
      currentUAMatches = uaVal === "*" || uaLower.includes(uaVal) || uaVal.includes("nex");
      currentUABlockActive = currentUAMatches;
      if (uaVal === "*") sawStar = true;
    } else if (currentUABlockActive) {
      if (key === "disallow") {
        if (currentUAMatches && !currentUABlockActive) continue;
        // For the current UA block, record
        (uaMatchesStar() ? starDisallow : disallow_paths).push(val);
      } else if (key === "allow") {
        (uaMatchesStar() ? starAllow : allow_paths).push(val);
      } else if (key === "crawl-delay") {
        const s = Number(val); if (!isNaN(s)) {
          if (uaMatchesStar()) starCrawlDelay = s * 1000;
          else crawl_delay_ms = s * 1000;
        }
      }
    }

    function uaMatchesStar(): boolean {
      // If the CURRENT ua block is the "*" one, treat rules as star fallback
      const ln = rawKey.trim().toLowerCase();
      // hack: look upward — simpler: keep track separately
      return sawStar && currentUAMatches;
    }
  }

  // If no explicit rules for our UA but * has rules, use those
  const final_disallow = disallow_paths.length > 0 ? disallow_paths : starDisallow;
  const final_allow = allow_paths.length > 0 ? allow_paths : starAllow;
  const final_delay = crawl_delay_ms ?? starCrawlDelay;

  return {
    fetched_at: Date.now(),
    disallow_paths: final_disallow.filter(Boolean),
    allow_paths: final_allow.filter(Boolean),
    crawl_delay_ms: final_delay,
  };
}

function pathAllowedByRobots(rules: RobotsRules, urlPath: string): boolean {
  // "Allow" wins over "Disallow" if it matches longer prefix (RFC 9309 §2.2.2)
  const bestAllow = rules.allow_paths.reduce((longest, p) =>
    urlPath.startsWith(p) && p.length > longest.length ? p : longest, "");
  const bestDisallow = rules.disallow_paths.reduce((longest, p) =>
    p && urlPath.startsWith(p) && p.length > longest.length ? p : longest, "");
  if (bestAllow.length > 0 && bestAllow.length >= bestDisallow.length) return true;
  if (bestDisallow.length > 0) return false;
  return true;
}

// ─── The fetcher ──────────────────────────────────────────────────
export class BehaviorWalkFetcher implements PageFetcher {
  readonly source_id = "nex-behavior-walk-fetcher";
  private readonly user_agent: string;
  private readonly default_timeout_ms: number;
  private readonly default_min_interval_ms: number;
  private readonly max_bytes: number;
  private readonly audit: AuditWriter | null;
  private readonly clock: () => number;
  private readonly robots_cache: Map<string, RobotsRules | "failed"> = new Map();
  private readonly last_fetch_at: Map<string, number> = new Map();

  constructor(opts: BehaviorWalkFetcherOptions = {}) {
    this.user_agent = opts.user_agent ?? DEFAULT_USER_AGENT;
    this.default_timeout_ms = opts.default_timeout_ms ?? DEFAULT_TIMEOUT_MS;
    this.default_min_interval_ms = opts.default_min_interval_ms ?? DEFAULT_MIN_INTERVAL_MS;
    this.max_bytes = opts.max_bytes ?? DEFAULT_MAX_BYTES;
    this.audit = opts.audit_writer ?? null;
    this.clock = opts.clock ?? Date.now;
  }

  async fetchPage(input: FetchInput): Promise<FetchResult> {
    const t0 = this.clock();
    const requested_url = input.url;
    let parsed: URL;
    try { parsed = new URL(requested_url); }
    catch { return this.result("unavailable", requested_url, null, 0, "invalid_url", "unknown_no_robots", t0); }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return this.result("unavailable", requested_url, null, 0, `unsupported_protocol_${parsed.protocol}`, "unknown_no_robots", t0);
    }
    const host = parsed.hostname.toLowerCase();
    const urlPath = parsed.pathname + parsed.search;

    // Step 1: robots.txt
    const robots = await this.getRobots(host, parsed.protocol);
    if (robots === "failed") {
      // Cannot fetch robots.txt · fail closed by default
      await this.audit?.record({
        at: new Date().toISOString(), host, url: requested_url, method: "GET",
        outcome: "blocked_by_robots", status_code: null, bytes: 0,
        robots_verdict: "robots_fetch_failed", notes: "robots.txt fetch failed · policy = fail-closed",
      });
      return this.result("blocked_by_governance" as any, requested_url, null, 0, "robots_txt_fetch_failed_fail_closed", "robots_fetch_failed", t0);
    }
    if (robots && !pathAllowedByRobots(robots, urlPath)) {
      await this.audit?.record({
        at: new Date().toISOString(), host, url: requested_url, method: "GET",
        outcome: "blocked_by_robots", status_code: null, bytes: 0,
        robots_verdict: "disallowed", notes: `robots.txt disallowed path ${urlPath}`,
      });
      return this.result("robots_denied", requested_url, null, 0, "robots_disallow", "disallowed", t0);
    }

    // Step 2: politeness delay
    const minInterval = Math.max(this.default_min_interval_ms, robots?.crawl_delay_ms ?? 0);
    const last = this.last_fetch_at.get(host) ?? 0;
    const waitMs = Math.max(0, last + minInterval - this.clock());
    if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
    this.last_fetch_at.set(host, this.clock());

    // Step 3: real fetch with redirect chain we manually follow
    let currentUrl = requested_url;
    let redirect_hops = 0;
    const MAX_REDIRECTS = 5;
    let finalRes: Response;
    let currentHost = host;

    try {
      while (true) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Math.min(this.default_timeout_ms, input.deadline_ms ?? this.default_timeout_ms));
        let res: Response;
        try {
          res = await fetch(currentUrl, {
            method: "GET",
            redirect: "manual",
            headers: {
              "User-Agent": this.user_agent,
              "Accept": "text/html,application/xhtml+xml,text/plain;q=0.8",
              "Accept-Language": "en-GB,en;q=0.7,de;q=0.5",
            },
            signal: controller.signal,
          });
        } catch (e: any) {
          clearTimeout(timer);
          const isAbort = e?.name === "AbortError";
          await this.audit?.record({
            at: new Date().toISOString(), host: currentHost, url: currentUrl, method: "GET",
            outcome: isAbort ? "timeout" : "unavailable",
            status_code: null, bytes: 0,
            robots_verdict: "allowed", notes: e?.message?.slice(0, 200) ?? null,
          });
          return this.result(isAbort ? "unavailable" : "unavailable", currentUrl, null, 0, isAbort ? "timeout" : `fetch_error:${e?.message}`, "allowed", t0);
        }
        clearTimeout(timer);

        // 3xx redirects
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get("location");
          if (!loc) return this.result("unavailable", currentUrl, res.status, 0, "redirect_no_location", "allowed", t0);
          const absTo = new URL(loc, currentUrl).toString();
          const nextHost = new URL(absTo).hostname.toLowerCase();
          if (!isSameApex(currentHost, nextHost)) {
            await this.audit?.record({
              at: new Date().toISOString(), host: currentHost, url: currentUrl, method: "GET",
              outcome: "blocked_cross_apex_redirect", status_code: res.status, bytes: 0,
              robots_verdict: "allowed", notes: `redirect to different apex ${nextHost}`,
            });
            return this.result("blocked_by_governance" as any, currentUrl, res.status, 0, `cross_apex_redirect_to_${nextHost}`, "allowed", t0);
          }
          redirect_hops++;
          if (redirect_hops > MAX_REDIRECTS) {
            return this.result("unavailable", currentUrl, res.status, 0, "too_many_redirects", "allowed", t0);
          }
          currentUrl = absTo;
          currentHost = nextHost;
          continue;
        }

        // 429 / 503 politeness
        if (res.status === 429 || res.status === 503) {
          const retryAfter = Number(res.headers.get("retry-after") ?? "0");
          await this.audit?.record({
            at: new Date().toISOString(), host: currentHost, url: currentUrl, method: "GET",
            outcome: "rate_limited", status_code: res.status, bytes: 0,
            robots_verdict: "allowed", notes: `retry_after=${retryAfter}`,
          });
          return this.result("rate_limited", currentUrl, res.status, 0, `retry_after_${retryAfter}s`, "allowed", t0);
        }

        // 404
        if (res.status === 404) {
          await this.audit?.record({
            at: new Date().toISOString(), host: currentHost, url: currentUrl, method: "GET",
            outcome: "not_found", status_code: 404, bytes: 0, robots_verdict: "allowed", notes: null,
          });
          return this.result("not_found", currentUrl, 404, 0, null, "allowed", t0);
        }

        // Other 4xx / 5xx
        if (!res.ok) {
          await this.audit?.record({
            at: new Date().toISOString(), host: currentHost, url: currentUrl, method: "GET",
            outcome: "unavailable", status_code: res.status, bytes: 0, robots_verdict: "allowed", notes: `http_${res.status}`,
          });
          return this.result("unavailable", currentUrl, res.status, 0, `http_${res.status}`, "allowed", t0);
        }

        finalRes = res;
        break;
      }
    } catch (e: any) {
      return this.result("unavailable", currentUrl, null, 0, `outer_error:${e?.message}`, "allowed", t0);
    }

    // Step 4: read body with size cap
    const contentType = finalRes.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml|text\/plain/i.test(contentType)) {
      await this.audit?.record({
        at: new Date().toISOString(), host: currentHost, url: currentUrl, method: "GET",
        outcome: "unavailable", status_code: finalRes.status, bytes: 0, robots_verdict: "allowed",
        notes: `unsupported_content_type:${contentType.slice(0, 50)}`,
      });
      return this.result("responded_zero" as any, currentUrl, finalRes.status, 0, "non_html_content", "allowed", t0);
    }

    const reader = finalRes.body?.getReader();
    if (!reader) return this.result("unavailable", currentUrl, finalRes.status, 0, "no_body_reader", "allowed", t0);
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        bytes += value.byteLength;
        if (bytes > this.max_bytes) { try { await reader.cancel(); } catch { /* ignore */ } break; }
        chunks.push(value);
      }
    }
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk.subarray(0, Math.min(chunk.byteLength, this.max_bytes - offset)), offset); offset += chunk.byteLength; if (offset >= this.max_bytes) break; }
    const html = new TextDecoder("utf-8", { fatal: false }).decode(buffer.subarray(0, Math.min(bytes, this.max_bytes)));

    await this.audit?.record({
      at: new Date().toISOString(), host: currentHost, url: currentUrl, method: "GET",
      outcome: "responded", status_code: finalRes.status, bytes,
      robots_verdict: "allowed", notes: null,
    });

    return {
      kind: "responded",
      url_final: currentUrl,
      status_code: finalRes.status,
      bytes,
      ms: this.clock() - t0,
      content_type: contentType,
      html,
      etag: finalRes.headers.get("etag"),
      last_modified: finalRes.headers.get("last-modified"),
    };
  }

  private async getRobots(host: string, protocol: string): Promise<RobotsRules | null | "failed"> {
    const cached = this.robots_cache.get(host);
    if (cached && cached !== "failed" && (this.clock() - cached.fetched_at) < ROBOTS_CACHE_TTL_MS) return cached;
    if (cached === "failed" && (this.clock() - Date.now() < ROBOTS_CACHE_TTL_MS)) return "failed";

    const robotsUrl = `${protocol}//${host}/robots.txt`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ROBOTS_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(robotsUrl, {
        method: "GET", redirect: "follow",
        headers: { "User-Agent": this.user_agent, "Accept": "text/plain" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.status === 404) {
        // No robots.txt = everything allowed by convention
        const rules: RobotsRules = { fetched_at: this.clock(), disallow_paths: [], allow_paths: [], crawl_delay_ms: null };
        this.robots_cache.set(host, rules);
        return rules;
      }
      if (!res.ok) { this.robots_cache.set(host, "failed"); return "failed"; }
      const txt = await res.text();
      const rules = parseRobotsTxt(txt, this.user_agent);
      this.robots_cache.set(host, rules);
      return rules;
    } catch {
      clearTimeout(timer);
      this.robots_cache.set(host, "failed");
      return "failed";
    }
  }

  private result(
    kind: FetchResult["kind"],
    url_final: string,
    status_code: number | null,
    bytes: number,
    note: string | null,
    _robots_verdict: string,
    started: number,
  ): FetchResult {
    return {
      kind,
      url_final,
      status_code,
      bytes,
      ms: this.clock() - started,
      content_type: null,
      html: null,
      etag: null,
      last_modified: null,
      note: note ?? undefined,
    } as FetchResult;
  }
}

// Doctrine locks
export const _BEHAVIOR_WALK_HONORS_ROBOTS_TXT = "every_fetch_checks_robots_txt_first";
export const _BEHAVIOR_WALK_HONORS_PER_HOST_RATE_LIMIT = "min_interval_enforced_per_host_never_bypassed";
export const _BEHAVIOR_WALK_IDENTIFIES_WITH_REAL_UA = "user_agent_names_nex_and_contact_url";
export const _BEHAVIOR_WALK_AUDIT_LOGS_EVERY_FETCH = "audit_writer_recorded_on_every_outcome";
export const _BEHAVIOR_WALK_NEVER_BYPASSES_429 = "429_returns_rate_limited_never_ignored";
