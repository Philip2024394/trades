// src/lib/nex/security-agent/security-agent.test.ts
//
// Stage 1 · Security Agent core tests.
// Read-only · no mutation · runs against real registries at repo root.

import { describe, it, expect } from "vitest";
import { SecurityAgent } from "./security-agent";
import type { SecurityInspectionRequest } from "./types";

const CWD = process.cwd();

function baseRequest(overrides?: Partial<SecurityInspectionRequest>): SecurityInspectionRequest {
  return {
    agentId: "test",
    targetCapabilities: ["CAP-091"],
    changeReason: "Test change touching CAP-091 (NEX HQ Work Map surface)",
    proposedFiles: [
      {
        path: "src/app/nex-head-quarters/work-map/page.tsx",
        action: "modify",
        newContentPreview: "// tiny doc-comment update\n",
      },
    ],
    proposedAction: { kind: "code_change_only" },
    ...overrides,
  };
}

describe("SecurityAgent · request validation", () => {
  it("rejects missing changeReason", async () => {
    const agent = new SecurityAgent(CWD);
    const decision = await agent.inspect(baseRequest({ changeReason: "" }));
    expect(decision.accepted).toBe(false);
  });

  it("rejects empty proposedFiles", async () => {
    const agent = new SecurityAgent(CWD);
    const decision = await agent.inspect(baseRequest({ proposedFiles: [] }));
    expect(decision.accepted).toBe(false);
  });

  it("rejects changeReason without CAP-XXX", async () => {
    const agent = new SecurityAgent(CWD);
    const decision = await agent.inspect(
      baseRequest({ changeReason: "just fixing a typo" }),
    );
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(decision.rejections.some((r) => r.code === "sec.work_map_bypassed")).toBe(true);
    }
  });
});

describe("SecurityAgent · file-registry checks", () => {
  it("rejects file outside registry", async () => {
    const agent = new SecurityAgent(CWD);
    const decision = await agent.inspect(
      baseRequest({
        proposedFiles: [
          {
            path: "some/unmapped/path/to/random.ts",
            action: "create",
            newContentPreview: "export const x = 1;\n",
          },
        ],
        targetCapabilities: [],
        changeReason: "touching an unmapped path · CAP-091 for demo",
      }),
    );
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      // Either sec.file_outside_registry or CAP-UNASSIGNED fallback rejection
      const codes = decision.rejections.map((r) => r.code);
      expect(codes).toContain("sec.file_outside_registry");
    }
  });

  it("rejects ROGUE-flagged path modification", async () => {
    const agent = new SecurityAgent(CWD);
    const decision = await agent.inspect(
      baseRequest({
        proposedFiles: [
          {
            path: "src/app/nex-anim-test/page.tsx",
            action: "modify",
            newContentPreview: "// touching a rogue path\n",
          },
        ],
        changeReason: "editing rogue path for CAP-091",
      }),
    );
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(decision.rejections.some((r) => r.code === "sec.rogue_path_modified")).toBe(true);
    }
  });
});

describe("SecurityAgent · action-scope checks", () => {
  it("rejects promote_to_authoritative", async () => {
    const agent = new SecurityAgent(CWD);
    const decision = await agent.inspect(
      baseRequest({
        proposedAction: { kind: "promote_to_authoritative", target: "nex.knowledge_records" },
      }),
    );
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(decision.rejections.some((r) => r.code === "sec.r10_bypass_attempted")).toBe(true);
    }
  });

  it("rejects apply_r10_authorisation", async () => {
    const agent = new SecurityAgent(CWD);
    const decision = await agent.inspect(
      baseRequest({
        proposedAction: { kind: "apply_r10_authorisation", policyRef: "r10.foo.v1" },
      }),
    );
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(decision.rejections.some((r) => r.code === "sec.r10_bypass_attempted")).toBe(true);
    }
  });

  it("rejects write_production", async () => {
    const agent = new SecurityAgent(CWD);
    const decision = await agent.inspect(
      baseRequest({
        proposedAction: { kind: "write_production", schema: "nex", table: "knowledge_records" },
      }),
    );
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(
        decision.rejections.some((r) => r.code === "sec.stage_1b_r10_boundary_violated"),
      ).toBe(true);
    }
  });
});

describe("SecurityAgent · doctrine checks", () => {
  it("rejects destructive git command in content", async () => {
    const agent = new SecurityAgent(CWD);
    const decision = await agent.inspect(
      baseRequest({
        proposedFiles: [
          {
            path: "scripts/nex-work-map-annotate.mjs",
            action: "modify",
            newContentPreview:
              'import { exec } from "child_process";\nexec("git push --force");\n',
          },
        ],
        changeReason: "adding automation for CAP-091",
      }),
    );
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(
        decision.rejections.some((r) => r.code === "sec.destructive_git_op_attempted"),
      ).toBe(true);
    }
  });

  it("rejects apparent OpenAI API key in content", async () => {
    const agent = new SecurityAgent(CWD);
    const decision = await agent.inspect(
      baseRequest({
        proposedFiles: [
          {
            path: "src/app/nex-head-quarters/work-map/page.tsx",
            action: "modify",
            newContentPreview:
              'const k = "sk-abcdefghijklmnopqrstuvwxyz1234567890abcdef";\n',
          },
        ],
        changeReason: "adding config for CAP-091",
      }),
    );
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(
        decision.rejections.some((r) => r.code === "sec.destructive_git_op_attempted"),
      ).toBe(true);
    }
  });

  it("rejects Stage 1a foundation modification via path", async () => {
    const agent = new SecurityAgent(CWD);
    const decision = await agent.inspect(
      baseRequest({
        proposedFiles: [
          {
            path: "src/lib/nex/truth-engine/verifier/verifier.ts",
            action: "modify",
            newContentPreview: "// modifying Stage 1a foundation\n",
          },
        ],
        changeReason: "attempting to touch Stage 1a for CAP-011",
      }),
    );
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) {
      expect(
        decision.rejections.some(
          (r) => r.code === "sec.stage_1a_foundation_modified",
        ),
      ).toBe(true);
    }
  });
});

describe("SecurityAgent · accept-path", () => {
  it("accepts a well-formed benign change", async () => {
    const agent = new SecurityAgent(CWD);
    const decision = await agent.inspect(baseRequest());
    // The base request touches a known-mapped path (CAP-091) with a
    // valid change reason + benign content. Should ACCEPT.
    if (!decision.accepted) {
      // Print rejections for debugging if it doesn't pass
      console.error("Unexpected rejections:", decision.rejections);
    }
    expect(decision.accepted).toBe(true);
    if (decision.accepted) {
      expect(decision.rejections).toEqual([]);
      expect(decision.runId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(decision.agentId).toBe("test");
    }
  });
});
