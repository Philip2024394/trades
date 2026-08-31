// Live-source connector types.
//
// A LiveSource is a walker that fetches from a real-time authoritative
// endpoint (BMKG, MAGMA, future BPJPH, live flight boards, etc.).
// It shares the walker interface but:
//   · declares freshness policy "live" or "very_fast"
//   · MUST be gated behind the NEX_LIVE_SOURCES_ENABLED env flag
//     (tests and CI run in mock-mode by default)
//   · comes with a mocked-response fixture for its Guardian tests
//     so the pipeline is verified without hitting the real endpoint

import type { FreshnessPolicy } from "../data/types";
import type { EntityRecord } from "../data/types";

export type LiveSourceKind = "bmkg" | "magma" | "bpjph" | "flight_status" | "osm_overpass" | "custom";

export type LiveSourceConfig = {
  id: string;
  kind: LiveSourceKind;
  endpoint: string;
  freshnessPolicy: FreshnessPolicy;
  /** Cadence (ms) between polling · defaults to the policy window. */
  pollIntervalMs?: number;
  /** Per-request timeout. Default 10s. */
  timeoutMs?: number;
  /** Circuit-breaker openAfter threshold. Default 3. */
  breakerOpenAfter?: number;
  breakerOpenForMs?: number;
  /** Human description. */
  description: string;
};

export type LiveObservation = {
  /** Raw payload from the source. */
  raw: unknown;
  /** Extracted EntityRecords, ready for pipeline enrichment. */
  entities: EntityRecord[];
  /** ISO date when the fetch happened. */
  observedAt: string;
  /** Was this a real fetch (true) or a mocked response (false)? */
  live: boolean;
};

/** A LiveSourceConnector wraps a specific endpoint + parser +
 *  entity-mapper. Implementations exist for BMKG (weather / quake /
 *  tsunami), MAGMA (volcano), etc. */
export interface LiveSourceConnector {
  readonly config: LiveSourceConfig;
  /** Fetch (or mock) one observation. Never throws · errors become
   *  LiveFetchError shape. */
  fetch(opts?: { mock?: unknown }): Promise<LiveObservation | LiveFetchError>;
}

export type LiveFetchError = {
  error: true;
  reason: "network" | "timeout" | "http_status" | "parse" | "disabled" | "circuit_open";
  detail?: string;
  status?: number;
};

export function isLiveFetchError(x: unknown): x is LiveFetchError {
  return !!x && typeof x === "object" && (x as { error?: boolean }).error === true;
}
