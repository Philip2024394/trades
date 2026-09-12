// src/lib/nex/tool-errors/retry-policy.ts
//
// WAVE-P-1.3 · Retry orchestration with exponential backoff + jitter
// Founder BEGIN WAVE-P-1 · 2026-09-08
//
// Given a tool handler + a policy · run with retries per policy.
// Retryable failures honor retry_after_ms when the upstream provides
// it · exponential backoff with jitter otherwise. Non-retryable
// failures abandon immediately.

import type {
  RetryPolicy,
  ToolFailure,
  ToolInvocationOutcome,
} from "./types";
import { DEFAULT_RETRY_POLICY } from "./types";
import { classifyToolFailure, isRetryable } from "./classifier";

/** Combine base + per-tool overrides · never mutates input. */
export function resolvePolicy(base: RetryPolicy, tool_name: string): RetryPolicy {
  const override = base.per_tool_overrides?.[tool_name];
  if (!override) return base;
  return { ...base, ...override };
}

/** Compute nth-attempt backoff · pure · deterministic when jitter=0. */
export function computeBackoff(
  attempt_number: number, // 1-indexed
  policy: RetryPolicy,
  retry_after_ms?: number,
  jitter_seed_01: number = 0.5, // 0..1 · test-injectable pseudo-random
): number {
  if (typeof retry_after_ms === "number" && retry_after_ms > 0) {
    return Math.min(policy.max_backoff_ms, retry_after_ms);
  }
  const raw = policy.base_backoff_ms * Math.pow(2, attempt_number - 1);
  const capped = Math.min(policy.max_backoff_ms, raw);
  const jitter = capped * policy.jitter_fraction * (jitter_seed_01 - 0.5) * 2; // ±jitter_fraction
  return Math.max(0, Math.floor(capped + jitter));
}

/** Run a tool handler with retries per policy. Returns the final
 *  outcome (either success or the LAST failure). Never throws. */
export async function runToolWithRetry<T>(input: {
  tool_name: string;
  handler: () => Promise<T>;
  policy?: RetryPolicy;
  sleep?: (ms: number) => Promise<void>;
  jitter_seed_provider?: () => number;
}): Promise<ToolInvocationOutcome<T>> {
  const policy = resolvePolicy(input.policy ?? DEFAULT_RETRY_POLICY, input.tool_name);
  const sleep = input.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const jitter = input.jitter_seed_provider ?? Math.random;
  const started = Date.now();
  let lastFailure: ToolFailure | undefined;

  for (let attempt = 1; attempt <= policy.max_attempts; attempt++) {
    try {
      const result = await input.handler();
      return { ok: true, result, latency_ms: Date.now() - started };
    } catch (err) {
      const failure = classifyToolFailure({ tool_name: input.tool_name, error: err });
      lastFailure = failure;

      const canRetry = attempt < policy.max_attempts && isRetryable(failure.kind) && policy.retryable_kinds.includes(failure.kind);
      if (!canRetry) {
        return { ok: false, failure, latency_ms: Date.now() - started };
      }
      const backoff = computeBackoff(attempt, policy, failure.retry_after_ms, jitter());
      await sleep(backoff);
    }
  }
  return {
    ok: false,
    failure: lastFailure ?? {
      kind: "unknown",
      message: `Exhausted ${policy.max_attempts} attempts without capturing a failure`,
      retryable: false,
      tool_name: input.tool_name,
      captured_at_iso: new Date().toISOString(),
    },
    latency_ms: Date.now() - started,
  };
}
