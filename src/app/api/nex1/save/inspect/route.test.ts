// src/app/api/nex1/save/inspect/route.test.ts
//
// Prove Save is bound to the canonical Project registry and NEVER falls
// back to process.cwd() when the Project is not resolvable.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the registry BEFORE importing the route.
vi.mock("@/lib/nex-agent/code-engine/capability-nex-project-registry", () => ({
  resolveActiveProject: vi.fn(),
}));

import { POST } from "./route";
import { resolveActiveProject } from "@/lib/nex-agent/code-engine/capability-nex-project-registry";

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/nex1/save/inspect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("save/inspect · Project binding · Rule 6", () => {
  it("REFUSES with NOT_AVAILABLE when active_project_id is missing (null body)", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue({
      status: "NOT_AVAILABLE",
      reason: "no active_project_id provided · Rule 6 · NEX does not silently select a project",
    });
    const req = buildRequest({});
    const resp = await POST(req);
    expect(resp.status).toBe(409);
    const j = await resp.json();
    expect(j.ok).toBe(false);
    expect(j.refused).toBe("NOT_AVAILABLE");
    expect(j.reason).toMatch(/Rule 6|silently select/i);
    // Prove: resolver was called with null id, NOT with a cwd fallback
    expect(resolveActiveProject).toHaveBeenCalledWith({ active_project_id: null });
  });

  it("REFUSES with NOT_AVAILABLE when active_project_id is empty string", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue({
      status: "NOT_AVAILABLE",
      reason: "no active_project_id provided · Rule 6 · NEX does not silently select a project",
    });
    const req = buildRequest({ active_project_id: "   " });
    const resp = await POST(req);
    expect(resp.status).toBe(409);
    expect(resolveActiveProject).toHaveBeenCalledWith({ active_project_id: null });
  });

  it("REFUSES with NOT_AVAILABLE when active_project_id references an unregistered project", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue({
      status: "NOT_AVAILABLE",
      reason: 'active_project_id "0123456789abcdef" is not registered',
    });
    const req = buildRequest({ active_project_id: "0123456789abcdef" });
    const resp = await POST(req);
    expect(resp.status).toBe(409);
    const j = await resp.json();
    expect(j.refused).toBe("NOT_AVAILABLE");
    expect(j.reason).toMatch(/not registered/);
  });

  it("REFUSES with INVALID when the registered workspace no longer exists", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue({
      status: "INVALID",
      project_id: "abcdef0123456789",
      reason: 'registered workspace_root "/tmp/gone" no longer exists on disk',
    });
    const req = buildRequest({ active_project_id: "abcdef0123456789" });
    const resp = await POST(req);
    expect(resp.status).toBe(409);
    const j = await resp.json();
    expect(j.refused).toBe("INVALID");
    expect(j.reason).toMatch(/no longer exists/);
  });

  it("REFUSES with AMBIGUOUS when multiple projects match the hint", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue({
      status: "AMBIGUOUS",
      candidates: [
        { record_type: "NEX_PROJECT", project_id: "a1b2c3d4e5f60000", project_name: "Acme Shop", project_slug: "acme-shop", workspace_root: "/tmp/a", framework: "static-html", source: "scaffold", created_at_iso: "", created_by: "", zero_llm: true, ledger: "B", version: "test" },
        { record_type: "NEX_PROJECT", project_id: "b2c3d4e5f6789abc", project_name: "Acme Blog", project_slug: "acme-blog", workspace_root: "/tmp/b", framework: "static-html", source: "scaffold", created_at_iso: "", created_by: "", zero_llm: true, ledger: "B", version: "test" },
      ],
      reason: "customer must choose",
    });
    const req = buildRequest({ active_project_id: null });
    const resp = await POST(req);
    expect(resp.status).toBe(409);
    const j = await resp.json();
    expect(j.refused).toBe("AMBIGUOUS");
    expect(j.candidates?.length).toBe(2);
  });

  it("NEVER returns process.cwd() as workspace_root on any refusal path", async () => {
    const scenarios = [
      { status: "NOT_AVAILABLE" as const, reason: "no id" },
      { status: "INVALID" as const, project_id: "x".repeat(16), reason: "missing" },
      { status: "AMBIGUOUS" as const, candidates: [], reason: "multiple" },
    ];
    for (const s of scenarios) {
      vi.mocked(resolveActiveProject).mockReturnValue(s);
      const resp = await POST(buildRequest({}));
      const j = await resp.json();
      // Refusal responses have no `project` field at all
      expect(j.project).toBeUndefined();
      // Belt and braces: no key in the response value equals process.cwd()
      const serialised = JSON.stringify(j);
      expect(serialised).not.toContain(process.cwd().replace(/\\/g, "\\\\"));
    }
  });
});

describe("save/inspect · RESOLVED · uses Project workspace_root", () => {
  it("inspects the Project's workspace_root · NOT process.cwd()", async () => {
    // Use the OS tmp dir so assessProjectState can safely run without side effects.
    // The workspace need not be a real git repo · assessProjectState handles
    // NOT_A_REPOSITORY gracefully.
    const { mkdirSync, existsSync, rmSync } = await import("node:fs");
    const path = await import("node:path");
    const { tmpdir } = await import("node:os");
    const fakeWorkspace = path.join(tmpdir(), `nex1-save-inspect-test-${Date.now()}`);
    if (existsSync(fakeWorkspace)) rmSync(fakeWorkspace, { recursive: true, force: true });
    mkdirSync(fakeWorkspace, { recursive: true });

    try {
      vi.mocked(resolveActiveProject).mockReturnValue({
        status: "RESOLVED",
        project: {
          record_type: "NEX_PROJECT",
          project_id: "0123456789abcdef",
          project_name: "Test Project",
          project_slug: "test-project",
          workspace_root: fakeWorkspace,
          framework: "static-html",
          source: "scaffold",
          created_at_iso: new Date().toISOString(),
          created_by: "test",
          zero_llm: true,
          ledger: "B",
          version: "test",
        },
        evidence: ["hint=active_project_id:0123456789abcdef", `workspace_verified=${fakeWorkspace}`],
      });

      const req = buildRequest({ active_project_id: "0123456789abcdef" });
      const resp = await POST(req);
      expect(resp.status).toBe(200);
      const j = await resp.json();
      expect(j.ok).toBe(true);
      expect(j.project.workspace_root).toBe(fakeWorkspace);
      expect(j.project.workspace_root).not.toBe(process.cwd());
      // The assessment was run against the Project's workspace, not cwd
      // (assessProjectState returns NOT_A_REPOSITORY for a plain empty dir · that's honest)
      expect(j.assessment.state).toBeDefined();
    } finally {
      rmSync(fakeWorkspace, { recursive: true, force: true });
    }
  });
});
