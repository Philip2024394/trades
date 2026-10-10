// src/lib/nex/master-ai/agent-designation.test.ts
//
// Founder-authorised 2026-09-16 · NEX designation governance tests
//
// These tests prove the doctrine's governance invariants hold at runtime:
//   1. UNASSIGNED / DISCOVERED forbid number + approval + rejection fields
//   2. PROPOSED requires number, forbids approval / rejection
//   3. OFFICIAL requires founder-approval fields AND number consistency
//   4. REJECTED requires reason; keeps number reserved (no reuse)
//   5. DEFERRED holds a reservation without approval or rejection
//   6. Number format validated
//   7. Number-conflict prevention
//   8. Designation status is INDEPENDENT of intelligence_status (identity ≠ capability)

import { describe, it, expect } from "vitest";
import {
  claimedNumbersMap,
  isFounderApprovedIdentity,
  isValidDesignationNumber,
  validateDesignation,
  validateNoNumberConflict,
  type Nex1AgentDesignation,
} from "./agent-designation";
import {
  NEX_01_DESIGNATION,
  NEX_02_DESIGNATION,
  NEX_DESIGNATION_FAMILY,
  officialDesignations,
} from "./known-nex-designations";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function base(overrides: Partial<Nex1AgentDesignation> = {}): Nex1AgentDesignation {
  return {
    agent_id: "test_agent",
    status: "UNASSIGNED",
    proposed_number: null,
    official_number: null,
    proposed_purpose: "Test agent",
    proposed_by: "nex1",
    proposed_at_iso: "2026-09-16T00:00:00.000Z",
    approved_by: null,
    approved_at_iso: null,
    rejected_reason: null,
    relationships: [],
    taught_by: "master_ai_engineer",
    ...overrides,
  };
}

// ─── §1 · UNASSIGNED / DISCOVERED forbid identity fields ────────────────────

describe("Designation · UNASSIGNED / DISCOVERED forbid identity fields", () => {
  it("UNASSIGNED with a proposed_number is REJECTED", () => {
    const d = base({ status: "UNASSIGNED", proposed_number: "NEX-42" });
    expect(validateDesignation(d)).toMatch(/UNASSIGNED forbids proposed_number/);
  });

  it("DISCOVERED with an approved_by is REJECTED", () => {
    const d = base({ status: "DISCOVERED", approved_by: "founder" });
    expect(validateDesignation(d)).toMatch(/DISCOVERED forbids approved_by/);
  });

  it("clean UNASSIGNED validates", () => {
    expect(validateDesignation(base())).toBeNull();
  });
});

// ─── §2 · PROPOSED requires number, forbids approval / rejection ────────────

describe("Designation · PROPOSED governance", () => {
  it("PROPOSED without proposed_number is REJECTED", () => {
    const d = base({ status: "PROPOSED", proposed_purpose: "Something" });
    expect(validateDesignation(d)).toMatch(/PROPOSED requires proposed_number/);
  });

  it("PROPOSED with founder approval fields is REJECTED (must go via OFFICIAL)", () => {
    const d = base({
      status: "PROPOSED",
      proposed_number: "NEX-05",
      approved_by: "founder",
    });
    expect(validateDesignation(d)).toMatch(/PROPOSED forbids approved_by/);
  });

  it("clean PROPOSED validates", () => {
    const d = base({
      status: "PROPOSED",
      proposed_number: "NEX-05",
    });
    expect(validateDesignation(d)).toBeNull();
  });
});

// ─── §3 · OFFICIAL requires founder approval + number consistency ───────────

describe("Designation · OFFICIAL governance (founder-only approval)", () => {
  it("OFFICIAL without approved_by is REJECTED", () => {
    const d = base({
      status: "OFFICIAL",
      proposed_number: "NEX-05",
      official_number: "NEX-05",
      approved_at_iso: "2026-09-16T00:00:00.000Z",
    });
    expect(validateDesignation(d)).toMatch(/OFFICIAL requires approved_by='founder'/);
  });

  it("OFFICIAL where official_number differs from proposed_number is REJECTED (no number-substitution)", () => {
    const d = base({
      status: "OFFICIAL",
      proposed_number: "NEX-05",
      official_number: "NEX-06",
      approved_by: "founder",
      approved_at_iso: "2026-09-16T00:00:00.000Z",
    });
    expect(validateDesignation(d)).toMatch(/no number-substitution/);
  });

  it("OFFICIAL missing approved_at_iso is REJECTED", () => {
    const d = base({
      status: "OFFICIAL",
      proposed_number: "NEX-05",
      official_number: "NEX-05",
      approved_by: "founder",
    });
    expect(validateDesignation(d)).toMatch(/OFFICIAL requires approved_at_iso/);
  });

  it("OFFICIAL with all founder-approval fields validates", () => {
    const d = base({
      status: "OFFICIAL",
      proposed_number: "NEX-05",
      official_number: "NEX-05",
      approved_by: "founder",
      approved_at_iso: "2026-09-16T00:00:00.000Z",
    });
    expect(validateDesignation(d)).toBeNull();
  });
});

// ─── §4 · REJECTED / DEFERRED preserve number reservation ───────────────────

describe("Designation · REJECTED / DEFERRED preserve number reservation", () => {
  it("REJECTED without a reason is REJECTED (audit trail integrity)", () => {
    const d = base({
      status: "REJECTED",
      proposed_number: "NEX-07",
    });
    expect(validateDesignation(d)).toMatch(/REJECTED requires rejected_reason/);
  });

  it("REJECTED cannot omit proposed_number (audit trail)", () => {
    const d = base({
      status: "REJECTED",
      rejected_reason: "Duplicate of NEX-05 capability",
    });
    expect(validateDesignation(d)).toMatch(/REJECTED requires proposed_number/);
  });

  it("DEFERRED with a rejected_reason is REJECTED (deferral is not rejection)", () => {
    const d = base({
      status: "DEFERRED",
      proposed_number: "NEX-07",
      rejected_reason: "wrong field",
    });
    expect(validateDesignation(d)).toMatch(/DEFERRED forbids rejected_reason/);
  });

  it("clean REJECTED validates", () => {
    const d = base({
      status: "REJECTED",
      proposed_number: "NEX-07",
      rejected_reason: "Duplicates NEX-01 scope",
    });
    expect(validateDesignation(d)).toBeNull();
  });

  it("clean DEFERRED validates", () => {
    const d = base({
      status: "DEFERRED",
      proposed_number: "NEX-07",
    });
    expect(validateDesignation(d)).toBeNull();
  });
});

// ─── §5 · Number format validation ──────────────────────────────────────────

describe("Designation · number format", () => {
  it.each(["NEX-01", "NEX-02", "NEX-42", "NEX-99", "NEX-100"])(
    "'%s' is valid",
    (n) => expect(isValidDesignationNumber(n)).toBe(true),
  );

  it.each(["NEX1", "NEX-1", "nex-01", "NEX-", "NEX--01", "01", "NEX_01"])(
    "'%s' is invalid",
    (n) => expect(isValidDesignationNumber(n)).toBe(false),
  );

  it("PROPOSED with invalid number format is REJECTED", () => {
    const d = base({
      status: "PROPOSED",
      proposed_number: "NEX1", // no hyphen, no zero-pad
    });
    expect(validateDesignation(d)).toMatch(/invalid proposed_number/);
  });
});

// ─── §6 · Number-conflict prevention ────────────────────────────────────────

describe("Designation · number-conflict prevention (numbers are permanent claims)", () => {
  const existing: readonly Nex1AgentDesignation[] = [NEX_01_DESIGNATION, NEX_02_DESIGNATION];

  it("proposing NEX-01 for a different agent is REJECTED (already claimed by OFFICIAL)", () => {
    const candidate = base({
      agent_id: "some_other_agent",
      status: "PROPOSED",
      proposed_number: "NEX-01",
    });
    expect(validateNoNumberConflict(candidate, existing)).toMatch(/NEX-01 already claimed/);
  });

  it("proposing NEX-02 for a different agent is REJECTED (already claimed by PROPOSED)", () => {
    const candidate = base({
      agent_id: "another_agent",
      status: "PROPOSED",
      proposed_number: "NEX-02",
    });
    expect(validateNoNumberConflict(candidate, existing)).toMatch(/NEX-02 already claimed/);
  });

  it("proposing a fresh number for a new agent is OK", () => {
    const candidate = base({
      agent_id: "future_agent",
      status: "PROPOSED",
      proposed_number: "NEX-42",
    });
    expect(validateNoNumberConflict(candidate, existing)).toBeNull();
  });

  it("same-agent record with same number is OK (state transition)", () => {
    // NEX-02 is PROPOSED. Future founder-approval record with same agent_id + number is OK.
    const candidate = base({
      agent_id: NEX_02_DESIGNATION.agent_id,
      status: "OFFICIAL",
      proposed_number: "NEX-02",
      official_number: "NEX-02",
      approved_by: "founder",
      approved_at_iso: "2026-09-16T00:00:00.000Z",
    });
    expect(validateNoNumberConflict(candidate, existing)).toBeNull();
  });

  it("claimedNumbersMap includes PROPOSED numbers (reservations)", () => {
    const claims = claimedNumbersMap(existing);
    expect(claims.get("NEX-01")).toBeDefined();
    expect(claims.get("NEX-02")).toBeDefined();
    expect(claims.size).toBe(2);
  });
});

// ─── §7 · Identity ≠ capability · independence axis ─────────────────────────

describe("Designation · identity is INDEPENDENT of intelligence_status", () => {
  it("isFounderApprovedIdentity reports IDENTITY approval, not capability approval", () => {
    // NEX-01 is OFFICIAL — founder-approved identity.
    expect(isFounderApprovedIdentity(NEX_01_DESIGNATION)).toBe(true);
    // But this function does NOT return anything about capability.
    // Capability comes from the separate intelligence-status.ts axis.
    // No test can conclude NATIVE / NI-1 / etc. from designation status.
  });

  it("NEX-02 (PROPOSED) is NOT a founder-approved identity yet", () => {
    expect(isFounderApprovedIdentity(NEX_02_DESIGNATION)).toBe(false);
  });

  it("Even an OFFICIAL designation with no evidence remains an identity claim only", () => {
    // A hypothetical NEX-99 could be founder-approved as identity, yet still
    // have intelligence_status UNKNOWN if capability has not been demonstrated.
    const identityOnly = base({
      agent_id: "nex99_agent",
      status: "OFFICIAL",
      proposed_number: "NEX-99",
      official_number: "NEX-99",
      approved_by: "founder",
      approved_at_iso: "2026-09-16T00:00:00.000Z",
    });
    expect(validateDesignation(identityOnly)).toBeNull();
    expect(isFounderApprovedIdentity(identityOnly)).toBe(true);
    // The doctrine test: identity approval does NOT elevate capability.
    // Founder rule: "Identity first → evidence → capability → maturity."
  });
});

// ─── §8 · Founding registry snapshot ────────────────────────────────────────

describe("Designation · founding registry", () => {
  it("NEX-01 is registered as OFFICIAL", () => {
    expect(NEX_01_DESIGNATION.status).toBe("OFFICIAL");
    expect(NEX_01_DESIGNATION.official_number).toBe("NEX-01");
    expect(validateDesignation(NEX_01_DESIGNATION)).toBeNull();
  });

  it("NEX-02 is registered as PROPOSED (Context Intelligence · awaiting founder decision)", () => {
    expect(NEX_02_DESIGNATION.status).toBe("PROPOSED");
    expect(NEX_02_DESIGNATION.proposed_number).toBe("NEX-02");
    expect(NEX_02_DESIGNATION.official_number).toBeNull();
    expect(validateDesignation(NEX_02_DESIGNATION)).toBeNull();
    expect(isFounderApprovedIdentity(NEX_02_DESIGNATION)).toBe(false);
  });

  it("officialDesignations() returns only OFFICIAL entries", () => {
    const officials = officialDesignations();
    expect(officials.length).toBe(1);
    expect(officials[0]!.official_number).toBe("NEX-01");
  });

  it("family map contains exactly 2 entries at seal (2026-09-16)", () => {
    expect(NEX_DESIGNATION_FAMILY.size).toBe(2);
    expect(NEX_DESIGNATION_FAMILY.has("NEX-01")).toBe(true);
    expect(NEX_DESIGNATION_FAMILY.has("NEX-02")).toBe(true);
  });
});
