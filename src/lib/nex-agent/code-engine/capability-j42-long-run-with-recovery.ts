// src/lib/nex-agent/code-engine/capability-j42-long-run-with-recovery.ts
//
// NEX1 · CAPABILITY J.4.2 · LONG AUTONOMOUS LOOP WITH IN-LOOP RECOVERY.
//
// taught_by = master_ai_engineer · 2026-09-12
// Teaching infrastructure only · NOT NEX1 independent authorship.
//
// Extends J.4.1's discipline to include RECOVERY inside the sequence:
// a queue item may be either
//   · `add_field`         · a plain H.1 goal (like J.4.1)
//   · `fix_failing_test`  · a J.1 → J.2 → J.3 recovery chain against a
//                           specific test file
//
// State discipline is identical to J.4.1: every goal ends in one of
// verified · refused · failed_hard · queued. FAILED_HARD → STOP.
// The manager never enters "try until something works" mode.
//
// Chain of custody: for fix_failing_test items, the recovery goes
// through J.2 (diagnose + propose) and J.3 (apply + verify + rollback).
// If J.2 refuses or J.3 rejects, the item is FAILED_HARD.
//
// Removing this module must not remove any NEX1-owned identity, memory,
// evidence, orchestration, ladder, audit, or safety mechanism.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import type { TemplateDirective } from "./types";
import type { Nex1GoalRecord } from "./capability-h-planning";
import { planGoalToDirective } from "./capability-h-planning";
import type { Nex1DiscoveryScope } from "./capability-f-discovery";
import { extractRuntimeFailures } from "./capability-j-runtime-diagnosis";
import { diagnoseAndPropose } from "./capability-j2-cause-analysis";
import { executeAndVerifyRepair, type Nex1J3RunSpec } from "./capability-j3-verify-repair";

export type Nex1GoalStateWithRecovery =
  | "queued"
  | "running"
  | "verified"
  | "verified_with_recovery"
  | "refused"
  | "failed_hard";

export interface Nex1LongRunAddFieldItem {
  readonly id: string;
  readonly kind: "add_field";
  readonly goal: Nex1GoalRecord;
}

export interface Nex1LongRunFixFailingTestItem {
  readonly id: string;
  readonly kind: "fix_failing_test";
  readonly test_file: string;
  readonly vitest_config: string;
}

export type Nex1LongRunItem = Nex1LongRunAddFieldItem | Nex1LongRunFixFailingTestItem;

export interface Nex1LongRunRecoveryRecord {
  readonly items: readonly Nex1LongRunItem[];
  readonly max_iterations?: number;
  readonly instruction?: string;
}

export type Nex1LongRunRecoveryVerdict =
  | "all_verified"
  | "refused_empty"
  | "refused_unsafe_instruction"
  | "refused_iteration_cap_exceeded"
  | "failed_hard_mid_run"
  | "stopped_by_refusal";

export interface Nex1LongRunRecoveryGoalResult {
  readonly id: string;
  readonly kind: "add_field" | "fix_failing_test";
  readonly state: Nex1GoalStateWithRecovery;
  readonly reason: string;
  readonly recovery_used: boolean;
  readonly j3_verdict?: string;
}

export interface Nex1LongRunRecoveryResult {
  readonly verdict: Nex1LongRunRecoveryVerdict;
  readonly per_goal: readonly Nex1LongRunRecoveryGoalResult[];
  readonly rollback_status: "restored" | "not_needed" | "failed";
  readonly stopped_after_id: string | null;
  readonly reasoning_trace: readonly string[];
  readonly taught_by: "master_ai_engineer";
}

export interface Nex1LongRunRecoveryExecutor {
  readonly repo_root: string;
  readonly scope: Nex1DiscoveryScope;
  readonly apply_directive: (target: string, directive: TemplateDirective) => Promise<{ ok: true; delta: number } | { ok: false; reason: string }>;
  readonly tsc_errors_scoped: (targets: readonly string[]) => number;
}

const DEFAULT_MAX_ITER = 5;

export async function executeLongRunWithRecovery(
  spec: Nex1LongRunRecoveryRecord,
  exec: Nex1LongRunRecoveryExecutor,
): Promise<Nex1LongRunRecoveryResult> {
  const trace: string[] = [];
  const T = (s: string) => trace.push(s);
  const perGoal: Nex1LongRunRecoveryGoalResult[] = [];

  // ── Run-level unsafe-instruction guard ──────────────────────────────
  const instr = spec.instruction?.toLowerCase() ?? "";
  if (
    /ignore\s+protect/.test(instr) ||
    /bypass/.test(instr) ||
    /override\s+safety/.test(instr) ||
    /disable\s+guard/.test(instr) ||
    /disable\s+security/.test(instr)
  ) {
    return {
      verdict: "refused_unsafe_instruction",
      per_goal: [],
      rollback_status: "not_needed",
      stopped_after_id: null,
      reasoning_trace: ["run-level instruction attempts to override safety"],
      taught_by: "master_ai_engineer",
    };
  }

  if (!spec.items || spec.items.length === 0) {
    return {
      verdict: "refused_empty",
      per_goal: [],
      rollback_status: "not_needed",
      stopped_after_id: null,
      reasoning_trace: ["long-run spec has no items"],
      taught_by: "master_ai_engineer",
    };
  }

  const cap = spec.max_iterations ?? DEFAULT_MAX_ITER;
  if (spec.items.length > cap) {
    for (let i = 0; i < spec.items.length; i++) {
      const it = spec.items[i];
      perGoal.push({
        id: it.id,
        kind: it.kind,
        state: i < cap ? "queued" : "refused",
        reason: i < cap ? "not started · run refused before execution" : "iteration cap exceeded",
        recovery_used: false,
      });
    }
    return {
      verdict: "refused_iteration_cap_exceeded",
      per_goal: perGoal,
      rollback_status: "not_needed",
      stopped_after_id: null,
      reasoning_trace: [`queue length ${spec.items.length} exceeds max_iterations ${cap}`],
      taught_by: "master_ai_engineer",
    };
  }

  const snapshots = new Map<string, string>();
  const rollbackAll = (): "restored" | "failed" => {
    for (const [target, content] of snapshots) {
      try {
        writeFileSync(resolve(exec.repo_root, target), content, "utf8");
      } catch {
        return "failed";
      }
    }
    return "restored";
  };

  for (let i = 0; i < spec.items.length; i++) {
    const item = spec.items[i];
    T(`item ${item.id} · kind=${item.kind} · running`);

    if (item.kind === "add_field") {
      const h1 = planGoalToDirective(item.goal, exec.scope);
      if (h1.kind !== "planned" || !h1.directive) {
        const hardRefusalKinds = new Set(["refused_protected_path", "refused_unsafe_instruction"]);
        const isHard = hardRefusalKinds.has(h1.kind);
        perGoal.push({
          id: item.id,
          kind: "add_field",
          state: "refused",
          reason: `H.1 refused (${h1.kind}) · ${h1.reason.slice(0, 100)}`,
          recovery_used: false,
        });
        if (isHard) {
          for (let j = i + 1; j < spec.items.length; j++) {
            perGoal.push({ id: spec.items[j].id, kind: spec.items[j].kind, state: "queued", reason: "not started · earlier hard refusal", recovery_used: false });
          }
          const rb = rollbackAll();
          return {
            verdict: "stopped_by_refusal",
            per_goal: perGoal,
            rollback_status: snapshots.size > 0 ? rb : "not_needed",
            stopped_after_id: item.id,
            reasoning_trace: trace,
            taught_by: "master_ai_engineer",
          };
        }
        continue;
      }

      const relTarget = h1.target_file!;
      const abs = resolve(exec.repo_root, relTarget);
      if (!snapshots.has(relTarget)) snapshots.set(relTarget, readFileSync(abs, "utf8"));

      const applied = await exec.apply_directive(relTarget, h1.directive);
      if (!applied.ok) {
        perGoal.push({
          id: item.id,
          kind: "add_field",
          state: "failed_hard",
          reason: `apply failed · ${applied.reason}`,
          recovery_used: false,
        });
        for (let j = i + 1; j < spec.items.length; j++) {
          perGoal.push({ id: spec.items[j].id, kind: spec.items[j].kind, state: "queued", reason: "not started · earlier goal failed hard", recovery_used: false });
        }
        const rb = rollbackAll();
        return {
          verdict: "failed_hard_mid_run",
          per_goal: perGoal,
          rollback_status: rb,
          stopped_after_id: item.id,
          reasoning_trace: trace,
          taught_by: "master_ai_engineer",
        };
      }

      const targetsSoFar = Array.from(snapshots.keys());
      const tscErrors = exec.tsc_errors_scoped(targetsSoFar);
      if (tscErrors > 0) {
        perGoal.push({
          id: item.id,
          kind: "add_field",
          state: "failed_hard",
          reason: `post-apply tsc reports ${tscErrors} error(s) · unrecoverable in add_field flow`,
          recovery_used: false,
        });
        for (let j = i + 1; j < spec.items.length; j++) {
          perGoal.push({ id: spec.items[j].id, kind: spec.items[j].kind, state: "queued", reason: "not started · earlier goal failed hard", recovery_used: false });
        }
        const rb = rollbackAll();
        return {
          verdict: "failed_hard_mid_run",
          per_goal: perGoal,
          rollback_status: rb,
          stopped_after_id: item.id,
          reasoning_trace: trace,
          taught_by: "master_ai_engineer",
        };
      }

      perGoal.push({
        id: item.id,
        kind: "add_field",
        state: "verified",
        reason: "H.1 planned · apply ok · tsc scoped clean",
        recovery_used: false,
      });
      continue;
    }

    // ── item.kind === "fix_failing_test" · in-loop recovery ─────────
    const runSpec: Nex1J3RunSpec = { config_file: item.vitest_config, test_files: [item.test_file] };
    // Run vitest → extract failures via J.1
    const vt = runVitestForOutput(runSpec, exec.repo_root);
    T(`item ${item.id} · vitest exit=${vt.exit_code}`);
    const extract = extractRuntimeFailures(vt.output);
    if (extract.kind !== "ok" || extract.findings.length === 0) {
      // No failure OR extractor refused · this item cannot use recovery
      const isPassing = vt.exit_code === 0 && vt.passed > 0 && vt.failed === 0;
      if (isPassing) {
        perGoal.push({ id: item.id, kind: "fix_failing_test", state: "verified", reason: "test was already passing · no recovery needed", recovery_used: false });
        continue;
      }
      perGoal.push({
        id: item.id,
        kind: "fix_failing_test",
        state: "failed_hard",
        reason: `J.1 could not extract findings (${extract.kind})`,
        recovery_used: false,
      });
      for (let j = i + 1; j < spec.items.length; j++) {
        perGoal.push({ id: spec.items[j].id, kind: spec.items[j].kind, state: "queued", reason: "not started · earlier goal failed hard", recovery_used: false });
      }
      const rb = rollbackAll();
      return {
        verdict: "failed_hard_mid_run",
        per_goal: perGoal,
        rollback_status: snapshots.size > 0 ? rb : "not_needed",
        stopped_after_id: item.id,
        reasoning_trace: trace,
        taught_by: "master_ai_engineer",
      };
    }

    // J.2 · diagnose + propose
    const finding = extract.findings[0];
    const diagnosis = diagnoseAndPropose(finding, exec.repo_root);
    T(`item ${item.id} · J.2 kind=${diagnosis.kind}`);
    if (diagnosis.kind !== "proposal") {
      perGoal.push({
        id: item.id,
        kind: "fix_failing_test",
        state: "failed_hard",
        reason: `J.2 refused to propose (${diagnosis.kind}) · ${diagnosis.diagnosis.slice(0, 80)}`,
        recovery_used: true,
      });
      for (let j = i + 1; j < spec.items.length; j++) {
        perGoal.push({ id: spec.items[j].id, kind: spec.items[j].kind, state: "queued", reason: "not started · earlier goal failed hard", recovery_used: false });
      }
      const rb = rollbackAll();
      return {
        verdict: "failed_hard_mid_run",
        per_goal: perGoal,
        rollback_status: snapshots.size > 0 ? rb : "not_needed",
        stopped_after_id: item.id,
        reasoning_trace: trace,
        taught_by: "master_ai_engineer",
      };
    }

    // J.3 · apply · rerun · prove (J.3 rolls back internally)
    const j3 = await executeAndVerifyRepair(diagnosis, runSpec, exec.repo_root);
    T(`item ${item.id} · J.3 verdict=${j3.verdict}`);
    if (j3.verdict !== "verified_repair") {
      perGoal.push({
        id: item.id,
        kind: "fix_failing_test",
        state: "failed_hard",
        reason: `J.3 verdict=${j3.verdict}`,
        recovery_used: true,
        j3_verdict: j3.verdict,
      });
      for (let j = i + 1; j < spec.items.length; j++) {
        perGoal.push({ id: spec.items[j].id, kind: spec.items[j].kind, state: "queued", reason: "not started · earlier goal failed hard", recovery_used: false });
      }
      const rb = rollbackAll();
      return {
        verdict: "failed_hard_mid_run",
        per_goal: perGoal,
        rollback_status: snapshots.size > 0 ? rb : "not_needed",
        stopped_after_id: item.id,
        reasoning_trace: trace,
        taught_by: "master_ai_engineer",
      };
    }

    perGoal.push({
      id: item.id,
      kind: "fix_failing_test",
      state: "verified_with_recovery",
      reason: `recovery succeeded · J.1 finding → J.2 proposal → J.3 verified_repair · fixture restored by J.3`,
      recovery_used: true,
      j3_verdict: j3.verdict,
    });
  }

  const rb = rollbackAll();
  return {
    verdict: "all_verified",
    per_goal: perGoal,
    rollback_status: snapshots.size > 0 ? rb : "not_needed",
    stopped_after_id: null,
    reasoning_trace: trace,
    taught_by: "master_ai_engineer",
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function runVitestForOutput(runSpec: Nex1J3RunSpec, repoRoot: string): { exit_code: number; passed: number; failed: number; output: string } {
  const args = ["vitest", "run", `--config=${runSpec.config_file}`, ...runSpec.test_files, "--reporter=default"];
  const vt = spawnSync("npx", args, {
    stdio: "pipe", shell: true, encoding: "utf8", cwd: repoRoot,
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
  });
  const output = (vt.stdout ?? "") + "\n" + (vt.stderr ?? "");
  const passed = Number(/(\d+)\s+passed/.exec(output)?.[1] ?? "0");
  const failed = Number(/(\d+)\s+failed/.exec(output)?.[1] ?? "0");
  return { exit_code: vt.status ?? 1, passed, failed, output };
}
