// src/lib/nex/observability/outcome.ts
//
// Wave 11 · GROUP B remediation · shared outcome vocabulary for every
// operation that can produce a non-success result.
//
// Philip's directive (2026-08-10): "Do not invent 'healthy' states
// merely because an operation did not throw. Distinguish success /
// skipped / rejected / failed / unavailable / fallback."
//
// This module defines the discriminated-union type every subsystem
// uses when it reports what happened. The outcome NEVER discards
// information · it names the state and carries the reason.
//
// Callers that today return `null` or `[]` on error MUST migrate to
// this shape so downstream operators can see the difference between
// "queue empty" (Success) and "read failed · fell back to empty"
// (Fallback with reason).

export type OutcomeSuccess<T = void> = {
  kind: "success";
  value: T;
};

export type OutcomeSkipped = {
  kind: "skipped";
  reason: string;                    // machine-readable code (kebab-case)
  detail?: string;                   // optional human context (no secrets)
};

export type OutcomeRejected = {
  kind: "rejected";
  reason: string;                    // e.g. "invalid-shape" · "unknown-brain"
  detail?: string;
};

export type OutcomeFailed = {
  kind: "failed";
  reason: string;                    // e.g. "provider-error" · "write-conflict"
  error_code?: string;               // upstream err.code if any
  detail?: string;
};

export type OutcomeUnavailable = {
  kind: "unavailable";
  reason: string;                    // e.g. "pg-not-configured" · "circuit-open"
  detail?: string;
};

export type OutcomeFallback<T = void> = {
  kind: "fallback";
  reason: string;                    // WHY the fallback engaged
  value: T;                          // the fallback result
  primary_error_code?: string;
};

export type Outcome<T = void> =
  | OutcomeSuccess<T>
  | OutcomeSkipped
  | OutcomeRejected
  | OutcomeFailed
  | OutcomeUnavailable
  | OutcomeFallback<T>;

// ── Constructor helpers ─────────────────────────────────────────────

export function success<T>(value: T): OutcomeSuccess<T> {
  return { kind: "success", value };
}

export function skipped(reason: string, detail?: string): OutcomeSkipped {
  return { kind: "skipped", reason, detail };
}

export function rejected(reason: string, detail?: string): OutcomeRejected {
  return { kind: "rejected", reason, detail };
}

export function failed(reason: string, opts: { error_code?: string; detail?: string } = {}): OutcomeFailed {
  return { kind: "failed", reason, error_code: opts.error_code, detail: opts.detail };
}

export function unavailable(reason: string, detail?: string): OutcomeUnavailable {
  return { kind: "unavailable", reason, detail };
}

export function fallback<T>(value: T, reason: string, primary_error_code?: string): OutcomeFallback<T> {
  return { kind: "fallback", value, reason, primary_error_code };
}

// ── Type guards ─────────────────────────────────────────────────────

export function isSuccess<T>(o: Outcome<T>): o is OutcomeSuccess<T> { return o.kind === "success"; }
export function isFallback<T>(o: Outcome<T>): o is OutcomeFallback<T> { return o.kind === "fallback"; }
export function isProblem<T>(o: Outcome<T>): o is Exclude<Outcome<T>, OutcomeSuccess<T> | OutcomeFallback<T>> {
  return o.kind !== "success" && o.kind !== "fallback";
}
