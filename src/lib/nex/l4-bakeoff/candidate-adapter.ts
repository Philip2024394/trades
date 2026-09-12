// src/lib/nex/l4-bakeoff/candidate-adapter.ts
//
// V.5.2 · L4 bakeoff · common candidate adapter primitives
// Founder BEGIN V.5.2 · 2026-09-08
//
// Discipline (Founder Section 14):
//   · Adapter is the ONLY layer that talks to a candidate
//   · Adapter NEVER throws · always returns typed AdapterResponse
//   · Distinguishes MODEL / ADAPTER / NETWORK / TOOL / BENCHMARK failure
//   · Never attributes infrastructure failure to model intelligence

import type {
  AdapterRequest,
  AdapterResponse,
  CandidateAdapter,
  CandidateIdentity,
  EvaluationDimension,
} from "./types";

/** Base helper · captures elapsed milliseconds for a wrapped operation
 *  regardless of success/failure. Every adapter uses this. */
export async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; latency_ms: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, latency_ms: Date.now() - start };
}

/** Convert an unexpected exception into a typed adapter_failure ·
 *  no exception ever escapes to the harness. */
export function catchAsAdapterFailure(fn: () => Promise<AdapterResponse>): Promise<AdapterResponse> {
  return fn().catch((err: unknown): AdapterResponse => ({
    kind: "adapter_failure",
    reason: err instanceof Error ? err.message : String(err),
    latency_ms: 0,
  }));
}

/** Enforce request contract before dispatch · caller-side sanity checks. */
export function validateAdapterRequest(req: AdapterRequest): { ok: true } | { ok: false; reason: string } {
  if (!req.request_id || req.request_id.length === 0) return { ok: false, reason: "request_id required" };
  if (typeof req.prompt !== "string" || req.prompt.length === 0) return { ok: false, reason: "prompt required" };
  if (req.temperature !== undefined && (req.temperature < 0 || req.temperature > 2)) {
    return { ok: false, reason: `temperature ${req.temperature} out of range [0,2]` };
  }
  if (req.max_tokens !== undefined && req.max_tokens <= 0) {
    return { ok: false, reason: `max_tokens ${req.max_tokens} must be positive` };
  }
  return { ok: true };
}

/** Sentinel for "adapter not implemented" · used by the harness to
 *  produce an adapter_failure without silently skipping a candidate. */
export function unimplementedAdapter(candidate: CandidateIdentity): CandidateAdapter {
  return {
    identity: candidate,
    supportedDimensions(): readonly EvaluationDimension[] { return []; },
    async invoke(_req: AdapterRequest): Promise<AdapterResponse> {
      return {
        kind: "adapter_failure",
        reason: `no adapter implementation for candidate ${candidate.candidate_id} · V.5.2 protocol only · no real inference authorized this phase`,
        latency_ms: 0,
      };
    },
  };
}

/** Helper to reject cases a candidate cannot support · returns explicit
 *  benchmark_failure so the harness records it as excluded with reason
 *  rather than silently passing. */
export function unsupportedForDimension(candidate: CandidateIdentity, dimension: EvaluationDimension): AdapterResponse {
  return {
    kind: "adapter_failure",
    reason: `candidate ${candidate.candidate_id} does not declare support for dimension ${dimension}`,
    latency_ms: 0,
  };
}
