// WO-WORKSTATION-01 · foundation acceptance tests
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Real execution against the actual GB storage jsonl backend — no fixtures.
//
// Tests deliberately share the default `data/nex-storage/` root; each test
// uses fresh trace_ids AND cleans the WO-01 collection files up front so a
// re-run leaves no residue. Order of tests must not matter — every assertion
// is scoped to trace_ids the test creates.

import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { WorkflowTrace } from "../types";
import {
  saveTraceDurable,
  loadTraceDurable,
  listTraceHistoryDurable,
  applyTransitionDurable,
  reserveTraceId,
  resolveTraceId,
  recoverActiveTraces,
  recordRecoveryPass,
} from "../wo1-durable-store";
import {
  computeIdempotencyKey,
  deriveTraceIdFromIdempotencyKey,
} from "../wo1-idempotency";
import {
  readAuditStream,
  verifyAuditChain,
  computeContentHash,
  type AuditEvent,
} from "../wo1-audit-log";

const STORAGE_ROOT = path.join(process.cwd(), "data", "nex-storage");
const WO1_COLLECTIONS = [
  "nex1_workflow_traces.jsonl",
  "nex1_audit_events.jsonl",
  "nex1_idempotency_lookup.jsonl",
];

async function cleanCollections(): Promise<void> {
  for (const name of WO1_COLLECTIONS) {
    const file = path.join(STORAGE_ROOT, name);
    try { await fs.unlink(file); } catch { /* ok · not present */ }
  }
}

function buildInitialTrace(trace_id: string, raw_request: string): WorkflowTrace {
  return {
    record_type: "NEX1_WORKFLOW_TRACE",
    trace_id,
    schema_version: "wo1.v0.1",
    raw_request,
    structured_intent: null,
    requirements_evidence: null,
    work_order: null,
    architecture_evidence: null,
    design_evidence: null,
    builder_plan: null,
    specialist_evidence_ids: [],
    validation_verdicts: [],
    nex2_review_id: null,
    nex3_arbitration_id: null,
    nex3_verdict: null,
    founder_decision: null,
    transitions: [],
    current_state: "REQUEST_RECEIVED",
    stage_statuses: {},
    audit_trail: [],
    created_at: new Date().toISOString(),
    authorisation: false,
    execution: false,
    authority_boundary: "orchestrator_advisory_until_founder_authorises",
    attribution: {
      external_llm_used: false,
      deterministic: true,
      taught_by: "master_ai_engineer",
      role: "nex1_orchestrator",
      authority: "orchestration_advisory",
      produced_by: "nex1_orchestrator",
    },
  };
}

describe("WO-WORKSTATION-01 · foundation", () => {
  beforeEach(async () => {
    await cleanCollections();
  });

  // ── 1 · Idempotency primitives ──────────────────────────────────────────

  it("computeIdempotencyKey is deterministic for the same input", () => {
    const a = computeIdempotencyKey({ raw_request: "build a 3-page app", seed: "s1" });
    const b = computeIdempotencyKey({ raw_request: "build a 3-page app", seed: "s1" });
    expect(a).toBe(b);
  });

  it("computeIdempotencyKey differs when raw_request differs", () => {
    const a = computeIdempotencyKey({ raw_request: "build a 3-page app" });
    const b = computeIdempotencyKey({ raw_request: "build a 5-page app" });
    expect(a).not.toBe(b);
  });

  it("computeIdempotencyKey honours client-supplied idempotency_key over content", () => {
    const a = computeIdempotencyKey({ raw_request: "x", idempotency_key: "abc123" });
    const b = computeIdempotencyKey({ raw_request: "different content", idempotency_key: "abc123" });
    expect(a).toBe(b);
    expect(a).toMatch(/^wo1:idem:client:/);
  });

  it("deriveTraceIdFromIdempotencyKey is deterministic and prefixed", () => {
    const key = computeIdempotencyKey({ raw_request: "test" });
    const id1 = deriveTraceIdFromIdempotencyKey(key);
    const id2 = deriveTraceIdFromIdempotencyKey(key);
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^wo1-[0-9a-f]{24}$/);
  });

  // ── 2 · reserveTraceId · duplicate submission returns same id ───────────

  it("reserveTraceId returns new_project=true the first time, false on repeat", async () => {
    const input = { raw_request: "build a 3-page app about staircases" };
    const first = await reserveTraceId(input);
    expect(first.new_project).toBe(true);
    expect(first.trace_id).toMatch(/^wo1-[0-9a-f]{24}$/);

    const second = await reserveTraceId(input);
    expect(second.new_project).toBe(false);
    expect(second.trace_id).toBe(first.trace_id);
  });

  it("reserveTraceId with different idempotency_key produces different trace_id", async () => {
    const a = await reserveTraceId({ raw_request: "same content", idempotency_key: "key-A" });
    const b = await reserveTraceId({ raw_request: "same content", idempotency_key: "key-B" });
    expect(a.trace_id).not.toBe(b.trace_id);
  });

  it("resolveTraceId returns null for a genuinely new request", async () => {
    const found = await resolveTraceId({ raw_request: "never seen before " + Math.random() });
    expect(found).toBeNull();
  });

  // ── 3 · Durable persistence round-trip ──────────────────────────────────

  it("saveTraceDurable then loadTraceDurable round-trips the current state", async () => {
    const reservation = await reserveTraceId({ raw_request: "round-trip test" });
    const trace = buildInitialTrace(reservation.trace_id, "round-trip test");
    await saveTraceDurable(trace);

    const loaded = await loadTraceDurable(reservation.trace_id);
    expect(loaded).not.toBeNull();
    expect(loaded!.trace_id).toBe(reservation.trace_id);
    expect(loaded!.current_state).toBe("REQUEST_RECEIVED");
    expect(loaded!.raw_request).toBe("round-trip test");
  });

  it("loadTraceDurable returns null for an unknown trace_id", async () => {
    const loaded = await loadTraceDurable("wo1-unknown-000000000000000000000000");
    expect(loaded).toBeNull();
  });

  // ── 4 · applyTransitionDurable · state + audit ──────────────────────────

  it("applyTransitionDurable advances state, saves snapshot, and emits an audit event", async () => {
    const { trace_id } = await reserveTraceId({ raw_request: "transition test" });
    const t0 = buildInitialTrace(trace_id, "transition test");
    await saveTraceDurable(t0);

    const result = await applyTransitionDurable({
      trace: t0,
      next: "UNDERSTANDING",
      transition: {
        next: "UNDERSTANDING",
        reason: "extracted structured intent",
        at: new Date().toISOString(),
        actor: "orchestrator",
        authorisation_state: "not_required",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.trace.current_state).toBe("UNDERSTANDING");
    expect(result.trace.transitions).toHaveLength(1);
    expect(result.event.event_type).toBe("state.transitioned");
    expect(result.event.previous_state).toBe("REQUEST_RECEIVED");
    expect(result.event.next_state).toBe("UNDERSTANDING");
    expect(result.event.previous_event_id).toBeNull(); // first event

    const loaded = await loadTraceDurable(trace_id);
    expect(loaded!.current_state).toBe("UNDERSTANDING");
  });

  it("applyTransitionDurable refuses illegal transitions", async () => {
    const { trace_id } = await reserveTraceId({ raw_request: "illegal-transition test" });
    const t0 = buildInitialTrace(trace_id, "illegal-transition test");
    await saveTraceDurable(t0);

    const result = await applyTransitionDurable({
      trace: t0,
      next: "RELEASE", // cannot go straight from REQUEST_RECEIVED to RELEASE
      transition: {
        next: "RELEASE",
        reason: "illegal jump",
        at: new Date().toISOString(),
        actor: "orchestrator",
        authorisation_state: "not_required",
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/illegal transition/);
  });

  // ── 5 · Audit chain integrity ───────────────────────────────────────────

  it("audit stream forms a hash chain and verifies clean", async () => {
    const { trace_id } = await reserveTraceId({ raw_request: "audit chain test" });
    let trace: WorkflowTrace = buildInitialTrace(trace_id, "audit chain test");
    await saveTraceDurable(trace);

    // Two transitions → two audit events
    const r1 = await applyTransitionDurable({
      trace,
      next: "UNDERSTANDING",
      transition: {
        next: "UNDERSTANDING",
        reason: "extract intent",
        at: new Date().toISOString(),
        actor: "orchestrator",
        authorisation_state: "not_required",
      },
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    trace = r1.trace;

    const r2 = await applyTransitionDurable({
      trace,
      next: "REQUIREMENTS",
      transition: {
        next: "REQUIREMENTS",
        reason: "requirements analysis",
        at: new Date().toISOString(),
        actor: "orchestrator",
        authorisation_state: "not_required",
      },
    });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;

    const events = await readAuditStream(trace_id);
    expect(events).toHaveLength(2);
    expect(events[0].previous_event_id).toBeNull();
    expect(events[1].previous_event_id).toBe(events[0].event_id);

    const verdict = verifyAuditChain(events);
    expect(verdict.ok).toBe(true);
  });

  it("verifyAuditChain detects a tampered content_hash", async () => {
    const { trace_id } = await reserveTraceId({ raw_request: "tamper test" });
    const t0 = buildInitialTrace(trace_id, "tamper test");
    await saveTraceDurable(t0);

    const r = await applyTransitionDurable({
      trace: t0,
      next: "UNDERSTANDING",
      transition: {
        next: "UNDERSTANDING",
        reason: "step",
        at: new Date().toISOString(),
        actor: "orchestrator",
        authorisation_state: "not_required",
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const genuine = await readAuditStream(trace_id);
    expect(genuine).toHaveLength(1);

    // Simulate tamper: rewrite payload but keep old hash
    const tampered: AuditEvent[] = [
      { ...genuine[0], payload: { reason: "hacked", authorisation_state: "not_required", evidence_refs: [], stage_status: null } },
    ];
    const verdict = verifyAuditChain(tampered);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toMatch(/content_hash mismatch/);
  });

  it("computeContentHash is deterministic for the same canonical payload", () => {
    const base = {
      record_type: "NEX1_AUDIT_EVENT" as const,
      trace_id: "wo1-abc",
      event_type: "state.transitioned",
      previous_state: "REQUEST_RECEIVED" as const,
      next_state: "UNDERSTANDING" as const,
      actor: "orchestrator" as const,
      at: "2026-09-13T00:00:00.000Z",
      payload: { reason: "x" },
      previous_event_id: null,
    };
    expect(computeContentHash(base)).toBe(computeContentHash(base));
  });

  // ── 6 · Recovery ────────────────────────────────────────────────────────

  it("recoverActiveTraces returns non-terminal traces and excludes terminal ones", async () => {
    // active: REQUEST_RECEIVED
    const active = await reserveTraceId({ raw_request: "active " + Math.random() });
    await saveTraceDurable(buildInitialTrace(active.trace_id, "active"));

    // terminal: BLOCKED
    const terminal = await reserveTraceId({ raw_request: "terminal " + Math.random() });
    const terminalTrace: WorkflowTrace = {
      ...buildInitialTrace(terminal.trace_id, "terminal"),
      current_state: "BLOCKED",
    };
    await saveTraceDurable(terminalTrace);

    const recovered = await recoverActiveTraces();
    const activeIds = recovered.map((t) => t.trace_id);
    expect(activeIds).toContain(active.trace_id);
    expect(activeIds).not.toContain(terminal.trace_id);
  });

  it("recordRecoveryPass emits recovery events chained after prior audit history", async () => {
    const { trace_id } = await reserveTraceId({ raw_request: "recovery chain " + Math.random() });
    const t0 = buildInitialTrace(trace_id, "recovery chain");
    await saveTraceDurable(t0);

    // Emit a prior state transition
    const r = await applyTransitionDurable({
      trace: t0,
      next: "UNDERSTANDING",
      transition: {
        next: "UNDERSTANDING",
        reason: "pre-recovery",
        at: new Date().toISOString(),
        actor: "orchestrator",
        authorisation_state: "not_required",
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const events = await recordRecoveryPass({
      recovered_trace_ids: [trace_id],
      reason: "process restarted",
    });
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe("recovery.observed_active");
    expect(events[0].previous_event_id).toBe(r.event.event_id);

    // Full chain verifies
    const full = await readAuditStream(trace_id);
    expect(full).toHaveLength(2);
    const verdict = verifyAuditChain(full);
    expect(verdict.ok).toBe(true);
  });

  // ── 7 · History (append-only preserves prior snapshots) ─────────────────

  it("listTraceHistoryDurable preserves every snapshot, not just the latest", async () => {
    const { trace_id } = await reserveTraceId({ raw_request: "history test " + Math.random() });
    const t0 = buildInitialTrace(trace_id, "history test");
    await saveTraceDurable(t0);

    const r1 = await applyTransitionDurable({
      trace: t0,
      next: "UNDERSTANDING",
      transition: {
        next: "UNDERSTANDING",
        reason: "step 1",
        at: new Date().toISOString(),
        actor: "orchestrator",
        authorisation_state: "not_required",
      },
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    const r2 = await applyTransitionDurable({
      trace: r1.trace,
      next: "REQUIREMENTS",
      transition: {
        next: "REQUIREMENTS",
        reason: "step 2",
        at: new Date().toISOString(),
        actor: "orchestrator",
        authorisation_state: "not_required",
      },
    });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;

    const history = await listTraceHistoryDurable(trace_id);
    // 1 initial + 2 transitions = 3 snapshots
    expect(history.length).toBeGreaterThanOrEqual(3);
    expect(history[0].current_state).toBe("REQUEST_RECEIVED");
    expect(history[history.length - 1].current_state).toBe("REQUIREMENTS");
  });
});
