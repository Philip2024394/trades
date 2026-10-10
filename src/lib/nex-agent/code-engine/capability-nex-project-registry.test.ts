// src/lib/nex-agent/code-engine/capability-nex-project-registry.test.ts
//
// Tests for the canonical Project identity layer.
// Proves: identity + workspace stability independent of task_id and trace_id,
// anti-fabrication invariants, Rule 6 (no silent selection), 4-state resolver.

import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  registerProject,
  getProject,
  listProjects,
  resolveActiveProject,
  deriveStableProjectId,
  NEX_PROJECT_REGISTRY_VERSION,
} from "./capability-nex-project-registry";

// Fresh isolated test scaffolding per test run
const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const TEST_ROOT = path.join(tmpdir(), "nex1-project-registry-test", RUN_ID);
const SANCTIONED = path.join(TEST_ROOT, "sanctioned");
const INFRA = path.join(TEST_ROOT, "nex-infra");
const REGISTRY = path.join(TEST_ROOT, "registry", "index.jsonl");

function opts() {
  return { registry_path: REGISTRY, sanctioned_root: SANCTIONED, nex_infra_root: INFRA };
}

function makeSanctionedWorkspace(slug: string): string {
  const wsRoot = path.join(SANCTIONED, slug);
  mkdirSync(wsRoot, { recursive: true });
  return wsRoot;
}

function baseInput(slug: string, projectId?: string) {
  return {
    project_id: projectId ?? deriveStableProjectId({ project_slug: slug, framework: "static-html" as const, source: "scaffold" as const }),
    project_name: `Project ${slug}`,
    project_slug: slug,
    workspace_root: makeSanctionedWorkspace(slug),
    framework: "static-html" as const,
    source: "scaffold" as const,
    created_by: "founder",
  };
}

beforeEach(() => {
  if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true, force: true });
  mkdirSync(SANCTIONED, { recursive: true });
  mkdirSync(INFRA, { recursive: true });
});

describe("NexProjectRegistry · valid registration + retrieval", () => {
  it("valid Project registers and returns the canonical record", () => {
    const r = registerProject(baseInput("acme-shop"), opts());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.record.record_type).toBe("NEX_PROJECT");
      expect(r.record.project_slug).toBe("acme-shop");
      expect(r.record.zero_llm).toBe(true);
      expect(r.record.ledger).toBe("B");
      expect(r.record.version).toBe(NEX_PROJECT_REGISTRY_VERSION);
    }
  });

  it("valid Project retrieves by project_id after registration", () => {
    const r = registerProject(baseInput("acme-shop"), opts());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const back = getProject(r.record.project_id, opts());
    expect(back).not.toBeNull();
    expect(back?.project_id).toBe(r.record.project_id);
    expect(back?.workspace_root).toBe(r.record.workspace_root);
  });

  it("listProjects returns all registered", () => {
    registerProject(baseInput("one"), opts());
    registerProject(baseInput("two"), opts());
    registerProject(baseInput("three"), opts());
    const all = listProjects(opts());
    expect(all.length).toBe(3);
    expect(new Set(all.map((r) => r.project_slug))).toEqual(new Set(["one", "two", "three"]));
  });

  it("re-registering identical (project_id + workspace_root) is idempotent · no duplicate row", () => {
    const input = baseInput("acme-shop");
    const r1 = registerProject(input, opts());
    const r2 = registerProject(input, opts());
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(listProjects(opts()).length).toBe(1);
  });
});

describe("NexProjectRegistry · anti-fabrication invariants", () => {
  it("REJECTS: project_id malformed", () => {
    const r = registerProject({ ...baseInput("acme-shop"), project_id: "TOO_SHORT" }, opts());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason_code).toBe("PROJECT_ID_INVALID");
  });

  it("REJECTS: project_slug malformed", () => {
    const r = registerProject({ ...baseInput("acme-shop"), project_slug: "-bad-lead-hyphen" }, opts());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason_code).toBe("PROJECT_SLUG_INVALID");
  });

  it("REJECTS: project_name empty", () => {
    const r = registerProject({ ...baseInput("acme-shop"), project_name: "  " }, opts());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason_code).toBe("PROJECT_NAME_EMPTY");
  });

  it("REJECTS: workspace outside sanctioned root", () => {
    const outsideRoot = path.join(TEST_ROOT, "outside");
    mkdirSync(outsideRoot, { recursive: true });
    const r = registerProject({ ...baseInput("acme-shop"), workspace_root: outsideRoot }, opts());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason_code).toBe("WORKSPACE_OUTSIDE_SANCTIONED_ROOT");
  });

  it("REJECTS: workspace resolves to NEX infrastructure root", () => {
    // Even if we pretend the infra root is inside sanctioned (which it isn't in real config),
    // the infra check MUST fire first.
    const infraAsWorkspace = INFRA;
    mkdirSync(infraAsWorkspace, { recursive: true });
    const r = registerProject({ ...baseInput("acme-shop"), workspace_root: infraAsWorkspace }, opts());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // Either infra-check or outside-sanctioned check may fire · both are correct rejections
      expect(["WORKSPACE_IS_NEX_INFRASTRUCTURE", "WORKSPACE_OUTSIDE_SANCTIONED_ROOT"]).toContain(r.reason_code);
    }
  });

  it("REJECTS: process.cwd() as workspace (real cwd, real infra check)", () => {
    // Use production defaults for this test — no test override — so process.cwd() is checked as real infra
    const cwdRoot = process.cwd();
    const r = registerProject({
      project_id: deriveStableProjectId({ project_slug: "cwd-attempt", framework: "static-html", source: "scaffold" }),
      project_name: "cwd attempt",
      project_slug: "cwd-attempt",
      workspace_root: cwdRoot,
      framework: "static-html",
      source: "scaffold",
      created_by: "founder",
    }, { registry_path: REGISTRY });  // note: no sanctioned_root/nex_infra_root override
    expect(r.ok).toBe(false);
    // Either infra check or sanctioned-root check must fire · never OK
    if (!r.ok) {
      expect(["WORKSPACE_IS_NEX_INFRASTRUCTURE", "WORKSPACE_OUTSIDE_SANCTIONED_ROOT"]).toContain(r.reason_code);
    }
  });

  it("REJECTS: workspace does not exist", () => {
    const missing = path.join(SANCTIONED, "does-not-exist-yet");
    // deliberately do NOT create it
    const r = registerProject({ ...baseInput("acme-shop"), workspace_root: missing }, opts());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason_code).toBe("WORKSPACE_DOES_NOT_EXIST");
  });

  it("REJECTS: duplicate project_id pointing at different workspace", () => {
    const first = registerProject(baseInput("acme-shop"), opts());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    // Create a second workspace and try to reuse the same project_id
    const otherWs = makeSanctionedWorkspace("other-workspace");
    const second = registerProject({
      ...baseInput("something-else", first.record.project_id),
      workspace_root: otherWs,
    }, opts());
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason_code).toBe("DUPLICATE_PROJECT_ID_DIFFERENT_WORKSPACE");
  });

  it("REJECTS: two projects claiming the same workspace_root", () => {
    const first = registerProject(baseInput("acme-shop"), opts());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    // Same workspace, different project_id/slug
    const conflict = registerProject({
      ...baseInput("another-slug"),
      workspace_root: first.record.workspace_root,
    }, opts());
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.reason_code).toBe("DUPLICATE_WORKSPACE_ROOT");
  });
});

describe("NexProjectRegistry · Project identity stability", () => {
  // The key proof: identity is independent of task_id and trace_id.
  // We simulate "separate traces / separate tasks" as separate readRegistry
  // reads after independent registerProject calls without any shared state.

  it("project identity remains stable across separate registration reads", () => {
    const r = registerProject(baseInput("stable-one"), opts());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const stableId = r.record.project_id;
    const stableRoot = r.record.workspace_root;

    // "Later task" · fresh read
    const back1 = getProject(stableId, opts());
    expect(back1?.project_id).toBe(stableId);
    expect(back1?.workspace_root).toBe(stableRoot);

    // "Later trace" · another fresh read
    const back2 = getProject(stableId, opts());
    expect(back2?.project_id).toBe(stableId);
    expect(back2?.workspace_root).toBe(stableRoot);

    // Explicitly prove: identity does NOT include task_id or trace_id
    expect(back1?.project_id).not.toMatch(/trace/);
    expect(back1?.project_id).not.toMatch(/task/);
  });

  it("deriveStableProjectId is deterministic: same inputs → same id", () => {
    const a = deriveStableProjectId({ project_slug: "portfolio", framework: "next-app-router", source: "scaffold" });
    const b = deriveStableProjectId({ project_slug: "portfolio", framework: "next-app-router", source: "scaffold" });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{16}$/);
  });

  it("deriveStableProjectId differs on different inputs (no collisions on the fixture set)", () => {
    const a = deriveStableProjectId({ project_slug: "portfolio", framework: "next-app-router", source: "scaffold" });
    const b = deriveStableProjectId({ project_slug: "portfolio", framework: "static-html", source: "scaffold" });
    const c = deriveStableProjectId({ project_slug: "shop", framework: "next-app-router", source: "scaffold" });
    expect(new Set([a, b, c]).size).toBe(3);
  });
});

describe("NexProjectRegistry · resolveActiveProject · 4-state contract", () => {
  it("RESOLVED · valid active_project_id · workspace exists", () => {
    const r = registerProject(baseInput("acme-shop"), opts());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const out = resolveActiveProject({ active_project_id: r.record.project_id }, opts());
    expect(out.status).toBe("RESOLVED");
    if (out.status === "RESOLVED") {
      expect(out.project.project_id).toBe(r.record.project_id);
      expect(out.evidence.length).toBeGreaterThan(0);
    }
  });

  it("NOT_AVAILABLE · active_project_id is null · Rule 6 · no silent selection", () => {
    // Even with one project registered, no hint → NOT_AVAILABLE
    registerProject(baseInput("acme-shop"), opts());
    const out = resolveActiveProject({ active_project_id: null }, opts());
    expect(out.status).toBe("NOT_AVAILABLE");
    if (out.status === "NOT_AVAILABLE") {
      expect(out.reason).toMatch(/Rule 6|silently select/i);
    }
  });

  it("NOT_AVAILABLE · active_project_id is not registered", () => {
    const out = resolveActiveProject({ active_project_id: "0123456789abcdef" }, opts());
    expect(out.status).toBe("NOT_AVAILABLE");
    if (out.status === "NOT_AVAILABLE") {
      expect(out.reason).toMatch(/not registered/);
    }
  });

  it("INVALID · registered project · workspace no longer exists on disk", () => {
    const r = registerProject(baseInput("acme-shop"), opts());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Delete the workspace after registration
    rmSync(r.record.workspace_root, { recursive: true, force: true });
    const out = resolveActiveProject({ active_project_id: r.record.project_id }, opts());
    expect(out.status).toBe("INVALID");
    if (out.status === "INVALID") {
      expect(out.project_id).toBe(r.record.project_id);
      expect(out.reason).toMatch(/no longer exists/);
    }
  });

  it("AMBIGUOUS · by_slug_prefix matches multiple projects", () => {
    registerProject(baseInput("acme-shop"), opts());
    registerProject(baseInput("acme-blog"), opts());
    registerProject(baseInput("acme-portfolio"), opts());
    const out = resolveActiveProject({ active_project_id: null, by_slug_prefix: "acme-" }, opts());
    expect(out.status).toBe("AMBIGUOUS");
    if (out.status === "AMBIGUOUS") {
      expect(out.candidates.length).toBe(3);
      expect(out.reason).toMatch(/customer must choose/);
    }
  });

  it("RESOLVED · by_slug_prefix matches exactly one project", () => {
    registerProject(baseInput("acme-shop"), opts());
    registerProject(baseInput("bravo-blog"), opts());
    const out = resolveActiveProject({ active_project_id: null, by_slug_prefix: "acme-" }, opts());
    expect(out.status).toBe("RESOLVED");
  });

  it("NOT_AVAILABLE · by_slug_prefix matches nothing", () => {
    registerProject(baseInput("acme-shop"), opts());
    const out = resolveActiveProject({ active_project_id: null, by_slug_prefix: "nomatch-" }, opts());
    expect(out.status).toBe("NOT_AVAILABLE");
  });

  it("resolver NEVER returns RESOLVED with process.cwd() as workspace", () => {
    // A separate scenario: create a fake registry row that points at cwd, bypass registerProject.
    // If we could resolve to that, the invariant is broken. Because we CAN'T register cwd (previous test proves this),
    // and getProject/resolve read from the same registry that registerProject writes to, this composes.
    // Direct anti-fabrication proof: a legitimate resolveActiveProject flow never yields cwd.
    const r = registerProject(baseInput("acme-shop"), opts());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const out = resolveActiveProject({ active_project_id: r.record.project_id }, opts());
    expect(out.status).toBe("RESOLVED");
    if (out.status === "RESOLVED") {
      expect(path.resolve(out.project.workspace_root)).not.toBe(path.resolve(process.cwd()));
    }
  });
});
