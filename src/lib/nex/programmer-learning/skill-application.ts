// src/lib/nex/programmer-learning/skill-application.ts
//
// NEX Programmer Agent · Phase B · Safe skill application harness
// Philip 2026-09-05 · AUTHORIZE · PHASE B §8 §10
//
// Discipline:
//   · A Skill is only PROVEN when it has been APPLIED and OBSERVED.
//   · Reading documentation is RESEARCH · not application.
//   · Application MUST run in an isolated/safe environment (tmpdir).
//   · The harness captures the actual observed outcome and derives the
//     Experience record (with root_cause on failure per Phase A rules).
//
// The harness is intentionally minimal. It:
//   1. Prepares an isolated tmpdir (auto-cleanup)
//   2. Runs a caller-supplied apply_fn that RECEIVES the tmpdir path
//      and RETURNS an ApplicationOutcome describing what happened
//   3. Records an ExperienceItem via the Phase-A ingestion API
//   4. Refuses to record a failed experience without a root_cause
//   5. Returns the experience id + outcome for the caller
//
// The apply_fn is caller-supplied JavaScript — the harness does not
// interpret user-derived code. Callers are expected to pass a
// static function literal defining the safe application.

import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ExperienceOutcome, Provenance } from "./types";
import { captureExperience } from "./ingestion";
import { newProvenance } from "./store";

export type ApplicationOutcome = {
  outcome: ExperienceOutcome;
  expected_result: string;
  actual_result: string;
  evidence: string[];
  root_cause?: string | null;
  correction?: string | null;
  lessons: string[];
};

export type ApplySkillInput<TResult> = {
  skill_id: string;
  skill_name: string;
  task: string;
  initial_hypothesis: string;
  files_involved?: string[];
  related_knowledge?: string[];
  provenance: Provenance;
  /** Executed with an isolated tmpdir path. Returns an ApplicationOutcome
   *  that the harness uses to build the Experience record. */
  apply_fn: (tmpDir: string) => Promise<TResult & ApplicationOutcome> | (TResult & ApplicationOutcome);
  /** When true (default) the tmpdir is removed after apply_fn returns. */
  cleanup?: boolean;
};

export type ApplySkillResult<TResult> = {
  experience_id: string;
  tmpDir: string;
  outcome: ExperienceOutcome;
  result: TResult & ApplicationOutcome;
};

/**
 * Apply a skill inside an isolated tmpdir and record the Experience.
 * Refuses to record a failed Experience without a root_cause (§11).
 * On unexpected exception from apply_fn, records a failure with the
 * exception message as root_cause and rethrows for the caller.
 */
export async function applySkillSafely<TResult>(
  input: ApplySkillInput<TResult>,
): Promise<ApplySkillResult<TResult>> {
  const shouldCleanup = input.cleanup !== false;
  const tmpDir = mkdtempSync(path.join(tmpdir(), "nex-plearn-apply-"));
  let result: (TResult & ApplicationOutcome) | null = null;
  let harnessError: unknown = null;
  try {
    result = await input.apply_fn(tmpDir);
  } catch (e) {
    harnessError = e;
  }

  if (harnessError !== null) {
    const errMsg = (harnessError as Error)?.message ?? String(harnessError);
    const experience = captureExperience({
      task: input.task,
      initial_hypothesis: input.initial_hypothesis,
      action_taken: `Applied skill '${input.skill_name}' in isolated tmpdir ${tmpDir}`,
      files_involved: input.files_involved ?? [tmpDir],
      expected_result: "apply_fn returns ApplicationOutcome",
      actual_result: `apply_fn threw · ${errMsg}`,
      evidence: [`harness_exception:${errMsg.slice(0, 200)}`],
      outcome: "failure",
      root_cause: `apply_fn raised exception: ${errMsg.slice(0, 200)}`,
      correction: null,
      lessons: ["harness exception path invoked · caller apply_fn must return ApplicationOutcome"],
      related_knowledge: input.related_knowledge,
      related_skill: input.skill_id,
      provenance: input.provenance,
    });
    if (shouldCleanup && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
    throw new Error(`applySkillSafely: apply_fn failed · experience_id=${experience.experience_id} · original=${errMsg}`);
  }

  if (!result) {
    const experience = captureExperience({
      task: input.task,
      initial_hypothesis: input.initial_hypothesis,
      action_taken: `Applied skill '${input.skill_name}' in isolated tmpdir ${tmpDir}`,
      files_involved: input.files_involved ?? [tmpDir],
      expected_result: "apply_fn returns ApplicationOutcome",
      actual_result: "apply_fn returned undefined/null",
      evidence: ["harness_null_result"],
      outcome: "failure",
      root_cause: "apply_fn returned undefined · Phase-B contract requires an ApplicationOutcome",
      correction: null,
      lessons: [],
      related_knowledge: input.related_knowledge,
      related_skill: input.skill_id,
      provenance: input.provenance,
    });
    if (shouldCleanup && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
    throw new Error(`applySkillSafely: apply_fn returned no ApplicationOutcome · experience_id=${experience.experience_id}`);
  }

  const experience = captureExperience({
    task: input.task,
    initial_hypothesis: input.initial_hypothesis,
    action_taken: `Applied skill '${input.skill_name}' in isolated tmpdir ${tmpDir}`,
    files_involved: input.files_involved ?? [tmpDir],
    expected_result: result.expected_result,
    actual_result: result.actual_result,
    evidence: result.evidence,
    outcome: result.outcome,
    root_cause: result.root_cause ?? null,
    correction: result.correction ?? null,
    lessons: result.lessons,
    related_knowledge: input.related_knowledge,
    related_skill: input.skill_id,
    provenance: input.provenance,
  });

  if (shouldCleanup && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });

  return {
    experience_id: experience.experience_id,
    tmpDir,
    outcome: result.outcome,
    result,
  };
}

// Small convenience: prevent unused-import stripper from removing
// newProvenance which callers commonly want to import via this module.
export { newProvenance };
