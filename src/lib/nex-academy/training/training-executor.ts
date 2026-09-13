// WO-ACADEMY-02 · training executor.
//
// Runs the real WO-07 specialist against a training task, captures the
// real stderr + real findings, applies the candidate rule set on top,
// and reports whether the AUGMENTED result matches the expected outcome.
//
// Zero mocks. Real subprocess via wo7-run-specialist.runSpecialist. The
// specialist source is never modified.

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { runSpecialist } from "@/lib/nex1-orchestrator/wo7-run-specialist";
import type { SpecialistFinding } from "@/lib/nex1-orchestrator/wo7-types";
import { applyCandidateRules, type CandidateRule } from "./candidate-rules";
import type { OutcomeKind, TaskOutcome } from "./types";

export interface TrainingTaskCase {
  readonly case_id: string;
  /** How to set up the sandbox for this case: e.g. "esm-import-in-cjs",
   *  "syntax-error", "clean", "missing-file". */
  readonly setup_kind: "missing-file" | "syntax-error" | "clean" | "esm-import" | "require-of-esm" | "export-in-cjs";
  /** Expected outcome for a PASSING result. */
  readonly expected_rule: string | null;   // null = "PASSED with no findings"
}

export interface RunTaskInput {
  readonly case: TrainingTaskCase;
  readonly sandbox_root: string;
  readonly candidate_rules: readonly CandidateRule[];   // [] for baseline
}

export interface RunTaskResult {
  readonly outcome: TaskOutcome;
  readonly real_findings: readonly SpecialistFinding[];
  readonly augmented_findings: readonly SpecialistFinding[];
  readonly real_stderr: string;
}

/**
 * Set up the sandbox for a case, then run the real specialist. Compare
 * the (real + candidate) findings against the expected rule.
 */
export async function runTrainingTask(input: RunTaskInput): Promise<RunTaskResult> {
  const caseDir = path.join(input.sandbox_root, input.case.case_id);
  await fs.mkdir(caseDir, { recursive: true });
  const targetName = `${input.case.case_id}-target.js`;
  const targetPath = path.join(caseDir, targetName);

  // Setup per case kind
  switch (input.case.setup_kind) {
    case "missing-file":
      // Deliberately do NOT create the file — triggers ENOENT
      break;
    case "syntax-error":
      await fs.writeFile(targetPath, "function () { return 1; }\n");
      break;
    case "clean":
      await fs.writeFile(targetPath, "console.log(1);\n");
      break;
    case "esm-import":
      await fs.writeFile(targetPath, "import path from 'node:path';\nconsole.log(path);\n");
      break;
    case "require-of-esm":
      await fs.writeFile(targetPath, "// simulated: require of an ES module\nrequire('./nonexistent.mjs');\n");
      break;
    case "export-in-cjs":
      await fs.writeFile(targetPath, "export const x = 1;\n");
      break;
  }

  // Real specialist invocation
  const specResult = await runSpecialist({
    record_type: "NEX1_SPECIALIST_INVOCATION",
    invocation_id: `academy-train-${randomUUID()}`,
    trace_id: `academy-training-run`,
    work_order_id: "wo-academy-02",
    project_id: "academy-training",
    kind: "node-syntax",
    workspace_root: caseDir,
    targets: [targetName],
    timeout_ms: 10_000,
  });

  const real_findings: readonly SpecialistFinding[] = specResult.ok ? specResult.result.findings : [];
  const real_stderr = specResult.ok
    ? ((specResult.result as unknown as { report?: { stderr?: string } }).report?.stderr ?? "")
    : "";

  const augmented = applyCandidateRules({
    real_findings,
    real_stderr,
    candidate_rules: input.candidate_rules,
  });

  // Compare against expected
  let outcome: OutcomeKind;
  let matched_pattern: string | null = null;

  if (input.case.expected_rule === null) {
    // Expect PASSED with zero findings
    outcome = augmented.length === 0 ? "SUCCESS" : "FAILURE";
  } else {
    const match = augmented.find((f) => f.rule === input.case.expected_rule);
    if (match) {
      outcome = "SUCCESS";
      matched_pattern = match.rule ?? null;
    } else if (augmented.length > 0) {
      outcome = "FAILURE";   // wrong finding, or missing expected
    } else {
      outcome = "LIMITATION";   // no finding at all — specialist + candidates BOTH missed
    }
  }

  return {
    outcome: {
      task_id: input.case.case_id,
      outcome,
      evidence_pointer: `academy-training-${input.case.case_id}`,
      matched_pattern,
    },
    real_findings,
    augmented_findings: augmented,
    real_stderr,
  };
}
