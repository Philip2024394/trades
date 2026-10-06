// Stage 3.9 · Phase 1 · Capability Registry tests.

import { describe, it, expect } from "vitest";
import {
  listCapabilities,
  getCapability,
  capabilitiesByStatus,
  capabilitySummary,
  ActivationTrace,
} from "./capabilities";

describe("Brain Capability Registry", () => {
  it("registers all canonical capabilities", () => {
    expect(listCapabilities()).toHaveLength(44); // 43 pre-Theme-Brain + theme_intelligence (Phase 1 · sealed 2026-10-05)
  });

  it("every capability has an id, name, baby description, and status", () => {
    for (const c of listCapabilities()) {
      expect(c.id).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.baby).toBeTruthy();
      expect(["GREEN", "PARTIAL", "MISSING"]).toContain(c.status);
    }
  });

  it("every GREEN capability names at least one implementation file", () => {
    for (const c of capabilitiesByStatus("GREEN")) {
      expect(c.files.length).toBeGreaterThan(0);
    }
  });

  it("MISSING capabilities have empty files list (nothing to point at)", () => {
    for (const c of capabilitiesByStatus("MISSING")) {
      expect(c.files).toEqual([]);
    }
  });

  it("summary counts add up to total", () => {
    const s = capabilitySummary();
    expect(s.GREEN + s.PARTIAL + s.MISSING).toBe(s.total);
    expect(s.total).toBe(44);
  });

  it("core capabilities that should be GREEN post-Phase-2 are GREEN", () => {
    const mustBeGreen = [
      "intent", "context", "memory", "world_knowledge", "insight",
      "curiosity", "smart_questioning", "decision", "truth_honesty",
      "safety", "conversation_control", "self_awareness", "goal_tracking",
    ] as const;
    for (const id of mustBeGreen) {
      expect(getCapability(id)?.status, `expected ${id} to be GREEN`).toBe("GREEN");
    }
  });
});

describe("ActivationTrace", () => {
  it("records activations and summarises them", () => {
    const t = new ActivationTrace();
    t.record("intent", "classified");
    t.record("insight", "decision");
    t.record("insight", "another"); // duplicates ignored in summary
    const s = t.summary();
    expect(s.count).toBe(2);
    expect(new Set(s.capabilities)).toEqual(new Set(["intent", "insight"]));
  });

  it("activated() reports whether a specific capability fired", () => {
    const t = new ActivationTrace();
    t.record("memory", "session read");
    expect(t.activated("memory")).toBe(true);
    expect(t.activated("commerce")).toBe(false);
  });
});
