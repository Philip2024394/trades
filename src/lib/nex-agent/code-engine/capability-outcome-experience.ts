// src/lib/nex-agent/code-engine/capability-outcome-experience.ts
//
// NEX1 · Ledger B substrate · B1 + B2 · Founder-authorised 2026-09-18.
//
// PURPOSE (founder's framing, verbatim)
//   "Make coding-loop outcomes capable of becoming properly structured
//    experience. Add dimensions such as: intended target, actual
//    execution path, mutation/path relationship, verification target,
//    actual fixture outcome, confidence/uncertainty."
//
//   And the critical constraint:
//   "Don't let the engineering team turn 'NEX couldn't learn this
//    because the architecture didn't expose the information' into
//    'Therefore we need to program the answer.' The goal should be to
//    give NEX the right evidence, not give it the conclusion."
//
// DESIGN DISCIPLINE
//   Every field on `OutcomeExperienceEntry` is an OBSERVABLE FACT
//   about what happened. None of the fields is a semantic label of the
//   form "wrong-branch mutation" / "correct-by-luck" / "verification
//   false positive". Those labels emerge (or fail to emerge) when a
//   downstream abstraction step groups entries by feature-value
//   combinations. This module does not conclude anything.
//
//   Ledger B: this file is human engineering. It becomes part of
//   NEX1's substrate. Any pattern NEX1's abstraction machinery
//   subsequently induces over these entries is a Ledger A candidate,
//   subject to falsification.
//
// CONSTITUTIONAL PRESERVATION
//   - Zero LLM. Zero network.
//   - Every OutcomeFeatures value carries evidence_kind: "INFERRED"
//     when derived from observations, or evidence_kind: "OBSERVED"
//     when captured directly at runtime.
//   - Q7/Q8/Fix 17/Fix 23a/b/c/Fix 25/Fix 30/Fix 30B/Fix 34/Fix 35
//     Schema V1 all UNCHANGED. This is a parallel, additive store.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// ── The record schema ────────────────────────────────────────────────────

/**
 * One record per completed coding-loop run. Fields describe WHAT HAPPENED,
 * not WHAT SHOULD HAVE HAPPENED. Downstream abstraction machinery must
 * derive any judgement about correctness by grouping over these facts.
 */
export interface OutcomeExperienceEntry {
  readonly entry_id: string;
  readonly timestamp: string;

  // What was attempted
  readonly target_source_file: string;
  readonly founder_goal: string;
  readonly assertion_expression: string; // exact original assertion text
  readonly assertion_input_verbatim: string; // e.g. "true", "5", "-3", "1, true", "()"

  // What NEX proposed
  readonly j2_response_kind: "proposal" | "refusal" | "no_signal";
  readonly j2_proposal_text: string | null; // trimmed reasoning-trace line, verbatim
  readonly j2_refusal_kind: string | null; // e.g. "refused_low_confidence"

  // What was mutated (if anything)
  readonly mutation_applied: boolean;
  readonly mutation_target_line: number | null;
  readonly mutation_before_text: string | null;
  readonly mutation_after_text: string | null;

  // Where the fixture assertion actually reaches at runtime
  //   Determined by dynamically invoking the (mutated or unmutated)
  //   function with the fixture assertion's exact input and observing
  //   which `return` statement fires. This is an OBSERVED fact.
  //   `null` when the fixture cannot be instrumented (e.g. class methods,
  //   expressions with no discrete return). Consumers must handle null.
  readonly actual_execution_path_line: number | null;
  readonly execution_path_evidence_kind: "OBSERVED" | "UNAVAILABLE";

  // Verification-coupling facts (B3)
  //   spec_test_after_mutation: what the coding-loop's own spec-derived
  //     test reported after the change stage.
  //   fixture_test_after_mutation: what happens if we re-run the
  //     ORIGINAL fixture assertion after the change stage.
  //   These may DISAGREE (that is E's failure mode).
  readonly spec_test_after_mutation: "verified" | "failed" | "skipped" | "not_run";
  readonly fixture_test_after_mutation: "verified" | "failed" | "not_run";
  readonly loop_overall_verdict: string;

  // Derived-fact fields (still not conclusions · just relationships)
  //   Downstream code can group over these to induce patterns.
  readonly mutation_target_matches_execution_path: boolean | null;
  readonly spec_and_fixture_verdicts_agree: boolean | null;

  // Confidence expressed by NEX during the run (not an authored judgement)
  readonly confidence_reported_by_j2: number | null;

  readonly r11b_marker: "OUTCOME_EXPERIENCE_MUST_NOT_ENTER_R4_SUPPORTING_COUNT";
  readonly evidence_kind: "INFERRED";
}

// ── Storage ──────────────────────────────────────────────────────────────

export function getOutcomeStorePath(repo_root?: string): string {
  const rr = repo_root ?? process.cwd();
  return path.join(rr, "data", "nex1-coding-experience", "entries.jsonl");
}

export function appendOutcome(
  entry: Omit<OutcomeExperienceEntry, "entry_id" | "timestamp" | "r11b_marker" | "evidence_kind"> & {
    readonly timestamp?: string;
  },
  repo_root?: string,
): OutcomeExperienceEntry {
  const p = getOutcomeStorePath(repo_root);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const record: OutcomeExperienceEntry = {
    entry_id: "oe-" + crypto.randomBytes(4).toString("hex"),
    timestamp: entry.timestamp ?? new Date().toISOString(),
    r11b_marker: "OUTCOME_EXPERIENCE_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
    evidence_kind: "INFERRED",
    ...entry,
  };
  fs.appendFileSync(p, JSON.stringify(record) + "\n", "utf8");
  return record;
}

export function loadAllOutcomes(repo_root?: string): OutcomeExperienceEntry[] {
  const p = getOutcomeStorePath(repo_root);
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, "utf8");
  const out: OutcomeExperienceEntry[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed.entry_id === "string" && parsed.r11b_marker) out.push(parsed);
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

// ── Outcome feature extraction (B2 · dimensions that expose facts) ──────

export type SpecFixtureAgreement =
  | "both_verified"
  | "both_failed"
  | "spec_verified_fixture_failed"
  | "spec_failed_fixture_verified"
  | "spec_verified_fixture_not_run"
  | "spec_skipped_fixture_verified"
  | "spec_skipped_fixture_failed"
  | "other";

export interface OutcomeFeatures {
  readonly mutation_applied: boolean;
  readonly j2_response_kind: OutcomeExperienceEntry["j2_response_kind"];
  readonly execution_path_known: boolean;
  readonly mutation_targets_execution_path:
    | "true"
    | "false"
    | "not_applicable_no_mutation"
    | "not_applicable_execution_path_unknown";
  readonly spec_fixture_agreement: SpecFixtureAgreement;
  readonly loop_overall_verdict: string;
}

export function extractOutcomeFeatures(e: OutcomeExperienceEntry): OutcomeFeatures {
  // spec-fixture agreement classification
  const spec = e.spec_test_after_mutation;
  const fix = e.fixture_test_after_mutation;
  let agreement: SpecFixtureAgreement = "other";
  if (spec === "verified" && fix === "verified") agreement = "both_verified";
  else if (spec === "failed" && fix === "failed") agreement = "both_failed";
  else if (spec === "verified" && fix === "failed") agreement = "spec_verified_fixture_failed";
  else if (spec === "failed" && fix === "verified") agreement = "spec_failed_fixture_verified";
  else if (spec === "verified" && fix === "not_run") agreement = "spec_verified_fixture_not_run";
  else if (spec === "skipped" && fix === "verified") agreement = "spec_skipped_fixture_verified";
  else if (spec === "skipped" && fix === "failed") agreement = "spec_skipped_fixture_failed";

  let mutTargets: OutcomeFeatures["mutation_targets_execution_path"];
  if (!e.mutation_applied) mutTargets = "not_applicable_no_mutation";
  else if (e.actual_execution_path_line === null) mutTargets = "not_applicable_execution_path_unknown";
  else mutTargets = e.mutation_target_matches_execution_path ? "true" : "false";

  return {
    mutation_applied: e.mutation_applied,
    j2_response_kind: e.j2_response_kind,
    execution_path_known: e.actual_execution_path_line !== null,
    mutation_targets_execution_path: mutTargets,
    spec_fixture_agreement: agreement,
    loop_overall_verdict: e.loop_overall_verdict,
  };
}

// ── Grouping over outcome features (parallel to Fix 34) ────────────────

export interface OutcomePatternRecord {
  readonly pattern_id: string;
  readonly features: OutcomeFeatures;
  readonly support_count: number;
  readonly entry_ids: readonly string[];
  readonly evidence_kind: "INFERRED";
  readonly r11b_marker: "OUTCOME_PATTERN_MUST_NOT_ENTER_R4_SUPPORTING_COUNT";
}

function patternIdOf(f: OutcomeFeatures): string {
  return [
    "opat",
    f.mutation_applied ? "mut" : "nomut",
    f.j2_response_kind,
    f.execution_path_known ? "epknown" : "epunknown",
    f.mutation_targets_execution_path,
    f.spec_fixture_agreement,
    f.loop_overall_verdict,
  ].join("-");
}

export function extractOutcomePatterns(entries: readonly OutcomeExperienceEntry[]): OutcomePatternRecord[] {
  const groups = new Map<string, { features: OutcomeFeatures; entry_ids: string[] }>();
  for (const e of entries) {
    const f = extractOutcomeFeatures(e);
    const id = patternIdOf(f);
    const existing = groups.get(id);
    if (existing) existing.entry_ids.push(e.entry_id);
    else groups.set(id, { features: f, entry_ids: [e.entry_id] });
  }
  const out: OutcomePatternRecord[] = [];
  for (const [pattern_id, g] of groups.entries()) {
    out.push({
      pattern_id,
      features: g.features,
      support_count: g.entry_ids.length,
      entry_ids: [...g.entry_ids],
      evidence_kind: "INFERRED",
      r11b_marker: "OUTCOME_PATTERN_MUST_NOT_ENTER_R4_SUPPORTING_COUNT",
    });
  }
  out.sort((a, b) => b.support_count - a.support_count || a.pattern_id.localeCompare(b.pattern_id));
  return out;
}

export const OUTCOME_EXPERIENCE_VERSION = "outcome-experience.v1";
