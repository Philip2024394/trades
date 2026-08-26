// src/lib/nex-transport-acquisition/recruitment-funnel.test.ts

import { describe, it, expect } from "vitest";
import {
  transitionRecruitmentStage,
  isStageDispatchable,
  isTerminalStage,
  RecruitmentTransitionError,
} from "./recruitment-funnel";

describe("Recruitment funnel · linear happy path", () => {
  it("walks the full ladder discovered → active", () => {
    const stages = [
      "discovered", "public_contact_verified", "invitable", "invited",
      "interested", "registration_started", "registered", "kyc_pending",
      "vehicle_pending", "insurance_pending", "legal_review", "verified", "active",
    ] as const;
    for (let i = 0; i < stages.length - 1; i++) {
      const t = transitionRecruitmentStage({
        current: stages[i],
        next: stages[i + 1],
        reason: "unit test",
        legalModelApproved: true,
      });
      expect(t.status).toBe("OK");
      expect(t.from).toBe(stages[i]);
      expect(t.to).toBe(stages[i + 1]);
    }
  });
});

describe("Recruitment funnel · illegal skips throw", () => {
  it("discovered → verified is rejected (non-adjacent)", () => {
    expect(() => transitionRecruitmentStage({ current: "discovered", next: "verified" })).toThrow(RecruitmentTransitionError);
  });

  it("discovered → active is rejected (non-adjacent)", () => {
    expect(() => transitionRecruitmentStage({ current: "discovered", next: "active" })).toThrow(RecruitmentTransitionError);
  });

  it("registered → active is rejected (non-adjacent · must go through kyc/vehicle/insurance/legal review/verified)", () => {
    expect(() => transitionRecruitmentStage({ current: "registered", next: "active" })).toThrow(RecruitmentTransitionError);
  });

  it("backwards transition rejected", () => {
    expect(() => transitionRecruitmentStage({ current: "registered", next: "invited" })).toThrow(RecruitmentTransitionError);
  });
});

describe("Recruitment funnel · terminal exits require a reason from any pre-terminal state", () => {
  it("discovered → declined without reason → REASON_REQUIRED", () => {
    expect(() => transitionRecruitmentStage({ current: "discovered", next: "declined" })).toThrow(/reason/i);
  });

  it("discovered → declined WITH reason succeeds", () => {
    const t = transitionRecruitmentStage({ current: "discovered", next: "declined", reason: "provider explicitly declined" });
    expect(t.status).toBe("OK");
    expect(t.to).toBe("declined");
  });

  it("invited → unreachable requires reason", () => {
    expect(() => transitionRecruitmentStage({ current: "invited", next: "unreachable" })).toThrow(/reason/i);
    const t = transitionRecruitmentStage({ current: "invited", next: "unreachable", reason: "no response after 3 attempts" });
    expect(t.status).toBe("OK");
  });

  it("interested → opted_out succeeds with reason", () => {
    const t = transitionRecruitmentStage({ current: "interested", next: "opted_out", reason: "requested removal" });
    expect(t.status).toBe("OK");
  });
});

describe("Recruitment funnel · cannot leave a terminal state", () => {
  it("declined → invited rejected", () => {
    expect(() => transitionRecruitmentStage({ current: "declined", next: "invited" })).toThrow(/terminal/i);
  });

  it("opted_out → interested rejected", () => {
    expect(() => transitionRecruitmentStage({ current: "opted_out", next: "interested" })).toThrow(/terminal/i);
  });
});

describe("Recruitment funnel · verified → active requires legalModelApproved", () => {
  it("without legalModelApproved → MISSING_LEGAL_APPROVAL", () => {
    expect(() => transitionRecruitmentStage({ current: "verified", next: "active" })).toThrow(/legal/i);
  });

  it("with legalModelApproved=true → OK", () => {
    const t = transitionRecruitmentStage({ current: "verified", next: "active", legalModelApproved: true });
    expect(t.status).toBe("OK");
  });
});

describe("Recruitment funnel · dispatchability + terminality helpers", () => {
  it("only active is dispatchable", () => {
    expect(isStageDispatchable("active")).toBe(true);
    expect(isStageDispatchable("verified")).toBe(false);
    expect(isStageDispatchable("discovered")).toBe(false);
    expect(isStageDispatchable("legal_review")).toBe(false);
  });

  it("terminal stages reported correctly", () => {
    expect(isTerminalStage("declined")).toBe(true);
    expect(isTerminalStage("unreachable")).toBe(true);
    expect(isTerminalStage("opted_out")).toBe(true);
    expect(isTerminalStage("verified")).toBe(false);
    expect(isTerminalStage("active")).toBe(false);
  });
});
