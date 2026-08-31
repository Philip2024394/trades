// src/lib/nex-provider/reliability-profile.test.ts

import { describe, it, expect } from "vitest";
import {
  calculateReliabilityProfile,
  type ReliabilitySignals,
} from "./reliability-profile";

function signals(overrides: Partial<ReliabilitySignals> = {}): ReliabilitySignals {
  return {
    offered: 100,
    accepted: 60,
    declined: 40,
    completed: 58,
    cancellationsAfterAcceptance: 1,
    noShows: 1,
    recentActivityDays: 3,
    documentValidityOk: true,
    vehicleVerified: true,
    consentActive: true,
    ...overrides,
  };
}

describe("Reliability · insufficient history → new_driver (never a punishment)", () => {
  it("accepted=0 → new_driver", () => {
    const p = calculateReliabilityProfile(signals({ accepted: 0, completed: 0 }));
    expect(p.band).toBe("new_driver");
    expect(p.unknown.toLowerCase()).toMatch(/not a negative signal/);
  });

  it("accepted=3 → new_driver", () => {
    const p = calculateReliabilityProfile(signals({ accepted: 3, completed: 3 }));
    expect(p.band).toBe("new_driver");
  });
});

describe("Reliability · excellent band", () => {
  it("completion 98% + no-show 2% → excellent", () => {
    const p = calculateReliabilityProfile(signals({ accepted: 100, completed: 98, noShows: 2, cancellationsAfterAcceptance: 0 }));
    expect(p.band).toBe("excellent");
  });
});

describe("Reliability · good band", () => {
  it("completion 94% + no-show 5% → good", () => {
    const p = calculateReliabilityProfile(signals({ accepted: 100, completed: 94, noShows: 5, cancellationsAfterAcceptance: 1 }));
    expect(p.band).toBe("good");
  });
});

describe("Reliability · steady band", () => {
  it("completion 90% · no-show 3% · cancel 5% · not red → steady", () => {
    const p = calculateReliabilityProfile(signals({ accepted: 100, completed: 90, noShows: 3, cancellationsAfterAcceptance: 5 }));
    expect(p.band).toBe("steady");
  });
});

describe("Reliability · needs_attention band", () => {
  it("cancel-after-accept 20% → needs_attention", () => {
    const p = calculateReliabilityProfile(signals({ accepted: 100, completed: 70, noShows: 5, cancellationsAfterAcceptance: 20 }));
    expect(p.band).toBe("needs_attention");
    expect(p.reviewFlags).toContain("elevated_cancel_or_no_show_rate");
    expect(p.unknown.toLowerCase()).toMatch(/human review.*never an automatic ban/);
  });

  it("no-show rate 15% → needs_attention", () => {
    const p = calculateReliabilityProfile(signals({ accepted: 100, completed: 60, noShows: 15, cancellationsAfterAcceptance: 5 }));
    expect(p.band).toBe("needs_attention");
  });
});

describe("Reliability · declines never lower the band", () => {
  it("100 declines · 100 accepts · perfect completion → excellent (not penalised)", () => {
    const p = calculateReliabilityProfile(signals({
      offered: 200, accepted: 100, declined: 100,
      completed: 100, noShows: 0, cancellationsAfterAcceptance: 0,
    }));
    expect(p.band).toBe("excellent");
    // declines only surface in the informational acceptanceRate · not band
    expect(p.acceptanceRate).toBe(0.5);
  });

  it("acceptance rate is informational only · does not lower the band", () => {
    // Compare two drivers: both have identical completion behaviour, one declines more
    const highDecline = calculateReliabilityProfile(signals({
      offered: 200, accepted: 60, declined: 140,
      completed: 60, noShows: 0, cancellationsAfterAcceptance: 0,
    }));
    const lowDecline = calculateReliabilityProfile(signals({
      offered: 65, accepted: 60, declined: 5,
      completed: 60, noShows: 0, cancellationsAfterAcceptance: 0,
    }));
    expect(highDecline.band).toBe(lowDecline.band);   // same band regardless of declines
    expect(highDecline.acceptanceRate).not.toBe(lowDecline.acceptanceRate);
  });
});

describe("Reliability · review flags surface honest concerns", () => {
  it("documents invalid → document_validity_issue flag", () => {
    const p = calculateReliabilityProfile(signals({ documentValidityOk: false }));
    expect(p.reviewFlags).toContain("document_validity_issue");
  });

  it("vehicle unverified → vehicle_not_verified flag", () => {
    const p = calculateReliabilityProfile(signals({ vehicleVerified: false }));
    expect(p.reviewFlags).toContain("vehicle_not_verified");
  });

  it("consent inactive → consent_not_active flag", () => {
    const p = calculateReliabilityProfile(signals({ consentActive: false }));
    expect(p.reviewFlags).toContain("consent_not_active");
  });

  it("inactive over 90 days → inactive_over_90_days flag", () => {
    const p = calculateReliabilityProfile(signals({ recentActivityDays: 120 }));
    expect(p.reviewFlags).toContain("inactive_over_90_days");
  });
});

describe("Reliability · configurable thresholds", () => {
  it("threshold minAcceptedForBanding overridden → excellent for very short history", () => {
    const p = calculateReliabilityProfile(
      signals({ accepted: 2, completed: 2, noShows: 0, cancellationsAfterAcceptance: 0 }),
      { minAcceptedForBanding: 2 },
    );
    expect(p.band).toBe("excellent");
  });

  it("threshold needsAttentionCancelRate=0.05 → band drops to needs_attention earlier", () => {
    const p = calculateReliabilityProfile(
      signals({ accepted: 100, completed: 90, noShows: 2, cancellationsAfterAcceptance: 8 }),
      { needsAttentionCancelRate: 0.05 },
    );
    expect(p.band).toBe("needs_attention");
  });
});

describe("Reliability · rate calculations · integer + fractional cases", () => {
  it("completion + no-show + cancel rates computed correctly", () => {
    const p = calculateReliabilityProfile(signals({
      accepted: 200, completed: 190, noShows: 4, cancellationsAfterAcceptance: 6,
    }));
    expect(p.completionRate).toBeCloseTo(0.95);
    expect(p.noShowRate).toBeCloseTo(0.02);
    expect(p.cancelAfterAcceptRate).toBeCloseTo(0.03);
  });
});
