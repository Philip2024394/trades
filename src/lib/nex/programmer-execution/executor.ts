// src/lib/nex/programmer-execution/executor.ts
//
// NEX Programmer Agent · Phase G · bounded execution orchestrator
// Philip 2026-09-06 · AUTHORIZE · PHASE G · §3 §5 §9 §10 §11 §17 §18 §20
//
// The executor takes ONE TaskContract and runs the pipeline:
//   PLAN → IMPLEMENT → TEST → REVIEW → BENCHMARK → STABILITY → VERIFY
// It never generates code via an LLM. All code changes come from:
//   (a) contract.provided_plan, or
//   (b) a whitelisted RepairSkill in `RepairSkillRegistry` (declarative,
//       deterministic, no arbitrary code generation).
//
// Every iteration checks the budget. Every operation goes through
// file/tool policy. Every failure is FIRST-CLASS.

import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import type {
  ExecutionRun,
  ExecutionStatus,
  IterationRecord,
  RepairPlan,
  RepairSkill,
  RepairFileOp,
  SuccessCondition,
  TaskContract,
  TestResult,
  ToolCapability,
} from "./types";
import { validateTaskContract, checkToolAllowed, taskContractHash } from "./contract";
import { createSandbox, discardSandbox, writeSandboxFile, readSandboxFile, deleteSandboxFile, listSandboxFiles, type SandboxHandle } from "./sandbox";

// ─── Repair skill registry (declarative · empty by default) ────

const REPAIR_SKILLS = new Map<string, RepairSkill>();

/** Register a RepairSkill. Registration is intentionally exposed so
 *  test fixtures can add skills without polluting the module surface.
 *  The set of allowed skill IDs is always contract-controlled. */
export function registerRepairSkill(skill: RepairSkill): void {
  REPAIR_SKILLS.set(skill.skill_id, skill);
}

export function getRegisteredRepairSkills(): readonly string[] {
  return [...REPAIR_SKILLS.keys()].sort();
}

export function _clearRepairSkillsForTests(): void {
  REPAIR_SKILLS.clear();
}

// ─── Executor input ────────────────────────────────────────────

export type ExecuteInput = {
  contract: TaskContract;
  repo_root: string;
  /** Optional override — for tests wanting deterministic run ids. */
  run_id_override?: string;
  /** Optional override for iteration-time clock (for deterministic tests). */
  now?: () => string;
  triggered_by?: ExecutionRun["triggered_by"];
};

// ─── Execute one bounded task ──────────────────────────────────

export function executeTask(input: ExecuteInput): ExecutionRun {
  const now = input.now ?? (() => new Date().toISOString());
  const triggered_by = input.triggered_by ?? "manual";
  const started_at = now();
  const run_id = input.run_id_override ?? `exec_${randomUUID()}`;
  const environment_identifier = `node:${process.version}:${process.platform}`;

  const denied_operations: ExecutionRun["denied_operations"] = [];
  const iterations: IterationRecord[] = [];
  const filesModified = new Set<string>();

  const terminate = (
    sandbox: SandboxHandle | null,
    final_status: ExecutionStatus,
    reason: string,
  ): ExecutionRun => {
    const finished_at = now();
    const files_modified = [...filesModified].sort();
    const isFailure = (["FAILED", "BLOCKED", "ESCALATED", "ROLLED_BACK"] as ExecutionStatus[]).includes(final_status);
    if (sandbox && isFailure && input.contract.rollback_on_failure) {
      discardSandbox(sandbox);
    }
    const contractHash = taskContractHash(input.contract);
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({
        run_id, task_id: input.contract.task_id,
        contract_hash: contractHash,
        files_modified,
        denied_ops: denied_operations.map((d) => `${d.kind}:${d.detail}`).sort(),
        final_status,
        iteration_count: iterations.length,
      }))
      .digest("hex")
      .slice(0, 24);
    return {
      run_id,
      task_id: input.contract.task_id,
      environment_identifier,
      started_at,
      finished_at,
      triggered_by,
      sandbox_root: sandbox?.root ?? "",
      contract: input.contract,
      iterations,
      files_modified,
      final_status,
      final_status_narrative: null,
      denied_operations,
      execution_fingerprint: fingerprint,
    };
  };

  // ─── Structural contract validation ─────────────────────────
  const v = validateTaskContract(input.contract);
  if (!v.ok) {
    denied_operations.push({ kind: "protected_path", detail: `contract_invalid:${v.reason}`, at: now() });
    return terminate(null, "BLOCKED", `contract_invalid:${v.reason}`);
  }

  // ─── Sandbox provisioning ───────────────────────────────────
  let sandbox: SandboxHandle;
  try {
    sandbox = createSandbox(input.contract.sandbox_parent_dir);
  } catch (e) {
    denied_operations.push({ kind: "protected_path", detail: `sandbox_create_failed:${(e as Error).message}`, at: now() });
    return terminate(null, "BLOCKED", "sandbox_create_failed");
  }

  const runStart = Date.now();

  // ─── Iteration loop ─────────────────────────────────────────
  for (let i = 1; i <= input.contract.max_iterations; i++) {
    const iterationStart = now();
    const record: IterationRecord & { status_transitions: IterationRecord["status_transitions"][number][] } = {
      iteration: i,
      started_at: iterationStart,
      finished_at: null,
      status_transitions: [],
      plan_id: null,
      file_ops_applied: 0,
      test_command: null,
      test_result: null,
      review_verdict: null,
      notes: "",
    };
    const transition = (from: ExecutionStatus, to: ExecutionStatus, note?: string) => {
      record.status_transitions.push({ from, to, at: now(), note });
    };

    if (Date.now() - runStart > input.contract.max_runtime_ms) {
      denied_operations.push({ kind: "budget_exhausted", detail: "max_runtime_ms", at: now() });
      record.finished_at = now();
      iterations.push(record);
      return terminate(sandbox, "FAILED", "budget_exhausted:runtime");
    }

    // 1 · PLANNING · pick a plan
    transition("CREATED", "PLANNING");
    const plan = pickPlan(input.contract, sandbox, i, denied_operations, now);
    if (!plan) {
      record.finished_at = now();
      iterations.push(record);
      // No plan available under the contract's constraints — escalate rather than continue.
      return terminate(sandbox, "ESCALATED", "no_plan_available");
    }
    record.plan_id = plan.plan_id;

    // 2 · IMPLEMENTING · apply plan operations · every op goes through
    // sandbox guard which honours the file policy and protected paths.
    transition("PLANNING", "IMPLEMENTING");
    let planAppliedSuccessfully = true;
    for (const op of plan.operations) {
      // Enforce per-op file changed cap
      if (filesModified.size >= input.contract.max_files_changed && !filesModified.has(op.sandbox_relpath)) {
        denied_operations.push({ kind: "budget_exhausted", detail: `max_files_changed:${input.contract.max_files_changed}`, at: now() });
        planAppliedSuccessfully = false;
        break;
      }
      const applied = applyPlanOp(op, sandbox, input.contract, input.repo_root);
      if (!applied.ok) {
        denied_operations.push({ kind: applied.denial_kind, detail: applied.detail, at: now() });
        planAppliedSuccessfully = false;
        break;
      }
      filesModified.add(op.sandbox_relpath);
      record.file_ops_applied += 1;
    }
    if (!planAppliedSuccessfully) {
      record.finished_at = now();
      record.notes = "plan_apply_failed";
      iterations.push(record);
      return terminate(sandbox, "BLOCKED", "plan_apply_failed");
    }

    // 3 · TESTING · run the first test-success condition (if any)
    transition("IMPLEMENTING", "TESTING");
    const testCond = input.contract.success_conditions.find((c) => c.kind === "test_command_passes");
    if (testCond && testCond.kind === "test_command_passes") {
      if (!checkToolAllowed(input.contract, "run_test")) {
        denied_operations.push({ kind: "tool_denied", detail: "run_test", at: now() });
        record.finished_at = now();
        iterations.push(record);
        return terminate(sandbox, "BLOCKED", "run_test_not_allowed");
      }
      const t = runTest(testCond.command, testCond.args, sandbox);
      record.test_command = `${testCond.command} ${testCond.args.join(" ")}`;
      record.test_result = t;
      if (!t.passed) {
        // Continue to next iteration (bounded retry) unless this was the last.
        record.finished_at = now();
        record.notes = `test_failed_iteration:${i}`;
        iterations.push(record);
        if (i < input.contract.max_iterations) continue;
        return terminate(sandbox, "FAILED", `test_failed_after_${i}_iterations`);
      }
    }

    // 4 · REVIEWING · optional Phase C review invocation
    transition("TESTING", "REVIEWING");
    // Reviewer wiring is intentionally deferred to the executor caller —
    // the caller supplies a pre-formed ReviewRequest through the
    // `providedReview` cycle input (Phase F pattern). Phase G's executor
    // records a stub verdict; a caller running the pipeline WITH review
    // uses the loop wrapper above the executor. Keeping executor pure
    // here preserves anti-self-reinforcement (executor does NOT invoke
    // the reviewer on its own behalf).

    // 5 · Verify remaining success conditions (file_contains / file_absent)
    transition("REVIEWING", "VERIFIED");
    const allConditionsMet = verifySuccessConditions(input.contract.success_conditions, sandbox, input.contract, input.repo_root);
    if (!allConditionsMet.ok) {
      record.finished_at = now();
      record.notes = `success_conditions_not_met:${allConditionsMet.reason}`;
      iterations.push(record);
      if (i < input.contract.max_iterations) continue;
      return terminate(sandbox, "FAILED", allConditionsMet.reason);
    }

    record.finished_at = now();
    record.notes = "verified";
    iterations.push(record);
    return terminate(sandbox, "VERIFIED", "success_conditions_met");
  }

  // Should not reach here — the loop returns before falling out.
  return terminate(sandbox, "FAILED", "iterations_exhausted_without_termination");
}

// ─── Plan selection ────────────────────────────────────────────

function pickPlan(
  contract: TaskContract,
  sandbox: SandboxHandle,
  iteration: number,
  denied: ExecutionRun["denied_operations"],
  now: () => string,
): RepairPlan | null {
  // Provided plan wins outright.
  if (contract.provided_plan) return contract.provided_plan;
  const allowed = contract.allowed_repair_skills ?? [];
  if (allowed.length === 0) return null;
  for (const id of allowed) {
    const skill = REPAIR_SKILLS.get(id);
    if (!skill) {
      denied.push({ kind: "tool_denied", detail: `unknown_repair_skill:${id}`, at: now() });
      continue;
    }
    const ctx = {
      readFile: (rel: string) => {
        const r = readSandboxFile({ sandbox, repo_root: process.cwd(), contract, relpath: rel });
        return r.ok ? r.content : null;
      },
      listFiles: () => listSandboxFiles(sandbox),
      iteration,
    };
    if (skill.applies(ctx)) {
      return skill.build_plan(ctx);
    }
  }
  return null;
}

// ─── Plan application ─────────────────────────────────────────

type OpApplied =
  | { ok: true }
  | { ok: false; denial_kind: "file_denied" | "tool_denied" | "path_traversal" | "protected_path"; detail: string };

function applyPlanOp(op: RepairFileOp, sandbox: SandboxHandle, contract: TaskContract, repo_root: string): OpApplied {
  if (op.op === "write") {
    if (!checkToolAllowed(contract, "write_sandbox_file")) {
      return { ok: false, denial_kind: "tool_denied", detail: "write_sandbox_file" };
    }
    const r = writeSandboxFile({ sandbox, repo_root, contract, relpath: op.sandbox_relpath, content: op.content });
    if (!r.ok) {
      const denialKind: OpApplied extends { ok: false; denial_kind: infer K } ? K : never = r.reason.startsWith("file_denied:sandbox_escape")
        ? "protected_path"
        : r.reason.startsWith("file_denied:protected_path")
        ? "protected_path"
        : r.reason === "path_traversal"
        ? "path_traversal"
        : "file_denied";
      return { ok: false, denial_kind: denialKind, detail: r.reason };
    }
    return { ok: true };
  }
  if (op.op === "delete") {
    if (!checkToolAllowed(contract, "delete_sandbox_file")) {
      return { ok: false, denial_kind: "tool_denied", detail: "delete_sandbox_file" };
    }
    const r = deleteSandboxFile({ sandbox, repo_root, contract, relpath: op.sandbox_relpath });
    if (!r.ok) {
      return { ok: false, denial_kind: "file_denied", detail: r.reason };
    }
    return { ok: true };
  }
  return { ok: false, denial_kind: "tool_denied", detail: "unknown_op" };
}

// ─── Test execution ────────────────────────────────────────────

function runTest(command: string, args: readonly string[], sandbox: SandboxHandle): TestResult {
  const start = Date.now();
  const r = spawnSync(command, [...args], {
    cwd: sandbox.root,
    timeout: 30_000,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const duration_ms = Date.now() - start;
  const stdout_tail = (r.stdout ?? "").slice(-1000);
  const stderr_tail = (r.stderr ?? "").slice(-1000);
  const passed = r.status === 0 && !r.error;
  return {
    passed,
    exit_code: r.status,
    stdout_tail,
    stderr_tail,
    duration_ms,
  };
}

// ─── Success condition verification ────────────────────────────

function verifySuccessConditions(
  conditions: readonly SuccessCondition[],
  sandbox: SandboxHandle,
  contract: TaskContract,
  repo_root: string,
): { ok: true } | { ok: false; reason: string } {
  for (const cond of conditions) {
    if (cond.kind === "file_contains") {
      const r = readSandboxFile({ sandbox, repo_root, contract, relpath: cond.sandbox_relpath });
      if (!r.ok) return { ok: false, reason: `file_missing:${cond.sandbox_relpath}` };
      if (!r.content.includes(cond.needle)) return { ok: false, reason: `needle_missing:${cond.sandbox_relpath}:${cond.needle}` };
    } else if (cond.kind === "file_absent") {
      const r = readSandboxFile({ sandbox, repo_root, contract, relpath: cond.sandbox_relpath });
      if (r.ok) return { ok: false, reason: `file_present_should_be_absent:${cond.sandbox_relpath}` };
    }
    // test_command_passes was handled inside the iteration loop
  }
  return { ok: true };
}
