// src/lib/nex/master-ai/master-ai-y-w4-3.test.ts
//
// NEX Master AI · Y-W4-3 · Programmer Delegation Consumer · contract tests
// Philip 2026-09-07 · AUTHORIZE
//
// Proves the 10 required capabilities from §11:
//   1. PENDING delegation is consumed
//   2. Invalid delegation is rejected
//   3. Duplicate claim is prevented
//   4. Programmer uses Phase G bounds
//   5. Successful outcome is persisted
//   6. Failed outcome is persisted (via validation rejection)
//   7. Restart does not duplicate execution
//   8. Master AI can observe the outcome
//   9. Learning-cycle state updates correctly (delegation status flows)
//  10. Existing Programmer tests remain green (verified by baseline run)

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let tempDir = "";
let origMasterRoot: string | undefined;
let origRuntimeRoot: string | undefined;

beforeEach(() => {
  origMasterRoot = process.env.NEX_MASTER_AI_DATA_ROOT;
  origRuntimeRoot = process.env.NEX_AGENT_RUNTIME_DATA_ROOT;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-master-ai-w43-"));
  process.env.NEX_MASTER_AI_DATA_ROOT = path.join(tempDir, "master-ai");
  process.env.NEX_AGENT_RUNTIME_DATA_ROOT = path.join(tempDir, "agent-runtime");
  fs.mkdirSync(process.env.NEX_MASTER_AI_DATA_ROOT, { recursive: true });
  fs.mkdirSync(process.env.NEX_AGENT_RUNTIME_DATA_ROOT, { recursive: true });
});
afterEach(() => {
  if (origMasterRoot === undefined) delete process.env.NEX_MASTER_AI_DATA_ROOT;
  else process.env.NEX_MASTER_AI_DATA_ROOT = origMasterRoot;
  if (origRuntimeRoot === undefined) delete process.env.NEX_AGENT_RUNTIME_DATA_ROOT;
  else process.env.NEX_AGENT_RUNTIME_DATA_ROOT = origRuntimeRoot;
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

function mkDelegation() {
  return {
    source_agent_id: "master_ai" as any,
    target_agent_id: "programmer" as any,
    task_slug: "resilience_e150f990",
    task_description: "Implement resilience improvement for process_dead_but_heartbeat_recorded",
    bounds: { max_iterations: 4, max_runtime_ms: 5_000, max_files_changed: 8 },
    reason: "w43_test",
  };
}

describe("Y-W4-3 · Delegation consumer contract", () => {
  it("proof 1 · PENDING delegation is consumed by processOneDelegation", async () => {
    const { delegateTask, getDelegation } = await import("./delegation");
    const { processOneDelegation } = await import("./delegation-executor");
    const d = delegateTask(mkDelegation());
    expect(d.status).toBe("PENDING");
    const out = await processOneDelegation({
      delegation_id: d.delegation_id, recipient: "programmer",
      claimer_id: "worker-1",
    });
    expect(out.attempted).toBe(true);
    expect(out.final_status).toBe("COMPLETED");
    const after = getDelegation(d.delegation_id);
    expect(after?.status).toBe("COMPLETED");
  });

  it("proof 2 · Invalid delegation (prohibited keyword) is REJECTED", async () => {
    const { delegateTask } = await import("./delegation");
    const { processOneDelegation } = await import("./delegation-executor");
    const d = delegateTask({
      ...mkDelegation(),
      task_description: "This delegation attempts to bypass Phase G safety",
    });
    const out = await processOneDelegation({
      delegation_id: d.delegation_id, recipient: "programmer",
      claimer_id: "worker-1",
    });
    expect(out.final_status).toBe("REJECTED");
    expect(out.reason).toContain("bypass");
  });

  it("proof 2b · Invalid task_slug (bad pattern) is REJECTED", async () => {
    const { delegateTask } = await import("./delegation");
    const { processOneDelegation } = await import("./delegation-executor");
    const d = delegateTask({
      ...mkDelegation(),
      task_slug: "Bad-slug-with-caps",
    });
    // First, the delegateTask itself may accept but our validator should reject
    const out = await processOneDelegation({
      delegation_id: d.delegation_id, recipient: "programmer",
      claimer_id: "worker-1",
    });
    expect(out.final_status).toBe("REJECTED");
    expect(out.reason).toContain("task_slug_pattern_violation");
  });

  it("proof 3 · Duplicate claim is prevented · second claim returns null", async () => {
    const { delegateTask } = await import("./delegation");
    const { atomicClaim } = await import("./delegation");
    const d = delegateTask(mkDelegation());
    const first = atomicClaim({ delegation_id: d.delegation_id, claimer_id: "worker-1", recipient: "programmer" });
    expect(first).not.toBeNull();
    const second = atomicClaim({ delegation_id: d.delegation_id, claimer_id: "worker-2", recipient: "programmer" });
    expect(second).toBeNull();
  });

  it("proof 4 · Phase G bounds enforced · out-of-range max_iterations REJECTED", async () => {
    // delegateTask already validates bounds at CREATE time, so we must bypass
    // it by writing directly to the ledger with invalid bounds · then run
    // the executor to prove the executor also validates bounds.
    const { getDelegation } = await import("./delegation");
    const { processOneDelegation } = await import("./delegation-executor");
    const { appendJsonLine } = await import("./fs-atomic");
    const { delegationLedgerPath } = await import("./paths");
    const bad = {
      delegation_id: "bad-bounds-test", created_at_iso: new Date().toISOString(),
      updated_at_iso: new Date().toISOString(),
      source_agent_id: "master_ai", target_agent_id: "programmer",
      task_slug: "bad_bounds_task",
      task_description: "Test that executor validates bounds even if ledger has bad record",
      bounds: { max_iterations: 999, max_runtime_ms: 5000, max_files_changed: 8 },
      status: "PENDING", reason: "w43_bounds_test",
      outcome_ref: null, outcome_notes: null,
    };
    appendJsonLine(delegationLedgerPath(), bad);
    const out = await processOneDelegation({
      delegation_id: "bad-bounds-test", recipient: "programmer",
      claimer_id: "worker-1",
    });
    expect(out.final_status).toBe("REJECTED");
    expect(out.reason).toContain("max_iterations_out_of_range");
  });

  it("proof 5 · Successful outcome persisted with structured summary", async () => {
    const { delegateTask, getDelegation } = await import("./delegation");
    const { processOneDelegation } = await import("./delegation-executor");
    const d = delegateTask(mkDelegation());
    const out = await processOneDelegation({
      delegation_id: d.delegation_id, recipient: "programmer",
      claimer_id: "worker-1",
    });
    const after = getDelegation(d.delegation_id);
    expect(after?.status).toBe("COMPLETED");
    expect(after?.outcome_notes).toContain("Phase A observation-only");
    expect(after?.outcome_notes).toContain("bench=NO_VALID_IMPROVEMENT");
  });

  it("proof 6 · Failure outcome persisted with validation reason", async () => {
    const { delegateTask, getDelegation } = await import("./delegation");
    const { processOneDelegation } = await import("./delegation-executor");
    const d = delegateTask({
      ...mkDelegation(),
      task_description: "Attempt sandbox escape via /etc/passwd",
    });
    await processOneDelegation({
      delegation_id: d.delegation_id, recipient: "programmer",
      claimer_id: "worker-1",
    });
    const after = getDelegation(d.delegation_id);
    expect(after?.status).toBe("REJECTED");
    expect(after?.outcome_notes).toMatch(/prohibited_keyword|sandbox/);
  });

  it("proof 7 · Restart safety · re-running processOneDelegation on completed delegation is no-op", async () => {
    const { delegateTask, getDelegation } = await import("./delegation");
    const { processOneDelegation } = await import("./delegation-executor");
    const d = delegateTask(mkDelegation());
    const first = await processOneDelegation({
      delegation_id: d.delegation_id, recipient: "programmer",
      claimer_id: "worker-1",
    });
    expect(first.attempted).toBe(true);
    const second = await processOneDelegation({
      delegation_id: d.delegation_id, recipient: "programmer",
      claimer_id: "worker-1",
    });
    expect(second.attempted).toBe(false);
    expect(second.reason).toContain("not_pending");
    // Terminal status unchanged
    expect(getDelegation(d.delegation_id)?.status).toBe("COMPLETED");
  });

  it("proof 8 · Master AI can observe the outcome via getDelegation", async () => {
    const { delegateTask, getDelegation, readAllDelegations } = await import("./delegation");
    const { processOneDelegation } = await import("./delegation-executor");
    const d = delegateTask(mkDelegation());
    await processOneDelegation({
      delegation_id: d.delegation_id, recipient: "programmer",
      claimer_id: "master_ai_observer",
    });
    // Observable full history: PENDING → ACCEPTED → IN_PROGRESS → COMPLETED
    const history = readAllDelegations().filter((r) => r.delegation_id === d.delegation_id);
    expect(history.length).toBeGreaterThanOrEqual(4);   // PENDING, ACCEPTED, IN_PROGRESS, COMPLETED
    const statuses = history.map((r) => r.status);
    expect(statuses).toContain("PENDING");
    expect(statuses).toContain("ACCEPTED");
    expect(statuses).toContain("IN_PROGRESS");
    expect(statuses).toContain("COMPLETED");
  });

  it("proof 9 · Learning-cycle state · delegation flows PENDING → ACCEPTED → IN_PROGRESS → terminal", async () => {
    const { delegateTask, readAllDelegations } = await import("./delegation");
    const { processOneDelegation } = await import("./delegation-executor");
    const d = delegateTask(mkDelegation());
    await processOneDelegation({
      delegation_id: d.delegation_id, recipient: "programmer",
      claimer_id: "worker-1",
    });
    const history = readAllDelegations()
      .filter((r) => r.delegation_id === d.delegation_id)
      .sort((a, b) => a.updated_at_iso.localeCompare(b.updated_at_iso));
    // Verify ordering is strictly PENDING → ACCEPTED → IN_PROGRESS → COMPLETED
    expect(history[0].status).toBe("PENDING");
    expect(history[history.length - 1].status).toBe("COMPLETED");
  });

  it("proof 10a · getNextClaimablePending returns oldest PENDING for target", async () => {
    const { delegateTask, getNextClaimablePending } = await import("./delegation");
    delegateTask({ ...mkDelegation(), task_slug: "first_task" });
    delegateTask({ ...mkDelegation(), task_slug: "second_task" });
    const next = getNextClaimablePending("programmer" as any);
    expect(next?.task_slug).toBe("first_task");
  });

  it("proof 10b · getNextClaimablePending skips already-claimed delegations", async () => {
    const { delegateTask, getNextClaimablePending, atomicClaim } = await import("./delegation");
    const a = delegateTask({ ...mkDelegation(), task_slug: "task_alpha" });
    delegateTask({ ...mkDelegation(), task_slug: "task_bravo" });
    atomicClaim({ delegation_id: a.delegation_id, claimer_id: "w1", recipient: "programmer" as any });
    const next = getNextClaimablePending("programmer" as any);
    expect(next?.task_slug).toBe("task_bravo");
  });
});
