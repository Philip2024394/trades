// src/lib/nex/workstation/workstation-store.test.ts
//
// Isolated tests · uses a fresh WorkstationStore instance (not the global)
// so tests don't pollute or depend on process-level state.

import { describe, it, expect, beforeEach } from "vitest";

// Import the class shape by re-declaring — we test the store logic itself,
// not the singleton export. Since the file exports both the singleton and
// (implicitly) the class, we exercise via the singleton but clear between tests.

import { workstationStore } from "./workstation-store";

beforeEach(() => {
  workstationStore.setIdle();
});

describe("workstationStore lifecycle", () => {
  it("starts idle when task cleared", () => {
    workstationStore.setIdle();
    expect(workstationStore.currentTask()).toBeNull();
  });

  it("startTask + currentTask returns active task", () => {
    const task = workstationStore.startTask({
      taskId: "t-1",
      capabilityId: "CAP-091",
      summary: "test build",
      ownerAgentId: "nex1",
    });
    expect(task.status).toBe("ACTIVE");
    expect(workstationStore.currentTask()?.taskId).toBe("t-1");
  });

  it("appendEvent records events on task", () => {
    workstationStore.startTask({
      taskId: "t-2", capabilityId: null, summary: "x", ownerAgentId: "nex1",
    });
    workstationStore.appendEvent({
      at: new Date().toISOString(),
      kind: "build_ok",
      agentId: "nex1",
      detail: "tests pass",
    });
    const t = workstationStore.currentTask();
    expect(t?.events.length).toBeGreaterThanOrEqual(2); // start + build_ok
    expect(t?.events[t!.events.length - 1].kind).toBe("build_ok");
  });

  it("appendEvent returns null when no active task", () => {
    workstationStore.setIdle();
    const r = workstationStore.appendEvent({
      at: new Date().toISOString(),
      kind: "build_ok",
      agentId: "nex1",
      detail: "x",
    });
    expect(r).toBeNull();
  });

  it("setStatus transitions correctly", () => {
    workstationStore.startTask({ taskId: "t-3", capabilityId: null, summary: "x", ownerAgentId: "nex1" });
    workstationStore.setStatus("AWAITING_REVIEW");
    expect(workstationStore.currentTask()?.status).toBe("AWAITING_REVIEW");
  });
});
