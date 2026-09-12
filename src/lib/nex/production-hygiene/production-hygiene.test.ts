// src/lib/nex/production-hygiene/production-hygiene.test.ts
//
// WAVE-P-4 · Production hygiene contract tests
// Founder BEGIN WAVE-P-4 · 2026-09-08

import { describe, it, expect } from "vitest";
import type { DelegationLike, RunCheckpointHeader, StepCheckpoint } from "./types";
import { advanceHeader, decideNextStep, InMemoryCheckpointLog } from "./checkpointing";
import { SseSessionBuffer, compareEventIds } from "./streaming-reconnect";
import { reapDelegations } from "./delegation-reaper";
import { BreakpointRegistry, canonicalPromptFor } from "./hitl-breakpoints";

// ═══════════════════════════════════════════════════════════════════
// § CHECKPOINTING
// ═══════════════════════════════════════════════════════════════════

describe("§P4-CHECKPOINT · adaptive budget + resumable state", () => {
  it("decideNextStep continues when budget remaining", () => {
    const header: RunCheckpointHeader = {
      run_id: "r1", started_at_iso: "x", last_step_at_iso: "x",
      total_steps: 3, max_steps_budget: 10, budget_remaining: 7, status: "active",
    };
    const d = decideNextStep({ header, proposed_step_kind: "message" });
    expect(d.action).toBe("continue");
    if (d.action === "continue") expect(d.steps_remaining).toBe(7);
  });

  it("decideNextStep abandons when budget exhausted + no expand reason", () => {
    const header: RunCheckpointHeader = {
      run_id: "r1", started_at_iso: "x", last_step_at_iso: "x",
      total_steps: 10, max_steps_budget: 10, budget_remaining: 0, status: "active",
    };
    const d = decideNextStep({ header, proposed_step_kind: "message" });
    expect(d.action).toBe("abandon");
  });

  it("decideNextStep expands budget on justified reason (capped at 2x)", () => {
    const header: RunCheckpointHeader = {
      run_id: "r1", started_at_iso: "x", last_step_at_iso: "x",
      total_steps: 10, max_steps_budget: 10, budget_remaining: 0, status: "active",
    };
    const d = decideNextStep({ header, proposed_step_kind: "message", budget_expand_reason: "user asked complex multi-step task" });
    expect(d.action).toBe("expand_budget");
    if (d.action === "expand_budget") expect(d.new_budget).toBeLessThanOrEqual(20);
  });

  it("decideNextStep awaits HITL on high_risk + await_hitl", () => {
    const header: RunCheckpointHeader = {
      run_id: "r1", started_at_iso: "x", last_step_at_iso: "x",
      total_steps: 3, max_steps_budget: 10, budget_remaining: 7, status: "active",
    };
    expect(decideNextStep({ header, proposed_step_kind: "message", high_risk: true }).action).toBe("await_hitl");
    expect(decideNextStep({ header, proposed_step_kind: "await_hitl" }).action).toBe("await_hitl");
  });

  it("advanceHeader increments total_steps + decrements budget", () => {
    const h: RunCheckpointHeader = {
      run_id: "r", started_at_iso: "x", last_step_at_iso: "x",
      total_steps: 2, max_steps_budget: 10, budget_remaining: 8, status: "active",
    };
    const h2 = advanceHeader(h, "message");
    expect(h2.total_steps).toBe(3);
    expect(h2.budget_remaining).toBe(7);
  });

  it("advanceHeader sets awaiting_hitl on await_hitl step", () => {
    const h: RunCheckpointHeader = {
      run_id: "r", started_at_iso: "x", last_step_at_iso: "x",
      total_steps: 2, max_steps_budget: 10, budget_remaining: 8, status: "active",
    };
    const h2 = advanceHeader(h, "await_hitl");
    expect(h2.status).toBe("awaiting_hitl");
  });

  it("InMemoryCheckpointLog · createRun + appendStep + replay round-trip", () => {
    const log = new InMemoryCheckpointLog();
    log.createRun({ run_id: "r1", max_steps_budget: 5 });
    const step: StepCheckpoint = {
      run_id: "r1", step_number: 1, step_id: "s1", step_kind: "message",
      captured_at_iso: "x", serialized_state: "{}",
    };
    log.appendStep(step);
    const { header, steps } = log.replay("r1");
    expect(header?.total_steps).toBe(1);
    expect(header?.budget_remaining).toBe(4);
    expect(steps.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § STREAMING RECONNECT
// ═══════════════════════════════════════════════════════════════════

describe("§P4-RECONNECT · SSE session replay", () => {
  it("append then replay all when no last_event_id", () => {
    const buf = new SseSessionBuffer();
    buf.append("s1", { event_type: "message", data: "a" });
    buf.append("s1", { event_type: "message", data: "b" });
    const r = buf.replay({ session_id: "s1" });
    expect(r.events_replayed.length).toBe(2);
    expect(r.session_expired).toBe(false);
  });

  it("replay only newer events when last_event_id supplied", () => {
    const buf = new SseSessionBuffer();
    const e1 = buf.append("s1", { event_type: "message", data: "a" });
    buf.append("s1", { event_type: "message", data: "b" });
    buf.append("s1", { event_type: "message", data: "c" });
    const r = buf.replay({ session_id: "s1", last_event_id: e1.event_id });
    expect(r.events_replayed.length).toBe(2);
    expect(r.events_replayed[0].data).toBe("b");
  });

  it("expired session returns session_expired:true", () => {
    const buf = new SseSessionBuffer(1000, -1); // negative TTL · immediately expired
    buf.append("s1", { event_type: "message", data: "a" });
    const r = buf.replay({ session_id: "s1" });
    expect(r.session_expired).toBe(true);
  });

  it("unknown session_id returns session_expired:true", () => {
    const buf = new SseSessionBuffer();
    const r = buf.replay({ session_id: "unknown" });
    expect(r.session_expired).toBe(true);
  });

  it("bounded window · oldest events dropped when exceeded", () => {
    const buf = new SseSessionBuffer(2);
    buf.append("s1", { event_type: "m", data: "a" });
    buf.append("s1", { event_type: "m", data: "b" });
    buf.append("s1", { event_type: "m", data: "c" });
    const r = buf.replay({ session_id: "s1" });
    expect(r.events_replayed.length).toBe(2);
    expect(r.events_replayed[0].data).toBe("b");
  });

  it("compareEventIds numeric ordering", () => {
    expect(compareEventIds("5", "10")).toBeLessThan(0);
    expect(compareEventIds("10", "5")).toBeGreaterThan(0);
    expect(compareEventIds("10", "10")).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// § DELEGATION REAPER
// ═══════════════════════════════════════════════════════════════════

describe("§P4-REAPER · delegation timeout decisions", () => {
  const now = 2_000_000_000_000;

  it("fresh PENDING kept", () => {
    const d: DelegationLike[] = [{ delegation_id: "d1", status: "PENDING", created_at_iso: new Date(now - 60_000).toISOString() }];
    const decisions = reapDelegations({ delegations: d, now_ms: now });
    expect(decisions[0].action).toBe("keep");
  });

  it("stale PENDING timed out (default 1h cap)", () => {
    const d: DelegationLike[] = [{ delegation_id: "d1", status: "PENDING", created_at_iso: new Date(now - 3 * 60 * 60_000).toISOString() }];
    const decisions = reapDelegations({ delegations: d, now_ms: now });
    expect(decisions[0].action).toBe("timeout");
  });

  it("IN_PROGRESS uses accepted_at reference", () => {
    const d: DelegationLike[] = [{
      delegation_id: "d1", status: "IN_PROGRESS",
      created_at_iso: new Date(now - 10 * 60 * 60_000).toISOString(),
      accepted_at_iso: new Date(now - 30_000).toISOString(),
    }];
    const decisions = reapDelegations({ delegations: d, now_ms: now });
    expect(decisions[0].action).toBe("keep");
  });

  it("explicit deadline honored over defaults", () => {
    const d: DelegationLike[] = [{
      delegation_id: "d1", status: "PENDING",
      created_at_iso: new Date(now - 60_000).toISOString(),
      deadline_iso: new Date(now - 1000).toISOString(),
    }];
    const decisions = reapDelegations({ delegations: d, now_ms: now });
    expect(decisions[0].action).toBe("timeout");
    if (decisions[0].action === "timeout") expect(decisions[0].reason).toContain("deadline");
  });

  it("terminal statuses left alone", () => {
    const d: DelegationLike[] = [
      { delegation_id: "d1", status: "COMPLETED", created_at_iso: new Date(0).toISOString() },
      { delegation_id: "d2", status: "TIMED_OUT", created_at_iso: new Date(0).toISOString() },
    ];
    const decisions = reapDelegations({ delegations: d, now_ms: now });
    expect(decisions[0].action).toBe("keep");
    expect(decisions[1].action).toBe("keep");
  });
});

// ═══════════════════════════════════════════════════════════════════
// § HITL BREAKPOINTS
// ═══════════════════════════════════════════════════════════════════

describe("§P4-HITL · breakpoint lifecycle", () => {
  it("raise + resolve(approve) round-trip", () => {
    const reg = new BreakpointRegistry();
    const req = reg.raise({
      run_id: "r1", step_id: "s1", reason: "approval_required",
      prompt_to_founder: "Approve?", pending_action_summary: "do X",
    });
    const res = reg.resolve({ breakpoint_id: req.breakpoint_id, decision: "approve", approved_by: "phil", resolved_at_iso: "x" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.final_state.kind).toBe("resolved");
  });

  it("cannot resolve twice", () => {
    const reg = new BreakpointRegistry();
    const req = reg.raise({ run_id: "r", step_id: "s", reason: "custom", prompt_to_founder: "p", pending_action_summary: "x" });
    reg.resolve({ breakpoint_id: req.breakpoint_id, decision: "approve", approved_by: "phil", resolved_at_iso: "x" });
    const res2 = reg.resolve({ breakpoint_id: req.breakpoint_id, decision: "reject", rejected_by: "phil", resolved_at_iso: "y", reason: "no" });
    expect(res2.ok).toBe(false);
  });

  it("unknown breakpoint id refused", () => {
    const reg = new BreakpointRegistry();
    const res = reg.resolve({ breakpoint_id: "bp_unknown", decision: "approve", approved_by: "phil", resolved_at_iso: "x" });
    expect(res.ok).toBe(false);
  });

  it("listAwaiting excludes resolved", () => {
    const reg = new BreakpointRegistry();
    reg.raise({ run_id: "r", step_id: "s", reason: "custom", prompt_to_founder: "p", pending_action_summary: "x" });
    const r2 = reg.raise({ run_id: "r", step_id: "s", reason: "custom", prompt_to_founder: "p", pending_action_summary: "y" });
    reg.resolve({ breakpoint_id: r2.breakpoint_id, decision: "approve", approved_by: "phil", resolved_at_iso: "x" });
    expect(reg.listAwaiting().length).toBe(1);
  });

  it("canonicalPromptFor produces consistent strings", () => {
    expect(canonicalPromptFor("founder_gate", "do X")).toContain("Founder-gate");
    expect(canonicalPromptFor("high_risk_tool", "do X")).toContain("high-risk");
    expect(canonicalPromptFor("budget_exceeded", "do X")).toContain("budget");
  });
});
