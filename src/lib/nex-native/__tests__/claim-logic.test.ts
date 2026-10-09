// src/lib/nex-native/__tests__/claim-logic.test.ts
//
// Pure-logic tests for the universal business-claim module.
// No DB. No network. No clock (clocks are injected). No randomness.

import { describe, expect, test } from "vitest";
import {
  CLAIM_CODE_MAX_ATTEMPTS,
  CLAIM_CODE_TTL_MS,
  computeExpiry,
  decideRevokeClaim,
  decideVerifyClaim,
  isClaimChannel,
  planAcceptedClaimWrite,
  planCreateClaim,
  type BusinessClaim,
} from "../claims/claim-logic";

// ═════════════════════════════════════════════════════════════════════
// Fixtures
// ═════════════════════════════════════════════════════════════════════

const FIXED_NOW = new Date("2026-10-09T12:00:00.000Z");

function pendingClaim(overrides: Partial<BusinessClaim> = {}): BusinessClaim {
  return {
    claim_id: "11111111-1111-1111-1111-111111111111",
    canonical_business_id: "22222222-2222-2222-2222-222222222222",
    code_hash: "crypt-hash-placeholder",
    claim_channel: "whatsapp",
    destination: "+6281234567890",
    state: "PENDING",
    requested_at: "2026-10-09T11:55:00.000Z",
    expires_at: "2026-10-09T12:05:00.000Z",
    attempt_count: 0,
    verified_at: null,
    claimed_by_account_id: null,
    expired_at: null,
    revoked_at: null,
    revoked_by: null,
    requested_by: "admin:philip",
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §1 · Channel validator
// ═════════════════════════════════════════════════════════════════════

describe("isClaimChannel", () => {
  test.each(["whatsapp", "email", "sms", "phone"])(
    "accepts sealed channel '%s'",
    (c) => {
      expect(isClaimChannel(c)).toBe(true);
    },
  );

  test.each(["sendgrid", "", "WhatsApp", "signal", "fax"])(
    "refuses non-sealed value '%s'",
    (c) => {
      expect(isClaimChannel(c)).toBe(false);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════
// §2 · computeExpiry · sealed 10-minute TTL
// ═════════════════════════════════════════════════════════════════════

describe("computeExpiry", () => {
  test("returns now + CLAIM_CODE_TTL_MS", () => {
    const exp = computeExpiry(FIXED_NOW);
    expect(exp.getTime()).toBe(FIXED_NOW.getTime() + CLAIM_CODE_TTL_MS);
  });

  test("TTL is 10 minutes (600_000 ms)", () => {
    expect(CLAIM_CODE_TTL_MS).toBe(600_000);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · planCreateClaim · pure validator
// ═════════════════════════════════════════════════════════════════════

describe("planCreateClaim", () => {
  test("accepts valid input", () => {
    const result = planCreateClaim({
      canonical_business_id: "cbid-1",
      claim_channel: "whatsapp",
      destination: "+628...",
      requested_by: "admin:philip",
      code_hash: "hash-1",
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.canonical_business_id).toBe("cbid-1");
      expect(result.plan.expires_at.getTime()).toBe(
        FIXED_NOW.getTime() + CLAIM_CODE_TTL_MS,
      );
    }
  });

  test("refuses blank canonical_business_id", () => {
    const result = planCreateClaim({
      canonical_business_id: "   ",
      claim_channel: "whatsapp",
      destination: "+628...",
      requested_by: "admin:philip",
      code_hash: "hash-1",
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("blank_canonical_business_id");
  });

  test("refuses invalid channel", () => {
    const result = planCreateClaim({
      canonical_business_id: "cbid-1",
      claim_channel: "fax" as never,
      destination: "+628...",
      requested_by: "admin:philip",
      code_hash: "hash-1",
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_channel");
  });

  test("refuses blank destination", () => {
    const result = planCreateClaim({
      canonical_business_id: "cbid-1",
      claim_channel: "email",
      destination: "",
      requested_by: "admin:philip",
      code_hash: "hash-1",
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("blank_destination");
  });

  test("refuses blank requested_by", () => {
    const result = planCreateClaim({
      canonical_business_id: "cbid-1",
      claim_channel: "email",
      destination: "x@y.z",
      requested_by: "   ",
      code_hash: "hash-1",
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("blank_requested_by");
  });

  test("refuses blank code_hash", () => {
    const result = planCreateClaim({
      canonical_business_id: "cbid-1",
      claim_channel: "whatsapp",
      destination: "+628...",
      requested_by: "admin:philip",
      code_hash: "",
      now: FIXED_NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("blank_code_hash");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · decideVerifyClaim · state transitions
// ═════════════════════════════════════════════════════════════════════

describe("decideVerifyClaim", () => {
  test("accept on PENDING + matching code + non-expired + account present", () => {
    const result = decideVerifyClaim({
      claim: pendingClaim(),
      supplied_code_matches: true,
      account_id_asserting_claim: "acc-123",
      now: FIXED_NOW,
    });
    expect(result.kind).toBe("accept");
    if (result.kind === "accept") {
      expect(result.new_state).toBe("VERIFIED");
      expect(result.claimed_by_account_id).toBe("acc-123");
      expect(result.verified_at).toEqual(FIXED_NOW);
    }
  });

  test("reject_wrong_code on PENDING + mismatch, bumps attempt_count", () => {
    const result = decideVerifyClaim({
      claim: pendingClaim({ attempt_count: 2 }),
      supplied_code_matches: false,
      account_id_asserting_claim: "acc-123",
      now: FIXED_NOW,
    });
    expect(result.kind).toBe("reject_wrong_code");
    if (result.kind === "reject_wrong_code") {
      expect(result.new_attempt_count).toBe(3);
      expect(result.auto_expire).toBe(false);
    }
  });

  test("reject_wrong_code auto-expires at CLAIM_CODE_MAX_ATTEMPTS", () => {
    const result = decideVerifyClaim({
      claim: pendingClaim({ attempt_count: CLAIM_CODE_MAX_ATTEMPTS - 1 }),
      supplied_code_matches: false,
      account_id_asserting_claim: "acc-123",
      now: FIXED_NOW,
    });
    expect(result.kind).toBe("reject_wrong_code");
    if (result.kind === "reject_wrong_code") {
      expect(result.new_attempt_count).toBe(CLAIM_CODE_MAX_ATTEMPTS);
      expect(result.auto_expire).toBe(true);
    }
  });

  test("reject_expired when now >= expires_at", () => {
    const result = decideVerifyClaim({
      claim: pendingClaim({ expires_at: "2026-10-09T11:00:00.000Z" }),
      supplied_code_matches: true,
      account_id_asserting_claim: "acc-123",
      now: FIXED_NOW,
    });
    expect(result.kind).toBe("reject_expired");
  });

  test("reject_terminal_state when claim is VERIFIED", () => {
    const result = decideVerifyClaim({
      claim: pendingClaim({ state: "VERIFIED", verified_at: "2026-10-09T11:58:00.000Z", claimed_by_account_id: "earlier-acc" }),
      supplied_code_matches: true,
      account_id_asserting_claim: "acc-123",
      now: FIXED_NOW,
    });
    expect(result.kind).toBe("reject_terminal_state");
    if (result.kind === "reject_terminal_state") {
      expect(result.current_state).toBe("VERIFIED");
    }
  });

  test("reject_terminal_state when claim is EXPIRED", () => {
    const result = decideVerifyClaim({
      claim: pendingClaim({ state: "EXPIRED", expired_at: "2026-10-09T11:58:00.000Z" }),
      supplied_code_matches: true,
      account_id_asserting_claim: "acc-123",
      now: FIXED_NOW,
    });
    expect(result.kind).toBe("reject_terminal_state");
  });

  test("reject_terminal_state when claim is REVOKED", () => {
    const result = decideVerifyClaim({
      claim: pendingClaim({ state: "REVOKED", revoked_at: "2026-10-09T11:58:00.000Z", revoked_by: "admin:philip" }),
      supplied_code_matches: true,
      account_id_asserting_claim: "acc-123",
      now: FIXED_NOW,
    });
    expect(result.kind).toBe("reject_terminal_state");
  });

  test("reject_blank_account rejects empty account id", () => {
    const result = decideVerifyClaim({
      claim: pendingClaim(),
      supplied_code_matches: true,
      account_id_asserting_claim: "   ",
      now: FIXED_NOW,
    });
    expect(result.kind).toBe("reject_blank_account");
  });

  test("reject_attempts_exhausted when attempt_count already at max", () => {
    const result = decideVerifyClaim({
      claim: pendingClaim({ attempt_count: CLAIM_CODE_MAX_ATTEMPTS }),
      supplied_code_matches: false,
      account_id_asserting_claim: "acc-123",
      now: FIXED_NOW,
    });
    expect(result.kind).toBe("reject_attempts_exhausted");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · decideRevokeClaim
// ═════════════════════════════════════════════════════════════════════

describe("decideRevokeClaim", () => {
  test("accept on PENDING + non-blank revoked_by", () => {
    const result = decideRevokeClaim({
      claim: pendingClaim(),
      revoked_by: "admin:philip",
      reason: "fraud detected",
      now: FIXED_NOW,
    });
    expect(result.kind).toBe("accept");
    if (result.kind === "accept") {
      expect(result.new_state).toBe("REVOKED");
      expect(result.revoked_at).toEqual(FIXED_NOW);
      expect(result.revoked_by).toBe("admin:philip");
    }
  });

  test("reject_blank_revoked_by refuses empty actor", () => {
    const result = decideRevokeClaim({
      claim: pendingClaim(),
      revoked_by: "",
      reason: "test",
      now: FIXED_NOW,
    });
    expect(result.kind).toBe("reject_blank_revoked_by");
  });

  test("reject_already_terminal when claim is already VERIFIED", () => {
    const result = decideRevokeClaim({
      claim: pendingClaim({ state: "VERIFIED", verified_at: FIXED_NOW.toISOString(), claimed_by_account_id: "acc" }),
      revoked_by: "admin:philip",
      reason: "mistake",
      now: FIXED_NOW,
    });
    expect(result.kind).toBe("reject_already_terminal");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · planAcceptedClaimWrite · lifecycle promotion contract
// ═════════════════════════════════════════════════════════════════════

describe("planAcceptedClaimWrite", () => {
  test("produces a 3-table write plan with CLAIMABLE_LIFECYCLE_STATES guard", () => {
    const claim = pendingClaim();
    const decision = decideVerifyClaim({
      claim,
      supplied_code_matches: true,
      account_id_asserting_claim: "acc-999",
      now: FIXED_NOW,
    });
    if (decision.kind !== "accept") throw new Error("fixture mismatch");
    const plan = planAcceptedClaimWrite(claim, decision);
    expect(plan.update_claim.state).toBe("VERIFIED");
    expect(plan.update_claim.claimed_by_account_id).toBe("acc-999");
    expect(plan.update_canonical.to_lifecycle_state).toBe("OWNER_CLAIMED");
    expect(plan.update_canonical.expected_lifecycle_states_in).toEqual([
      "DISCOVERED",
      "ENRICHED",
      "VERIFIED",
    ]);
    expect(plan.insert_lifecycle_log.transition_reason).toBe("owner_claim");
    expect(plan.insert_lifecycle_log.transitioned_by).toBe("owner:acc-999");
    expect(plan.insert_lifecycle_log.to_state).toBe("OWNER_CLAIMED");
  });
});
