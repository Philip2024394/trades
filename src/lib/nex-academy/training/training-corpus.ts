// WO-ACADEMY-02 · deterministic training corpus.
//
// The founder-locked causal chain requires the training corpus + held-out
// + adversarial + regression sets to be defined UP FRONT and be DISJOINT.
// This module produces the slice-1 corpus targeting the wo7-node-syntax-
// specialist's ESM-import weakness.
//
// Same-name case ids across baseline/training/generalisation/adversarial
// would be an integrity error; the constructor property-checks disjointness.

import { randomUUID } from "node:crypto";
import type { TrainingKind, TrainingProgram } from "./types";
import type { TrainingTaskCase } from "./training-executor";
import { provenanceChainHash, sha256Hex } from "@/lib/nex-intelligence/provenance";

// ── The slice-1 corpus ─────────────────────────────────────────────────

/** BASELINE set: cases the specialist ALREADY handles (before training) */
export const SLICE1_BASELINE_CASES: readonly TrainingTaskCase[] = Object.freeze([
  { case_id: "baseline-01", setup_kind: "missing-file",   expected_rule: "file-not-found" },
  { case_id: "baseline-02", setup_kind: "syntax-error",   expected_rule: "syntax-error"   },
  { case_id: "baseline-03", setup_kind: "clean",          expected_rule: null              },
  { case_id: "baseline-04", setup_kind: "missing-file",   expected_rule: "file-not-found" },
  { case_id: "baseline-05", setup_kind: "syntax-error",   expected_rule: "syntax-error"   },
  { case_id: "baseline-06", setup_kind: "esm-import",     expected_rule: "esm-import-outside-module" },
  { case_id: "baseline-07", setup_kind: "esm-import",     expected_rule: "esm-import-outside-module" },
]);

/** TRAINING set: cases the training run designs candidate rules against */
export const SLICE1_TRAINING_CASES: readonly TrainingTaskCase[] = Object.freeze([
  { case_id: "train-01", setup_kind: "esm-import",     expected_rule: "esm-import-outside-module" },
  { case_id: "train-02", setup_kind: "esm-import",     expected_rule: "esm-import-outside-module" },
  { case_id: "train-03", setup_kind: "esm-import",     expected_rule: "esm-import-outside-module" },
  { case_id: "train-04", setup_kind: "export-in-cjs",  expected_rule: "unexpected-export-in-cjs" },
  { case_id: "train-05", setup_kind: "clean",          expected_rule: null                       },
  { case_id: "train-06", setup_kind: "syntax-error",   expected_rule: "syntax-error"             },
]);

/** GENERALISATION set: NEVER seen during training design */
export const SLICE1_GENERALISATION_CASES: readonly TrainingTaskCase[] = Object.freeze([
  { case_id: "genl-01", setup_kind: "esm-import",     expected_rule: "esm-import-outside-module" },
  { case_id: "genl-02", setup_kind: "esm-import",     expected_rule: "esm-import-outside-module" },
  { case_id: "genl-03", setup_kind: "export-in-cjs",  expected_rule: "unexpected-export-in-cjs" },
  { case_id: "genl-04", setup_kind: "clean",          expected_rule: null                       },
  { case_id: "genl-05", setup_kind: "clean",          expected_rule: null                       },
]);

/** ADVERSARIAL set: designed to be tricky — near-miss inputs the candidate
 *  rules could false-positive on. */
export const SLICE1_ADVERSARIAL_CASES: readonly TrainingTaskCase[] = Object.freeze([
  { case_id: "adv-01", setup_kind: "clean",          expected_rule: null            },   // "import" appearing in a comment should not trigger
  { case_id: "adv-02", setup_kind: "syntax-error",   expected_rule: "syntax-error"  },   // ordinary syntax error, not ESM
  { case_id: "adv-03", setup_kind: "missing-file",   expected_rule: "file-not-found"},   // ordinary ENOENT, not ESM
  { case_id: "adv-04", setup_kind: "clean",          expected_rule: null            },
  { case_id: "adv-05", setup_kind: "clean",          expected_rule: null            },
]);

/** REGRESSION set: cases the specialist was already good at — must remain
 *  passing after training. Reuses the baseline mix but with distinct ids. */
export const SLICE1_REGRESSION_CASES: readonly TrainingTaskCase[] = Object.freeze([
  { case_id: "regr-01", setup_kind: "missing-file",  expected_rule: "file-not-found" },
  { case_id: "regr-02", setup_kind: "syntax-error",  expected_rule: "syntax-error"   },
  { case_id: "regr-03", setup_kind: "clean",         expected_rule: null              },
  { case_id: "regr-04", setup_kind: "missing-file",  expected_rule: "file-not-found" },
]);

// ── Program constructor ────────────────────────────────────────────────

/** Build the slice-1 TrainingProgram. Enforces set disjointness. */
export function buildSlice1TrainingProgram(input: {
  readonly target_agent_id: string;
  readonly domain: string;
  readonly authorising_wo_id: string;
  readonly deterministic_seed?: string;
  readonly antecedent_provenance_hashes?: readonly string[];
}): TrainingProgram {
  const baseline_task_ids = SLICE1_BASELINE_CASES.map((c) => c.case_id);
  const training_task_ids = SLICE1_TRAINING_CASES.map((c) => c.case_id);
  const generalisation_task_ids = SLICE1_GENERALISATION_CASES.map((c) => c.case_id);
  const adversarial_task_ids = SLICE1_ADVERSARIAL_CASES.map((c) => c.case_id);
  const regression_task_ids = SLICE1_REGRESSION_CASES.map((c) => c.case_id);

  // Property: baseline/training/generalisation/adversarial/regression MUST be disjoint
  assertDisjoint("baseline vs training", baseline_task_ids, training_task_ids);
  assertDisjoint("baseline vs generalisation", baseline_task_ids, generalisation_task_ids);
  assertDisjoint("baseline vs adversarial", baseline_task_ids, adversarial_task_ids);
  assertDisjoint("training vs generalisation", training_task_ids, generalisation_task_ids);
  assertDisjoint("training vs adversarial", training_task_ids, adversarial_task_ids);
  assertDisjoint("training vs regression", training_task_ids, regression_task_ids);
  assertDisjoint("generalisation vs adversarial", generalisation_task_ids, adversarial_task_ids);
  assertDisjoint("adversarial vs regression", adversarial_task_ids, regression_task_ids);

  const program_id = `academy-program-${sha256Hex(input.target_agent_id + "esm-import-weakness").slice(0, 16)}-${randomUUID()}`;
  const base = {
    record_type: "NEX_ACADEMY_TRAINING_PROGRAM" as const,
    program_id,
    target_agent_id: input.target_agent_id,
    domain: input.domain,
    training_kind: "knowledge" as TrainingKind,
    targeted_weakness: "wo7-node-syntax-specialist does not classify ESM-import-in-CJS stderr as a distinct finding kind",
    baseline_task_ids: Object.freeze(baseline_task_ids) as readonly string[],
    training_task_ids: Object.freeze(training_task_ids) as readonly string[],
    generalisation_task_ids: Object.freeze(generalisation_task_ids) as readonly string[],
    adversarial_task_ids: Object.freeze(adversarial_task_ids) as readonly string[],
    regression_task_ids: Object.freeze(regression_task_ids) as readonly string[],
    max_attempts: 1,
    deterministic_seed: input.deterministic_seed ?? "wo-academy-02-slice1-2026-09-13",
    created_at: new Date().toISOString(),
    authorising_wo_id: input.authorising_wo_id,
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, input.antecedent_provenance_hashes ?? []) };
}

/** Look up a TrainingTaskCase by id across all slice-1 sets. */
export function slice1CaseById(case_id: string): TrainingTaskCase | null {
  return [
    ...SLICE1_BASELINE_CASES,
    ...SLICE1_TRAINING_CASES,
    ...SLICE1_GENERALISATION_CASES,
    ...SLICE1_ADVERSARIAL_CASES,
    ...SLICE1_REGRESSION_CASES,
  ].find((c) => c.case_id === case_id) ?? null;
}

function assertDisjoint(label: string, a: readonly string[], b: readonly string[]): void {
  const setA = new Set(a);
  for (const x of b) {
    if (setA.has(x)) {
      throw new Error(`[training-corpus] set-disjointness violation (${label}): shared id "${x}"`);
    }
  }
}
