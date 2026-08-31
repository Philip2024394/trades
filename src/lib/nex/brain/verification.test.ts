// Stage 3.22 · Phase 15 · Verification unit tests.

import { describe, it, expect } from "vitest";
import { verifyAction } from "./verification";
import type { ActionProposal, ActionExecution } from "./action";
import type { SessionState } from "./session";

function target(name: string, refId: string) {
  return { canonical: name.toLowerCase(), raw: name, refId };
}

function proposalOpenDir(name = "Hotel Trim Tiga", refId = "place:accommodation:osm:node_1359116507"): ActionProposal {
  return {
    kind: "open_directory",
    target: target(name, refId),
    availability: "available",
    reason: "generatable",
    linkPreview: `/nex-app/centre?ref=${encodeURIComponent(refId)}`,
    consentRequired: false,
  };
}

function executionSuccess(proposal: ActionProposal): ActionExecution {
  return {
    executed: true,
    kind: proposal.kind,
    target: proposal.target,
    result: { url: proposal.linkPreview, message: `Directory link for ${proposal.target.raw}` },
  };
}

function sessionWithRef(name: string, refId: string): SessionState {
  return {
    conversationId: "test",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    currentReference: {
      resolved: true,
      refKind: "ordinal",
      offset: 2,
      business: { canonical: name.toLowerCase(), raw: name, refId },
    },
  };
}

describe("verifyAction · applicable=false paths", () => {
  it("no proposal → applicable=false · no_proposal", () => {
    const r = verifyAction({});
    expect(r.applicable).toBe(false);
    if (!r.applicable) expect(r.reason).toBe("no_proposal");
  });

  it("proposal but no execution → applicable=false · nothing_executed", () => {
    const r = verifyAction({ proposal: proposalOpenDir() });
    expect(r.applicable).toBe(false);
    if (!r.applicable) expect(r.reason).toBe("nothing_executed");
  });

  it("execution refused (executed=false) → applicable=false · execution_refused", () => {
    const p = proposalOpenDir();
    const e: ActionExecution = { executed: false, kind: "open_directory", reason: "no_consent", message: "gate" };
    const r = verifyAction({ proposal: p, execution: e });
    expect(r.applicable).toBe(false);
    if (!r.applicable) expect(r.reason).toBe("execution_refused");
  });
});

describe("verifyAction · full success path", () => {
  it("all 4 checks pass when target consistent + link round-trips + kind matches + capability registered", () => {
    const p = proposalOpenDir();
    const e = executionSuccess(p);
    const s = sessionWithRef("Hotel Trim Tiga", "place:accommodation:osm:node_1359116507");
    const r = verifyAction({ proposal: p, execution: e, session: s });
    expect(r.applicable).toBe(true);
    if (r.applicable) {
      expect(r.passed).toBe(true);
      expect(r.passedCount).toBe(4);
      expect(r.totalChecks).toBe(4);
      expect(r.summary).toContain("verified");
    }
  });
});

describe("verifyAction · individual check failures", () => {
  it("target_consistency FAILS when action target doesn't match session reference", () => {
    const p = proposalOpenDir("Hotel Trim Tiga", "id1");
    const e = executionSuccess(p);
    const s = sessionWithRef("Different Hotel", "id2");
    const r = verifyAction({ proposal: p, execution: e, session: s });
    expect(r.applicable).toBe(true);
    if (r.applicable) {
      expect(r.passed).toBe(false);
      const tc = r.findings.find((f) => f.check === "target_consistency")!;
      expect(tc.passed).toBe(false);
      expect(tc.reason).toContain("does NOT match");
    }
  });

  it("target_consistency passes when no session reference (not applicable)", () => {
    const p = proposalOpenDir();
    const e = executionSuccess(p);
    const r = verifyAction({ proposal: p, execution: e, session: null });
    expect(r.applicable).toBe(true);
    if (r.applicable) {
      const tc = r.findings.find((f) => f.check === "target_consistency")!;
      expect(tc.passed).toBe(true);
      expect(tc.reason).toContain("not applicable");
    }
  });

  it("link_round_trip FAILS when URL doesn't encode the refId", () => {
    const p = proposalOpenDir("H", "correct-id");
    const e: ActionExecution = {
      executed: true, kind: "open_directory", target: target("H", "correct-id"),
      result: { url: "/nex-app/centre?ref=WRONG-ID", message: "" },
    };
    const r = verifyAction({ proposal: p, execution: e });
    expect(r.applicable).toBe(true);
    if (r.applicable) {
      expect(r.passed).toBe(false);
      const lt = r.findings.find((f) => f.check === "link_round_trip")!;
      expect(lt.passed).toBe(false);
    }
  });

  it("link_round_trip check not applicable for non-open_directory kinds · passes with reason", () => {
    const p: ActionProposal = { kind: "contact_via_whatsapp", target: target("H", "id"), availability: "declared_not_wired", reason: "no phone", consentRequired: false };
    const e: ActionExecution = { executed: true, kind: "contact_via_whatsapp", target: p.target, result: { message: "n/a" } };
    const r = verifyAction({ proposal: p, execution: e });
    expect(r.applicable).toBe(true);
    if (r.applicable) {
      const lt = r.findings.find((f) => f.check === "link_round_trip")!;
      expect(lt.passed).toBe(true);
      expect(lt.reason).toContain("not applicable");
    }
  });

  it("kind_matches_proposal FAILS on mismatch", () => {
    const p = proposalOpenDir();
    const e: ActionExecution = { executed: true, kind: "book_now", target: p.target, result: {} };
    const r = verifyAction({ proposal: p, execution: e });
    if (r.applicable) {
      const km = r.findings.find((f) => f.check === "kind_matches_proposal")!;
      expect(km.passed).toBe(false);
    }
  });

  it("capability_registered FAILS on unknown kind", () => {
    const p: ActionProposal = { kind: "made_up_action" as unknown as ActionProposal["kind"], target: target("H", "id"), availability: "available", reason: "spoof", consentRequired: false, linkPreview: "/x" };
    const e: ActionExecution = { executed: true, kind: p.kind, target: p.target, result: { url: "/x" } };
    const r = verifyAction({ proposal: p, execution: e });
    if (r.applicable) {
      const cr = r.findings.find((f) => f.check === "capability_registered")!;
      expect(cr.passed).toBe(false);
      expect(cr.reason).toContain("spoof");
    }
  });
});
