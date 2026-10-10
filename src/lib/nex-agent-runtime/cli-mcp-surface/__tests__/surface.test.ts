// §36-E-8 · WAVE-E8 · 2026-09-14 · cli-mcp-surface
// NEX bounded infrastructure · cli-mcp surface tests · 2026-09-14

import { describe, expect, it } from "vitest";
import { dispatchSurfaceRequest } from "../surface";
import type { SurfaceDispatchFailure, SurfaceDispatchSuccess } from "../surface-types";
import type { SkillCandidate } from "../../skills/skill-schema-types";
import { FIRST_SKILLS_LIBRARY } from "../../skills/library";

// ── Fixture builders ────────────────────────────────────────────────────

function baseCandidate(): SkillCandidate {
  return {
    workspace_relative_path: "src/lib/nex-agent-runtime/example.ts",
    change_kind: "file_new",
    current_sha256_hex: null,
    proposed_content: "// §36-XX · WAVE-XX · 2026-09-14 · example\nexport type XRefusalCode = 'X_A';\n",
    proposed_content_sha256_hex: null,
    declared_symbols: [],
    imported_symbols: [],
    imported_from_specifiers: [],
    authorised: true,
    test_count_declared: null,
  };
}

function sortedLibrary() {
  return [...FIRST_SKILLS_LIBRARY].sort((a, b) => a.identity.slug.localeCompare(b.identity.slug));
}

// ── §A · Basic authorisation + shape refusals ───────────────────────────

describe("§36-E-8 · E8 · §A · shape + authorisation guards", () => {
  it("A-1 · null request → E8_INVALID_REQUEST", () => {
    const r = dispatchSurfaceRequest(null as never) as SurfaceDispatchFailure;
    expect(r.kind).toBe("FAILURE");
    expect(r.refusal_code).toBe("E8_INVALID_REQUEST");
  });
  it("A-2 · missing authorisation → E8_MISSING_AUTHORISATION", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_SKILL_ROUTER",
      mission_id: "m-1",
      authorisation_ref: "" as never,
      payload: {},
    }) as SurfaceDispatchFailure;
    expect(r.refusal_code).toBe("E8_MISSING_AUTHORISATION");
  });
  it("A-3 · invalid authorisation (non-string) → E8_MISSING_AUTHORISATION", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_SKILL_ROUTER",
      mission_id: "m-1",
      authorisation_ref: 123 as never,
      payload: {},
    }) as SurfaceDispatchFailure;
    expect(r.refusal_code).toBe("E8_MISSING_AUTHORISATION");
  });
  it("A-4 · wildcard authorisation '*' → E8_AUTHORITY_ESCALATION_REJECTED", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_SKILL_ROUTER",
      mission_id: "m-1",
      authorisation_ref: "*",
      payload: {},
    }) as SurfaceDispatchFailure;
    expect(r.refusal_code).toBe("E8_AUTHORITY_ESCALATION_REJECTED");
  });
  it("A-5 · missing mission_id → E8_MISSING_MISSION_ID", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_SKILL_ROUTER",
      mission_id: "" as never,
      authorisation_ref: "founder-sig",
      payload: {},
    }) as SurfaceDispatchFailure;
    expect(r.refusal_code).toBe("E8_MISSING_MISSION_ID");
  });
  it("A-6 · unsupported operation → E8_UNSUPPORTED_OPERATION", () => {
    const r = dispatchSurfaceRequest({
      operation: "DELETE_EVERYTHING" as never,
      mission_id: "m-1",
      authorisation_ref: "founder-sig",
      payload: {},
    }) as SurfaceDispatchFailure;
    expect(r.refusal_code).toBe("E8_UNSUPPORTED_OPERATION");
  });
});

// ── §B · Path-traversal guard ───────────────────────────────────────────

describe("§36-E-8 · E8 · §B · path-traversal guard", () => {
  it("B-1 · payload with '../../etc/passwd' rejects", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_SKILL_ROUTER",
      mission_id: "m-1",
      authorisation_ref: "founder-sig",
      payload: {
        candidate: { ...baseCandidate(), workspace_relative_path: "../../etc/passwd" },
        skill_library: sortedLibrary(),
      },
    }) as SurfaceDispatchFailure;
    expect(r.refusal_code).toBe("E8_PATH_TRAVERSAL_REJECTED");
  });
  it("B-2 · absolute path '/etc/hosts' rejects", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_SKILL_ROUTER",
      mission_id: "m-1",
      authorisation_ref: "founder-sig",
      payload: {
        candidate: { ...baseCandidate(), workspace_relative_path: "/etc/hosts" },
        skill_library: sortedLibrary(),
      },
    }) as SurfaceDispatchFailure;
    expect(r.refusal_code).toBe("E8_PATH_TRAVERSAL_REJECTED");
  });
  it("B-3 · Windows-drive-letter absolute 'C:\\Windows\\...' rejects", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_SKILL_ROUTER",
      mission_id: "m-1",
      authorisation_ref: "founder-sig",
      payload: {
        candidate: { ...baseCandidate(), workspace_relative_path: "C:\\Windows\\System32" },
        skill_library: sortedLibrary(),
      },
    }) as SurfaceDispatchFailure;
    expect(r.refusal_code).toBe("E8_PATH_TRAVERSAL_REJECTED");
  });
  it("B-4 · URL-encoded traversal '%2e%2e/x' rejects", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_SKILL_ROUTER",
      mission_id: "m-1",
      authorisation_ref: "founder-sig",
      payload: {
        candidate: { ...baseCandidate(), workspace_relative_path: "%2e%2e/leak" },
        skill_library: sortedLibrary(),
      },
    }) as SurfaceDispatchFailure;
    expect(r.refusal_code).toBe("E8_PATH_TRAVERSAL_REJECTED");
  });
  it("B-5 · null byte in path rejects", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_SKILL_ROUTER",
      mission_id: "m-1",
      authorisation_ref: "founder-sig",
      payload: {
        candidate: { ...baseCandidate(), workspace_relative_path: "src/x\0.ts" },
        skill_library: sortedLibrary(),
      },
    }) as SurfaceDispatchFailure;
    expect(r.refusal_code).toBe("E8_PATH_TRAVERSAL_REJECTED");
  });
});

// ── §C · Arbitrary-command guard ────────────────────────────────────────

// The command guard is scoped by field NAME (fields ending in _command,
// _shell, _exec; or starting with shell_/exec_). Fields whose names
// indicate analysis content (proposed_content, evidence_summary, regex
// patterns in skill definitions) are NOT scanned because they legitimately
// contain the same substrings the guard looks for. These tests inject the
// suspicious substrings into command-shaped field names to confirm the
// guard fires on real injection vectors.
describe("§36-E-8 · E8 · §C · arbitrary-command guard (command-shaped fields)", () => {
  it("C-1 · shell_command field with 'exec(' rejects", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_SKILL_ROUTER",
      mission_id: "m-1",
      authorisation_ref: "founder-sig",
      payload: {
        candidate: baseCandidate(),
        skill_library: sortedLibrary(),
        shell_command: "exec('/bin/sh')",
      },
    }) as SurfaceDispatchFailure;
    expect(r.refusal_code).toBe("E8_ARBITRARY_COMMAND_REJECTED");
  });
  it("C-2 · shell_exec field with 'eval(' rejects", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_SKILL_ROUTER",
      mission_id: "m-1",
      authorisation_ref: "founder-sig",
      payload: {
        candidate: baseCandidate(),
        skill_library: sortedLibrary(),
        shell_exec: "eval('malicious')",
      },
    }) as SurfaceDispatchFailure;
    expect(r.refusal_code).toBe("E8_ARBITRARY_COMMAND_REJECTED");
  });
  it("C-3 · exec_command field with 'child_process' rejects", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_SKILL_ROUTER",
      mission_id: "m-1",
      authorisation_ref: "founder-sig",
      payload: {
        candidate: baseCandidate(),
        skill_library: sortedLibrary(),
        exec_command: "child_process",
      },
    }) as SurfaceDispatchFailure;
    expect(r.refusal_code).toBe("E8_ARBITRARY_COMMAND_REJECTED");
  });
  it("C-4 · run_command field with 'spawn(' rejects", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_SKILL_ROUTER",
      mission_id: "m-1",
      authorisation_ref: "founder-sig",
      payload: {
        candidate: baseCandidate(),
        skill_library: sortedLibrary(),
        run_command: "spawn('/bin/bash', [])",
      },
    }) as SurfaceDispatchFailure;
    expect(r.refusal_code).toBe("E8_ARBITRARY_COMMAND_REJECTED");
  });
  it("C-5 · sh_shell field with 'new Function(' rejects", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_SKILL_ROUTER",
      mission_id: "m-1",
      authorisation_ref: "founder-sig",
      payload: {
        candidate: baseCandidate(),
        skill_library: sortedLibrary(),
        sh_shell: "new Function('return 1')",
      },
    }) as SurfaceDispatchFailure;
    expect(r.refusal_code).toBe("E8_ARBITRARY_COMMAND_REJECTED");
  });
  it("C-6 · analysis content in proposed_content is NOT scanned by command guard (design intent)", () => {
    // eval( in code being ANALYSED is fine — the surface never executes proposed_content.
    // This test documents the intentional boundary.
    const r = dispatchSurfaceRequest({
      operation: "RUN_SPECIALIST_REVIEWERS",
      mission_id: "m-1",
      authorisation_ref: "founder-sig",
      payload: {
        candidate: { ...baseCandidate(), proposed_content: "eval('this is code being reviewed, not executed')" },
        specialists_to_run: "all",
      },
    });
    expect(r.kind).toBe("SUCCESS");
  });
});

// ── §D · Authority-escalation guard ─────────────────────────────────────

describe("§36-E-8 · E8 · §D · authority-escalation guard", () => {
  it("D-1 · payload with grant_all field rejects", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_SKILL_ROUTER",
      mission_id: "m-1",
      authorisation_ref: "founder-sig",
      payload: { grant_all: true, candidate: baseCandidate(), skill_library: sortedLibrary() },
    }) as SurfaceDispatchFailure;
    expect(r.refusal_code).toBe("E8_AUTHORITY_ESCALATION_REJECTED");
    expect(r.offending_field).toBe("payload.grant_all");
  });
  it("D-2 · payload with superuser field rejects", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_SKILL_ROUTER",
      mission_id: "m-1",
      authorisation_ref: "founder-sig",
      payload: { superuser: true, candidate: baseCandidate(), skill_library: sortedLibrary() },
    }) as SurfaceDispatchFailure;
    expect(r.refusal_code).toBe("E8_AUTHORITY_ESCALATION_REJECTED");
  });
  it("D-3 · nested *_authorisation rejects", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_SKILL_ROUTER",
      mission_id: "m-1",
      authorisation_ref: "founder-sig",
      payload: {
        candidate: baseCandidate(),
        skill_library: sortedLibrary(),
        extra: { additional_authorisation: "bogus" },
      },
    }) as SurfaceDispatchFailure;
    expect(r.refusal_code).toBe("E8_AUTHORITY_ESCALATION_REJECTED");
  });
  it("D-4 · nested bypass_auth field rejects", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_SPECIALIST_REVIEWERS",
      mission_id: "m-1",
      authorisation_ref: "founder-sig",
      payload: {
        candidate: baseCandidate(),
        specialists_to_run: "all",
        nested: { bypass_auth: 1 },
      },
    }) as SurfaceDispatchFailure;
    expect(r.refusal_code).toBe("E8_AUTHORITY_ESCALATION_REJECTED");
  });
});

// ── §E · Legitimate dispatch (positive path) ────────────────────────────

describe("§36-E-8 · E8 · §E · legitimate dispatch succeeds", () => {
  it("E-1 · well-formed RUN_SKILL_ROUTER request dispatches", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_SKILL_ROUTER",
      mission_id: "m-1",
      authorisation_ref: "founder-sig",
      payload: { candidate: baseCandidate(), skill_library: sortedLibrary() },
    }) as SurfaceDispatchSuccess;
    expect(r.kind).toBe("SUCCESS");
    expect(r.operation).toBe("RUN_SKILL_ROUTER");
    expect(r.mission_id).toBe("m-1");
    expect(r.result).toBeDefined();
  });
  it("E-2 · well-formed RUN_SPECIALIST_REVIEWERS dispatches", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_SPECIALIST_REVIEWERS",
      mission_id: "m-1",
      authorisation_ref: "founder-sig",
      payload: { candidate: baseCandidate(), specialists_to_run: "all" },
    }) as SurfaceDispatchSuccess;
    expect(r.kind).toBe("SUCCESS");
    expect(r.operation).toBe("RUN_SPECIALIST_REVIEWERS");
  });
  it("E-3 · well-formed RUN_ADVERSARIAL_REFUTATION dispatches", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_ADVERSARIAL_REFUTATION",
      mission_id: "m-1",
      authorisation_ref: "founder-sig",
      payload: { candidate: baseCandidate(), findings: [] },
    }) as SurfaceDispatchSuccess;
    expect(r.kind).toBe("SUCCESS");
  });
});

// ── §F · Malformed payload ──────────────────────────────────────────────

describe("§36-E-8 · E8 · §F · malformed payload", () => {
  it("F-1 · non-object payload → E8_MALFORMED_PAYLOAD", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_SKILL_ROUTER",
      mission_id: "m-1",
      authorisation_ref: "founder-sig",
      payload: 42 as never,
    }) as SurfaceDispatchFailure;
    expect(r.refusal_code).toBe("E8_MALFORMED_PAYLOAD");
  });
});

// ── §G · Grep marker ───────────────────────────────────────────────────

describe("§36-E-8 · E8 · §G · grep marker", () => {
  it("G-1 · success carries §36-E-8 marker", () => {
    const r = dispatchSurfaceRequest({
      operation: "RUN_SKILL_ROUTER",
      mission_id: "m-1",
      authorisation_ref: "founder-sig",
      payload: { candidate: baseCandidate(), skill_library: sortedLibrary() },
    });
    expect(r.grep_marker).toBe("§36-E-8 · WAVE-E8 · 2026-09-14 · cli-mcp-surface");
  });
  it("G-2 · failure carries §36-E-8 marker", () => {
    const r = dispatchSurfaceRequest(null as never);
    expect(r.grep_marker).toBe("§36-E-8 · WAVE-E8 · 2026-09-14 · cli-mcp-surface");
  });
});
