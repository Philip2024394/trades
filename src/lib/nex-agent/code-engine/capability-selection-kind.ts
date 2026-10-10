// src/lib/nex-agent/code-engine/capability-selection-kind.ts
//
// NEX1 · Stage 1.6 Containment · zero LLM · READ-ONLY.
//
// PURPOSE (founder acceptance decision · 2026-09-20)
//   Provide the CANONICAL, ONE-WAY-TO-DO-IT accessors for interpreting
//   Q8's CandidateSelection.source_file (and Q7's CandidateRanking.source_file
//   and CandidateSelection.rankings_reference.source_file, and the
//   candidate_id prefix) as either a REAL FILESYSTEM PATH or a SCOPED
//   CANDIDATE IDENTIFIER derived from the Stage 1.6 declaration bridge.
//
// CONTRACT
//   The single valid marker for a declaration-derived scope is the string
//   constant `DECLARATION_SCOPE_PREFIX` re-exported from
//   `capability-declaration-bridge.ts` (currently the literal `decl@`).
//   No other prefix is defined. No other prefix will silently be recognised.
//
//   For any string `s` that is a scope key emitted by Q7/Q8:
//     · `isDeclarationScope(s)`   → s.startsWith(DECLARATION_SCOPE_PREFIX)
//     · `stripDeclarationScope(s)` → s with a single leading prefix removed
//     · `scopeKind(s)`             → "declaration" | "root_cause"
//     · `realSourceFile(sel)`     → the RESOLVED filesystem path (from
//                                     provenance if present, else stripped
//                                     source_file). Guaranteed to never
//                                     begin with the prefix.
//
// USAGE DISCIPLINE
//   · Persistence layers may store the raw `source_file` verbatim (already
//     the case in investigation-conclusion-store.ts) — that record remains
//     truthful because the prefix is content, not path.
//   · UI, path resolvers, `fs.exists`, IDE deep-links, dashboards, or any
//     code that treats `source_file` as a filesystem entry MUST route
//     through `realSourceFile()` first.
//   · Consumers that need to distinguish declaration answers from
//     root-cause answers (e.g., for presentation grouping) should use
//     `scopeKind()`.
//
// DISCIPLINE INVARIANTS
//   · Zero LLM · zero randomness · zero external model · deterministic.
//   · No modification of Q7 · Q8 · Fix 8-14 · bridge · or walker source files.
//   · Additive · Ledger B · a helper module only.

import type {
  CandidateRanking,
  RankingScope,
} from "./capability-candidate-ranker";
import type { CandidateSelection } from "./capability-candidate-selector";
import { DECLARATION_SCOPE_PREFIX } from "./capability-declaration-bridge";

// Re-export for callers that want to reference the constant by name from
// this containment module rather than the bridge.
export { DECLARATION_SCOPE_PREFIX };

export type ScopeKind = "declaration" | "root_cause";

/** True when the given scope key (source_file / candidate_id / rankings_reference.source_file)
 *  is a Stage 1.6 declaration-derived scope. */
export function isDeclarationScope(scopeKey: string): boolean {
  return typeof scopeKey === "string" && scopeKey.startsWith(DECLARATION_SCOPE_PREFIX);
}

/** Remove exactly ONE leading DECLARATION_SCOPE_PREFIX from `scopeKey` and
 *  return the resulting string. If the prefix is absent, returns the input
 *  unchanged. Never removes more than one prefix instance. */
export function stripDeclarationScope(scopeKey: string): string {
  if (isDeclarationScope(scopeKey)) {
    return scopeKey.slice(DECLARATION_SCOPE_PREFIX.length);
  }
  return scopeKey;
}

/** Classify a scope key by kind. */
export function scopeKind(scopeKey: string): ScopeKind {
  return isDeclarationScope(scopeKey) ? "declaration" : "root_cause";
}

/** Resolve a Q8 CandidateSelection to a REAL filesystem-relative path.
 *  Precedence:
 *    1. `sel.provenance[0].source_file` if non-empty AND doesn't start with
 *       the prefix (provenance is the strongest source of truth).
 *    2. `stripDeclarationScope(sel.source_file)` otherwise.
 *
 *  The returned string is guaranteed to NOT begin with
 *  `DECLARATION_SCOPE_PREFIX`. It is safe to pass to path resolvers /
 *  `fs.exists` / IDE deep-link constructors.
 *
 *  If no path can be resolved (empty provenance, empty source_file), returns
 *  the empty string. Callers should treat the empty string as "unknown". */
export function realSourceFile(sel: CandidateSelection): string {
  if (
    sel.provenance &&
    sel.provenance.length > 0 &&
    typeof sel.provenance[0].source_file === "string" &&
    sel.provenance[0].source_file.length > 0 &&
    !sel.provenance[0].source_file.startsWith(DECLARATION_SCOPE_PREFIX)
  ) {
    return sel.provenance[0].source_file;
  }
  const stripped = stripDeclarationScope(sel.source_file ?? "");
  return stripped;
}

/** Convenience accessor for a Q7 ranking scope. */
export function scopeKindOfRanking(scope: RankingScope): ScopeKind {
  return scopeKind(scope.source_file);
}

/** Convenience accessor for a single Q7 ranking record. */
export function scopeKindOfRankingRecord(record: CandidateRanking): ScopeKind {
  return scopeKind(record.source_file);
}

/** Structured summary of the selection for downstream consumers. Callers
 *  that want a single object with EVERY interpretation resolved should use
 *  this — it removes any ambiguity about which field is the "path" and
 *  which is the "scope key". */
export interface SelectionInterpretation {
  readonly kind: ScopeKind;
  /** Raw scope key from Q8 output · may include prefix. */
  readonly scope_key: string;
  /** REAL filesystem-relative path · never has prefix. Empty when unknown. */
  readonly real_source_file: string;
  /** Raw selected_candidate id from Q8 · may include prefix. */
  readonly selected_candidate: string | null;
  /** Selected candidate id with any leading DECLARATION_SCOPE_PREFIX removed
   *  from its FIRST split segment. Never null when scope kind is 'declaration'
   *  and a selection was made. */
  readonly stripped_selected_candidate: string | null;
}

/** Build a fully-resolved interpretation of a Q8 selection. Deterministic. */
export function interpretSelection(sel: CandidateSelection): SelectionInterpretation {
  const kind = scopeKind(sel.source_file);
  const real = realSourceFile(sel);
  let strippedCand: string | null = null;
  if (sel.selected_candidate) {
    const parts = sel.selected_candidate.split("::");
    if (parts.length > 0 && parts[0].startsWith(DECLARATION_SCOPE_PREFIX)) {
      parts[0] = parts[0].slice(DECLARATION_SCOPE_PREFIX.length);
      strippedCand = parts.join("::");
    } else {
      strippedCand = sel.selected_candidate;
    }
  }
  return {
    kind,
    scope_key: sel.source_file,
    real_source_file: real,
    selected_candidate: sel.selected_candidate,
    stripped_selected_candidate: strippedCand,
  };
}
