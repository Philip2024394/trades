// Permissions unit tests · verifies role-based write allow / deny across every
// agent and against every protected path. Adversarial cases included.

import { describe, it, expect } from "vitest";
import { canWrite, UNIVERSAL_DENY, HISTORICAL_RECEIPTS_PREFIX } from "../permissions";
import type { AgentId } from "../types";
import { ALL_AGENT_IDS } from "../types";

describe("permissions · UNIVERSAL_DENY", () => {
  it("blocks every agent from writing .env", () => {
    for (const agent of ALL_AGENT_IDS) {
      const r = canWrite(agent, ".env");
      expect(r.allowed).toBe(false);
      expect(r.reason).toMatch(/universal deny/);
    }
  });

  it("blocks every agent from writing CLAUDE.md", () => {
    for (const agent of ALL_AGENT_IDS) {
      const r = canWrite(agent, "CLAUDE.md");
      expect(r.allowed).toBe(false);
    }
  });

  it("blocks every agent from anything under src/lib/nex-v3/", () => {
    for (const agent of ALL_AGENT_IDS) {
      const r = canWrite(agent, "src/lib/nex-v3/v3-engine-registry.ts");
      expect(r.allowed).toBe(false);
    }
  });

  it("blocks writes to the frozen M-1 migration", () => {
    const r = canWrite("integrator", "supabase/migrations/20260915180000_nex_visual_structural_lock_architecture.sql");
    expect(r.allowed).toBe(false);
  });

  it("all listed UNIVERSAL_DENY entries actually match", () => {
    for (const p of UNIVERSAL_DENY) {
      const r = canWrite("builder", p);
      expect(r.allowed).toBe(false);
    }
  });
});

describe("permissions · historical receipts", () => {
  it("blocks every agent from writing under nex-visual-proving", () => {
    for (const agent of ALL_AGENT_IDS) {
      const r = canWrite(agent, `${HISTORICAL_RECEIPTS_PREFIX}some/receipt.json`);
      expect(r.allowed).toBe(false);
      expect(r.reason).toMatch(/historical receipt/);
    }
  });
});

describe("permissions · agent scoping", () => {
  it("PM may write to runs/ but not to src/", () => {
    expect(canWrite("pm", "data/nex-coding-team/runs/run-x/ticket.md").allowed).toBe(true);
    expect(canWrite("pm", "src/lib/foo/bar.ts").allowed).toBe(false);
  });

  it("Builder may write to src/ but MUST NOT touch tests", () => {
    expect(canWrite("builder", "src/lib/foo/index.ts").allowed).toBe(true);
    expect(canWrite("builder", "src/lib/foo/__tests__/index.test.ts").allowed).toBe(false);
    expect(canWrite("builder", "src/lib/foo/bar.test.ts").allowed).toBe(false);
    expect(canWrite("builder", "tests/anything.spec.ts").allowed).toBe(false);
  });

  it("Tester may write to __tests__/ and tests/ but MUST NOT touch app code", () => {
    expect(canWrite("tester", "src/lib/foo/__tests__/index.test.ts").allowed).toBe(true);
    expect(canWrite("tester", "tests/e2e/thing.test.ts").allowed).toBe(true);
    expect(canWrite("tester", "src/lib/foo/index.ts").allowed).toBe(false);
    expect(canWrite("tester", "src/app/page.tsx").allowed).toBe(false);
  });

  it("Reviewer only writes review.md under runs/", () => {
    expect(canWrite("reviewer", "data/nex-coding-team/runs/run-x/review.md").allowed).toBe(true);
    expect(canWrite("reviewer", "src/lib/foo/index.ts").allowed).toBe(false);
  });

  it("Integrator never modifies source directly", () => {
    expect(canWrite("integrator", "data/nex-coding-team/runs/run-x/integration.md").allowed).toBe(true);
    expect(canWrite("integrator", "src/lib/foo/index.ts").allowed).toBe(false);
    expect(canWrite("integrator", "scripts/anything.mjs").allowed).toBe(false);
  });

  it("Technical Writer writes docs and READMEs but not application source", () => {
    expect(canWrite("technical-writer", "docs/features/index.md").allowed).toBe(true);
    expect(canWrite("technical-writer", "src/lib/foo/index.ts").allowed).toBe(false);
  });
});

describe("permissions · adversarial", () => {
  it("rejects Windows path separators masquerading as different paths", () => {
    // Windows path input should be normalised before matching.
    const r = canWrite("builder", "src\\lib\\nex-v3\\v3-engine-registry.ts");
    expect(r.allowed).toBe(false);
  });

  it("rejects absolute paths that escape the repo", () => {
    const r = canWrite("builder", "/etc/passwd");
    // Any absolute path resolves under the repo relative computation to '..' —
    // Builder allowlist does not include that.
    expect(r.allowed).toBe(false);
  });

  it("blocks unknown protected-file variants", () => {
    // Backup file explicitly listed
    const r = canWrite("integrator", ".env.local.backup-pre-cutover-2026-09-10");
    expect(r.allowed).toBe(false);
  });

  it("every agent has a permission profile", () => {
    for (const agent of ALL_AGENT_IDS) {
      // Should not throw when checked.
      expect(() => canWrite(agent as AgentId, "data/nex-coding-team/runs/whatever.md")).not.toThrow();
    }
  });
});
