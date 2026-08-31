// http-adapter · shared fetch primitive for live-source connectors.
//
// Consistent retry/timeout/circuit-breaker behaviour so every live
// connector inherits the same resilience. Never throws · always
// returns Response OR a structured LiveFetchError.
//
// LIVE FETCHING IS GATED. Default is DISABLED. Set
// NEX_LIVE_SOURCES_ENABLED=1 to allow real HTTP · otherwise the
// adapter returns { error: "disabled" }. Tests / CI stay in mock
// mode; production ops flip the flag explicitly.

import type { LiveFetchError } from "./types";

export type HttpFetchOptions = {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  headers?: Record<string, string>;
  /** Force-enable regardless of the env flag · used only by tests
   *  that inject their own fetch shim. */
  __forceEnabled?: boolean;
  /** Injectable fetch for tests. */
  __fetch?: typeof fetch;
};

export type HttpFetchResult =
  | { ok: true; status: number; text: string; json: unknown }
  | LiveFetchError;

export async function httpFetch(url: string, opts: HttpFetchOptions = {}): Promise<HttpFetchResult> {
  const enabled = opts.__forceEnabled || process.env.NEX_LIVE_SOURCES_ENABLED === "1";
  if (!enabled) return { error: true, reason: "disabled", detail: "NEX_LIVE_SOURCES_ENABLED not set" };

  const timeoutMs = opts.timeoutMs ?? 10_000;
  const retries = opts.retries ?? 2;
  const retryDelayMs = opts.retryDelayMs ?? 1500;
  const fetchFn = opts.__fetch ?? fetch;

  let lastError: LiveFetchError = { error: true, reason: "network" };
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, { headers: opts.headers, signal: controller.signal });
      clearTimeout(timer);
      const text = await res.text();
      if (!res.ok) {
        lastError = { error: true, reason: "http_status", status: res.status, detail: text.slice(0, 200) };
        if (res.status >= 500 && attempt < retries) { await sleep(retryDelayMs * (attempt + 1)); continue; }
        return lastError;
      }
      let json: unknown = null;
      try { json = JSON.parse(text); } catch { /* leave json=null */ }
      return { ok: true, status: res.status, text, json };
    } catch (e) {
      clearTimeout(timer);
      const isAbort = e instanceof Error && e.name === "AbortError";
      lastError = { error: true, reason: isAbort ? "timeout" : "network", detail: e instanceof Error ? e.message : "unknown" };
      if (attempt < retries) { await sleep(retryDelayMs * (attempt + 1)); continue; }
      return lastError;
    }
  }
  return lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
