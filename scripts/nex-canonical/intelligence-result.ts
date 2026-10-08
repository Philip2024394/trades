// scripts/nex-canonical/intelligence-result.ts
//
// NEX Truth Layer · IntelligenceResult<T>
//
// Pure generic primitive for the truth-layer doctrine: every truth-layer
// function must either Answer (with a typed value) or Abstain (with a
// structured, reviewable reason). No "unknown" return. No silent null.
//
// Design posture
//   · Pure. No DB, no filesystem, no network, no clock, no randomness.
//   · Generic over the answered value type.
//   · The abstained reason is structured (code + message + optional
//     details) so downstream consumers can route on code without parsing
//     the human message.
//   · Both branches are returned Object.freeze'd so a caller cannot
//     mutate a Result after the fact.
//   · An exhaustive fold helper enforces that every call site handles
//     both branches at compile time.

// ═════════════════════════════════════════════════════════════════════
// §1 · Public types
// ═════════════════════════════════════════════════════════════════════

/** The structured reason returned when a truth-layer function cannot
 *  answer. `code` is machine-readable (stable identifier); `message` is
 *  human-readable; `details` is an optional structured bag of context. */
export interface AbstainedReason {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/** A discriminated union · either an answer with a value, or an
 *  abstention with a structured reason. Never both, never neither. */
export type IntelligenceResult<T> =
  | { readonly kind: "answered"; readonly value: T }
  | { readonly kind: "abstained"; readonly reason: AbstainedReason };

// ═════════════════════════════════════════════════════════════════════
// §2 · Constructors (frozen)
// ═════════════════════════════════════════════════════════════════════

/** Construct an Answered result with the supplied value. The result
 *  object is Object.freeze'd. */
export function answered<T>(value: T): IntelligenceResult<T> {
  return Object.freeze({ kind: "answered" as const, value });
}

/** Construct an Abstained result with the supplied reason. The result
 *  object and the reason object are both Object.freeze'd. If `details`
 *  is provided it is shallow-frozen; callers must deep-freeze nested
 *  objects themselves if they need deep immutability. */
export function abstained<T>(reason: AbstainedReason): IntelligenceResult<T> {
  const frozenReason: AbstainedReason =
    reason.details === undefined
      ? Object.freeze({ code: reason.code, message: reason.message })
      : Object.freeze({
          code: reason.code,
          message: reason.message,
          details: Object.freeze({ ...reason.details }),
        });
  return Object.freeze({ kind: "abstained" as const, reason: frozenReason });
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Predicates
// ═════════════════════════════════════════════════════════════════════

export function isAnswered<T>(
  r: IntelligenceResult<T>,
): r is { readonly kind: "answered"; readonly value: T } {
  return r.kind === "answered";
}

export function isAbstained<T>(
  r: IntelligenceResult<T>,
): r is { readonly kind: "abstained"; readonly reason: AbstainedReason } {
  return r.kind === "abstained";
}

// ═════════════════════════════════════════════════════════════════════
// §4 · Exhaustive fold
// ═════════════════════════════════════════════════════════════════════

export interface FoldCases<T, R> {
  readonly onAnswered: (value: T) => R;
  readonly onAbstained: (reason: AbstainedReason) => R;
}

/** Exhaustive fold · forces the caller to handle both branches at
 *  compile time. The never-check in the default case guards against a
 *  future union expansion silently dropping a branch. */
export function foldIntelligenceResult<T, R>(
  result: IntelligenceResult<T>,
  cases: FoldCases<T, R>,
): R {
  switch (result.kind) {
    case "answered":
      return cases.onAnswered(result.value);
    case "abstained":
      return cases.onAbstained(result.reason);
    default: {
      // Exhaustiveness check · will fail to compile if a new branch is
      // added to IntelligenceResult without updating this switch.
      const _exhaustive: never = result;
      void _exhaustive;
      throw new Error("foldIntelligenceResult: non-exhaustive branch");
    }
  }
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Static invariants · module-level
// ═════════════════════════════════════════════════════════════════════
//
// This module is PURE. It:
//   · does NOT open a network connection
//   · does NOT read or write the filesystem
//   · does NOT read environment variables
//   · does NOT use a clock (no Date.now, no new Date)
//   · does NOT use randomness
//   · imports NO script-local modules · the only runtime value this
//     module uses is Object.freeze, which is deterministic
//
// Future truth-layer functions (resolver bridge, canonical pre-check,
// etc.) return `IntelligenceResult<T>` so that every call site is
// forced to deal with Abstained explicitly, never silently.
