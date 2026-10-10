// WO-CRAWLER-INTERNET-01 · host rate limiter.
//
// Founder-locked 2026-09-13 · NEX Continuous Multi-Source Crawler Directive:
//   - Respect Retry-After header when provided
//   - Exponential backoff with jitter otherwise
//   - Per-host state persisted across restarts (do not hammer on restart)
//   - Concurrent-request protection per host (max 1 in-flight per host)
//   - Every 429 recorded as evidence · never counted as success
//   - Never bypass · never hammer
//
// Persistence: nex_host_rate_limit_state.jsonl · one record per host with
// last_request_at, next_permitted_at, backoff_multiplier, consecutive_failures.

import { promises as fs } from "node:fs";
import path from "node:path";

const STATE_FILE = path.join(process.cwd(), "data", "nex-storage", "nex_host_rate_limits.json");

// ── Per-host policy (conservative defaults · overridable per-source) ───

export interface HostPolicy {
  readonly host: string;
  readonly min_interval_ms: number;              // minimum time between requests to this host
  readonly max_concurrent: number;                // max in-flight requests (usually 1)
  readonly request_timeout_ms: number;            // total request budget
  readonly initial_backoff_ms: number;            // initial 429/5xx backoff
  readonly max_backoff_ms: number;                // cap on exponential backoff
  readonly backoff_multiplier: number;            // × per consecutive failure
  readonly jitter_ratio: number;                  // 0.0 to 1.0 (fraction of backoff for jitter)
  readonly max_bytes_per_response: number;        // response body cap
  readonly daily_request_budget: number;          // max requests per host per rolling 24h
}

/** Founder-locked conservative defaults · used when no per-host policy provided. */
export const DEFAULT_HOST_POLICY: Omit<HostPolicy, "host"> = Object.freeze({
  min_interval_ms: 3_000,                   // 1 request per 3 seconds sustained (arXiv-safe)
  max_concurrent: 1,
  request_timeout_ms: 30_000,
  initial_backoff_ms: 60_000,               // 1-minute initial backoff on 429
  max_backoff_ms: 30 * 60_000,              // capped at 30 minutes
  backoff_multiplier: 2,
  jitter_ratio: 0.25,
  max_bytes_per_response: 5 * 1024 * 1024,  // 5 MB
  daily_request_budget: 1000,
});

// ── Per-host runtime state ─────────────────────────────────────────────

export interface HostState {
  readonly host: string;
  last_request_at: number | null;
  next_permitted_at: number;
  consecutive_failures: number;
  in_flight: number;                          // 0 or 1 for max_concurrent=1
  requests_today: number;
  day_bucket: string;                         // YYYY-MM-DD
  /** Founder-locked: every 429 or backoff event kept for evidence + policy proof */
  events: Array<{
    at: string;
    kind: "REQUEST_ATTEMPT" | "REQUEST_OK" | "REQUEST_429" | "REQUEST_5XX" | "REQUEST_TIMEOUT" | "REQUEST_ERROR" | "BACKOFF_APPLIED";
    detail: string;
  }>;
}

interface Store {
  hosts: Record<string, HostState>;
  saved_at: string;
}

let cached: Store | null = null;

async function loadStore(): Promise<Store> {
  if (cached) return cached;
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    cached = JSON.parse(raw) as Store;
    // Backfill in_flight = 0 across restarts (a restart cancels in-flight requests)
    for (const h of Object.values(cached.hosts)) h.in_flight = 0;
    return cached;
  } catch {
    cached = { hosts: {}, saved_at: new Date().toISOString() };
    return cached;
  }
}

async function saveStore(): Promise<void> {
  if (!cached) return;
  cached.saved_at = new Date().toISOString();
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(cached, null, 2));
}

function getOrInitHostState(store: Store, host: string): HostState {
  let s = store.hosts[host];
  const dayBucket = new Date().toISOString().slice(0, 10);
  if (!s) {
    s = { host, last_request_at: null, next_permitted_at: 0, consecutive_failures: 0, in_flight: 0, requests_today: 0, day_bucket: dayBucket, events: [] };
    store.hosts[host] = s;
  }
  if (s.day_bucket !== dayBucket) {
    s.requests_today = 0;
    s.day_bucket = dayBucket;
  }
  return s;
}

// ── Retry-After parsing ────────────────────────────────────────────────

/** Parse RFC 7231 Retry-After: either an HTTP-date OR a delta-seconds integer. */
export function parseRetryAfterMs(header: string | undefined | null, now: Date): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  // Delta seconds integer
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10) * 1000;
  }
  // HTTP-date
  const d = Date.parse(trimmed);
  if (!Number.isNaN(d)) {
    return Math.max(0, d - now.getTime());
  }
  return null;
}

// ── Public API ─────────────────────────────────────────────────────────

export interface AcquisitionCheckOk {
  readonly ok: true;
  readonly host: string;
}
export interface AcquisitionCheckDenied {
  readonly ok: false;
  readonly host: string;
  readonly kind: "RATE_LIMITED" | "BACKING_OFF" | "CONCURRENT_LIMIT" | "DAILY_BUDGET_EXHAUSTED";
  readonly next_permitted_at: string;
  readonly wait_ms: number;
  readonly reason: string;
}

/**
 * Check whether a request to `host` is permitted RIGHT NOW under its policy.
 * Founder-locked: this is the SINGLE POINT of rate-limit enforcement · every
 * crawler request MUST pass through here.
 */
export async function checkAcquisitionPermitted(host: string, policy?: Partial<Omit<HostPolicy, "host">>): Promise<AcquisitionCheckOk | AcquisitionCheckDenied> {
  const store = await loadStore();
  const s = getOrInitHostState(store, host);
  const p = { ...DEFAULT_HOST_POLICY, ...policy, host };
  const now = Date.now();

  if (s.in_flight >= p.max_concurrent) {
    return {
      ok: false, host, kind: "CONCURRENT_LIMIT",
      next_permitted_at: new Date(now + 1000).toISOString(),
      wait_ms: 1000,
      reason: `${s.in_flight} in-flight >= max ${p.max_concurrent}`,
    };
  }
  if (s.requests_today >= p.daily_request_budget) {
    const nextMidnight = new Date(); nextMidnight.setUTCHours(24, 0, 0, 0);
    return {
      ok: false, host, kind: "DAILY_BUDGET_EXHAUSTED",
      next_permitted_at: nextMidnight.toISOString(),
      wait_ms: nextMidnight.getTime() - now,
      reason: `daily budget ${p.daily_request_budget} exhausted for host ${host}`,
    };
  }
  if (now < s.next_permitted_at) {
    const kind: "BACKING_OFF" | "RATE_LIMITED" = s.consecutive_failures > 0 ? "BACKING_OFF" : "RATE_LIMITED";
    return {
      ok: false, host, kind,
      next_permitted_at: new Date(s.next_permitted_at).toISOString(),
      wait_ms: s.next_permitted_at - now,
      reason: kind === "BACKING_OFF"
        ? `host ${host} backing off · ${s.consecutive_failures} consecutive failures · wait ${s.next_permitted_at - now}ms`
        : `host ${host} rate-limited by min_interval_ms · wait ${s.next_permitted_at - now}ms`,
    };
  }
  return { ok: true, host };
}

// ── After a request completes/fails ────────────────────────────────────

export interface RecordRequestInput {
  readonly host: string;
  readonly status: number | null;          // HTTP status, null on network/timeout error
  readonly retry_after_header?: string | null;
  readonly bytes_received?: number;
  readonly network_error?: string;         // set on timeout / DNS failure / etc.
  readonly policy?: Partial<Omit<HostPolicy, "host">>;
}

export type RequestOutcomeKind = "OK" | "RATE_LIMITED_429" | "TRANSIENT_5XX" | "TIMEOUT" | "NETWORK_ERROR" | "OTHER";

export interface RecordRequestResult {
  readonly outcome: RequestOutcomeKind;
  readonly host_state: HostState;
  /** Founder-locked: every request produces an evidence marker string that
   *  gets attached to the agent's heartbeat evidence_refs. */
  readonly evidence_marker: string;
}

export async function recordRequestOutcome(input: RecordRequestInput): Promise<RecordRequestResult> {
  const store = await loadStore();
  const s = getOrInitHostState(store, input.host);
  const p = { ...DEFAULT_HOST_POLICY, ...input.policy, host: input.host };
  const now = Date.now();
  s.last_request_at = now;
  s.requests_today++;
  s.in_flight = Math.max(0, s.in_flight - 1);

  let outcome: RequestOutcomeKind = "OTHER";
  let evidence: string;

  if (input.network_error) {
    outcome = /timeout/i.test(input.network_error) ? "TIMEOUT" : "NETWORK_ERROR";
    evidence = `host:${input.host}:${outcome}`;
    s.consecutive_failures++;
    applyExponentialBackoff(s, p, null, now);
    s.events.unshift({ at: new Date(now).toISOString(), kind: outcome === "TIMEOUT" ? "REQUEST_TIMEOUT" : "REQUEST_ERROR", detail: input.network_error });
  } else if (input.status === null) {
    outcome = "NETWORK_ERROR";
    evidence = `host:${input.host}:NETWORK_ERROR`;
    s.consecutive_failures++;
    applyExponentialBackoff(s, p, null, now);
    s.events.unshift({ at: new Date(now).toISOString(), kind: "REQUEST_ERROR", detail: "status=null" });
  } else if (input.status === 429) {
    outcome = "RATE_LIMITED_429";
    evidence = `host:${input.host}:HTTP_429`;
    s.consecutive_failures++;
    const retryAfterMs = parseRetryAfterMs(input.retry_after_header ?? null, new Date(now));
    applyExponentialBackoff(s, p, retryAfterMs, now);
    s.events.unshift({ at: new Date(now).toISOString(), kind: "REQUEST_429", detail: `Retry-After=${input.retry_after_header ?? "(none)"}` });
  } else if (input.status >= 500 && input.status < 600) {
    outcome = "TRANSIENT_5XX";
    evidence = `host:${input.host}:HTTP_${input.status}`;
    s.consecutive_failures++;
    applyExponentialBackoff(s, p, null, now);
    s.events.unshift({ at: new Date(now).toISOString(), kind: "REQUEST_5XX", detail: `status=${input.status}` });
  } else if (input.status >= 200 && input.status < 300) {
    outcome = "OK";
    evidence = `host:${input.host}:HTTP_${input.status}:${input.bytes_received ?? 0}B`;
    s.consecutive_failures = 0;
    // Ensure min-interval for next request
    s.next_permitted_at = now + p.min_interval_ms;
    s.events.unshift({ at: new Date(now).toISOString(), kind: "REQUEST_OK", detail: `status=${input.status} bytes=${input.bytes_received ?? 0}` });
  } else {
    outcome = "OTHER";
    evidence = `host:${input.host}:HTTP_${input.status}`;
    s.events.unshift({ at: new Date(now).toISOString(), kind: "REQUEST_ATTEMPT", detail: `status=${input.status}` });
  }

  // Trim events to last 50
  if (s.events.length > 50) s.events.length = 50;

  await saveStore();
  return { outcome, host_state: s, evidence_marker: evidence };
}

function applyExponentialBackoff(s: HostState, p: HostPolicy, retryAfterMs: number | null, now: number): void {
  if (retryAfterMs !== null && retryAfterMs > 0) {
    // Respect server-provided Retry-After
    s.next_permitted_at = now + retryAfterMs;
    s.events.unshift({ at: new Date(now).toISOString(), kind: "BACKOFF_APPLIED", detail: `Retry-After ${retryAfterMs}ms` });
    return;
  }
  // Exponential backoff · with jitter
  const attempt = Math.max(0, s.consecutive_failures - 1);
  const base = Math.min(p.max_backoff_ms, p.initial_backoff_ms * Math.pow(p.backoff_multiplier, attempt));
  const jitter = base * p.jitter_ratio * (Math.random() - 0.5);   // ± jitter_ratio/2
  const wait = Math.max(1000, Math.round(base + jitter));
  s.next_permitted_at = now + wait;
  s.events.unshift({ at: new Date(now).toISOString(), kind: "BACKOFF_APPLIED", detail: `exp-backoff ${wait}ms (attempt ${s.consecutive_failures})` });
}

// ── Mark request as in-flight (before fetch) ───────────────────────────

export async function beginRequest(host: string): Promise<void> {
  const store = await loadStore();
  const s = getOrInitHostState(store, host);
  s.in_flight++;
  await saveStore();
}

// ── Read-side helpers (for HQ) ─────────────────────────────────────────

export async function readAllHostStates(): Promise<HostState[]> {
  const store = await loadStore();
  return Object.values(store.hosts);
}

export async function readHostState(host: string): Promise<HostState | null> {
  const store = await loadStore();
  return store.hosts[host] ?? null;
}

/** For tests / dev · reset all state. */
export async function _resetRateLimiter(): Promise<void> {
  cached = { hosts: {}, saved_at: new Date().toISOString() };
  try { await fs.unlink(STATE_FILE); } catch { /* ok */ }
}
