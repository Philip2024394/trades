// src/lib/nex-native/family-links/cooldown-service.test.ts
//
// Unit tests for FS-2 cooldown-service. Mocks @/lib/nex/db.

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
  cancelPendingCooldown,
  confirmCooldownBypass,
  COOLDOWN_HOURS,
  COOLDOWN_MS,
  COOLDOWN_ERROR_CODES,
  finalisePendingCooldowns,
  founderOverrideCooldown,
  readPendingCooldownForLink,
  startPrimaryGuardianRevocationCooldown,
} from "./cooldown-service";

const GUARDIAN = "11111111-1111-4111-8111-111111111111";
const CHILD = "22222222-2222-4222-8222-222222222222";
const OUTSIDER = "33333333-3333-4333-8333-333333333333";
const LINK_ID = "44444444-4444-4444-4444-444444444444";
const COOLDOWN_ID = "55555555-5555-4555-8555-555555555555";
const HQ = "77777777-7777-4777-8777-777777777777";

function linkRow(
  state: string,
  role: string = "guardian_primary",
  overrides: Record<string, unknown> = {},
) {
  return {
    link_id: LINK_ID,
    guardian_account_id: GUARDIAN,
    child_account_id: CHILD,
    role,
    state,
    initiated_by: "guardian_invite",
    initiated_at: new Date("2026-10-10T10:00:00Z"),
    confirmed_at: state === "active" ? new Date("2026-10-10T10:05:00Z") : null,
    revoked_at: null,
    revoked_by: null,
    revoked_reason: null,
    expires_at: null,
    can_see_emergency_alerts: true,
    can_see_safety_summaries: false,
    can_see_location_when_shared: false,
    simulated: true,
    created_at: new Date("2026-10-10T10:00:00Z"),
    ...overrides,
  };
}

function cooldownRow(overrides: Record<string, unknown> = {}) {
  return {
    cooldown_id: COOLDOWN_ID,
    link_id: LINK_ID,
    initiated_by_account_id: GUARDIAN,
    initiated_at: new Date("2026-10-10T12:00:00Z"),
    effective_at: new Date("2026-10-13T12:00:00Z"),
    bypass_confirmed_by_other_party: false,
    bypass_confirmed_at: null,
    founder_override: false,
    founder_override_authorised_by: null,
    state: "pending",
    cancelled_at: null,
    cancelled_by_account_id: null,
    simulated: true,
    applied_at: null,
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
// Constants
// ─────────────────────────────────────────────────────────────────────

describe("COOLDOWN constants", () => {
  it("exposes a sealed 72h window", () => {
    expect(COOLDOWN_HOURS).toBe(72);
    expect(COOLDOWN_MS).toBe(72 * 60 * 60 * 1000);
  });
});

// ─────────────────────────────────────────────────────────────────────
// startPrimaryGuardianRevocationCooldown
// ─────────────────────────────────────────────────────────────────────

describe("startPrimaryGuardianRevocationCooldown", () => {
  it("rejects empty link id", async () => {
    await expect(
      startPrimaryGuardianRevocationCooldown({
        linkId: "",
        actorAccountId: GUARDIAN,
      }),
    ).rejects.toThrow(/invalid_link_id/);
  });

  it("rejects link not found", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    await expect(
      startPrimaryGuardianRevocationCooldown({
        linkId: LINK_ID,
        actorAccountId: GUARDIAN,
      }),
    ).rejects.toThrow(/link_not_found/);
  });

  it("rejects when actor is not a party", async () => {
    withClientResponder = (sql: string) => {
      if (/FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("active")], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    await expect(
      startPrimaryGuardianRevocationCooldown({
        linkId: LINK_ID,
        actorAccountId: OUTSIDER,
      }),
    ).rejects.toThrow(/not_a_party/);
  });

  it("rejects when the link is not active", async () => {
    withClientResponder = (sql: string) => {
      if (/FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("pending")], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    await expect(
      startPrimaryGuardianRevocationCooldown({
        linkId: LINK_ID,
        actorAccountId: GUARDIAN,
      }),
    ).rejects.toThrow(/link_not_active/);
  });

  it("rejects when the link role is not guardian_primary", async () => {
    withClientResponder = (sql: string) => {
      if (/FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("active", "guardian_secondary")], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    await expect(
      startPrimaryGuardianRevocationCooldown({
        linkId: LINK_ID,
        actorAccountId: GUARDIAN,
      }),
    ).rejects.toThrow(/link_not_primary_guardian/);
  });

  it("creates a pending cooldown row with effective_at = now + 72h · LOAD-BEARING D1", async () => {
    const insertCalls: Array<{ sql: string; params: readonly unknown[] }> = [];
    const beforeMs = Date.now();
    withClientResponder = (sql: string, params) => {
      if (/FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("active")], rowCount: 1 };
      }
      if (/INSERT INTO nex\.family_link_revocation_cooldown/i.test(sql)) {
        insertCalls.push({ sql, params });
        return {
          rows: [
            cooldownRow({
              effective_at: new Date(params[2] as string),
            }),
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    };
    const result = await startPrimaryGuardianRevocationCooldown({
      linkId: LINK_ID,
      actorAccountId: GUARDIAN,
    });
    const afterMs = Date.now();
    expect(insertCalls.length).toBe(1);
    const effectiveParam = String(insertCalls[0].params[2]);
    const effectiveMs = Date.parse(effectiveParam);
    expect(effectiveMs - beforeMs).toBeGreaterThanOrEqual(COOLDOWN_MS - 10);
    expect(effectiveMs - afterMs).toBeLessThanOrEqual(COOLDOWN_MS + 10);
    expect(result.cooldown.state).toBe("pending");
    expect(result.cooldown.linkId).toBe(LINK_ID);
    expect(result.link.state).toBe("active");
  });

  it("surfaces COOLDOWN_ALREADY_PENDING on partial-unique collision", async () => {
    withClientResponder = (sql: string) => {
      if (/FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("active")], rowCount: 1 };
      }
      if (/INSERT INTO nex\.family_link_revocation_cooldown/i.test(sql)) {
        throw new Error(
          `duplicate key value violates unique constraint "family_link_revocation_cooldown_link_pending_uq"`,
        );
      }
      return { rows: [], rowCount: 0 };
    };
    await expect(
      startPrimaryGuardianRevocationCooldown({
        linkId: LINK_ID,
        actorAccountId: GUARDIAN,
      }),
    ).rejects.toThrow(/cooldown_already_pending/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// confirmCooldownBypass
// ─────────────────────────────────────────────────────────────────────

describe("confirmCooldownBypass", () => {
  it("rejects when cooldown not found", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    await expect(
      confirmCooldownBypass({
        cooldownId: COOLDOWN_ID,
        actorAccountId: CHILD,
      }),
    ).rejects.toThrow(/cooldown_not_found/);
  });

  it("rejects when the initiator tries to bypass their own cooldown", async () => {
    withClientResponder = (sql: string) => {
      if (/SELECT \* FROM nex\.family_link_revocation_cooldown/i.test(sql)) {
        return { rows: [cooldownRow()], rowCount: 1 };
      }
      if (/FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("active")], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    await expect(
      confirmCooldownBypass({
        cooldownId: COOLDOWN_ID,
        actorAccountId: GUARDIAN, // initiator per fixture
      }),
    ).rejects.toThrow(/bypass_wrong_party/);
  });

  it("rejects when cooldown already applied/cancelled", async () => {
    withClientResponder = (sql: string) => {
      if (/SELECT \* FROM nex\.family_link_revocation_cooldown/i.test(sql)) {
        return { rows: [cooldownRow({ state: "applied" })], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    await expect(
      confirmCooldownBypass({
        cooldownId: COOLDOWN_ID,
        actorAccountId: CHILD,
      }),
    ).rejects.toThrow(/cooldown_not_pending/);
  });

  it("the OTHER party CAN bypass · composes sealed revokeLink · flips cooldown→applied", async () => {
    const revokeCalls: Array<{ sql: string; params: readonly unknown[] }> = [];
    withClientResponder = (sql: string) => {
      if (/SELECT \* FROM nex\.family_link_revocation_cooldown/i.test(sql)) {
        return { rows: [cooldownRow()], rowCount: 1 };
      }
      if (/FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("active")], rowCount: 1 };
      }
      if (/UPDATE nex\.family_link\b/i.test(sql) && /revoked_reason/i.test(sql)) {
        revokeCalls.push({ sql, params: [] });
        return {
          rows: [
            linkRow("revoked", "guardian_primary", {
              revoked_at: new Date(),
              revoked_by: CHILD,
              revoked_reason: "primary_guardian_cooldown_bypass",
            }),
          ],
          rowCount: 1,
        };
      }
      if (/UPDATE nex\.family_link_revocation_cooldown/i.test(sql)) {
        return {
          rows: [
            cooldownRow({
              state: "applied",
              bypass_confirmed_by_other_party: true,
              bypass_confirmed_at: new Date(),
              applied_at: new Date(),
            }),
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    };
    const result = await confirmCooldownBypass({
      cooldownId: COOLDOWN_ID,
      actorAccountId: CHILD, // the OTHER party
    });
    expect(revokeCalls.length).toBe(1);
    expect(result.state).toBe("applied");
    expect(result.bypassConfirmedByOtherParty).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// cancelPendingCooldown
// ─────────────────────────────────────────────────────────────────────

describe("cancelPendingCooldown", () => {
  it("only the initiator may cancel their cooldown", async () => {
    withClientResponder = (sql: string) => {
      if (/SELECT \* FROM nex\.family_link_revocation_cooldown/i.test(sql)) {
        return { rows: [cooldownRow()], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    await expect(
      cancelPendingCooldown({
        cooldownId: COOLDOWN_ID,
        actorAccountId: CHILD, // not the initiator
      }),
    ).rejects.toThrow(/bypass_wrong_party/);
  });

  it("flips state to cancelled when the initiator calls", async () => {
    withClientResponder = (sql: string) => {
      if (/SELECT \* FROM nex\.family_link_revocation_cooldown/i.test(sql)) {
        return { rows: [cooldownRow()], rowCount: 1 };
      }
      if (/UPDATE nex\.family_link_revocation_cooldown/i.test(sql)) {
        return {
          rows: [
            cooldownRow({
              state: "cancelled",
              cancelled_at: new Date(),
              cancelled_by_account_id: GUARDIAN,
            }),
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    };
    const result = await cancelPendingCooldown({
      cooldownId: COOLDOWN_ID,
      actorAccountId: GUARDIAN,
    });
    expect(result.state).toBe("cancelled");
  });
});

// ─────────────────────────────────────────────────────────────────────
// readPendingCooldownForLink
// ─────────────────────────────────────────────────────────────────────

describe("readPendingCooldownForLink", () => {
  it("returns null when no pending cooldown exists", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const row = await readPendingCooldownForLink(LINK_ID);
    expect(row).toBeNull();
  });

  it("returns the pending row when present", async () => {
    withClientResponder = (sql: string) => {
      if (/state = 'pending'/i.test(sql)) {
        return { rows: [cooldownRow()], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    const row = await readPendingCooldownForLink(LINK_ID);
    expect(row?.cooldownId).toBe(COOLDOWN_ID);
  });

  it("degrades to null when pool is unavailable", async () => {
    withClientUnavailable = true;
    const row = await readPendingCooldownForLink(LINK_ID);
    expect(row).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
// finalisePendingCooldowns · sweep contract (documented)
// ─────────────────────────────────────────────────────────────────────

describe("finalisePendingCooldowns", () => {
  it("returns [] when nothing is ripe", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const finalised = await finalisePendingCooldowns();
    expect(finalised).toEqual([]);
  });

  it("flips ripe pending rows to applied and composes sealed revokeLink", async () => {
    let flipped = false;
    let revokedLink = false;
    withClientResponder = (sql: string) => {
      if (
        /SELECT \* FROM nex\.family_link_revocation_cooldown[\s\S]*state = 'pending'/i.test(
          sql,
        )
      ) {
        return {
          rows: [
            cooldownRow({
              effective_at: new Date("2020-01-01T00:00:00Z"), // ripe
            }),
          ],
          rowCount: 1,
        };
      }
      if (/FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("active")], rowCount: 1 };
      }
      if (/UPDATE nex\.family_link\b/i.test(sql) && /revoked_reason/i.test(sql)) {
        revokedLink = true;
        return {
          rows: [
            linkRow("revoked", "guardian_primary", {
              revoked_at: new Date(),
              revoked_by: GUARDIAN,
              revoked_reason: "primary_guardian_cooldown_expired",
            }),
          ],
          rowCount: 1,
        };
      }
      if (/UPDATE nex\.family_link_revocation_cooldown/i.test(sql)) {
        flipped = true;
        return {
          rows: [
            cooldownRow({ state: "applied", applied_at: new Date() }),
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    };
    const finalised = await finalisePendingCooldowns();
    expect(finalised.length).toBe(1);
    expect(finalised[0].state).toBe("applied");
    expect(flipped).toBe(true);
    expect(revokedLink).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// founderOverrideCooldown · reserved HQ Tier-C
// ─────────────────────────────────────────────────────────────────────

describe("founderOverrideCooldown", () => {
  it("stamps founder_override + applies revoke + flips cooldown", async () => {
    let revokedLink = false;
    withClientResponder = (sql: string) => {
      if (/SELECT \* FROM nex\.family_link_revocation_cooldown/i.test(sql)) {
        return { rows: [cooldownRow()], rowCount: 1 };
      }
      if (/FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("active")], rowCount: 1 };
      }
      if (/UPDATE nex\.family_link\b/i.test(sql) && /revoked_reason/i.test(sql)) {
        revokedLink = true;
        return {
          rows: [
            linkRow("revoked", "guardian_primary", {
              revoked_at: new Date(),
              revoked_by: GUARDIAN, // initiator per sealed revoke contract
              revoked_reason: "primary_guardian_founder_override",
            }),
          ],
          rowCount: 1,
        };
      }
      if (/UPDATE nex\.family_link_revocation_cooldown/i.test(sql)) {
        return {
          rows: [
            cooldownRow({
              state: "applied",
              founder_override: true,
              founder_override_authorised_by: HQ,
              applied_at: new Date(),
            }),
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    };
    const result = await founderOverrideCooldown({
      cooldownId: COOLDOWN_ID,
      authorisedByAccountId: HQ,
    });
    expect(revokedLink).toBe(true);
    expect(result.founderOverride).toBe(true);
    // Audit trail: cooldown row carries the authoriser (HQ); link row
    // carries the initiator as actor (sealed revokeLink contract).
    expect(result.founderOverrideAuthorisedBy).toBe(HQ);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Error codes stability
// ─────────────────────────────────────────────────────────────────────

describe("COOLDOWN_ERROR_CODES", () => {
  it("exposes stable codes", () => {
    expect(COOLDOWN_ERROR_CODES.LINK_NOT_FOUND).toMatch(/link_not_found/);
    expect(COOLDOWN_ERROR_CODES.COOLDOWN_ALREADY_PENDING).toMatch(
      /already_pending/,
    );
    expect(COOLDOWN_ERROR_CODES.BYPASS_WRONG_PARTY).toMatch(/bypass_wrong_party/);
  });
});
