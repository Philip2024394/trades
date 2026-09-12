// src/lib/nex/agent-runtime/internet-check.ts
//
// NEX Agent Runtime · internet-availability check + work classification
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · §9 · §10
//
// Never busy-loop while offline. Never hammer providers. Never fabricate
// successful acquisition while disconnected. This module is the single
// truth source for "is the internet actually available right now?".

export type InternetState = "ONLINE" | "OFFLINE" | "UNKNOWN";

export type WorkClass =
  | "LOCAL_SAFE"                  // executes fully offline · safe when internet down
  | "NETWORK_REQUIRED"            // needs general internet
  | "EXTERNAL_DEPENDENCY_REQUIRED"; // needs a specific external service

export type InternetProbeResult = {
  state: InternetState;
  probed_at_iso: string;
  latency_ms: number | null;
  probe_target: string | null;
  reason: string;
};

/** In-process cache · avoids probing on every worker tick. The daemon
 *  refreshes this cache on a slower cadence (e.g. every 30s). */
let CACHED: InternetProbeResult | null = null;
let CACHE_UNTIL_MS = 0;

/** Simple HEAD probe against a reliable public endpoint. Returns
 *  ONLINE / OFFLINE only — never UNKNOWN from a real probe (UNKNOWN is
 *  reserved for "we have not probed yet").
 *
 *  §29 cross-process fault injection: when the daemon is spawned with
 *  `NEX_AGENT_INTERNET_FORCE_OFFLINE=1`, this function returns OFFLINE
 *  WITHOUT hitting the network. Enables Founder-driven live proof of
 *  the workforce's offline behaviour without unplugging the machine.
 *  Setting `NEX_AGENT_INTERNET_FORCE_ONLINE=1` forces ONLINE symmetrically.
 *  Both env vars are read on every call so a live-injection watcher can
 *  flip the state mid-lifetime. */
export async function probeInternet(opts?: {
  probe_url?: string;
  timeout_ms?: number;
}): Promise<InternetProbeResult> {
  // Cross-process fault-injection hook · read env every call.
  if (process.env.NEX_AGENT_INTERNET_FORCE_OFFLINE === "1") {
    const result: InternetProbeResult = {
      state: "OFFLINE",
      probed_at_iso: new Date().toISOString(),
      latency_ms: null,
      probe_target: "ENV_FORCE_OFFLINE",
      reason: "NEX_AGENT_INTERNET_FORCE_OFFLINE=1",
    };
    CACHED = result;
    CACHE_UNTIL_MS = Date.now() + 30_000;
    return result;
  }
  if (process.env.NEX_AGENT_INTERNET_FORCE_ONLINE === "1") {
    const result: InternetProbeResult = {
      state: "ONLINE",
      probed_at_iso: new Date().toISOString(),
      latency_ms: 1,
      probe_target: "ENV_FORCE_ONLINE",
      reason: "NEX_AGENT_INTERNET_FORCE_ONLINE=1",
    };
    CACHED = result;
    CACHE_UNTIL_MS = Date.now() + 30_000;
    return result;
  }
  const url = opts?.probe_url ?? "https://www.cloudflare.com/cdn-cgi/trace";
  const timeout = opts?.timeout_ms ?? 5000;
  const startedAt = Date.now();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  try {
    // Use HEAD for minimal bandwidth. Some hosts reject HEAD → fall back
    // to GET on a small endpoint. Cloudflare trace responds to both.
    const r = await fetch(url, { method: "GET", signal: controller.signal });
    clearTimeout(t);
    const latency = Date.now() - startedAt;
    const online = r.status >= 200 && r.status < 500;
    const result: InternetProbeResult = {
      state: online ? "ONLINE" : "OFFLINE",
      probed_at_iso: new Date().toISOString(),
      latency_ms: latency,
      probe_target: url,
      reason: online ? `status:${r.status}` : `status:${r.status}`,
    };
    CACHED = result;
    CACHE_UNTIL_MS = Date.now() + 30_000;
    return result;
  } catch (err) {
    clearTimeout(t);
    const result: InternetProbeResult = {
      state: "OFFLINE",
      probed_at_iso: new Date().toISOString(),
      latency_ms: null,
      probe_target: url,
      reason: (err as Error).message.slice(0, 200),
    };
    CACHED = result;
    CACHE_UNTIL_MS = Date.now() + 15_000;   // shorter cache on failure so we recover fast
    return result;
  }
}

/** Cached read — no probe · returns UNKNOWN when no probe has ever run.
 *  Callers who need a fresh check must invoke probeInternet(). */
export function cachedInternetState(): InternetProbeResult {
  if (CACHED && Date.now() < CACHE_UNTIL_MS) return CACHED;
  if (CACHED) return { ...CACHED, state: "UNKNOWN", reason: "cache_expired" };
  return {
    state: "UNKNOWN",
    probed_at_iso: new Date().toISOString(),
    latency_ms: null,
    probe_target: null,
    reason: "no_probe_recorded",
  };
}

/** Decide whether a piece of work of a given class may proceed given
 *  current internet state. §10 spirit: keep LOCAL_SAFE work alive when
 *  offline; pause network-dependent work. */
export function mayProceedOffline(work: WorkClass, state: InternetState): boolean {
  if (work === "LOCAL_SAFE") return true;
  return state === "ONLINE";
}

/** Test hook · clears the cache so unit tests can exercise the
 *  probe-then-cache path without waiting. */
export function _resetInternetCacheForTests(): void {
  CACHED = null;
  CACHE_UNTIL_MS = 0;
}

/** Test hook · injects a specific state without hitting the network.
 *  Used by watchdog/worker tests + the fault-injection live-proof for
 *  §38 TEST 6 (disable internet). Never call from production code. */
export function _forceInternetStateForTests(state: InternetState, reason: string): void {
  CACHED = {
    state,
    probed_at_iso: new Date().toISOString(),
    latency_ms: state === "ONLINE" ? 10 : null,
    probe_target: "TEST_FAULT_INJECTION",
    reason,
  };
  CACHE_UNTIL_MS = Date.now() + 300_000;   // 5min stays sticky through a test scenario
}
