// src/lib/nex-agent/code-engine/capability-prior-evidence-comparator.ts
//
// NEX1 · Fix 30B · Prior-Evidence Comparator.
// Founder-authorised 2026-09-18 · minimal deterministic connection that lets
// retrieved prior experience INFORM (never authorise) the current downstream
// decision made in Fix 25 salience-switch.
//
// PURPOSE
//   Fix 26 retrieves, Fix 30 aggregates, and Fix 30B classifies the
//   RELATIONSHIP between the current-turn evidence (target + expected value
//   from Fix 24 Class 2 Bridge) and one or more prior investigation
//   conclusions (Fix 17 store · read via Fix 26).
//
//   The classification is deterministic, uses ONLY existing fields, and
//   distinguishes:
//
//     NO_PRIOR                        no prior entries at all
//     PRIOR_UNRELATED                 no prior for this source_file
//     PRIOR_MATCHES_CURRENT           same file · prior SELECTED with a
//                                     structurally comparable candidate whose
//                                     signature agrees with the current
//                                     candidate signature
//     PRIOR_CONFLICTS_CURRENT         same file · prior SELECTED with a
//                                     structurally comparable candidate whose
//                                     signature DISAGREES with the current
//                                     candidate signature
//     PRIOR_UNRESOLVED_SAME_FILE      same file · prior TIE / INSUFFICIENT_
//                                     EVIDENCE / UNRESOLVED / REQUIRE_MORE_
//                                     INVESTIGATION / NO_SELECTION
//     PRIOR_INFORMATIONAL_ONLY        same file · prior SELECTED but the
//                                     candidate signature is not structurally
//                                     comparable (arbitrary Q8 candidate id)
//
//   CONSTITUTIONAL RULES
//   - Prior experience is EVIDENCE, never AUTHORITY. This module returns a
//     RELATIONSHIP; the consumer decides what to do with it.
//   - R11-B enforced: the classification never enters R-4 SUPPORTING count.
//   - The relationship depends on the RELATIONSHIP between current and prior
//     (structured signature comparison), never on the prior label alone.
//     SELECTED with matching signature → PRIOR_MATCHES_CURRENT
//     SELECTED with different signature → PRIOR_CONFLICTS_CURRENT
//     TIE alone does not force a decision.
//   - Zero LLM. Deterministic. No I/O. No timestamps.
//
//   Q7 / Q8 / Fix 23a / Fix 23b / Fix 23c / Schema V1 UNCHANGED.

import type { InvestigationConclusionEntry } from "./investigation-conclusion-store";

// ── Public shape ────────────────────────────────────────────────────────

export type PriorRelationship =
  | "NO_PRIOR"
  | "PRIOR_UNRELATED"
  | "PRIOR_MATCHES_CURRENT"
  | "PRIOR_CONFLICTS_CURRENT"
  | "PRIOR_UNRESOLVED_SAME_FILE"
  | "PRIOR_INFORMATIONAL_ONLY";

export interface ComparatorInput {
  /** Current source_file (repo-relative). */
  readonly current_source_file: string;
  /** Current candidate signature. When Fix 24 Class 2 Bridge fires this is
   *  `${current_source_file}::${expected_normalised}` — a stable structural
   *  identifier for what the current turn intends to fix. May be null when
   *  the current turn does not have a structured signature (e.g. bridge
   *  refused). */
  readonly current_candidate_signature: string | null;
  /** Retrieved prior entries. Order is preserved; caller supplies
   *  timestamp-descending. */
  readonly priors: readonly InvestigationConclusionEntry[];
}

export interface ComparatorResult {
  readonly relationship: PriorRelationship;
  readonly reason: string;
  readonly matched_prior_entry_id: string | null;
  readonly current_signature: string | null;
  readonly prior_signature: string | null;
  readonly r11b_marker: "RETRIEVED_EVIDENCE_MUST_NOT_ENTER_R4_SUPPORTING_COUNT";
  readonly evidence_kind: "INFERRED";
}

// ── Implementation ──────────────────────────────────────────────────────

/**
 * Structural signature test. A prior selected_candidate is deemed
 * "structurally comparable" when it starts with `${current_source_file}::`
 * — the exact encoding produced by the Fix 24 Class 2 Bridge when a caller
 * uses the deterministic `signatureFor(target, expected)` helper below.
 *
 * Arbitrary Q8 candidate ids from production Fix 17 entries do NOT match
 * this prefix; they are treated as PRIOR_INFORMATIONAL_ONLY to avoid false
 * conflict flags.
 */
function isStructurallyComparable(
  prior_candidate: string | null,
  current_source_file: string,
): boolean {
  if (typeof prior_candidate !== "string") return false;
  if (prior_candidate.length === 0) return false;
  return prior_candidate.startsWith(`${current_source_file}::`);
}

/**
 * Build a stable signature for the current turn: `${source_file}::${value}`.
 * Consumers use this to construct `current_candidate_signature`; seeded
 * priors in adversarial experiments use the same helper so both sides
 * agree on shape.
 */
export function signatureFor(
  source_file: string,
  expected_value: string | number | boolean | null | undefined,
): string {
  const v =
    expected_value === null || expected_value === undefined
      ? ""
      : String(expected_value);
  return `${source_file}::${v}`;
}

const R11B: "RETRIEVED_EVIDENCE_MUST_NOT_ENTER_R4_SUPPORTING_COUNT" =
  "RETRIEVED_EVIDENCE_MUST_NOT_ENTER_R4_SUPPORTING_COUNT";

export function comparePriorToCurrent(
  input: ComparatorInput,
): ComparatorResult {
  const {
    current_source_file,
    current_candidate_signature,
    priors,
  } = input;

  if (!priors || priors.length === 0) {
    return {
      relationship: "NO_PRIOR",
      reason: "no prior entries supplied",
      matched_prior_entry_id: null,
      current_signature: current_candidate_signature,
      prior_signature: null,
      r11b_marker: R11B,
      evidence_kind: "INFERRED",
    };
  }

  const sameFile = priors.filter(
    (p) => p.source_file === current_source_file,
  );
  if (sameFile.length === 0) {
    return {
      relationship: "PRIOR_UNRELATED",
      reason: `no prior for ${current_source_file} (checked ${priors.length} prior entries)`,
      matched_prior_entry_id: null,
      current_signature: current_candidate_signature,
      prior_signature: null,
      r11b_marker: R11B,
      evidence_kind: "INFERRED",
    };
  }

  // Consult the most recent same-file prior (priors already sorted DESC by
  // caller). If a resolved prior exists at any depth, we still consider only
  // the most recent to keep the rule deterministic.
  const latest = sameFile[0];

  // ── Resolved past: SELECTED ─────────────────────────────────────────
  if (
    latest.selection_state === "SELECTED" &&
    typeof latest.selected_candidate === "string"
  ) {
    if (
      isStructurallyComparable(
        latest.selected_candidate,
        current_source_file,
      )
    ) {
      // Structured comparison possible: relationship is decided by whether
      // the signatures agree.
      if (
        current_candidate_signature !== null &&
        current_candidate_signature === latest.selected_candidate
      ) {
        return {
          relationship: "PRIOR_MATCHES_CURRENT",
          reason:
            `prior SELECTED same signature (${latest.selected_candidate})`,
          matched_prior_entry_id: latest.entry_id,
          current_signature: current_candidate_signature,
          prior_signature: latest.selected_candidate,
          r11b_marker: R11B,
          evidence_kind: "INFERRED",
        };
      }
      // Signatures diverge — real structural conflict.
      return {
        relationship: "PRIOR_CONFLICTS_CURRENT",
        reason:
          `prior SELECTED signature (${latest.selected_candidate}) differs from current signature (${current_candidate_signature ?? "n/a"})`,
        matched_prior_entry_id: latest.entry_id,
        current_signature: current_candidate_signature,
        prior_signature: latest.selected_candidate,
        r11b_marker: R11B,
        evidence_kind: "INFERRED",
      };
    }
    // Structurally NOT comparable: prior was SELECTED but candidate id is
    // an arbitrary Q8 id we cannot compare with. Treat as informational.
    return {
      relationship: "PRIOR_INFORMATIONAL_ONLY",
      reason:
        `prior SELECTED but candidate id (${latest.selected_candidate}) not structurally comparable with current source_file (${current_source_file})`,
      matched_prior_entry_id: latest.entry_id,
      current_signature: current_candidate_signature,
      prior_signature: latest.selected_candidate,
      r11b_marker: R11B,
      evidence_kind: "INFERRED",
    };
  }

  // ── Unresolved past: TIE / NO_SELECTION / INSUFFICIENT / UNRESOLVED /
  //   REQUIRE_MORE_INVESTIGATION ───────────────────────────────────────
  return {
    relationship: "PRIOR_UNRESOLVED_SAME_FILE",
    reason:
      `prior on ${current_source_file} was ${latest.selection_state}${latest.selected_candidate === null ? " (no candidate selected)" : ` (candidate ${latest.selected_candidate})`}`,
    matched_prior_entry_id: latest.entry_id,
    current_signature: current_candidate_signature,
    prior_signature: latest.selected_candidate,
    r11b_marker: R11B,
    evidence_kind: "INFERRED",
  };
}

export const PRIOR_EVIDENCE_COMPARATOR_VERSION = "fix30b.v1";
