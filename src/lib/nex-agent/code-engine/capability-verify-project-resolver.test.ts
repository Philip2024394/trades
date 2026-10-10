// src/lib/nex-agent/code-engine/capability-verify-project-resolver.test.ts
//
// Prove: Verify honours the canonical Project registry.
// Prove: LEGACY_INFRASTRUCTURE is a deliberate outcome, not a fallback.
// Prove: NEVER returns process.cwd() as a customer Project workspace.

import { describe, it, expect } from "vitest";
import { resolveVerifyWorkspace } from "./capability-verify-project-resolver";
import type { NexProjectRecord } from "./capability-nex-project-registry";

function project(overrides: Partial<NexProjectRecord> = {}): NexProjectRecord {
  return {
    record_type: "NEX_PROJECT",
    project_id: "0123456789abcdef",
    project_name: "Test Project",
    project_slug: "test-project",
    workspace_root: "/tmp/nex-workspace/test-project",
    framework: "static-html",
    source: "scaffold",
    created_at_iso: new Date().toISOString(),
    created_by: "founder",
    zero_llm: true,
    ledger: "B",
    version: "test",
    ...overrides,
  };
}

describe("resolveVerifyWorkspace · PROJECT_BOUND paths", () => {
  it("explicit active_project_id → PROJECT_BOUND with source=explicit_hint", () => {
    const r = resolveVerifyWorkspace(
      { active_project_id: "0123456789abcdef", task_id: null },
      {
        resolveActiveProject: () => ({ status: "RESOLVED", project: project(), evidence: [] }),
        getProjectForTask: () => null,
      },
    );
    expect(r.outcome).toBe("PROJECT_BOUND");
    if (r.outcome === "PROJECT_BOUND") {
      expect(r.source).toBe("explicit_hint");
      expect(r.workspace_root).toBe("/tmp/nex-workspace/test-project");
      expect(r.workspace_root).not.toBe(process.cwd());
    }
  });

  it("task_id with binding → PROJECT_BOUND with source=task_binding", () => {
    const r = resolveVerifyWorkspace(
      { active_project_id: null, task_id: "some-task-uuid" },
      {
        resolveActiveProject: (input) => {
          expect(input.active_project_id).toBe("0123456789abcdef");
          return { status: "RESOLVED", project: project(), evidence: [] };
        },
        getProjectForTask: (t) => (t === "some-task-uuid" ? "0123456789abcdef" : null),
      },
    );
    expect(r.outcome).toBe("PROJECT_BOUND");
    if (r.outcome === "PROJECT_BOUND") {
      expect(r.source).toBe("task_binding");
      expect(r.workspace_root).not.toBe(process.cwd());
    }
  });

  it("explicit hint OVERRIDES task binding · never silently substitutes", () => {
    const r = resolveVerifyWorkspace(
      { active_project_id: "aaaaaaaaaaaaaaaa", task_id: "some-task-uuid" },
      {
        resolveActiveProject: (input) => {
          // Prove: the explicit hint was used · NOT the task binding
          expect(input.active_project_id).toBe("aaaaaaaaaaaaaaaa");
          return { status: "RESOLVED", project: project({ project_id: "aaaaaaaaaaaaaaaa", workspace_root: "/tmp/nex-workspace/other" }), evidence: [] };
        },
        // task binding points at a different project · resolver must prefer the explicit hint
        getProjectForTask: () => "0123456789abcdef",
      },
    );
    expect(r.outcome).toBe("PROJECT_BOUND");
    if (r.outcome === "PROJECT_BOUND") {
      expect(r.source).toBe("explicit_hint");
      expect(r.project_id).toBe("aaaaaaaaaaaaaaaa");
    }
  });
});

describe("resolveVerifyWorkspace · LEGACY_INFRASTRUCTURE preservation", () => {
  it("no hint AND no task binding → LEGACY_INFRASTRUCTURE (existing behaviour preserved)", () => {
    const r = resolveVerifyWorkspace(
      { active_project_id: null, task_id: "unbound-task-uuid" },
      {
        resolveActiveProject: () => { throw new Error("resolveActiveProject should not be called"); },
        getProjectForTask: () => null,  // task has no Project binding
      },
    );
    expect(r.outcome).toBe("LEGACY_INFRASTRUCTURE");
    if (r.outcome === "LEGACY_INFRASTRUCTURE") {
      expect(r.reason).toBe("no_project_hint_and_no_task_binding");
    }
  });

  it("empty active_project_id AND no task_id → LEGACY_INFRASTRUCTURE", () => {
    const r = resolveVerifyWorkspace(
      { active_project_id: "  ", task_id: null },
      {
        resolveActiveProject: () => { throw new Error("must not be called"); },
        getProjectForTask: () => null,
      },
    );
    expect(r.outcome).toBe("LEGACY_INFRASTRUCTURE");
  });

  it("legacy verification does NOT invoke resolveActiveProject at all", () => {
    let called = false;
    resolveVerifyWorkspace(
      { active_project_id: null, task_id: null },
      {
        resolveActiveProject: () => { called = true; return { status: "NOT_AVAILABLE", reason: "" }; },
        getProjectForTask: () => null,
      },
    );
    expect(called).toBe(false);
  });
});

describe("resolveVerifyWorkspace · refusal outcomes", () => {
  it("explicit hint · unknown project → NOT_AVAILABLE", () => {
    const r = resolveVerifyWorkspace(
      { active_project_id: "0123456789abcdef", task_id: null },
      {
        resolveActiveProject: () => ({ status: "NOT_AVAILABLE", reason: "not registered" }),
        getProjectForTask: () => null,
      },
    );
    expect(r.outcome).toBe("NOT_AVAILABLE");
    if (r.outcome === "NOT_AVAILABLE") {
      expect(r.attempted_project_id).toBe("0123456789abcdef");
      expect(r.reason).toBe("not registered");
    }
  });

  it("bound task pointing to missing workspace → INVALID (never falls back to legacy)", () => {
    const r = resolveVerifyWorkspace(
      { active_project_id: null, task_id: "bound-task" },
      {
        resolveActiveProject: () => ({ status: "INVALID", project_id: "abc", reason: "workspace missing" }),
        getProjectForTask: () => "abc",
      },
    );
    expect(r.outcome).toBe("INVALID");
    if (r.outcome === "INVALID") expect(r.reason).toMatch(/workspace missing/);
  });

  it("AMBIGUOUS surfaces candidates", () => {
    const r = resolveVerifyWorkspace(
      { active_project_id: "abc", task_id: null },
      {
        resolveActiveProject: () => ({
          status: "AMBIGUOUS",
          candidates: [project({ project_id: "aaaaaaaaaaaaaaaa" }), project({ project_id: "bbbbbbbbbbbbbbbb" })],
          reason: "customer must choose",
        }),
        getProjectForTask: () => null,
      },
    );
    expect(r.outcome).toBe("AMBIGUOUS");
    if (r.outcome === "AMBIGUOUS") expect(r.candidates.length).toBe(2);
  });
});

describe("resolveVerifyWorkspace · anti-fabrication invariants", () => {
  it("no outcome (of any kind) ever returns process.cwd() as workspace_root", () => {
    const scenarios: Array<Parameters<typeof resolveVerifyWorkspace>[0]> = [
      { active_project_id: null, task_id: null },
      { active_project_id: null, task_id: "any" },
      { active_project_id: "any", task_id: null },
      { active_project_id: "any", task_id: "any" },
    ];
    for (const s of scenarios) {
      const r = resolveVerifyWorkspace(s, {
        resolveActiveProject: () => ({ status: "NOT_AVAILABLE", reason: "test" }),
        getProjectForTask: () => null,
      });
      const serialised = JSON.stringify(r);
      expect(serialised).not.toContain(process.cwd().replace(/\\/g, "\\\\"));
    }
  });

  it("Project A workspace and Project B workspace never collide in a single resolution", () => {
    const rA = resolveVerifyWorkspace(
      { active_project_id: "aaaaaaaaaaaaaaaa", task_id: null },
      {
        resolveActiveProject: () => ({ status: "RESOLVED", project: project({ project_id: "aaaaaaaaaaaaaaaa", workspace_root: "/tmp/A" }), evidence: [] }),
        getProjectForTask: () => null,
      },
    );
    const rB = resolveVerifyWorkspace(
      { active_project_id: "bbbbbbbbbbbbbbbb", task_id: null },
      {
        resolveActiveProject: () => ({ status: "RESOLVED", project: project({ project_id: "bbbbbbbbbbbbbbbb", workspace_root: "/tmp/B" }), evidence: [] }),
        getProjectForTask: () => null,
      },
    );
    if (rA.outcome === "PROJECT_BOUND" && rB.outcome === "PROJECT_BOUND") {
      expect(rA.workspace_root).not.toBe(rB.workspace_root);
      expect(rA.project_id).not.toBe(rB.project_id);
    }
  });
});
