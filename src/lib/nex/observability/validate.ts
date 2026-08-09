// src/lib/nex/observability/validate.ts
//
// Wave 11 · GROUP B remediation · shared JSON-boundary validator.
//
// Closes F17 (pg-reads enum casts silent) · F18 (manager JSON.parse
// trust) · F19 (JSONL parse trust) with one architecture:
//
//   validateOrDrop(rows, validator, opts) →
//     { valid: T[], dropped: number, reasons: Map<reason, count> }
//
// The helper NEVER throws on invalid rows. Invalid rows are:
//   1. Dropped from the returned array.
//   2. Counted in `dropped` and per-reason.
//   3. Signalled to observability with signal kind "row-dropped"
//      (or "line-dropped" for JSONL parsers · caller chooses).
//   4. Counter `validate.row_dropped` / `validate.line_dropped` incremented.
//
// Callers get the CLEAN array + the tally. Operators see the drops via
// the observability surface — no silent trust.

import { incr, type CounterName } from "./counters";
import { emitSignal, type SignalKind } from "./signals";

export type Validator<T> = (row: unknown, idx: number) => { ok: true; value: T } | { ok: false; reason: string };

export type ValidateOpts = {
  /** Name used in signal emission · e.g. "pg-inbox" · "jsonl-jobs". */
  subsystem: string;
  /** Which counter to increment on drop. */
  counter: Extract<CounterName, "validate.row_dropped" | "validate.line_dropped">;
  /** Which signal kind to emit on drop. */
  signal_kind: Extract<SignalKind, "row-dropped" | "line-dropped">;
  /**
   * Optional cap on how many drop signals to emit per call. Above this
   * cap, drops are still COUNTED but not signalled individually — the
   * final drop count is reported in one aggregate signal. Prevents log
   * spam when a batch is entirely malformed.
   */
  max_signals?: number;
};

export type ValidateResult<T> = {
  valid: T[];
  dropped: number;
  reasons: Map<string, number>;
};

export function validateOrDrop<T>(
  rows: readonly unknown[],
  validator: Validator<T>,
  opts: ValidateOpts,
): ValidateResult<T> {
  const valid: T[] = [];
  const reasons = new Map<string, number>();
  const maxSignals = opts.max_signals ?? 5;
  let dropped = 0;
  let signalled = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = validator(rows[i], i);
    if (r.ok) {
      valid.push(r.value);
      continue;
    }
    dropped += 1;
    reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1);
    incr(opts.counter);
    if (signalled < maxSignals) {
      emitSignal({
        subsystem: opts.subsystem,
        kind: opts.signal_kind,
        code: r.reason,
        detail: `row_index=${i}`,
      });
      signalled += 1;
    }
  }

  // If we dropped more than we signalled, emit ONE aggregate signal
  // so the operator sees the total without log spam.
  if (dropped > signalled) {
    emitSignal({
      subsystem: opts.subsystem,
      kind: opts.signal_kind,
      code: "aggregate",
      detail: `dropped=${dropped} unique_reasons=${reasons.size} signals_emitted=${signalled}`,
    });
  }

  return { valid, dropped, reasons };
}
