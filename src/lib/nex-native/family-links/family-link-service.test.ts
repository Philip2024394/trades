// src/lib/nex-native/family-links/family-link-service.test.ts
//
// Unit tests for NEX Family Links Phase 1 · family_link lifecycle
// service. Mocks @/lib/nex/db · never touches a real database.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────
// Mock the shared pg pool.
// ─────────────────────────────────────────────────────────────────────

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

// Import AFTER mocks.
import {
  initiateLink,
  confirmLink,
  revokeLink,
  getLinkById,
  listLinksForGuardian,
  listLinksForChild,
  updateLinkPermissions,
} from "./family-link-service";
import { FAMILY_LINK_ERROR_CODES } from "./types";

// ─────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────

const GUARDIAN = "11111111-1111-4111-8111-111111111111";
const CHILD = "22222222-2222-4222-8222-222222222222";
const OUTSIDER = "33333333-3333-4333-8333-333333333333";
const LINK_ID = "44444444-4444-4444-4444-444444444444";
const OTHER_LINK_ID = "55555555-5555-4555-8555-555555555555";

function pendingRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    link_id: LINK_ID,
    guardian_account_id: GUARDIAN,
    child_account_id: CHILD,
    role: "guardian_primary",
    state: "pending",
    initiated_by: "guardian_invite",
    initiated_at: new Date("2026-10-10T10:00:00Z"),
    confirmed_at: null,
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

function activeRow(overrides: Record<string, unknown> = {}) {
  return pendingRow({ state: "active", confirmed_at: new Date("2026-10-10T10:05:00Z"), ...overrides });
}

function revokedRow(overrides: Record<string, unknown> = {}) {
  return pendingRow({
    state: "revoked",
    revoked_at: new Date("2026-10-10T11:00:00Z"),
    revoked_by: GUARDIAN,
    ...overrides,
  });
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
// initiateLink · argument guards + authorization
// ─────────────────────────────────────────────────────────────────────

describe("initiateLink · argument + authorization guards", () => {
  it("rejects empty guardian id", async () => {
    await expect(
      initiateLink({
        guardianAccountId: "",
        childAccountId: CHILD,
        role: "guardian_primary",
        initiatedBy: "guardian_invite",
        actorAccountId: GUARDIAN,
      }),
    ).rejects.toThrow(/invalid_guardian_account_id/);
  });

  it("rejects empty child id", async () => {
    await expect(
      initiateLink({
        guardianAccountId: GUARDIAN,
        childAccountId: "",
        role: "guardian_primary",
        initiatedBy: "guardian_invite",
        actorAccountId: GUARDIAN,
      }),
    ).rejects.toThrow(/invalid_child_account_id/);
  });

  it("rejects invalid role", async () => {
    await expect(
      initiateLink({
        guardianAccountId: GUARDIAN,
        childAccountId: CHILD,
        // @ts-expect-error · deliberately wrong
        role: "nope",
        initiatedBy: "guardian_invite",
        actorAccountId: GUARDIAN,
      }),
    ).rejects.toThrow(FAMILY_LINK_ERROR_CODES.INVALID_ROLE);
  });

  it("rejects invalid initiatedBy", async () => {
    await expect(
      initiateLink({
        guardianAccountId: GUARDIAN,
        childAccountId: CHILD,
        role: "guardian_primary",
        // @ts-expect-error · deliberately wrong
        initiatedBy: "nope",
        actorAccountId: GUARDIAN,
      }),
    ).rejects.toThrow(FAMILY_LINK_ERROR_CODES.INVALID_INITIATED_BY);
  });

  it("rejects guardian == child", async () => {
    await expect(
      initiateLink({
        guardianAccountId: GUARDIAN,
        childAccountId: GUARDIAN,
        role: "guardian_primary",
        initiatedBy: "guardian_invite",
        actorAccountId: GUARDIAN,
      }),
    ).rejects.toThrow(FAMILY_LINK_ERROR_CODES.SELF_LINK);
  });

  it("rejects guardian_invite from a non-guardian actor", async () => {
    await expect(
      initiateLink({
        guardianAccountId: GUARDIAN,
        childAccountId: CHILD,
        role: "guardian_primary",
        initiatedBy: "guardian_invite",
        actorAccountId: OUTSIDER,
      }),
    ).rejects.toThrow(FAMILY_LINK_ERROR_CODES.UNAUTHORIZED_ACTOR);
  });

  it("rejects child_invite from a non-child actor", async () => {
    await expect(
      initiateLink({
        guardianAccountId: GUARDIAN,
        childAccountId: CHILD,
        role: "guardian_primary",
        initiatedBy: "child_invite",
        actorAccountId: GUARDIAN, // guardian can't pretend to be the child
      }),
    ).rejects.toThrow(FAMILY_LINK_ERROR_CODES.UNAUTHORIZED_ACTOR);
  });

  it("rejects system_setup from a non-guardian actor", async () => {
    await expect(
      initiateLink({
        guardianAccountId: GUARDIAN,
        childAccountId: CHILD,
        role: "guardian_primary",
        initiatedBy: "system_setup",
        actorAccountId: CHILD,
      }),
    ).rejects.toThrow(FAMILY_LINK_ERROR_CODES.UNAUTHORIZED_ACTOR);
  });
});

// ─────────────────────────────────────────────────────────────────────
// initiateLink · happy path + primary-guardian uniqueness
// ─────────────────────────────────────────────────────────────────────

describe("initiateLink · happy path + uniqueness", () => {
  it("creates a pending link with simulated=TRUE and permission defaults", async () => {
    withClientResponder = (sql) => {
      if (/^SELECT 1 FROM nex\.family_link/i.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      if (/^INSERT INTO nex\.family_link/i.test(sql)) {
        return { rows: [pendingRow()], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };

    const row = await initiateLink({
      guardianAccountId: GUARDIAN,
      childAccountId: CHILD,
      role: "guardian_primary",
      initiatedBy: "guardian_invite",
      actorAccountId: GUARDIAN,
    });

    expect(row.state).toBe("pending");
    expect(row.role).toBe("guardian_primary");
    expect(row.simulated).toBe(true);
    expect(row.canSeeEmergencyAlerts).toBe(true);
    expect(row.canSeeSafetySummaries).toBe(false);
    expect(row.canSeeLocationWhenShared).toBe(false);

    const insert = withClientCalls.find((c) => /INSERT INTO nex\.family_link/i.test(c.sql));
    expect(insert).toBeDefined();
    // Ensure the INSERT hard-codes simulated=TRUE (not parameterised).
    expect(insert!.sql).toMatch(/TRUE\s*\)/i);
    // Ensure permission flags are NOT in the INSERT column list.
    expect(insert!.sql).not.toMatch(/can_see_safety_summaries/i);
    expect(insert!.sql).not.toMatch(/can_see_location_when_shared/i);
  });

  it("rejects when a primary guardian already exists for the child", async () => {
    withClientResponder = (sql) => {
      if (/^SELECT 1 FROM nex\.family_link/i.test(sql)) {
        return { rows: [{ "?column?": 1 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    await expect(
      initiateLink({
        guardianAccountId: GUARDIAN,
        childAccountId: CHILD,
        role: "guardian_primary",
        initiatedBy: "guardian_invite",
        actorAccountId: GUARDIAN,
      }),
    ).rejects.toThrow(FAMILY_LINK_ERROR_CODES.PRIMARY_GUARDIAN_ALREADY_EXISTS);
  });

  it("does NOT pre-check uniqueness for non-primary roles", async () => {
    let preCheckRan = false;
    withClientResponder = (sql) => {
      if (/^SELECT 1 FROM nex\.family_link/i.test(sql)) {
        preCheckRan = true;
        return { rows: [], rowCount: 0 };
      }
      if (/^INSERT INTO nex\.family_link/i.test(sql)) {
        return { rows: [pendingRow({ role: "guardian_secondary" })], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    const row = await initiateLink({
      guardianAccountId: GUARDIAN,
      childAccountId: CHILD,
      role: "guardian_secondary",
      initiatedBy: "guardian_invite",
      actorAccountId: GUARDIAN,
    });
    expect(row.role).toBe("guardian_secondary");
    expect(preCheckRan).toBe(false);
  });

  it("throws DB_UNAVAILABLE when pool is unavailable", async () => {
    withClientUnavailable = true;
    await expect(
      initiateLink({
        guardianAccountId: GUARDIAN,
        childAccountId: CHILD,
        role: "guardian_primary",
        initiatedBy: "guardian_invite",
        actorAccountId: GUARDIAN,
      }),
    ).rejects.toThrow(FAMILY_LINK_ERROR_CODES.DB_UNAVAILABLE);
  });
});

// ─────────────────────────────────────────────────────────────────────
// confirmLink
// ─────────────────────────────────────────────────────────────────────

describe("confirmLink", () => {
  it("confirms a guardian_invite when the child confirms", async () => {
    withClientResponder = (sql) => {
      if (/^SELECT \* FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [pendingRow()], rowCount: 1 };
      }
      if (/^SELECT 1 FROM nex\.family_link/i.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      if (/^UPDATE nex\.family_link/i.test(sql)) {
        return { rows: [activeRow()], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };

    const row = await confirmLink({ linkId: LINK_ID, actorAccountId: CHILD });
    expect(row.state).toBe("active");
    expect(row.confirmedAt).not.toBeNull();
  });

  it("rejects confirmation by the SAME party that invited", async () => {
    withClientResponder = (sql) => {
      if (/^SELECT \* FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [pendingRow()], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    await expect(
      confirmLink({ linkId: LINK_ID, actorAccountId: GUARDIAN }),
    ).rejects.toThrow(FAMILY_LINK_ERROR_CODES.WRONG_CONFIRMING_PARTY);
  });

  it("rejects confirmation by an outsider", async () => {
    withClientResponder = (sql) => {
      if (/^SELECT \* FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [pendingRow()], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    await expect(
      confirmLink({ linkId: LINK_ID, actorAccountId: OUTSIDER }),
    ).rejects.toThrow(FAMILY_LINK_ERROR_CODES.WRONG_CONFIRMING_PARTY);
  });

  it("confirms a child_invite when the guardian confirms", async () => {
    withClientResponder = (sql) => {
      if (/^SELECT \* FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return {
          rows: [pendingRow({ initiated_by: "child_invite" })],
          rowCount: 1,
        };
      }
      if (/^SELECT 1 FROM nex\.family_link/i.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      if (/^UPDATE nex\.family_link/i.test(sql)) {
        return { rows: [activeRow({ initiated_by: "child_invite" })], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    const row = await confirmLink({ linkId: LINK_ID, actorAccountId: GUARDIAN });
    expect(row.state).toBe("active");
  });

  it("rejects when link not found", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    await expect(
      confirmLink({ linkId: LINK_ID, actorAccountId: CHILD }),
    ).rejects.toThrow(FAMILY_LINK_ERROR_CODES.LINK_NOT_FOUND);
  });

  it("rejects when already confirmed", async () => {
    withClientResponder = (sql) => {
      if (/^SELECT \* FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [activeRow()], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    await expect(
      confirmLink({ linkId: LINK_ID, actorAccountId: CHILD }),
    ).rejects.toThrow(FAMILY_LINK_ERROR_CODES.ALREADY_CONFIRMED);
  });

  it("rejects when primary-guardian uniqueness was violated between pending and confirm", async () => {
    withClientResponder = (sql) => {
      if (/^SELECT \* FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [pendingRow()], rowCount: 1 };
      }
      if (/^SELECT 1 FROM nex\.family_link/i.test(sql)) {
        return { rows: [{ "?column?": 1 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    await expect(
      confirmLink({ linkId: LINK_ID, actorAccountId: CHILD }),
    ).rejects.toThrow(FAMILY_LINK_ERROR_CODES.PRIMARY_GUARDIAN_ALREADY_EXISTS);
  });
});

// ─────────────────────────────────────────────────────────────────────
// revokeLink · including revoke-then-re-invite
// ─────────────────────────────────────────────────────────────────────

describe("revokeLink", () => {
  it("allows the guardian to revoke", async () => {
    withClientResponder = (sql) => {
      if (/^SELECT \* FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [activeRow()], rowCount: 1 };
      }
      if (/^UPDATE nex\.family_link/i.test(sql)) {
        return { rows: [revokedRow()], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    const row = await revokeLink({
      linkId: LINK_ID,
      actorAccountId: GUARDIAN,
      reason: "parent asked to disconnect",
    });
    expect(row.state).toBe("revoked");
    expect(row.revokedBy).toBe(GUARDIAN);
  });

  it("allows the child to revoke", async () => {
    withClientResponder = (sql) => {
      if (/^SELECT \* FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [activeRow()], rowCount: 1 };
      }
      if (/^UPDATE nex\.family_link/i.test(sql)) {
        return { rows: [revokedRow({ revoked_by: CHILD })], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    const row = await revokeLink({ linkId: LINK_ID, actorAccountId: CHILD });
    expect(row.state).toBe("revoked");
  });

  it("rejects revoke by an outsider", async () => {
    withClientResponder = (sql) => {
      if (/^SELECT \* FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [activeRow()], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    await expect(
      revokeLink({ linkId: LINK_ID, actorAccountId: OUTSIDER }),
    ).rejects.toThrow(FAMILY_LINK_ERROR_CODES.UNAUTHORIZED_ACTOR);
  });

  it("rejects revoke on an already-revoked link", async () => {
    withClientResponder = (sql) => {
      if (/^SELECT \* FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [revokedRow()], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    await expect(
      revokeLink({ linkId: LINK_ID, actorAccountId: GUARDIAN }),
    ).rejects.toThrow(FAMILY_LINK_ERROR_CODES.ALREADY_REVOKED);
  });

  it("rejects over-long revoke reason", async () => {
    await expect(
      revokeLink({
        linkId: LINK_ID,
        actorAccountId: GUARDIAN,
        reason: "x".repeat(201),
      }),
    ).rejects.toThrow(FAMILY_LINK_ERROR_CODES.INVALID_REVOKE_REASON);
  });

  it("allows re-initiating a NEW link after revocation (append-only history)", async () => {
    // Simulate: revoked row exists for pair · fresh initiate must succeed.
    withClientResponder = (sql) => {
      if (/^SELECT 1 FROM nex\.family_link/i.test(sql)) {
        // Only queries for ACTIVE primary guardians. The revoked row
        // does not satisfy state='active'; so the pre-check returns 0.
        return { rows: [], rowCount: 0 };
      }
      if (/^INSERT INTO nex\.family_link/i.test(sql)) {
        return {
          rows: [pendingRow({ link_id: OTHER_LINK_ID })],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    };
    const row = await initiateLink({
      guardianAccountId: GUARDIAN,
      childAccountId: CHILD,
      role: "guardian_primary",
      initiatedBy: "guardian_invite",
      actorAccountId: GUARDIAN,
    });
    expect(row.linkId).toBe(OTHER_LINK_ID);
    expect(row.state).toBe("pending");
  });
});

// ─────────────────────────────────────────────────────────────────────
// Readers
// ─────────────────────────────────────────────────────────────────────

describe("readers", () => {
  it("getLinkById returns the mapped row", async () => {
    withClientResponder = (sql) => {
      if (/^SELECT \* FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [activeRow()], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    const row = await getLinkById(LINK_ID);
    expect(row?.linkId).toBe(LINK_ID);
    expect(row?.state).toBe("active");
  });

  it("getLinkById returns null when not found", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const row = await getLinkById(LINK_ID);
    expect(row).toBeNull();
  });

  it("listLinksForGuardian returns rows in reverse-chronological order", async () => {
    withClientResponder = (sql) => {
      if (/ORDER BY initiated_at DESC/i.test(sql)) {
        return {
          rows: [
            activeRow(),
            pendingRow({ link_id: OTHER_LINK_ID }),
          ],
          rowCount: 2,
        };
      }
      return { rows: [], rowCount: 0 };
    };
    const rows = await listLinksForGuardian(GUARDIAN);
    expect(rows).toHaveLength(2);
    expect(rows[0].linkId).toBe(LINK_ID);
    expect(rows[1].linkId).toBe(OTHER_LINK_ID);
  });

  it("listLinksForChild returns [] when pool unavailable", async () => {
    withClientUnavailable = true;
    const rows = await listLinksForChild(CHILD);
    expect(rows).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Phase 1 permission-flag lock
// ─────────────────────────────────────────────────────────────────────

describe("Phase 1 permission-flag lock", () => {
  it("updateLinkPermissions always rejects in Phase 1", async () => {
    await expect(updateLinkPermissions()).rejects.toThrow(
      FAMILY_LINK_ERROR_CODES.PERMISSION_FLAGS_LOCKED,
    );
  });
});
