// src/lib/nex-agent/code-engine/capability-h3-multigoal-planning.ts
//
// NEX1 · CAPABILITY H.3 · MULTI-GOAL PLANNING · deterministic · zero LLM.
//
// taught_by = master_ai_engineer · 2026-09-12
// Teaching infrastructure only · NOT NEX1 independent authorship.
//
// Purpose: convert a batch of structured engineering goals with declared
// dependencies into an IMMUTABLE, AUDITABLE, ordered plan of directives,
// or refuse cleanly. Every individual goal is validated by H.1 before
// admission. Cyclic or conflicting dependencies refuse. The plan is
// hashed BEFORE execution so its identity is auditable at commit time.
//
// Discipline (per founder authorization 2026-09-12):
//   · Plan first · then execute · then verify.
//   · Every goal passes H.1 or the whole plan refuses.
//   · Cycle detection · duplicate-ID detection · unsafe-instruction detection.
//   · Plan is immutable once produced (frozen · plan_hash captured).
//   · Execution is all-or-nothing: any apply failure OR tsc-error after
//     applies triggers rollback of all prior mutations back to snapshot.
//   · Fixtures byte-identical at exit.
//
// Removing this module must not remove any NEX1-owned identity, memory,
// evidence, orchestration, ladder, audit, or safety mechanism.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import type { TemplateDirective } from "./types";
import type { Nex1GoalRecord, Nex1PlanResult, Nex1PlanKind } from "./capability-h-planning";
import { planGoalToDirective } from "./capability-h-planning";
import type { Nex1DiscoveryScope } from "./capability-f-discovery";

export interface Nex1SubGoalRecord {
  readonly id: string;
  readonly goal: Nex1GoalRecord;
  readonly depends_on?: readonly string[];
}

export interface Nex1MultiGoalRecord {
  readonly goals: readonly Nex1SubGoalRecord[];
  readonly instruction?: string;
}

export type Nex1MultiPlanKind =
  | "planned"
  | "refused_empty"
  | "refused_duplicate_id"
  | "refused_unknown_depends_on"
  | "refused_cycle"
  | "refused_unsafe_instruction"
  | "refused_child_goal";

export interface Nex1MultiPlanStep {
  readonly id: string;
  readonly directive: TemplateDirective;
  readonly target_file: string;
  readonly h1_result_summary: string;
}

export interface Nex1MultiPlan {
  readonly kind: Nex1MultiPlanKind;
  readonly ordered_execution: readonly Nex1MultiPlanStep[];
  readonly reason: string;
  readonly plan_hash: string;
  readonly refused_child_id?: string;
  readonly refused_child_kind?: Nex1PlanKind;
  readonly cycle_ids?: readonly string[];
  readonly ignored_instruction?: string;
  readonly taught_by: "master_ai_engineer";
}

/**
 * @summary Produce an immutable multi-goal plan or refuse cleanly.
 * Deterministic. Validates every child goal via H.1 before admission.
 */
export function planMultiGoal(spec: Nex1MultiGoalRecord, scope: Nex1DiscoveryScope): Nex1MultiPlan {
  const instr = spec.instruction?.toLowerCase() ?? "";
  if (
    /ignore\s+protect/.test(instr) ||
    /bypass/.test(instr) ||
    /override\s+safety/.test(instr) ||
    /disable\s+guard/.test(instr) ||
    /disable\s+security/.test(instr)
  ) {
    return refusal("refused_unsafe_instruction", "multi-goal instruction attempts to override safety", { ignored_instruction: spec.instruction });
  }

  if (!spec.goals || spec.goals.length === 0) {
    return refusal("refused_empty", "multi-goal spec has no goals");
  }

  // ── Duplicate-ID check ─────────────────────────────────────────────
  const seenIds = new Set<string>();
  for (const g of spec.goals) {
    if (!g.id || g.id.trim().length === 0) {
      return refusal("refused_duplicate_id", "one or more goals have no id");
    }
    if (seenIds.has(g.id)) {
      return refusal("refused_duplicate_id", `duplicate goal id '${g.id}'`);
    }
    seenIds.add(g.id);
  }

  // ── depends_on target existence check ──────────────────────────────
  for (const g of spec.goals) {
    for (const dep of g.depends_on ?? []) {
      if (!seenIds.has(dep)) {
        return refusal("refused_unknown_depends_on", `goal '${g.id}' depends on unknown id '${dep}'`);
      }
      if (dep === g.id) {
        return refusal("refused_cycle", `goal '${g.id}' depends on itself`, { cycle_ids: [g.id] });
      }
    }
  }

  // ── Topological sort (Kahn's algorithm) with cycle detection ──────
  const idOrder = spec.goals.map((g) => g.id);
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const g of spec.goals) {
    indeg.set(g.id, (g.depends_on ?? []).length);
    for (const dep of g.depends_on ?? []) {
      if (!adj.has(dep)) adj.set(dep, []);
      adj.get(dep)!.push(g.id);
    }
  }
  const sorted: string[] = [];
  const queue: string[] = idOrder.filter((id) => (indeg.get(id) ?? 0) === 0);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    sorted.push(cur);
    for (const nxt of adj.get(cur) ?? []) {
      indeg.set(nxt, (indeg.get(nxt) ?? 1) - 1);
      if (indeg.get(nxt) === 0) queue.push(nxt);
    }
  }
  if (sorted.length !== spec.goals.length) {
    const remaining = spec.goals.map((g) => g.id).filter((id) => !sorted.includes(id));
    return refusal("refused_cycle", `dependency cycle detected among goals [${remaining.join(", ")}]`, { cycle_ids: remaining });
  }

  // ── Validate every child goal via H.1 · in the plan order ─────────
  const steps: Nex1MultiPlanStep[] = [];
  const byId = new Map<string, Nex1SubGoalRecord>();
  for (const g of spec.goals) byId.set(g.id, g);
  for (const id of sorted) {
    const sub = byId.get(id)!;
    const h1 = planGoalToDirective(sub.goal, scope);
    if (h1.kind !== "planned" || !h1.directive) {
      return {
        kind: "refused_child_goal",
        ordered_execution: [],
        reason: `child goal '${id}' rejected by H.1 (kind=${h1.kind}) · ${h1.reason.slice(0, 120)}`,
        plan_hash: "",
        refused_child_id: id,
        refused_child_kind: h1.kind,
        ignored_instruction: undefined,
        taught_by: "master_ai_engineer",
      };
    }
    steps.push({
      id,
      directive: h1.directive,
      target_file: h1.target_file!,
      h1_result_summary: h1.reason,
    });
  }

  // ── Freeze the plan · compute plan_hash for audit ─────────────────
  const planText = JSON.stringify({
    ordered: steps.map((s) => ({ id: s.id, kind: s.directive.kind, target_file: s.target_file, directive: s.directive })),
  });
  const planHash = createHash("sha256").update(planText).digest("hex");

  return {
    kind: "planned",
    ordered_execution: steps,
    reason: `${steps.length} goals validated and ordered · plan hash ${planHash.slice(0, 12)}`,
    plan_hash: planHash,
    taught_by: "master_ai_engineer",
  };
}

// ─── Execution ───────────────────────────────────────────────────────

export type Nex1MultiExecutionVerdict =
  | "verified_multi_repair"
  | "rejected_no_plan"
  | "rejected_apply_failed"
  | "rejected_tsc_error"
  | "rejected_plan_hash_mismatch";

export interface Nex1MultiExecutionResult {
  readonly verdict: Nex1MultiExecutionVerdict;
  readonly executed_steps: readonly { id: string; target_file: string; applied: boolean; before_hash: string; after_hash: string | null }[];
  readonly rollback_status: "restored" | "not_needed" | "failed";
  readonly reasoning_trace: readonly string[];
  readonly plan_hash: string;
  readonly taught_by: "master_ai_engineer";
}

export interface Nex1MultiExecutionInput {
  readonly plan: Nex1MultiPlan;
  readonly expected_plan_hash: string;
  readonly repo_root: string;
  readonly apply_directive: (target: string, directive: TemplateDirective) => Promise<{ ok: true; delta: number } | { ok: false; reason: string }>;
  readonly tsc_error_count_scoped: (targets: readonly string[]) => number;
}

/**
 * @summary Execute an immutable plan. All-or-nothing: any apply failure
 * or tsc-error after all applies triggers rollback of every prior step.
 *
 * Chain-of-custody: the caller must pass the plan_hash they authorised.
 * If the plan's hash disagrees, execution refuses immediately.
 */
export async function executeMultiPlan(input: Nex1MultiExecutionInput): Promise<Nex1MultiExecutionResult> {
  const trace: string[] = [];
  const T = (s: string) => trace.push(s);

  if (input.plan.kind !== "planned") {
    return {
      verdict: "rejected_no_plan",
      executed_steps: [],
      rollback_status: "not_needed",
      reasoning_trace: [`plan.kind='${input.plan.kind}' · not executable`],
      plan_hash: input.plan.plan_hash,
      taught_by: "master_ai_engineer",
    };
  }
  if (input.plan.plan_hash !== input.expected_plan_hash) {
    return {
      verdict: "rejected_plan_hash_mismatch",
      executed_steps: [],
      rollback_status: "not_needed",
      reasoning_trace: [`plan_hash mismatch · plan=${input.plan.plan_hash} expected=${input.expected_plan_hash}`],
      plan_hash: input.plan.plan_hash,
      taught_by: "master_ai_engineer",
    };
  }

  // Snapshot every distinct target file touched by the plan
  const snapshots = new Map<string, string>();
  const executed: { id: string; target_file: string; applied: boolean; before_hash: string; after_hash: string | null }[] = [];

  const rollback = (): "restored" | "failed" => {
    for (const [target, content] of snapshots) {
      try {
        writeFileSync(resolve(input.repo_root, target), content, "utf8");
      } catch {
        return "failed";
      }
    }
    return "restored";
  };

  for (const step of input.plan.ordered_execution) {
    const abs = resolve(input.repo_root, step.target_file);
    if (!snapshots.has(step.target_file)) {
      snapshots.set(step.target_file, readFileSync(abs, "utf8"));
    }
    const before = readFileSync(abs, "utf8");
    const beforeHash = sha256(before);
    T(`step ${step.id} · target ${step.target_file} · before ${beforeHash.slice(0, 12)}`);
    const applied = await input.apply_directive(step.target_file, step.directive);
    if (!applied.ok) {
      executed.push({ id: step.id, target_file: step.target_file, applied: false, before_hash: beforeHash, after_hash: null });
      T(`step ${step.id} · apply FAILED · ${applied.reason}`);
      const rb = rollback();
      return {
        verdict: "rejected_apply_failed",
        executed_steps: executed,
        rollback_status: rb,
        reasoning_trace: trace,
        plan_hash: input.plan.plan_hash,
        taught_by: "master_ai_engineer",
      };
    }
    const afterHash = sha256(readFileSync(abs, "utf8"));
    executed.push({ id: step.id, target_file: step.target_file, applied: true, before_hash: beforeHash, after_hash: afterHash });
    T(`step ${step.id} · applied · after ${afterHash.slice(0, 12)}`);
  }

  // Verify · run tsc over the set of modified targets. If tsc reports
  // any error localised to any modified file, roll back the entire plan.
  const targets = Array.from(new Set(input.plan.ordered_execution.map((s) => s.target_file)));
  const tscErrors = input.tsc_error_count_scoped(targets);
  T(`tsc scoped errors across ${targets.length} modified files: ${tscErrors}`);
  if (tscErrors > 0) {
    const rb = rollback();
    return {
      verdict: "rejected_tsc_error",
      executed_steps: executed,
      rollback_status: rb,
      reasoning_trace: trace,
      plan_hash: input.plan.plan_hash,
      taught_by: "master_ai_engineer",
    };
  }

  // Always rollback at end · this suite is a validation harness, not
  // a production commit. Callers that want to persist the plan should
  // do so between apply and rollback, but this harness leaves state clean.
  const rb = rollback();
  return {
    verdict: "verified_multi_repair",
    executed_steps: executed,
    rollback_status: rb,
    reasoning_trace: trace,
    plan_hash: input.plan.plan_hash,
    taught_by: "master_ai_engineer",
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function refusal(
  kind: Nex1MultiPlanKind,
  reason: string,
  extras?: Partial<Nex1MultiPlan>,
): Nex1MultiPlan {
  return {
    kind,
    ordered_execution: [],
    reason,
    plan_hash: "",
    taught_by: "master_ai_engineer",
    ...extras,
  };
}

function sha256(t: string): string {
  return createHash("sha256").update(t).digest("hex");
}
