// src/lib/nex/tool-errors/types.ts
//
// WAVE-P-1.3 · GAP-7 · Typed tool errors + retry classification
// Founder BEGIN WAVE-P-1 · 2026-09-08
//
// Extends the NexTool contract with a typed error union so tool handlers
// can distinguish transient (retry) from permanent (abandon) failures.
// Preserves existing NexTool interface · new fields are additive.

// ═══════════════════════════════════════════════════════════════════
// § A · TOOL ERROR TAXONOMY
// ═══════════════════════════════════════════════════════════════════

/** Coarse category · drives retry + user-visible message. */
export type ToolFailureKind =
  | "transient_upstream"     // upstream 5xx · network · timeout · retry after backoff
  | "rate_limited"           // upstream 429 · retry after retry_after_ms
  | "permanent_upstream"     // upstream 4xx · never retry · abandon
  | "invalid_input"          // caller-side error · never retry · abandon
  | "sandbox_denied"         // Phase G / policy denial · never retry · escalate
  | "not_authorized"         // authz failure · never retry · escalate
  | "quota_exhausted"        // budget hit · never retry (per this request) · escalate
  | "timeout"                // client-side timeout · retry once with longer budget
  | "malformed_output"       // upstream returned invalid data · retry once (may be flaky) · then abandon
  | "unknown";               // classifier couldn't determine · treat as transient with tight budget

/** Every tool handler that fails MUST return this shape · never throw
 *  raw exceptions past the tool boundary. Adapters that catch throws
 *  wrap them into ToolFailure with kind="unknown". */
export type ToolFailure = {
  kind: ToolFailureKind;
  message: string;                     // human-readable · never contains secrets
  retryable: boolean;                  // derived from kind · convenience flag
  retry_after_ms?: number;             // hint from upstream · caller honors
  http_status?: number;                // when applicable
  tool_name: string;
  captured_at_iso: string;
};

/** Union of handler outcomes · discriminated so callers pattern-match
 *  instead of null-checking. */
export type ToolInvocationOutcome<T = unknown> =
  | { ok: true; result: T; latency_ms: number }
  | { ok: false; failure: ToolFailure; latency_ms: number };

// ═══════════════════════════════════════════════════════════════════
// § B · RETRY POLICY
// ═══════════════════════════════════════════════════════════════════

export type RetryPolicy = {
  max_attempts: number;                // total attempts including first
  base_backoff_ms: number;             // exponential base
  max_backoff_ms: number;              // cap
  jitter_fraction: number;             // 0..1 · ±jitter of computed backoff
  /** Failure kinds ALLOWED to retry · everything else abandons immediately. */
  retryable_kinds: readonly ToolFailureKind[];
  /** Optional per-tool overrides. */
  per_tool_overrides?: Record<string, Partial<RetryPolicy>>;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  max_attempts: 3,
  base_backoff_ms: 500,
  max_backoff_ms: 8_000,
  jitter_fraction: 0.20,
  retryable_kinds: ["transient_upstream", "rate_limited", "timeout", "malformed_output", "unknown"],
};
