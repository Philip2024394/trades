// src/lib/nex-agent/code-engine/capability-j4-long-run.ts
//
// NEX1 · CAPABILITY J.4.1 · LONG AUTONOMOUS LOOP · PILOT · deterministic.
//
// taught_by = master_ai_engineer · 2026-09-12
// Teaching infrastructure only · NOT NEX1 independent authorship.
//
// Purpose: process a bounded queue of independent engineering goals,
// verifying each one before moving to the next. Every goal transitions
// through explicit states:
//   QUEUED → RUNNING → VERIFIED     (success)
//   QUEUED → RUNNING → REFUSED      (soft input rejection · continues)
//   QUEUED → RUNNING → FAILED_HARD  (unrecoverable · STOPS the whole run)
//
// Discipline (per founder authorization 2026-09-12):
//   · maximum-iteration cap · exceeded → refuse-remaining, stop
//   · per-goal state is explicit · no "in progress" ambiguity
//   · FAILED_HARD → immediate stop · no secret retries · no improvising
//   · Any mutation from verified goals is rolled back if the run ends
//     in FAILED_HARD · byte-identity preserved at exit
//   · Run-level unsafe instruction → whole run refused before any goal
//     is inspected · no mutation
//   · Each goal is validated by H.1 before any mutation is applied
//   · Chain of custody preserved: goals do not bypass H.1 or J.3-like
//     safety gates
//
// Removing this module must not remove any NEX1-owned identity, memory,
// evidence, orchestration, ladder, audit, or safety mechanism.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import type { TemplateDirective } from "./types";
import type { Nex1GoalRecord } from "./capability-h-planning";
import { planGoalToDirective } from "./capability-h-planning";
import type { Nex1DiscoveryScope } from "./capability-f-discovery";

export type Nex1GoalState = "queued" | "running" | "verified" | "refused" | "failed_hard";

export interface Nex1LongRunGoal {
  readonly id: string;
  readonly goal: Nex1GoalRecord;
}

export interface Nex1LongRunRecord {
  readonly goals: readonly Nex1LongRunGoal[];
  readonly max_iterations?: number;
  readonly instruction?: string;
}

export type Nex1LongRunVerdict =
  | "all_verified"
  | "refused_empty"
  | "refused_unsafe_instruction"
  | "refused_iteration_cap_exceeded"
  | "failed_hard_mid_run"
  | "stopped_by_refusal";

export interface Nex1LongRunGoalResult {
  readonly id: string;
  readonly state: Nex1GoalState;
  readonly reason: string;
  readonly directive: TemplateDirective | null;
  readonly target_file: string | null;
  readonly before_hash: string | null;
  readonly after_hash: string | null;
  readonly tsc_errors: number | null;
}

export interface Nex1LongRunResult {
  readonly verdict: Nex1LongRunVerdict;
  readonly per_goal: readonly Nex1LongRunGoalResult[];
  readonly rollback_status: "restored" | "not_needed" | "failed";
  readonly stopped_after_id: string | null;
  readonly reasoning_trace: readonly string[];
  readonly taught_by: "master_ai_engineer";
}

export interface Nex1LongRunExecutor {
  readonly repo_root: string;
  readonly scope: Nex1DiscoveryScope;
  readonly apply_directive: (target: string, directive: TemplateDirective) => Promise<{ ok: true; delta: number } | { ok: false; reason: string }>;
  readonly tsc_errors_scoped: (targets: readonly string[]) => number;
}

const DEFAULT_MAX_ITER = 5;

/**
 * @summary Execute the long-run pilot. All goals share a single fixture
 * snapshot map. If ANY goal ends in FAILED_HARD, the whole snapshot map
 * is restored and the verdict reflects the mid-run failure.
 */
export async function executeLongRun(
  spec: Nex1LongRunRecord,
  exec: Nex1LongRunExecutor,
): Promise<Nex1LongRunResult> {
  const trace: string[] = [];
  const T = (s: string) => trace.push(s);
  const perGoal: Nex1LongRunGoalResult[] = [];

  // ── Run-level unsafe-instruction guard ─────────────────────────────
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
      reasoning_trace: [`run-level instruction attempts to override safety · refused before any goal inspected`],
      taught_by: "master_ai_engineer",
    };
  }

  if (!spec.goals || spec.goals.length === 0) {
    return {
      verdict: "refused_empty",
      per_goal: [],
      rollback_status: "not_needed",
      stopped_after_id: null,
      reasoning_trace: ["long-run spec has no goals"],
      taught_by: "master_ai_engineer",
    };
  }

  const cap = spec.max_iterations ?? DEFAULT_MAX_ITER;
  if (spec.goals.length > cap) {
    // Mark remaining as refused for auditability; return refuse verdict; no mutation.
    for (let i = 0; i < spec.goals.length; i++) {
      const g = spec.goals[i];
      perGoal.push({
        id: g.id,
        state: i < cap ? "queued" : "refused",
        reason: i < cap ? "not started · run refused before execution" : "iteration cap exceeded",
        directive: null,
        target_file: null,
        before_hash: null,
        after_hash: null,
        tsc_errors: null,
      });
    }
    return {
      verdict: "refused_iteration_cap_exceeded",
      per_goal: perGoal,
      rollback_status: "not_needed",
      stopped_after_id: null,
      reasoning_trace: [`queue length ${spec.goals.length} exceeds max_iterations ${cap}`],
      taught_by: "master_ai_engineer",
    };
  }

  // ── Snapshot ALL fixture files that might be touched · read on demand ──
  // We track snapshots lazily as goals target files, so an untouched file
  // is not read up-front.
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

  // ── Per-goal execution loop ───────────────────────────────────────
  for (let i = 0; i < spec.goals.length; i++) {
    const g = spec.goals[i];
    // State QUEUED → RUNNING
    T(`goal ${g.id} · state=running`);

    // H.1 gate (soft refusals continue; safety-class refusals stop hard)
    const h1 = planGoalToDirective(g.goal, exec.scope);
    if (h1.kind !== "planned" || !h1.directive) {
      const hardRefusalKinds = new Set(["refused_protected_path", "refused_unsafe_instruction"]);
      const state: Nex1GoalState = "refused";
      const isHard = hardRefusalKinds.has(h1.kind);
      T(`goal ${g.id} · H.1 kind=${h1.kind}${isHard ? " · HARD" : ""}`);
      perGoal.push({
        id: g.id,
        state,
        reason: `H.1 refused (${h1.kind}) · ${h1.reason.slice(0, 100)}`,
        directive: null,
        target_file: null,
        before_hash: null,
        after_hash: null,
        tsc_errors: null,
      });
      if (isHard) {
        // Mark remaining as queued and stop
        for (let j = i + 1; j < spec.goals.length; j++) {
          const rem = spec.goals[j];
          perGoal.push({ id: rem.id, state: "queued", reason: "not started · earlier goal caused hard refusal", directive: null, target_file: null, before_hash: null, after_hash: null, tsc_errors: null });
        }
        const rb = rollbackAll();
        return {
          verdict: "stopped_by_refusal",
          per_goal: perGoal,
          rollback_status: snapshots.size > 0 ? rb : "not_needed",
          stopped_after_id: g.id,
          reasoning_trace: trace,
          taught_by: "master_ai_engineer",
        };
      }
      continue;
    }

    // Snapshot the target file before applying
    const relTarget = h1.target_file!;
    const abs = resolve(exec.repo_root, relTarget);
    if (!snapshots.has(relTarget)) {
      snapshots.set(relTarget, readFileSync(abs, "utf8"));
    }
    const beforeContent = readFileSync(abs, "utf8");
    const beforeHash = sha256(beforeContent);

    const applied = await exec.apply_directive(relTarget, h1.directive);
    if (!applied.ok) {
      T(`goal ${g.id} · apply FAILED · ${applied.reason}`);
      perGoal.push({
        id: g.id,
        state: "failed_hard",
        reason: `apply failed · ${applied.reason}`,
        directive: h1.directive,
        target_file: relTarget,
        before_hash: beforeHash,
        after_hash: null,
        tsc_errors: null,
      });
      for (let j = i + 1; j < spec.goals.length; j++) {
        const rem = spec.goals[j];
        perGoal.push({ id: rem.id, state: "queued", reason: "not started · earlier goal failed hard", directive: null, target_file: null, before_hash: null, after_hash: null, tsc_errors: null });
      }
      const rb = rollbackAll();
      return {
        verdict: "failed_hard_mid_run",
        per_goal: perGoal,
        rollback_status: rb,
        stopped_after_id: g.id,
        reasoning_trace: trace,
        taught_by: "master_ai_engineer",
      };
    }

    const afterHash = sha256(readFileSync(abs, "utf8"));

    // Verify · tsc scoped to all files touched so far
    const targetsSoFar = Array.from(snapshots.keys());
    const tscErrors = exec.tsc_errors_scoped(targetsSoFar);
    T(`goal ${g.id} · applied · tsc scoped errors across ${targetsSoFar.length} files = ${tscErrors}`);

    if (tscErrors > 0) {
      // FAILED_HARD · stop the run · rollback everything
      perGoal.push({
        id: g.id,
        state: "failed_hard",
        reason: `post-apply tsc reports ${tscErrors} error(s) across ${targetsSoFar.length} modified files · unrecoverable in J.4.1 pilot (no J.3 recovery inside long-run yet)`,
        directive: h1.directive,
        target_file: relTarget,
        before_hash: beforeHash,
        after_hash: afterHash,
        tsc_errors: tscErrors,
      });
      for (let j = i + 1; j < spec.goals.length; j++) {
        const rem = spec.goals[j];
        perGoal.push({ id: rem.id, state: "queued", reason: "not started · earlier goal failed hard", directive: null, target_file: null, before_hash: null, after_hash: null, tsc_errors: null });
      }
      const rb = rollbackAll();
      return {
        verdict: "failed_hard_mid_run",
        per_goal: perGoal,
        rollback_status: rb,
        stopped_after_id: g.id,
        reasoning_trace: trace,
        taught_by: "master_ai_engineer",
      };
    }

    perGoal.push({
      id: g.id,
      state: "verified",
      reason: "H.1 planned · apply ok · tsc scoped clean",
      directive: h1.directive,
      target_file: relTarget,
      before_hash: beforeHash,
      after_hash: afterHash,
      tsc_errors: 0,
    });
  }

  // All goals processed. Roll back at end for byte-identity in harness.
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

function sha256(t: string): string {
  return createHash("sha256").update(t).digest("hex");
}
