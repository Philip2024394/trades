// src/lib/nex/preview/preview.test.ts
//
// Stage 5 tests · resolver + flag evaluator (pure functions · no DB).

import { describe, it, expect } from "vitest";
import {
  validatePreviewParams,
  resolvePreviewFromRevision,
  composePreviewUrl,
  evaluateFlags,
  InMemoryFlagStore,
  makeFlag,
  PREVIEW_ELIGIBLE_STATES,
  type EmergencyFlag,
} from "./index";
import type { SectionRevision, LifecycleState } from "../section-build";

const mockRevision = (overrides: Partial<SectionRevision> = {}): SectionRevision => ({
  revision_id: "rev-1",
  capability_id: "CAP-091",
  version: "v1.0.0",
  parent_revision_id: null,
  artifact_id: "art-1",
  change_request_id: null,
  lifecycle_state: "IN_REVIEW",
  created_at: new Date().toISOString(),
  created_by_agent_id: "nex1",
  founder_approval_at: null,
  founder_signature: null,
  live_at: null,
  reverted_at: null,
  ...overrides,
});

describe("validatePreviewParams", () => {
  it("accepts CAP-091 v1.0.0", () => {
    const r = validatePreviewParams({ capability: "CAP-091", revision: "v1.0.0" });
    expect(r.ok).toBe(true);
  });

  it("rejects lowercase cap", () => {
    const r = validatePreviewParams({ capability: "cap-091", revision: "v1.0.0" });
    expect(r.ok).toBe(false);
  });

  it("rejects missing v-prefix", () => {
    const r = validatePreviewParams({ capability: "CAP-091", revision: "1.0.0" });
    expect(r.ok).toBe(false);
  });

  it("rejects two-part version", () => {
    const r = validatePreviewParams({ capability: "CAP-091", revision: "v1.0" });
    expect(r.ok).toBe(false);
  });
});

describe("resolvePreviewFromRevision", () => {
  it("resolves an IN_REVIEW revision", () => {
    const r = resolvePreviewFromRevision(
      mockRevision({ lifecycle_state: "IN_REVIEW" }),
      { capability: "CAP-091", revision: "v1.0.0" },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state).toBe("IN_REVIEW");
    }
  });

  it("rejects an ACTIVE revision at /preview/*", () => {
    const r = resolvePreviewFromRevision(
      mockRevision({ lifecycle_state: "ACTIVE" }),
      { capability: "CAP-091", revision: "v1.0.0" },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain("not preview-eligible");
    }
  });

  it("rejects capability/URL mismatch", () => {
    const r = resolvePreviewFromRevision(
      mockRevision({ capability_id: "CAP-092" }),
      { capability: "CAP-091", revision: "v1.0.0" },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain("Capability mismatch");
    }
  });

  it("rejects version/URL mismatch", () => {
    const r = resolvePreviewFromRevision(
      mockRevision({ version: "v1.0.1" }),
      { capability: "CAP-091", revision: "v1.0.0" },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain("Version mismatch");
    }
  });

  it("rejects null revision", () => {
    const r = resolvePreviewFromRevision(null, { capability: "CAP-091", revision: "v1.0.0" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain("not found");
    }
  });

  it("accepts AWAITING_PREVIEW · IN_REVIEW · APPROVED · ACTIVATING · REQUEST_UPDATE", () => {
    for (const s of PREVIEW_ELIGIBLE_STATES) {
      const r = resolvePreviewFromRevision(
        mockRevision({ lifecycle_state: s }),
        { capability: "CAP-091", revision: "v1.0.0" },
      );
      expect(r.ok).toBe(true);
    }
  });

  it("rejects REJECTED · REVERTED · DISABLED · BUILDING · TESTING", () => {
    const nonPreview: LifecycleState[] = ["REJECTED", "REVERTED", "DISABLED", "BUILDING", "TESTING", "ACTIVE"];
    for (const s of nonPreview) {
      const r = resolvePreviewFromRevision(
        mockRevision({ lifecycle_state: s }),
        { capability: "CAP-091", revision: "v1.0.0" },
      );
      expect(r.ok).toBe(false);
    }
  });
});

describe("composePreviewUrl", () => {
  it("composes valid URL", () => {
    expect(composePreviewUrl("CAP-091", "v1.0.0")).toBe("/preview/CAP-091/v1.0.0");
  });

  it("returns null for invalid inputs", () => {
    expect(composePreviewUrl("cap-91", "v1.0.0")).toBeNull();
    expect(composePreviewUrl("CAP-091", "1.0.0")).toBeNull();
  });
});

describe("makeFlag", () => {
  it("builds a well-formed flag with all fields", () => {
    const f = makeFlag({
      scope: { kind: "capability", capabilityId: "CAP-091" },
      reason: "regression detected",
      signedBy: "founder-sig-abc",
    });
    expect(f.reason).toBe("regression detected");
    expect(f.signedBy).toBe("founder-sig-abc");
    expect(typeof f.signedAt).toBe("string");
    expect(f.scope.kind).toBe("capability");
  });

  it("throws when signedBy is empty (defence-in-depth)", () => {
    expect(() =>
      makeFlag({
        scope: { kind: "global" },
        reason: "x",
        signedBy: "",
      }),
    ).toThrow(/signedBy/);
  });

  it("throws when reason is empty (audit trail)", () => {
    expect(() =>
      makeFlag({
        scope: { kind: "global" },
        reason: "",
        signedBy: "founder-sig-abc",
      }),
    ).toThrow(/reason/);
  });
});

describe("evaluateFlags", () => {
  const capFlag: EmergencyFlag = makeFlag({
    scope: { kind: "capability", capabilityId: "CAP-091" },
    reason: "CAP-091 disabled",
    signedBy: "founder-sig",
  });
  const revFlag: EmergencyFlag = makeFlag({
    scope: { kind: "revision", revisionId: "rev-123" },
    reason: "rev-123 disabled",
    signedBy: "founder-sig",
  });
  const globalFlag: EmergencyFlag = makeFlag({
    scope: { kind: "global" },
    reason: "system freeze",
    signedBy: "founder-sig",
  });

  it("blocks capability-scoped flag on match", () => {
    const r = evaluateFlags([capFlag], { capabilityId: "CAP-091", revisionId: "rev-abc" });
    expect(r.blocked).toBe(true);
    expect(r.reason).toBe("CAP-091 disabled");
  });

  it("does not block capability-scoped flag on non-match", () => {
    const r = evaluateFlags([capFlag], { capabilityId: "CAP-092", revisionId: "rev-abc" });
    expect(r.blocked).toBe(false);
  });

  it("blocks revision-scoped flag on match", () => {
    const r = evaluateFlags([revFlag], { capabilityId: "CAP-091", revisionId: "rev-123" });
    expect(r.blocked).toBe(true);
  });

  it("global flag blocks everything", () => {
    const r = evaluateFlags([globalFlag], { capabilityId: "CAP-999", revisionId: null });
    expect(r.blocked).toBe(true);
    expect(r.reason).toBe("system freeze");
  });

  it("no flags → not blocked", () => {
    const r = evaluateFlags([], { capabilityId: "CAP-091", revisionId: "rev-1" });
    expect(r.blocked).toBe(false);
    expect(r.matchedFlag).toBeNull();
  });

  it("multiple flags · first match wins", () => {
    const r = evaluateFlags([revFlag, capFlag], { capabilityId: "CAP-091", revisionId: "rev-123" });
    expect(r.blocked).toBe(true);
    expect(r.matchedFlag).toBe(revFlag);
  });
});

describe("InMemoryFlagStore", () => {
  it("add + list", () => {
    const store = new InMemoryFlagStore();
    const f = makeFlag({ scope: { kind: "global" }, reason: "x", signedBy: "s" });
    store.add(f);
    expect(store.list().length).toBe(1);
  });

  it("remove by matcher", () => {
    const store = new InMemoryFlagStore();
    const f1 = makeFlag({ scope: { kind: "capability", capabilityId: "CAP-091" }, reason: "a", signedBy: "s" });
    const f2 = makeFlag({ scope: { kind: "capability", capabilityId: "CAP-092" }, reason: "b", signedBy: "s" });
    store.add(f1);
    store.add(f2);
    const removed = store.remove((x) => x.scope.kind === "capability" && x.scope.capabilityId === "CAP-091");
    expect(removed).toBe(1);
    expect(store.list().length).toBe(1);
  });

  it("clear removes all", () => {
    const store = new InMemoryFlagStore();
    store.add(makeFlag({ scope: { kind: "global" }, reason: "x", signedBy: "s" }));
    store.add(makeFlag({ scope: { kind: "global" }, reason: "y", signedBy: "s" }));
    store.clear();
    expect(store.list().length).toBe(0);
  });
});
