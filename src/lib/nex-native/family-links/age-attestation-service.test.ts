// src/lib/nex-native/family-links/age-attestation-service.test.ts
//
// Unit tests for NEX Family Links Phase 1 · age-attestation service.
// Mocks @/lib/nex/db · never touches a real database.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type QueryResponder = (
  sql: string,
  params: readonly unknown[],
) => { rows: Record<string, unknown>[]; rowCount: number };

let withClientCalls: Array<{ sql: string; params: readonly unknown[] }>;
let withClientResponder: QueryResponder | null;
let withClientUnavailable: boolean;

vi.mock("@/lib/nex/db", () => ({
  withClient: async <T>(fn: (c: unknown) => Promise<T>): Promise<T | null> => {
    if (withClientUnavailable) return null;
    const client = {
      query: async (sql: string, params?: readonly unknown[]) => {
        withClientCalls.push({ sql, params: params ?? [] });
        if (withClientResponder) {
          return withClientResponder(sql, params ?? []);
        }
        return { rows: [], rowCount: 0 };
      },
    };
    return (await fn(client)) ?? null;
  },
}));

import {
  recordAttestation,
  readActiveAttestation,
  supersedeAttestation,
  readAttestationHistory,
} from "./age-attestation-service";
import { AGE_ATTESTATION_ERROR_CODES } from "./types";

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const GUARDIAN = "22222222-2222-4222-8222-222222222222";
const OUTSIDER = "33333333-3333-4333-8333-333333333333";
const ATT_ID = "44444444-4444-4444-4444-444444444444";
const PRIOR_ID = "55555555-5555-4555-8555-555555555555";

function attRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    attestation_id: ATT_ID,
    account_id: ACCOUNT,
    declared_date_of_birth: "2015-06-15",
    attested_by: "self",
    attested_by_account_id: ACCOUNT,
    attestation_method: "declared",
    attestation_notes: null,
    superseded_by: null,
    simulated: true,
    created_at: new Date("2026-10-10T10:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  withClientCalls = [];
  withClientResponder = null;
  withClientUnavailable = false;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────
// recordAttestation · argument + authorization guards
// ─────────────────────────────────────────────────────────────────────

describe("recordAttestation · argument guards", () => {
  it("rejects empty account id", async () => {
    await expect(
      recordAttestation({
        accountId: "",
        declaredDateOfBirth: "2015-06-15",
        attestedBy: "self",
        attestedByAccountId: ACCOUNT,
        actorAccountId: ACCOUNT,
      }),
    ).rejects.toThrow(/invalid_account_id/);
  });

  it("rejects malformed DOB", async () => {
    await expect(
      recordAttestation({
        accountId: ACCOUNT,
        declaredDateOfBirth: "not-a-date",
        attestedBy: "self",
        attestedByAccountId: ACCOUNT,
        actorAccountId: ACCOUNT,
      }),
    ).rejects.toThrow(AGE_ATTESTATION_ERROR_CODES.INVALID_DOB);
  });

  it("rejects DOB in the future", async () => {
    const future = new Date(Date.now() + 48 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    await expect(
      recordAttestation({
        accountId: ACCOUNT,
        declaredDateOfBirth: future,
        attestedBy: "self",
        attestedByAccountId: ACCOUNT,
        actorAccountId: ACCOUNT,
      }),
    ).rejects.toThrow(AGE_ATTESTATION_ERROR_CODES.INVALID_DOB);
  });

  it("rejects DOB before 1900", async () => {
    await expect(
      recordAttestation({
        accountId: ACCOUNT,
        declaredDateOfBirth: "1899-12-31",
        attestedBy: "self",
        attestedByAccountId: ACCOUNT,
        actorAccountId: ACCOUNT,
      }),
    ).rejects.toThrow(AGE_ATTESTATION_ERROR_CODES.INVALID_DOB);
  });

  it("rejects invalid attestedBy", async () => {
    await expect(
      recordAttestation({
        accountId: ACCOUNT,
        declaredDateOfBirth: "2015-06-15",
        // @ts-expect-error · deliberately wrong
        attestedBy: "nope",
        attestedByAccountId: ACCOUNT,
        actorAccountId: ACCOUNT,
      }),
    ).rejects.toThrow(AGE_ATTESTATION_ERROR_CODES.INVALID_ATTESTED_BY);
  });

  it("rejects over-long notes", async () => {
    await expect(
      recordAttestation({
        accountId: ACCOUNT,
        declaredDateOfBirth: "2015-06-15",
        attestedBy: "self",
        attestedByAccountId: ACCOUNT,
        actorAccountId: ACCOUNT,
        attestationNotes: "x".repeat(501),
      }),
    ).rejects.toThrow(AGE_ATTESTATION_ERROR_CODES.INVALID_NOTES);
  });
});

// ─────────────────────────────────────────────────────────────────────
// recordAttestation · authorization
// ─────────────────────────────────────────────────────────────────────

describe("recordAttestation · authorization", () => {
  it("rejects self-attestation by a different actor", async () => {
    await expect(
      recordAttestation({
        accountId: ACCOUNT,
        declaredDateOfBirth: "2015-06-15",
        attestedBy: "self",
        attestedByAccountId: ACCOUNT,
        actorAccountId: OUTSIDER,
      }),
    ).rejects.toThrow(AGE_ATTESTATION_ERROR_CODES.UNAUTHORIZED_ACTOR);
  });

  it("rejects system_fallback via this service", async () => {
    await expect(
      recordAttestation({
        accountId: ACCOUNT,
        declaredDateOfBirth: "2015-06-15",
        attestedBy: "system_fallback",
        attestedByAccountId: null,
        actorAccountId: ACCOUNT,
      }),
    ).rejects.toThrow(AGE_ATTESTATION_ERROR_CODES.UNAUTHORIZED_ACTOR);
  });

  it("rejects guardian-attestation without attestor id", async () => {
    await expect(
      recordAttestation({
        accountId: ACCOUNT,
        declaredDateOfBirth: "2015-06-15",
        attestedBy: "guardian",
        attestedByAccountId: null,
        actorAccountId: GUARDIAN,
      }),
    ).rejects.toThrow(AGE_ATTESTATION_ERROR_CODES.MISSING_ATTESTOR_ID);
  });

  it("rejects guardian-attestation when attestor id does not match actor", async () => {
    await expect(
      recordAttestation({
        accountId: ACCOUNT,
        declaredDateOfBirth: "2015-06-15",
        attestedBy: "guardian",
        attestedByAccountId: OUTSIDER,
        actorAccountId: GUARDIAN,
      }),
    ).rejects.toThrow(AGE_ATTESTATION_ERROR_CODES.UNAUTHORIZED_ACTOR);
  });

  it("rejects guardian-attestation when actor has NO active guardian link", async () => {
    withClientResponder = (sql) => {
      if (/^SELECT 1 FROM nex\.family_link/i.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    };
    await expect(
      recordAttestation({
        accountId: ACCOUNT,
        declaredDateOfBirth: "2015-06-15",
        attestedBy: "guardian",
        attestedByAccountId: GUARDIAN,
        actorAccountId: GUARDIAN,
      }),
    ).rejects.toThrow(AGE_ATTESTATION_ERROR_CODES.UNAUTHORIZED_ACTOR);
  });

  it("rejects self-elevation: child cannot guardian-attest for self", async () => {
    await expect(
      recordAttestation({
        accountId: ACCOUNT,
        declaredDateOfBirth: "2015-06-15",
        attestedBy: "guardian",
        attestedByAccountId: ACCOUNT,
        actorAccountId: ACCOUNT,
      }),
    ).rejects.toThrow(AGE_ATTESTATION_ERROR_CODES.UNAUTHORIZED_ACTOR);
  });
});

// ─────────────────────────────────────────────────────────────────────
// recordAttestation · happy paths
// ─────────────────────────────────────────────────────────────────────

describe("recordAttestation · happy paths", () => {
  it("records a self attestation with simulated=TRUE", async () => {
    withClientResponder = (sql) => {
      if (/^INSERT INTO nex\.account_age_attestation/i.test(sql)) {
        return { rows: [attRow()], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    const row = await recordAttestation({
      accountId: ACCOUNT,
      declaredDateOfBirth: "2015-06-15",
      attestedBy: "self",
      attestedByAccountId: ACCOUNT,
      actorAccountId: ACCOUNT,
    });
    expect(row.attestedBy).toBe("self");
    expect(row.attestationMethod).toBe("declared");
    expect(row.simulated).toBe(true);

    const insert = withClientCalls.find((c) =>
      /INSERT INTO nex\.account_age_attestation/i.test(c.sql),
    );
    expect(insert).toBeDefined();
    // simulated hard-coded TRUE (not parameterised).
    expect(insert!.sql).toMatch(/,\s*TRUE\s*\)/i);
  });

  it("records a guardian attestation when an active guardian link exists", async () => {
    withClientResponder = (sql) => {
      if (/^SELECT 1 FROM nex\.family_link/i.test(sql)) {
        return { rows: [{ "?column?": 1 }], rowCount: 1 };
      }
      if (/^INSERT INTO nex\.account_age_attestation/i.test(sql)) {
        return {
          rows: [
            attRow({
              attested_by: "guardian",
              attested_by_account_id: GUARDIAN,
              attestation_method: "guardian_declared",
            }),
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    };
    const row = await recordAttestation({
      accountId: ACCOUNT,
      declaredDateOfBirth: "2015-06-15",
      attestedBy: "guardian",
      attestedByAccountId: GUARDIAN,
      actorAccountId: GUARDIAN,
    });
    expect(row.attestedBy).toBe("guardian");
    expect(row.attestationMethod).toBe("guardian_declared");
  });

  it("throws DB_UNAVAILABLE when pool is unavailable", async () => {
    withClientUnavailable = true;
    await expect(
      recordAttestation({
        accountId: ACCOUNT,
        declaredDateOfBirth: "2015-06-15",
        attestedBy: "self",
        attestedByAccountId: ACCOUNT,
        actorAccountId: ACCOUNT,
      }),
    ).rejects.toThrow(AGE_ATTESTATION_ERROR_CODES.DB_UNAVAILABLE);
  });
});

// ─────────────────────────────────────────────────────────────────────
// readActiveAttestation
// ─────────────────────────────────────────────────────────────────────

describe("readActiveAttestation", () => {
  it("returns the mapped active row", async () => {
    withClientResponder = () => ({ rows: [attRow()], rowCount: 1 });
    const row = await readActiveAttestation(ACCOUNT);
    expect(row?.attestationId).toBe(ATT_ID);
    expect(row?.supersededBy).toBeNull();
  });

  it("returns null when nothing active", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const row = await readActiveAttestation(ACCOUNT);
    expect(row).toBeNull();
  });

  it("returns null when pool unavailable", async () => {
    withClientUnavailable = true;
    const row = await readActiveAttestation(ACCOUNT);
    expect(row).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
// supersedeAttestation
// ─────────────────────────────────────────────────────────────────────

describe("supersedeAttestation", () => {
  it("records a new row and marks the prior superseded", async () => {
    let newInserted = false;
    let supersedeHit = false;
    withClientResponder = (sql) => {
      if (/^INSERT INTO nex\.account_age_attestation/i.test(sql)) {
        newInserted = true;
        return { rows: [attRow()], rowCount: 1 };
      }
      if (/^UPDATE nex\.account_age_attestation/i.test(sql)) {
        supersedeHit = true;
        return { rows: [{ attestation_id: PRIOR_ID }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    const row = await supersedeAttestation({
      priorAttestationId: PRIOR_ID,
      newAttestation: {
        accountId: ACCOUNT,
        declaredDateOfBirth: "2015-07-20",
        attestedBy: "self",
        attestedByAccountId: ACCOUNT,
        actorAccountId: ACCOUNT,
      },
    });
    expect(row.attestationId).toBe(ATT_ID);
    expect(newInserted).toBe(true);
    expect(supersedeHit).toBe(true);
  });

  it("throws PRIOR_NOT_FOUND when the prior row is missing or already superseded", async () => {
    withClientResponder = (sql) => {
      if (/^INSERT INTO nex\.account_age_attestation/i.test(sql)) {
        return { rows: [attRow()], rowCount: 1 };
      }
      if (/^UPDATE nex\.account_age_attestation/i.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    };
    await expect(
      supersedeAttestation({
        priorAttestationId: PRIOR_ID,
        newAttestation: {
          accountId: ACCOUNT,
          declaredDateOfBirth: "2015-07-20",
          attestedBy: "self",
          attestedByAccountId: ACCOUNT,
          actorAccountId: ACCOUNT,
        },
      }),
    ).rejects.toThrow(AGE_ATTESTATION_ERROR_CODES.PRIOR_NOT_FOUND);
  });

  it("rejects when new attestation has an empty account id", async () => {
    await expect(
      supersedeAttestation({
        priorAttestationId: PRIOR_ID,
        newAttestation: {
          accountId: "",
          declaredDateOfBirth: "2015-07-20",
          attestedBy: "self",
          attestedByAccountId: ACCOUNT,
          actorAccountId: ACCOUNT,
        },
      }),
    ).rejects.toThrow(AGE_ATTESTATION_ERROR_CODES.INVALID_ACCOUNT_ID);
  });
});

// ─────────────────────────────────────────────────────────────────────
// readAttestationHistory
// ─────────────────────────────────────────────────────────────────────

describe("readAttestationHistory", () => {
  it("returns rows in reverse-chronological order", async () => {
    withClientResponder = () => ({
      rows: [attRow(), attRow({ attestation_id: PRIOR_ID, superseded_by: ATT_ID })],
      rowCount: 2,
    });
    const rows = await readAttestationHistory(ACCOUNT);
    expect(rows).toHaveLength(2);
    expect(rows[0].attestationId).toBe(ATT_ID);
    expect(rows[1].attestationId).toBe(PRIOR_ID);
  });

  it("returns [] when pool unavailable", async () => {
    withClientUnavailable = true;
    const rows = await readAttestationHistory(ACCOUNT);
    expect(rows).toEqual([]);
  });
});
