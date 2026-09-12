// src/lib/nex/production-hygiene/checkpointing.ts
//
// WAVE-P-4 · GAP-8 · Checkpointing with adaptive budget
// Founder BEGIN WAVE-P-4 · 2026-09-08

import type {
  AdaptiveBudgetDecision,
  RunCheckpointHeader,
  StepCheckpoint,
} from "./types";

/** Deterministic budget-decision function. Given the current run
 *  header + a proposed next step, decide whether to continue,
 *  expand budget (rare · needs explicit reason), await HITL,
 *  or abandon. Pure. */
export function decideNextStep(input: {
  header: RunCheckpointHeader;
  proposed_step_kind: StepCheckpoint["step_kind"];
  /** When true · caller is signalling this is a high-risk action (Founder-gate). */
  high_risk?: boolean;
  /** When true · caller signals budget-expand justification. */
  budget_expand_reason?: string;
}): AdaptiveBudgetDecision {
  const { header, proposed_step_kind, high_risk, budget_expand_reason } = input;

  if (header.status !== "active" && header.status !== "awaiting_hitl") {
    return { action: "abandon", reason: `run status ${header.status} · cannot continue` };
  }

  if (high_risk || proposed_step_kind === "await_hitl") {
    return { action: "await_hitl", reason: `step ${proposed_step_kind} requires HITL approval` };
  }

  if (header.budget_remaining <= 0) {
    if (budget_expand_reason) {
      // Cap expansion at 2x original budget · never unbounded
      const cap = Math.min(header.max_steps_budget * 2, 64);
      if (header.total_steps < cap) {
        return { action: "expand_budget", new_budget: cap, reason: budget_expand_reason };
      }
    }
    return { action: "abandon", reason: `budget exhausted · steps=${header.total_steps} · cap=${header.max_steps_budget}` };
  }

  return { action: "continue", steps_remaining: header.budget_remaining };
}

/** Advance the header by one step. Pure. */
export function advanceHeader(header: RunCheckpointHeader, step_kind: StepCheckpoint["step_kind"], now_iso?: string): RunCheckpointHeader {
  const ts = now_iso ?? new Date().toISOString();
  const new_status: RunCheckpointHeader["status"] =
    step_kind === "await_hitl" ? "awaiting_hitl" :
    step_kind === "summary" ? "completed" : "active";
  return {
    ...header,
    last_step_at_iso: ts,
    total_steps: header.total_steps + 1,
    budget_remaining: Math.max(0, header.budget_remaining - 1),
    status: new_status,
  };
}

/** In-memory checkpoint log · caller may persist externally.
 *  Append-only · replay-friendly. */
export class InMemoryCheckpointLog {
  private steps = new Map<string, StepCheckpoint[]>();
  private headers = new Map<string, RunCheckpointHeader>();

  createRun(input: { run_id: string; max_steps_budget: number; now_iso?: string }): RunCheckpointHeader {
    const ts = input.now_iso ?? new Date().toISOString();
    const h: RunCheckpointHeader = {
      run_id: input.run_id,
      started_at_iso: ts,
      last_step_at_iso: ts,
      total_steps: 0,
      max_steps_budget: input.max_steps_budget,
      budget_remaining: input.max_steps_budget,
      status: "active",
    };
    this.headers.set(input.run_id, h);
    this.steps.set(input.run_id, []);
    return h;
  }

  getHeader(run_id: string): RunCheckpointHeader | null {
    return this.headers.get(run_id) ?? null;
  }

  appendStep(step: StepCheckpoint): void {
    const arr = this.steps.get(step.run_id) ?? [];
    arr.push(step);
    this.steps.set(step.run_id, arr);
    const h = this.headers.get(step.run_id);
    if (h) this.headers.set(step.run_id, advanceHeader(h, step.step_kind, step.captured_at_iso));
  }

  getSteps(run_id: string): readonly StepCheckpoint[] {
    return this.steps.get(run_id) ?? [];
  }

  /** Rebuild the state of a run from its checkpoint log · used on
   *  resume after crash / process restart. */
  replay(run_id: string): { header: RunCheckpointHeader | null; steps: readonly StepCheckpoint[] } {
    return { header: this.getHeader(run_id), steps: this.getSteps(run_id) };
  }
}
