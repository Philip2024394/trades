// src/lib/nex-native/family-links/_server-actions.test.ts
//
// Unit tests for the Family Links Server Actions · the session gate
// is the load-bearing invariant proved here (the actor is derived
// from the authenticated session · the client never claims identity).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the session resolver so we can inject the authenticated actor.
let currentSessionAccountId: string | null = null;
vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: async () => {
    if (!currentSessionAccountId) return null;
    return {
      supabaseUserId: "sb-" + currentSessionAccountId,
      email: `${currentSessionAccountId}@example.com`,
      account: { id: currentSessionAccountId },
    };
  },
}));

// Mock the DB layer.
type QueryResponder = (
  sql: string,
  params: readonly unknown[],
) => { rows: Record<string, unknown>[]; rowCount: number };

let withClientCalls: Array<{ sql: string; params: readonly unknown[] }>;
let withClientResponder: QueryResponder | null;

vi.mock("@/lib/nex/db", () => ({
  withClient: async <T>(fn: (c: unknown) => Promise<T>): Promise<T | null> => {
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

// Mock the WebAuthn storage service.
let webAuthnCreds: unknown[] = [];
vi.mock("../webauthn-service", () => ({
  listCredentialsForAccount: async () => webAuthnCreds,
}));

import {
  cancelCooldownAction,
  confirmCooldownBypassAction,
  confirmInvitationAction,
  createInvitationAction,
  issuePressureSignalAction,
  readInviterWebAuthnState,
  readLinkWithCooldown,
  revokeInvitationAction,
} from "./_server-actions";

const GUARDIAN = "11111111-1111-4111-8111-111111111111";
const CHILD = "22222222-2222-4222-8222-222222222222";
const LINK_ID = "44444444-4444-4444-4444-444444444444";
const COOLDOWN_ID = "55555555-5555-4555-8555-555555555555";

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
    initiated_at: new Date(),
    effective_at: new Date(Date.now() + 72 * 60 * 60 * 1000),
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
  currentSessionAccountId = null;
  webAuthnCreds = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────
// Session gate · every action requires a session
// ─────────────────────────────────────────────────────────────────────

describe("Server Actions · session gate", () => {
  it("createInvitationAction rejects without a session", async () => {
    currentSessionAccountId = null;
    const r = await createInvitationAction({
      otherPartyAccountId: CHILD,
      role: "guardian_primary",
      initiatedBy: "guardian_invite",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_session");
  });

  it("confirmInvitationAction rejects without a session", async () => {
    currentSessionAccountId = null;
    const r = await confirmInvitationAction({ linkId: LINK_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_session");
  });

  it("revokeInvitationAction rejects without a session", async () => {
    currentSessionAccountId = null;
    const r = await revokeInvitationAction({ linkId: LINK_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_session");
  });

  it("issuePressureSignalAction rejects without a session", async () => {
    currentSessionAccountId = null;
    const r = await issuePressureSignalAction({
      linkId: LINK_ID,
      reasonCode: "coerced",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_session");
  });

  it("confirmCooldownBypassAction rejects without a session", async () => {
    currentSessionAccountId = null;
    const r = await confirmCooldownBypassAction({ cooldownId: COOLDOWN_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_session");
  });

  it("cancelCooldownAction rejects without a session", async () => {
    currentSessionAccountId = null;
    const r = await cancelCooldownAction({ cooldownId: COOLDOWN_ID });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_session");
  });

  it("readLinkWithCooldown rejects without a session", async () => {
    currentSessionAccountId = null;
    const r = await readLinkWithCooldown(LINK_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_session");
  });

  it("readInviterWebAuthnState rejects without a session", async () => {
    currentSessionAccountId = null;
    const r = await readInviterWebAuthnState();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_session");
  });
});

// ─────────────────────────────────────────────────────────────────────
// Identity derivation · the client never claims to be someone else
// ─────────────────────────────────────────────────────────────────────

describe("createInvitationAction · identity derivation", () => {
  it("binds the actor to the authenticated session, not a client arg", async () => {
    currentSessionAccountId = GUARDIAN;
    webAuthnCreds = [{ id: "c1" }];
    withClientResponder = (sql: string, params) => {
      if (/INSERT INTO nex\.family_link/i.test(sql)) {
        // Verify params[0] (guardian_account_id) equals the session
        // actor, not something the client supplied.
        expect(params[0]).toBe(GUARDIAN);
        return { rows: [linkRow("pending")], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    const r = await createInvitationAction({
      otherPartyAccountId: CHILD,
      role: "guardian_secondary",
      initiatedBy: "guardian_invite",
    });
    expect(r.ok).toBe(true);
  });

  it("blocks when inviter has no WebAuthn credential · LOAD-BEARING", async () => {
    currentSessionAccountId = GUARDIAN;
    webAuthnCreds = []; // none
    const r = await createInvitationAction({
      otherPartyAccountId: CHILD,
      role: "guardian_secondary",
      initiatedBy: "guardian_invite",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("webauthn_required");
    // No DB write happened.
    expect(withClientCalls.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Read actions
// ─────────────────────────────────────────────────────────────────────

describe("readLinkWithCooldown", () => {
  it("returns link + null cooldown when none pending", async () => {
    currentSessionAccountId = GUARDIAN;
    withClientResponder = (sql: string) => {
      if (/FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("active")], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    const r = await readLinkWithCooldown(LINK_ID);
    expect("ok" in r && r.ok === false).toBe(false);
    if ("link" in r) {
      expect(r.link?.linkId).toBe(LINK_ID);
      expect(r.cooldown).toBeNull();
    }
  });

  it("returns link + cooldown when pending", async () => {
    currentSessionAccountId = GUARDIAN;
    withClientResponder = (sql: string) => {
      if (/FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("active")], rowCount: 1 };
      }
      if (/state = 'pending'/i.test(sql)) {
        return { rows: [cooldownRow()], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    const r = await readLinkWithCooldown(LINK_ID);
    if ("link" in r) {
      expect(r.link?.linkId).toBe(LINK_ID);
      expect(r.cooldown?.cooldownId).toBe(COOLDOWN_ID);
    }
  });
});

describe("readInviterWebAuthnState", () => {
  it("reports hasWebAuthn=true when the inviter has at least one credential", async () => {
    currentSessionAccountId = GUARDIAN;
    webAuthnCreds = [{ id: "c1" }];
    const r = await readInviterWebAuthnState();
    expect("hasWebAuthn" in r && r.hasWebAuthn).toBe(true);
  });

  it("reports hasWebAuthn=false when the inviter has none", async () => {
    currentSessionAccountId = GUARDIAN;
    webAuthnCreds = [];
    const r = await readInviterWebAuthnState();
    expect("hasWebAuthn" in r && !r.hasWebAuthn).toBe(true);
  });
});
