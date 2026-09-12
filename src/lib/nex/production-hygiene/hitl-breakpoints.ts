// src/lib/nex/production-hygiene/hitl-breakpoints.ts
//
// WAVE-P-4 · GAP-12 · HITL breakpoints as first-class runtime primitive
// Founder BEGIN WAVE-P-4 · 2026-09-08

import { randomUUID } from "node:crypto";
import type {
  BreakpointReason,
  BreakpointRequest,
  BreakpointResolution,
  BreakpointState,
} from "./types";

/** In-memory breakpoint registry · caller may persist externally.
 *  Every breakpoint has an id · a state · a resolution. */
export class BreakpointRegistry {
  private states = new Map<string, BreakpointState>();

  raise(input: {
    run_id: string;
    step_id: string;
    reason: BreakpointReason;
    prompt_to_founder: string;
    pending_action_summary: string;
    metadata?: Record<string, unknown>;
  }): BreakpointRequest {
    const request: BreakpointRequest = {
      breakpoint_id: `bp_${randomUUID()}`,
      run_id: input.run_id,
      step_id: input.step_id,
      reason: input.reason,
      prompt_to_founder: input.prompt_to_founder,
      pending_action_summary: input.pending_action_summary,
      requested_at_iso: new Date().toISOString(),
      metadata: input.metadata,
    };
    this.states.set(request.breakpoint_id, { kind: "awaiting", request });
    return request;
  }

  resolve(resolution: BreakpointResolution): { ok: true; final_state: BreakpointState } | { ok: false; reason: string } {
    const state = this.states.get(resolution.breakpoint_id);
    if (!state) return { ok: false, reason: `breakpoint ${resolution.breakpoint_id} not found` };
    if (state.kind === "resolved") return { ok: false, reason: `breakpoint ${resolution.breakpoint_id} already resolved` };
    const next: BreakpointState = { kind: "resolved", request: state.request, resolution };
    this.states.set(resolution.breakpoint_id, next);
    return { ok: true, final_state: next };
  }

  get(breakpoint_id: string): BreakpointState | null {
    return this.states.get(breakpoint_id) ?? null;
  }

  /** Return all currently-awaiting breakpoints · used by the Founder UI. */
  listAwaiting(): readonly BreakpointRequest[] {
    const out: BreakpointRequest[] = [];
    for (const s of this.states.values()) {
      if (s.kind === "awaiting") out.push(s.request);
    }
    return out;
  }

  size(): number {
    return this.states.size;
  }

  reset(): void {
    this.states.clear();
  }
}

/** Convenience · construct a canonical Founder-approval prompt for a
 *  common breakpoint reason. Keeps the message consistent across
 *  callers · Founder sees the same shape every time. */
export function canonicalPromptFor(reason: BreakpointReason, pending_action_summary: string): string {
  switch (reason) {
    case "approval_required":
      return `NEX is requesting approval before proceeding.\n\nAction: ${pending_action_summary}\n\nApprove · reject · or modify.`;
    case "budget_exceeded":
      return `NEX has hit its budget cap.\n\nRemaining action: ${pending_action_summary}\n\nApprove to continue at additional cost · or reject.`;
    case "high_risk_tool":
      return `NEX wants to invoke a high-risk tool.\n\nAction: ${pending_action_summary}\n\nApprove with human oversight · or reject.`;
    case "founder_gate":
      return `NEX has hit a Founder-gate boundary.\n\nAction: ${pending_action_summary}\n\nExplicit Founder authorization required · approve · reject · or modify.`;
    case "adversarial_signal":
      return `NEX has detected an adversarial signal in the current request.\n\nContext: ${pending_action_summary}\n\nApprove to proceed with caution · reject to abandon.`;
    case "custom":
      return pending_action_summary;
  }
}
