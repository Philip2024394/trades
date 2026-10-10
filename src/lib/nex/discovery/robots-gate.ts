// src/lib/nex/discovery/robots-gate.ts
//
// UWI · Wave 3.3 · M9 · HARD ROBOTS GOVERNANCE GATE
// Founder-authorised programme · **CRITICAL RULE**:
//
//   "robots-parser must be a HARD GOVERNANCE GATE, not merely a parser
//    whose result gets logged. The crawler must demonstrably refuse a
//    disallowed fetch."
//
// This module MUST NOT return `allow: true` when the robots rule denies.
// Any caller that bypasses this gate is a governance violation. There is
// intentionally no "override" flag. There is intentionally no "lockdown
// mode that skips robots" (per FCA red-flag doctrine).
//
// Callers MUST:
//   1. Call `evaluate(canonicalUrl, userAgent)` before any outbound fetch.
//   2. Respect the returned `RobotsDecision`.
//   3. If `allow: false`, do NOT fetch. Return an honest DiscoveryFailure
//      of class `robots_denied`.
//   4. If `allow: true`, honour `crawl_delay_ms` via the politeness scheduler.

import robotsParser from "robots-parser";
import type { CanonicalUrl, RobotsDecision } from "./types";

// User-Agent NEX identifies as (per Wave 1 governance discipline · founder
// rule: NEX identifies honestly as `Nex/1.0`, never impersonates).
export const NEX_USER_AGENT = "Nex/1.0 (+https://nex.local; unified-research-intelligence)";

// Cache parsed robots.txt per host to avoid repeated re-fetch/parse.
// Key = host. Value = { parser, fetched_at_ms, ttl_ms }.
// TTL is intentionally long-ish (24h) but not permanent — a site owner
// can update robots.txt and NEX will notice on the next TTL bucket.
interface RobotsCacheEntry {
  parser: ReturnType<typeof robotsParser> | null; // null = fetch failed → conservative deny
  fetched_at_ms: number;
  ttl_ms: number;
  raw_text: string | null;
}

const ROBOTS_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const ROBOTS_FAIL_TTL_MS = 5 * 60 * 1000;  // 5min shorter TTL on fetch failure

// The cache is module-scope singleton; tests may reset via `_resetForTests`.
const cache = new Map<string, RobotsCacheEntry>();

/** Fetch + parse robots.txt for a host. Cache-friendly. */
export async function loadRobotsForHost(
  host: string,
  fetcher: (url: string) => Promise<{ status: number; text: string } | null> = defaultRobotsFetcher,
  now_ms: number = Date.now(),
): Promise<RobotsCacheEntry> {
  const cached = cache.get(host);
  if (cached && (now_ms - cached.fetched_at_ms) < cached.ttl_ms) return cached;

  const url = `https://${host}/robots.txt`;
  try {
    const result = await fetcher(url);
    if (!result || (result.status >= 400 && result.status < 500)) {
      // 4xx (including 404) per RFC 9309 = no restrictions apply. Empty parser.
      const entry: RobotsCacheEntry = {
        parser: robotsParser(url, ""),
        fetched_at_ms: now_ms,
        ttl_ms: ROBOTS_TTL_MS,
        raw_text: "",
      };
      cache.set(host, entry);
      return entry;
    }
    if (result.status >= 500) {
      // Server error: RFC 9309 recommends deferring / treating as full disallow
      // until success. NEX errs on the side of DENY (conservative).
      const entry: RobotsCacheEntry = {
        parser: null,
        fetched_at_ms: now_ms,
        ttl_ms: ROBOTS_FAIL_TTL_MS,
        raw_text: null,
      };
      cache.set(host, entry);
      return entry;
    }
    const entry: RobotsCacheEntry = {
      parser: robotsParser(url, result.text),
      fetched_at_ms: now_ms,
      ttl_ms: ROBOTS_TTL_MS,
      raw_text: result.text,
    };
    cache.set(host, entry);
    return entry;
  } catch {
    // Network failure: conservative deny per RFC 9309 §2.3.1.4.
    const entry: RobotsCacheEntry = {
      parser: null,
      fetched_at_ms: now_ms,
      ttl_ms: ROBOTS_FAIL_TTL_MS,
      raw_text: null,
    };
    cache.set(host, entry);
    return entry;
  }
}

/** HARD GATE — evaluate whether a fetch is permitted per robots.txt.
 *
 *  This function is the only sanctioned entry point for the fetch decision.
 *  A caller who fetches without consulting this function is a governance
 *  violation. */
export async function evaluate(
  url: CanonicalUrl,
  userAgent: string = NEX_USER_AGENT,
  fetcher?: (url: string) => Promise<{ status: number; text: string } | null>,
  now_ms: number = Date.now(),
): Promise<RobotsDecision> {
  const entry = await loadRobotsForHost(url.host, fetcher, now_ms);

  if (!entry.parser) {
    // Conservative deny on unresolvable robots (5xx / network error).
    return {
      allow: false,
      reason: "robots.txt fetch failed (5xx or network) — conservative deny per RFC 9309 §2.3.1.4",
      matched_rule: null,
    };
  }

  const isAllowed = entry.parser.isAllowed(url.normalised, userAgent);
  if (isAllowed === false) {
    return {
      allow: false,
      reason: `robots.txt Disallow rule matched for user-agent '${userAgent}'`,
      matched_rule: entry.parser.getMatchingLineNumber?.(url.normalised, userAgent) != null
        ? `line ${entry.parser.getMatchingLineNumber(url.normalised, userAgent)}`
        : null,
    };
  }

  // isAllowed can be `undefined` (no matching rule) — RFC 9309 says allow.
  const crawlDelaySec = entry.parser.getCrawlDelay(userAgent);
  const crawl_delay_ms = typeof crawlDelaySec === "number" && Number.isFinite(crawlDelaySec)
    ? Math.max(0, Math.floor(crawlDelaySec * 1000))
    : null;
  return {
    allow: true,
    crawl_delay_ms,
    matched_group: userAgent,
  };
}

/** Assert-style helper: throws RobotsDeniedError if the gate denies.
 *  Callers that prefer exceptions over decision handling use this. */
export async function assertAllowed(
  url: CanonicalUrl,
  userAgent: string = NEX_USER_AGENT,
): Promise<{ crawl_delay_ms: number | null }> {
  const decision = await evaluate(url, userAgent);
  if (!decision.allow) {
    throw new RobotsDeniedError(url.normalised, decision.reason, decision.matched_rule);
  }
  return { crawl_delay_ms: decision.crawl_delay_ms };
}

export class RobotsDeniedError extends Error {
  readonly url: string;
  readonly matched_rule: string | null;
  constructor(url: string, reason: string, matched_rule: string | null) {
    super(`robots.txt DENY for ${url} · ${reason}`);
    this.name = "RobotsDeniedError";
    this.url = url;
    this.matched_rule = matched_rule;
  }
}

// ─── Default fetcher · MUST use NEX's guardedFetch when integrated ──
// This default uses stdlib fetch for isolation-testability; wired code
// should inject a fetcher that goes through the constitutional gate.
async function defaultRobotsFetcher(url: string): Promise<{ status: number; text: string } | null> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "user-agent": NEX_USER_AGENT, "accept": "text/plain" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 200) {
      const text = await res.text();
      return { status: 200, text };
    }
    return { status: res.status, text: "" };
  } catch {
    return null;
  }
}

// ─── Test-only helpers ──────────────────────────────────────────────
export function _resetRobotsCacheForTests(): void {
  cache.clear();
}
