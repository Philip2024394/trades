// src/lib/nex/l4-bakeoff/latency.ts
//
// V.5.2 · L4 bakeoff · latency measurement protocol
// Founder BEGIN V.5.2 · 2026-09-08
//
// Discipline (Founder Section 11):
//   · TTFT · total · tok/s · cold-start · warm-start · concurrency · context effects
//   · p50 / p95 / p99 where sample size permits
//   · NEVER present single best-case latency as representative
//   · UNKNOWN when sample insufficient

import type { LatencyProfile } from "./types";

export type LatencySample = {
  ttft_ms?: number;
  total_ms: number;
  output_tokens?: number;
  cold_start?: boolean;
  concurrency_level?: number;
  context_length_tokens?: number;
  request_id: string;
};

/** Compute percentile from a sorted-ascending numeric array. */
function percentile(sortedAsc: number[], p: number): number | undefined {
  if (sortedAsc.length === 0) return undefined;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = Math.min(sortedAsc.length - 1, Math.floor(p * sortedAsc.length));
  return sortedAsc[idx];
}

/** Minimum sample size before we publish a percentile. Below this,
 *  fields remain undefined and reproducibility_notes say so. */
export const LATENCY_MIN_SAMPLES_FOR_P95 = 5;
export const LATENCY_MIN_SAMPLES_FOR_P99 = 20;

export function buildLatencyProfile(input: {
  candidate_id: string;
  samples: readonly LatencySample[];
  measurement_notes?: string;
  now_iso?: string;
}): LatencyProfile {
  const now = input.now_iso ?? new Date().toISOString();
  const samples = input.samples;
  const n = samples.length;

  if (n === 0) {
    return {
      candidate_id: input.candidate_id,
      samples: 0,
      measurement_notes: (input.measurement_notes ? input.measurement_notes + " · " : "") +
        "no samples collected · every field undefined · UNKNOWN discipline",
      measured_at_iso: now,
    };
  }

  const ttft = samples.map((s) => s.ttft_ms).filter((v): v is number => typeof v === "number").sort((a, b) => a - b);
  const total = samples.map((s) => s.total_ms).sort((a, b) => a - b);
  const tokPerSec = samples
    .filter((s) => typeof s.output_tokens === "number" && s.total_ms > 0)
    .map((s) => (s.output_tokens as number) / (s.total_ms / 1000))
    .sort((a, b) => a - b);
  const cold = samples.filter((s) => s.cold_start === true).map((s) => s.total_ms).sort((a, b) => a - b);
  const warm = samples.filter((s) => s.cold_start === false).map((s) => s.total_ms).sort((a, b) => a - b);
  const concurrency = samples.reduce((max, s) => Math.max(max, s.concurrency_level ?? 0), 0);

  const contextLengths = samples.map((s) => s.context_length_tokens).filter((v): v is number => typeof v === "number");
  const contextNote = contextLengths.length > 0
    ? `context_length range: min=${Math.min(...contextLengths)} max=${Math.max(...contextLengths)} n=${contextLengths.length}`
    : undefined;

  return {
    candidate_id: input.candidate_id,
    samples: n,
    ttft_ms_p50: ttft.length > 0 ? percentile(ttft, 0.50) : undefined,
    ttft_ms_p95: ttft.length >= LATENCY_MIN_SAMPLES_FOR_P95 ? percentile(ttft, 0.95) : undefined,
    ttft_ms_p99: ttft.length >= LATENCY_MIN_SAMPLES_FOR_P99 ? percentile(ttft, 0.99) : undefined,
    total_ms_p50: percentile(total, 0.50),
    total_ms_p95: total.length >= LATENCY_MIN_SAMPLES_FOR_P95 ? percentile(total, 0.95) : undefined,
    total_ms_p99: total.length >= LATENCY_MIN_SAMPLES_FOR_P99 ? percentile(total, 0.99) : undefined,
    tokens_per_second_p50: tokPerSec.length > 0 ? percentile(tokPerSec, 0.50) : undefined,
    cold_start_ms: cold.length > 0 ? percentile(cold, 0.50) : undefined,
    warm_start_ms: warm.length > 0 ? percentile(warm, 0.50) : undefined,
    concurrency_measured: concurrency > 0 ? concurrency : undefined,
    context_length_effect_notes: contextNote,
    measurement_notes: [
      input.measurement_notes,
      n < LATENCY_MIN_SAMPLES_FOR_P95 ? "sample size below p95 threshold · p95/p99 undefined per honesty discipline" : undefined,
      ttft.length === 0 ? "no ttft samples captured · streaming may not be supported" : undefined,
      tokPerSec.length === 0 ? "no tokens/second computable · output_tokens missing" : undefined,
    ].filter(Boolean).join(" · "),
    measured_at_iso: now,
  };
}
