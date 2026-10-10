// src/app/api/nex1/project/run/route.test.ts
//
// Prove Preview/Run is bound to the canonical Project registry and NEVER
// falls back to process.cwd(). Prove Rule 6 (start requires explicit action).

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock BOTH the registry and the orchestrator so tests are hermetic (no real spawn).
vi.mock("@/lib/nex-agent/code-engine/capability-nex-project-registry", () => ({
  resolveActiveProject: vi.fn(),
}));
vi.mock("@/lib/nex-agent/code-engine/capability-dev-server-orchestrator", () => ({
  startSession: vi.fn(),
  stopSession: vi.fn(),
  getSession: vi.fn(),
  deriveSessionId: vi.fn((project_root: string) => `session-for-${project_root}`),
}));

import { POST } from "./route";
import { resolveActiveProject } from "@/lib/nex-agent/code-engine/capability-nex-project-registry";
import { startSession, stopSession, getSession } from "@/lib/nex-agent/code-engine/capability-dev-server-orchestrator";

function req(body: unknown): Request {
  return new Request("http://localhost/api/nex1/project/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function resolvedProject(overrides: Partial<Parameters<typeof resolveActiveProject>[0]> & {
  workspace_root?: string; project_id?: string; framework?: "next-app-router" | "static-html";
} = {}) {
  return {
    status: "RESOLVED" as const,
    project: {
      record_type: "NEX_PROJECT" as const,
      project_id: overrides.project_id ?? "0123456789abcdef",
      project_name: "Test Project",
      project_slug: "test-project",
      workspace_root: overrides.workspace_root ?? "/tmp/nex-workspace/test-project",
      framework: overrides.framework ?? "static-html" as const,
      source: "scaffold" as const,
      created_at_iso: new Date().toISOString(),
      created_by: "founder",
      zero_llm: true as const,
      ledger: "B" as const,
      version: "test",
    },
    evidence: ["hint=active_project_id:0123456789abcdef", "workspace_verified"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("project/run · resolver binding · 4-state refusal", () => {
  it("REFUSES NOT_AVAILABLE when active_project_id is missing", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue({
      status: "NOT_AVAILABLE",
      reason: "Rule 6 · NEX does not silently select a project",
    });
    const resp = await POST(req({}));
    expect(resp.status).toBe(409);
    const j = await resp.json();
    expect(j.ok).toBe(false);
    expect(j.refused).toBe("NOT_AVAILABLE");
    expect(j.reason).toMatch(/Rule 6|silently/i);
    expect(resolveActiveProject).toHaveBeenCalledWith({ active_project_id: null });
    // Prove: never spawned
    expect(startSession).not.toHaveBeenCalled();
  });

  it("REFUSES AMBIGUOUS when resolver reports multiple candidates", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue({
      status: "AMBIGUOUS",
      candidates: [
        { record_type: "NEX_PROJECT", project_id: "a".repeat(16), project_name: "A", project_slug: "a", workspace_root: "/tmp/a", framework: "static-html", source: "scaffold", created_at_iso: "", created_by: "", zero_llm: true, ledger: "B", version: "t" },
        { record_type: "NEX_PROJECT", project_id: "b".repeat(16), project_name: "B", project_slug: "b", workspace_root: "/tmp/b", framework: "static-html", source: "scaffold", created_at_iso: "", created_by: "", zero_llm: true, ledger: "B", version: "t" },
      ],
      reason: "customer must choose",
    });
    const resp = await POST(req({ active_project_id: null, action: "start" }));
    expect(resp.status).toBe(409);
    const j = await resp.json();
    expect(j.refused).toBe("AMBIGUOUS");
    expect(j.candidates?.length).toBe(2);
    expect(startSession).not.toHaveBeenCalled();
  });

  it("REFUSES INVALID when workspace no longer exists on disk", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue({
      status: "INVALID",
      project_id: "0123456789abcdef",
      reason: "registered workspace_root no longer exists on disk",
    });
    const resp = await POST(req({ active_project_id: "0123456789abcdef", action: "start" }));
    expect(resp.status).toBe(409);
    const j = await resp.json();
    expect(j.refused).toBe("INVALID");
    expect(startSession).not.toHaveBeenCalled();
  });

  it("NEVER spawns and NEVER returns process.cwd() on any refusal path", async () => {
    const scenarios = [
      { status: "NOT_AVAILABLE" as const, reason: "none" },
      { status: "INVALID" as const, project_id: "x".repeat(16), reason: "missing" },
      { status: "AMBIGUOUS" as const, candidates: [], reason: "multi" },
    ];
    for (const s of scenarios) {
      vi.mocked(resolveActiveProject).mockReturnValue(s);
      const resp = await POST(req({ active_project_id: "any", action: "start" }));
      const j = await resp.json();
      const serialised = JSON.stringify(j);
      expect(serialised).not.toContain(process.cwd().replace(/\\/g, "\\\\"));
    }
    expect(startSession).not.toHaveBeenCalled();
  });
});

describe("project/run · Rule 6 · plan vs start", () => {
  it("action='plan' does NOT spawn · returns plan + null session when idle", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue(resolvedProject());
    vi.mocked(getSession).mockReturnValue(null);
    const resp = await POST(req({ active_project_id: "0123456789abcdef", action: "plan" }));
    expect(resp.status).toBe(200);
    const j = await resp.json();
    expect(j.ok).toBe(true);
    expect(j.action).toBe("plan");
    expect(j.session).toBeNull();
    expect(j.plan.workspace_root).toBe("/tmp/nex-workspace/test-project");
    expect(j.plan.framework).toBe("static-html");
    expect(j.plan.command).toBe("npx");
    expect(j.plan.args).toContain("serve");
    // Anti-fabrication proof: plan.workspace_root is NEVER cwd
    expect(j.plan.workspace_root).not.toBe(process.cwd());
    // Rule 6 · plan does not spawn
    expect(startSession).not.toHaveBeenCalled();
  });

  it("action defaults to 'plan' when omitted · no spawn", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue(resolvedProject());
    vi.mocked(getSession).mockReturnValue(null);
    const resp = await POST(req({ active_project_id: "0123456789abcdef" }));
    const j = await resp.json();
    expect(j.action).toBe("plan");
    expect(startSession).not.toHaveBeenCalled();
  });

  it("action='start' spawns via the orchestrator with project.workspace_root", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue(resolvedProject({ workspace_root: "/tmp/proj-abc" }));
    vi.mocked(getSession).mockReturnValue(null);
    vi.mocked(startSession).mockResolvedValue({
      session_id: "session-for-/tmp/proj-abc",
      project_root: "/tmp/proj-abc",
      command: "npx",
      args: ["serve", ".", "-l", "3100"],
      port: 3100,
      pid: 12345,
      lifecycle: "started",
      startup_marker_matched: false,
      exit_code: null,
      last_error: null,
      started_at_iso: new Date().toISOString(),
      stopped_at_iso: null,
      stdout_tail: [],
      stderr_tail: [],
    });
    const resp = await POST(req({ active_project_id: "0123456789abcdef", action: "start" }));
    expect(resp.status).toBe(200);
    const j = await resp.json();
    expect(j.ok).toBe(true);
    expect(j.action).toBe("start");
    expect(j.preview_url).toBe("http://localhost:3100");
    expect(startSession).toHaveBeenCalledTimes(1);
    const callArg = vi.mocked(startSession).mock.calls[0][0];
    // Prove: dev-server receives PROJECT workspace_root, NOT process.cwd()
    expect(callArg.project_root).toBe("/tmp/proj-abc");
    expect(callArg.project_root).not.toBe(process.cwd());
  });

  it("action='start' is idempotent when the session is already running", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue(resolvedProject({ workspace_root: "/tmp/proj-xyz" }));
    vi.mocked(getSession).mockReturnValue({
      session_id: "session-for-/tmp/proj-xyz",
      project_root: "/tmp/proj-xyz",
      command: "npx",
      args: [],
      port: 3200,
      pid: 999,
      lifecycle: "responding",
      startup_marker_matched: true,
      exit_code: null,
      last_error: null,
      started_at_iso: new Date().toISOString(),
      stopped_at_iso: null,
      stdout_tail: [],
      stderr_tail: [],
    });
    const resp = await POST(req({ active_project_id: "0123456789abcdef", action: "start" }));
    expect(resp.status).toBe(200);
    // idempotent · no second startSession call
    expect(startSession).not.toHaveBeenCalled();
    const j = await resp.json();
    expect(j.preview_url).toBe("http://localhost:3200");
  });

  it("action='stop' calls stopSession · never spawns", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue(resolvedProject({ workspace_root: "/tmp/proj-stop" }));
    vi.mocked(getSession).mockReturnValue({
      session_id: "session-for-/tmp/proj-stop",
      project_root: "/tmp/proj-stop",
      command: "npx",
      args: [],
      port: 3100,
      pid: 777,
      lifecycle: "responding",
      startup_marker_matched: true,
      exit_code: null,
      last_error: null,
      started_at_iso: new Date().toISOString(),
      stopped_at_iso: null,
      stdout_tail: [],
      stderr_tail: [],
    });
    vi.mocked(stopSession).mockResolvedValue({
      session_id: "session-for-/tmp/proj-stop",
      project_root: "/tmp/proj-stop",
      command: "npx",
      args: [],
      port: 3100,
      pid: 777,
      lifecycle: "stopped",
      startup_marker_matched: true,
      exit_code: 0,
      last_error: null,
      started_at_iso: new Date().toISOString(),
      stopped_at_iso: new Date().toISOString(),
      stdout_tail: [],
      stderr_tail: [],
    });
    const resp = await POST(req({ active_project_id: "0123456789abcdef", action: "stop" }));
    const j = await resp.json();
    expect(j.ok).toBe(true);
    expect(stopSession).toHaveBeenCalledTimes(1);
    expect(startSession).not.toHaveBeenCalled();
    expect(j.session.lifecycle).toBe("stopped");
  });

  it("action='stop' is safe when no session exists · no error", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue(resolvedProject());
    vi.mocked(getSession).mockReturnValue(null);
    const resp = await POST(req({ active_project_id: "0123456789abcdef", action: "stop" }));
    expect(resp.status).toBe(200);
    expect(stopSession).not.toHaveBeenCalled();
  });
});

describe("project/run · framework-based derived plan", () => {
  it("next-app-router framework derives `npx next dev -p <port>`", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue(resolvedProject({ framework: "next-app-router" }));
    vi.mocked(getSession).mockReturnValue(null);
    const resp = await POST(req({ active_project_id: "0123456789abcdef", action: "plan" }));
    const j = await resp.json();
    expect(j.plan.command).toBe("npx");
    expect(j.plan.args).toEqual(["next", "dev", "-p", "3100"]);
  });

  it("static-html framework derives `npx serve . -l <port>`", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue(resolvedProject({ framework: "static-html" }));
    vi.mocked(getSession).mockReturnValue(null);
    const resp = await POST(req({ active_project_id: "0123456789abcdef", action: "plan" }));
    const j = await resp.json();
    expect(j.plan.command).toBe("npx");
    expect(j.plan.args).toEqual(["serve", ".", "-l", "3100"]);
  });
});

describe("project/run · Project isolation", () => {
  it("Project A's session_id differs from Project B's · sessions cannot cross-preview", async () => {
    vi.mocked(resolveActiveProject)
      .mockReturnValueOnce(resolvedProject({ workspace_root: "/tmp/proj-A" }))
      .mockReturnValueOnce(resolvedProject({ workspace_root: "/tmp/proj-B" }));
    vi.mocked(getSession).mockReturnValue(null);
    const respA = await POST(req({ active_project_id: "0123456789abcdef", action: "plan" }));
    const respB = await POST(req({ active_project_id: "0123456789abcdef", action: "plan" }));
    const jA = await respA.json();
    const jB = await respB.json();
    expect(jA.plan.session_id).not.toBe(jB.plan.session_id);
    expect(jA.plan.workspace_root).not.toBe(jB.plan.workspace_root);
  });
});
