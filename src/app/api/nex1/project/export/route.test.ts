// src/app/api/nex1/project/export/route.test.ts
//
// Prove: Export is bound to the canonical Project registry.
// Prove: Rule 6 · resolving does not archive · action="archive" is explicit.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/nex-agent/code-engine/capability-nex-project-registry", () => ({
  resolveActiveProject: vi.fn(),
}));
vi.mock("@/lib/nex-agent/code-engine/capability-project-archive", () => ({
  archiveProject: vi.fn(),
}));

import { POST } from "./route";
import { resolveActiveProject } from "@/lib/nex-agent/code-engine/capability-nex-project-registry";
import { archiveProject } from "@/lib/nex-agent/code-engine/capability-project-archive";

function req(body: unknown): Request {
  return new Request("http://localhost/api/nex1/project/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function resolvedProject(overrides: {
  workspace_root?: string; project_id?: string;
} = {}) {
  return {
    status: "RESOLVED" as const,
    project: {
      record_type: "NEX_PROJECT" as const,
      project_id: overrides.project_id ?? "0123456789abcdef",
      project_name: "Test Project",
      project_slug: "test-project",
      workspace_root: overrides.workspace_root ?? "/tmp/nex-workspace/test-project",
      framework: "static-html" as const,
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

describe("project/export · refusal · never archives on non-RESOLVED", () => {
  it("REFUSES NOT_AVAILABLE + never invokes archiver", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue({
      status: "NOT_AVAILABLE",
      reason: "Rule 6 · no silent selection",
    });
    const resp = await POST(req({ action: "archive" }));
    expect(resp.status).toBe(409);
    const j = await resp.json();
    expect(j.ok).toBe(false);
    expect(j.refused).toBe("NOT_AVAILABLE");
    expect(archiveProject).not.toHaveBeenCalled();
  });

  it("REFUSES AMBIGUOUS + never invokes archiver", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue({
      status: "AMBIGUOUS",
      candidates: [
        { record_type: "NEX_PROJECT", project_id: "a".repeat(16), project_name: "A", project_slug: "a", workspace_root: "/tmp/a", framework: "static-html", source: "scaffold", created_at_iso: "", created_by: "", zero_llm: true, ledger: "B", version: "t" },
        { record_type: "NEX_PROJECT", project_id: "b".repeat(16), project_name: "B", project_slug: "b", workspace_root: "/tmp/b", framework: "static-html", source: "scaffold", created_at_iso: "", created_by: "", zero_llm: true, ledger: "B", version: "t" },
      ],
      reason: "customer must choose",
    });
    const resp = await POST(req({ active_project_id: null, action: "archive" }));
    expect(resp.status).toBe(409);
    const j = await resp.json();
    expect(j.refused).toBe("AMBIGUOUS");
    expect(j.candidates?.length).toBe(2);
    expect(archiveProject).not.toHaveBeenCalled();
  });

  it("REFUSES INVALID + never invokes archiver", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue({
      status: "INVALID",
      project_id: "0123456789abcdef",
      reason: "workspace missing",
    });
    const resp = await POST(req({ active_project_id: "0123456789abcdef", action: "archive" }));
    expect(resp.status).toBe(409);
    const j = await resp.json();
    expect(j.refused).toBe("INVALID");
    expect(archiveProject).not.toHaveBeenCalled();
  });

  it("NEVER returns process.cwd() on any refusal path", async () => {
    const scenarios = [
      { status: "NOT_AVAILABLE" as const, reason: "none" },
      { status: "INVALID" as const, project_id: "x".repeat(16), reason: "missing" },
      { status: "AMBIGUOUS" as const, candidates: [], reason: "multi" },
    ];
    for (const s of scenarios) {
      vi.mocked(resolveActiveProject).mockReturnValue(s);
      const resp = await POST(req({ active_project_id: "x", action: "archive" }));
      const j = await resp.json();
      expect(JSON.stringify(j)).not.toContain(process.cwd().replace(/\\/g, "\\\\"));
    }
  });
});

describe("project/export · Rule 6 · plan vs archive", () => {
  it("action='plan' invokes archiver with dry_run=true", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue(resolvedProject({ workspace_root: "/tmp/proj-plan" }));
    vi.mocked(archiveProject).mockResolvedValue({
      ok: true,
      manifest: {
        record_type: "NEX_PROJECT_ARCHIVE",
        project_id: "0123456789abcdef",
        project_slug: "test-project",
        archive_id: "aaaa1111bbbb2222",
        workspace_root: "/tmp/proj-plan",
        archive_path: null,
        archive_sha256: null,
        archive_bytes: null,
        files_included: 5,
        files_excluded: 2,
        total_source_bytes: 1024,
        exclusions_applied: ["dir:node_modules"],
        file_list_hash: "aabbccdd" + "0".repeat(24),
        dry_run: true,
        created_at_iso: new Date().toISOString(),
        created_by: "founder",
        zero_llm: true,
        ledger: "B",
        version: "test",
      },
    });
    const resp = await POST(req({ active_project_id: "0123456789abcdef", action: "plan" }));
    expect(resp.status).toBe(200);
    const j = await resp.json();
    expect(j.ok).toBe(true);
    expect(j.action).toBe("plan");
    expect(j.manifest.dry_run).toBe(true);
    expect(j.manifest.archive_path).toBeNull();
    const callArg = vi.mocked(archiveProject).mock.calls[0][0];
    expect(callArg.dry_run).toBe(true);
    expect(callArg.workspace_root).toBe("/tmp/proj-plan");
    // Anti-fabrication proof: archiver received PROJECT workspace, not cwd
    expect(callArg.workspace_root).not.toBe(process.cwd());
  });

  it("action defaults to 'plan' · omission is inspection-only", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue(resolvedProject());
    vi.mocked(archiveProject).mockResolvedValue({
      ok: true,
      manifest: {
        record_type: "NEX_PROJECT_ARCHIVE",
        project_id: "0123456789abcdef",
        project_slug: "test-project",
        archive_id: "aaaa1111bbbb2222",
        workspace_root: "/tmp",
        archive_path: null,
        archive_sha256: null,
        archive_bytes: null,
        files_included: 0,
        files_excluded: 0,
        total_source_bytes: 0,
        exclusions_applied: [],
        file_list_hash: "0".repeat(32),
        dry_run: true,
        created_at_iso: new Date().toISOString(),
        created_by: "founder",
        zero_llm: true,
        ledger: "B",
        version: "test",
      },
    });
    const resp = await POST(req({ active_project_id: "0123456789abcdef" }));
    const j = await resp.json();
    expect(j.action).toBe("plan");
    const callArg = vi.mocked(archiveProject).mock.calls[0][0];
    expect(callArg.dry_run).toBe(true);
  });

  it("action='archive' invokes archiver with dry_run=false · real archive path returned", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue(resolvedProject({ workspace_root: "/tmp/proj-real" }));
    vi.mocked(archiveProject).mockResolvedValue({
      ok: true,
      manifest: {
        record_type: "NEX_PROJECT_ARCHIVE",
        project_id: "0123456789abcdef",
        project_slug: "test-project",
        archive_id: "ffff2222aaaa3333",
        workspace_root: "/tmp/proj-real",
        archive_path: "/tmp/archives/test-project-ffff2222aaaa3333.zip",
        archive_sha256: "a".repeat(64),
        archive_bytes: 4096,
        files_included: 5,
        files_excluded: 2,
        total_source_bytes: 1024,
        exclusions_applied: ["dir:node_modules"],
        file_list_hash: "eeeeffff" + "0".repeat(24),
        dry_run: false,
        created_at_iso: new Date().toISOString(),
        created_by: "founder",
        zero_llm: true,
        ledger: "B",
        version: "test",
      },
    });
    const resp = await POST(req({ active_project_id: "0123456789abcdef", action: "archive" }));
    expect(resp.status).toBe(200);
    const j = await resp.json();
    expect(j.ok).toBe(true);
    expect(j.action).toBe("archive");
    expect(j.manifest.archive_path).toContain(".zip");
    expect(j.manifest.archive_bytes).toBeGreaterThan(0);
    expect(j.manifest.archive_sha256).toMatch(/^[a-f0-9]{64}$/);
    const callArg = vi.mocked(archiveProject).mock.calls[0][0];
    expect(callArg.dry_run).toBe(false);
    expect(callArg.workspace_root).toBe("/tmp/proj-real");
    expect(callArg.workspace_root).not.toBe(process.cwd());
  });

  it("archive failure from underlying capability is surfaced honestly (never fabricated success)", async () => {
    vi.mocked(resolveActiveProject).mockReturnValue(resolvedProject());
    vi.mocked(archiveProject).mockResolvedValue({
      ok: false,
      reason_code: "WORKSPACE_DOES_NOT_EXIST",
      reason: "workspace vanished after resolution",
    });
    const resp = await POST(req({ active_project_id: "0123456789abcdef", action: "archive" }));
    expect(resp.status).toBe(500);
    const j = await resp.json();
    expect(j.ok).toBe(false);
    expect(j.refused).toBe("ARCHIVE_FAILED");
    expect(j.reason_code).toBe("WORKSPACE_DOES_NOT_EXIST");
  });
});

describe("project/export · Project isolation", () => {
  it("Project A archive request and Project B archive request use different workspace_root", async () => {
    vi.mocked(resolveActiveProject)
      .mockReturnValueOnce(resolvedProject({ workspace_root: "/tmp/proj-A", project_id: "aaaa1111aaaa1111" }))
      .mockReturnValueOnce(resolvedProject({ workspace_root: "/tmp/proj-B", project_id: "bbbb2222bbbb2222" }));
    vi.mocked(archiveProject).mockImplementation(async (i) => ({
      ok: true,
      manifest: {
        record_type: "NEX_PROJECT_ARCHIVE",
        project_id: i.project_id,
        project_slug: i.project_slug,
        archive_id: "id-" + i.project_id.slice(0, 4),
        workspace_root: i.workspace_root,
        archive_path: null,
        archive_sha256: null,
        archive_bytes: null,
        files_included: 1,
        files_excluded: 0,
        total_source_bytes: 10,
        exclusions_applied: [],
        file_list_hash: "h",
        dry_run: true,
        created_at_iso: new Date().toISOString(),
        created_by: "f",
        zero_llm: true,
        ledger: "B",
        version: "t",
      },
    }));
    const respA = await POST(req({ active_project_id: "aaaa1111aaaa1111", action: "plan" }));
    const respB = await POST(req({ active_project_id: "bbbb2222bbbb2222", action: "plan" }));
    const jA = await respA.json();
    const jB = await respB.json();
    expect(jA.manifest.workspace_root).toBe("/tmp/proj-A");
    expect(jB.manifest.workspace_root).toBe("/tmp/proj-B");
    expect(jA.manifest.workspace_root).not.toBe(jB.manifest.workspace_root);
  });
});
