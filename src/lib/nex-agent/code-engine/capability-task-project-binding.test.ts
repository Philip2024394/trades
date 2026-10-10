// src/lib/nex-agent/code-engine/capability-task-project-binding.test.ts
//
// Prove: TASK belongs_to PROJECT, never the other way around.
// Prove: bindings honour the canonical Project registry as authority.

import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  bindTaskToProject,
  getProjectForTask,
  listBindingsForProject,
  listAllBindings,
  TASK_PROJECT_BINDING_VERSION,
} from "./capability-task-project-binding";

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const TEST_ROOT = path.join(tmpdir(), "nex1-task-binding-test", RUN_ID);
const REGISTRY = path.join(TEST_ROOT, "index.jsonl");

// Fake "project exists in registry" resolver · injected for isolation
const KNOWN_PROJECTS = new Set<string>();

function opts() {
  return {
    registry_path: REGISTRY,
    resolveProjectExists: (pid: string) => KNOWN_PROJECTS.has(pid),
  };
}

const uuid = (n: number): string => {
  const hex = n.toString(16).padStart(32, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

beforeEach(() => {
  if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true, force: true });
  mkdirSync(TEST_ROOT, { recursive: true });
  KNOWN_PROJECTS.clear();
});

describe("bindTaskToProject · valid binding", () => {
  it("binds a task to a registered project", () => {
    KNOWN_PROJECTS.add("0123456789abcdef");
    const r = bindTaskToProject(
      { task_id: uuid(1), project_id: "0123456789abcdef", bound_by: "founder" },
      opts(),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.binding.record_type).toBe("NEX_TASK_PROJECT_BINDING");
      expect(r.binding.project_id).toBe("0123456789abcdef");
      expect(r.binding.version).toBe(TASK_PROJECT_BINDING_VERSION);
      expect(r.binding.zero_llm).toBe(true);
    }
  });

  it("getProjectForTask returns the bound project after registration", () => {
    KNOWN_PROJECTS.add("0123456789abcdef");
    const taskId = uuid(2);
    bindTaskToProject({ task_id: taskId, project_id: "0123456789abcdef", bound_by: "founder" }, opts());
    expect(getProjectForTask(taskId, opts())).toBe("0123456789abcdef");
  });

  it("listBindingsForProject returns all tasks bound to that project", () => {
    KNOWN_PROJECTS.add("aaaaaaaaaaaaaaaa");
    KNOWN_PROJECTS.add("bbbbbbbbbbbbbbbb");
    bindTaskToProject({ task_id: uuid(10), project_id: "aaaaaaaaaaaaaaaa", bound_by: "f" }, opts());
    bindTaskToProject({ task_id: uuid(11), project_id: "aaaaaaaaaaaaaaaa", bound_by: "f" }, opts());
    bindTaskToProject({ task_id: uuid(12), project_id: "bbbbbbbbbbbbbbbb", bound_by: "f" }, opts());
    expect(listBindingsForProject("aaaaaaaaaaaaaaaa", opts()).length).toBe(2);
    expect(listBindingsForProject("bbbbbbbbbbbbbbbb", opts()).length).toBe(1);
    expect(listAllBindings(opts()).length).toBe(3);
  });

  it("re-binding the same task to the same project is idempotent · no duplicate row", () => {
    KNOWN_PROJECTS.add("0123456789abcdef");
    const taskId = uuid(3);
    const r1 = bindTaskToProject({ task_id: taskId, project_id: "0123456789abcdef", bound_by: "f" }, opts());
    const r2 = bindTaskToProject({ task_id: taskId, project_id: "0123456789abcdef", bound_by: "f" }, opts());
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(listAllBindings(opts()).length).toBe(1);
  });
});

describe("bindTaskToProject · anti-fabrication invariants", () => {
  it("REJECTS: task_id not a UUID", () => {
    KNOWN_PROJECTS.add("0123456789abcdef");
    const r = bindTaskToProject(
      { task_id: "not-a-uuid", project_id: "0123456789abcdef", bound_by: "f" },
      opts(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason_code).toBe("TASK_ID_INVALID");
  });

  it("REJECTS: project_id malformed", () => {
    const r = bindTaskToProject(
      { task_id: uuid(5), project_id: "TOO_SHORT", bound_by: "f" },
      opts(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason_code).toBe("PROJECT_ID_INVALID");
  });

  it("REJECTS: project not in canonical registry (anti-fabrication)", () => {
    // KNOWN_PROJECTS is empty · resolveProjectExists returns false
    const r = bindTaskToProject(
      { task_id: uuid(6), project_id: "0123456789abcdef", bound_by: "f" },
      opts(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason_code).toBe("PROJECT_NOT_IN_REGISTRY");
  });

  it("REJECTS: attempting to re-bind an existing task to a DIFFERENT project", () => {
    KNOWN_PROJECTS.add("aaaaaaaaaaaaaaaa");
    KNOWN_PROJECTS.add("bbbbbbbbbbbbbbbb");
    const taskId = uuid(7);
    const r1 = bindTaskToProject({ task_id: taskId, project_id: "aaaaaaaaaaaaaaaa", bound_by: "f" }, opts());
    expect(r1.ok).toBe(true);
    const r2 = bindTaskToProject({ task_id: taskId, project_id: "bbbbbbbbbbbbbbbb", bound_by: "f" }, opts());
    expect(r2.ok).toBe(false);
    if (!r2.ok) {
      expect(r2.reason_code).toBe("TASK_ALREADY_BOUND_TO_DIFFERENT_PROJECT");
      expect(r2.reason).toMatch(/already bound/);
    }
  });
});

describe("bindTaskToProject · legacy / infrastructure preservation", () => {
  it("unbound task returns null · never fabricates a project_id", () => {
    // No bindings written · this is the legacy/infrastructure state
    const legacyTaskId = uuid(99);
    expect(getProjectForTask(legacyTaskId, opts())).toBeNull();
  });

  it("listBindingsForProject on an unknown project returns empty · never invents", () => {
    KNOWN_PROJECTS.add("aaaaaaaaaaaaaaaa");
    bindTaskToProject({ task_id: uuid(20), project_id: "aaaaaaaaaaaaaaaa", bound_by: "f" }, opts());
    expect(listBindingsForProject("cccccccccccccccc", opts())).toEqual([]);
  });
});

describe("bindTaskToProject · Project isolation", () => {
  it("Task A bound to Project A cannot be reported as bound to Project B", () => {
    KNOWN_PROJECTS.add("aaaaaaaaaaaaaaaa");
    KNOWN_PROJECTS.add("bbbbbbbbbbbbbbbb");
    const taskA = uuid(30);
    bindTaskToProject({ task_id: taskA, project_id: "aaaaaaaaaaaaaaaa", bound_by: "f" }, opts());
    expect(getProjectForTask(taskA, opts())).toBe("aaaaaaaaaaaaaaaa");
    expect(listBindingsForProject("bbbbbbbbbbbbbbbb", opts())).toEqual([]);
  });
});
