// src/lib/nex-native/family-links/invite-service.test.ts
//
// Unit tests for FS-2 invite-service · the WebAuthn gate is the
// load-bearing invariant proved here.

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

// Mock the sealed WebAuthn storage service to drive the gate state.
let webAuthnCreds: unknown[] = [];
let webAuthnShouldThrow = false;
vi.mock("../webauthn-service", () => ({
  listCredentialsForAccount: async () => {
    if (webAuthnShouldThrow) throw new Error("boom");
    return webAuthnCreds;
  },
}));

import {
  confirmInvitationFromRecipient,
  createInvitationWithWebAuthnGate,
  inviterHasWebAuthnCredential,
  revokePrimaryGuardianWithCooldown,
} from "./invite-service";

const GUARDIAN = "11111111-1111-4111-8111-111111111111";
const CHILD = "22222222-2222-4222-8222-222222222222";
const OUTSIDER = "33333333-3333-4333-8333-333333333333";
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
  withClientUnavailable = false;
  webAuthnCreds = [];
  webAuthnShouldThrow = false;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────
// LOAD-BEARING INVARIANT #1 · WebAuthn gate (D3 · 3A)
// ─────────────────────────────────────────────────────────────────────

describe("inviterHasWebAuthnCredential · gate", () => {
  it("returns true when at least one credential exists", async () => {
    webAuthnCreds = [{ id: "c1" }];
    expect(await inviterHasWebAuthnCredential(GUARDIAN)).toBe(true);
  });

  it("returns false when no credentials exist", async () => {
    webAuthnCreds = [];
    expect(await inviterHasWebAuthnCredential(GUARDIAN)).toBe(false);
  });

  it("fail-closed: returns false when the underlying read throws", async () => {
    webAuthnShouldThrow = true;
    expect(await inviterHasWebAuthnCredential(GUARDIAN)).toBe(false);
  });

  it("returns false for an empty account id", async () => {
    expect(await inviterHasWebAuthnCredential("")).toBe(false);
  });
});

describe("createInvitationWithWebAuthnGate · blocks without WebAuthn", () => {
  it("returns {ok:false, reason:'webauthn_required'} when inviter has no credential · LOAD-BEARING", async () => {
    webAuthnCreds = [];
    const r = await createInvitationWithWebAuthnGate({
      guardianAccountId: GUARDIAN,
      childAccountId: CHILD,
      role: "guardian_primary",
      initiatedBy: "guardian_invite",
      actorAccountId: GUARDIAN,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("webauthn_required");
    // The DB layer must NOT have been touched in the blocked path.
    expect(withClientCalls.length).toBe(0);
  });

  it("proceeds when inviter has a credential", async () => {
    webAuthnCreds = [{ id: "c1" }];
    withClientResponder = (sql: string) => {
      if (/INSERT INTO nex\.family_link/i.test(sql)) {
        return { rows: [linkRow("pending")], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    const r = await createInvitationWithWebAuthnGate({
      guardianAccountId: GUARDIAN,
      childAccountId: CHILD,
      role: "guardian_secondary",
      initiatedBy: "guardian_invite",
      actorAccountId: GUARDIAN,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.link.linkId).toBe(LINK_ID);
  });

  it("surfaces PRIMARY_GUARDIAN_ALREADY_EXISTS cleanly", async () => {
    webAuthnCreds = [{ id: "c1" }];
    withClientResponder = (sql: string) => {
      if (/SELECT 1 FROM nex\.family_link[\s\S]*guardian_primary[\s\S]*active/i.test(sql)) {
        return { rows: [{ "?column?": 1 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    const r = await createInvitationWithWebAuthnGate({
      guardianAccountId: GUARDIAN,
      childAccountId: CHILD,
      role: "guardian_primary",
      initiatedBy: "guardian_invite",
      actorAccountId: GUARDIAN,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("primary_guardian_already_exists");
  });

  it("surfaces SELF_LINK cleanly", async () => {
    webAuthnCreds = [{ id: "c1" }];
    const r = await createInvitationWithWebAuthnGate({
      guardianAccountId: GUARDIAN,
      childAccountId: GUARDIAN,
      role: "guardian_primary",
      initiatedBy: "guardian_invite",
      actorAccountId: GUARDIAN,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("self_link_forbidden");
  });

  it("surfaces UNAUTHORIZED_ACTOR cleanly", async () => {
    webAuthnCreds = [{ id: "c1" }];
    const r = await createInvitationWithWebAuthnGate({
      guardianAccountId: GUARDIAN,
      childAccountId: CHILD,
      role: "guardian_primary",
      initiatedBy: "guardian_invite",
      actorAccountId: OUTSIDER,
    });
    expect(r.ok).toBe(false);
    // Note: we checked the inviter's webauthn creds against the inviter
    // (guardian for guardian_invite). The actor mismatch is caught by
    // the sealed service after the gate passes.
    if (!r.ok) expect(r.reason).toBe("unauthorized_actor");
  });
});

// ─────────────────────────────────────────────────────────────────────
// confirmInvitationFromRecipient
// ─────────────────────────────────────────────────────────────────────

describe("confirmInvitationFromRecipient", () => {
  it("confirms when the child accepts a guardian_invite", async () => {
    withClientResponder = (sql: string) => {
      if (/SELECT \* FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("pending")], rowCount: 1 };
      }
      if (/UPDATE nex\.family_link[\s\S]*state\s*=\s*'active'/i.test(sql)) {
        return {
          rows: [
            linkRow("active", "guardian_primary", {
              confirmed_at: new Date(),
            }),
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    };
    const r = await confirmInvitationFromRecipient({
      linkId: LINK_ID,
      actorAccountId: CHILD,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.link.state).toBe("active");
  });

  it("returns wrong_confirming_party when the guardian tries to confirm their own invite", async () => {
    withClientResponder = (sql: string) => {
      if (/SELECT \* FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("pending")], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    const r = await confirmInvitationFromRecipient({
      linkId: LINK_ID,
      actorAccountId: GUARDIAN,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("wrong_confirming_party");
  });

  it("returns link_not_found when the link is missing", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const r = await confirmInvitationFromRecipient({
      linkId: LINK_ID,
      actorAccountId: CHILD,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("link_not_found");
  });
});

// ─────────────────────────────────────────────────────────────────────
// revokePrimaryGuardianWithCooldown · routing
// ─────────────────────────────────────────────────────────────────────

describe("revokePrimaryGuardianWithCooldown · routing", () => {
  it("active guardian_primary → opens cooldown (no immediate revoke) · LOAD-BEARING D1", async () => {
    let revokeCalled = false;
    let cooldownInserted = false;
    withClientResponder = (sql: string) => {
      if (/SELECT \* FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("active", "guardian_primary")], rowCount: 1 };
      }
      if (/INSERT INTO nex\.family_link_revocation_cooldown/i.test(sql)) {
        cooldownInserted = true;
        return { rows: [cooldownRow()], rowCount: 1 };
      }
      if (/UPDATE nex\.family_link\b/i.test(sql) && /revoked_reason/i.test(sql)) {
        revokeCalled = true;
        return { rows: [linkRow("revoked")], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    const r = await revokePrimaryGuardianWithCooldown({
      linkId: LINK_ID,
      actorAccountId: GUARDIAN,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.kind).toBe("cooldown_started");
      if (r.kind === "cooldown_started") {
        expect(r.cooldown.linkId).toBe(LINK_ID);
      }
    }
    expect(cooldownInserted).toBe(true);
    expect(revokeCalled).toBe(false);
  });

  it("pending link → sealed revokeLink immediately (no cooldown)", async () => {
    let revokeCalled = false;
    let cooldownInserted = false;
    withClientResponder = (sql: string) => {
      if (/SELECT \* FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("pending", "guardian_primary")], rowCount: 1 };
      }
      if (/INSERT INTO nex\.family_link_revocation_cooldown/i.test(sql)) {
        cooldownInserted = true;
        return { rows: [cooldownRow()], rowCount: 1 };
      }
      if (/UPDATE nex\.family_link\b/i.test(sql) && /revoked_reason/i.test(sql)) {
        revokeCalled = true;
        return {
          rows: [
            linkRow("revoked", "guardian_primary", {
              revoked_at: new Date(),
              revoked_by: GUARDIAN,
            }),
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    };
    const r = await revokePrimaryGuardianWithCooldown({
      linkId: LINK_ID,
      actorAccountId: GUARDIAN,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.kind).toBe("immediate_revoke");
    expect(cooldownInserted).toBe(false);
    expect(revokeCalled).toBe(true);
  });

  it("active guardian_secondary → sealed revokeLink immediately", async () => {
    let revokeCalled = false;
    withClientResponder = (sql: string) => {
      if (/SELECT \* FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return {
          rows: [linkRow("active", "guardian_secondary")],
          rowCount: 1,
        };
      }
      if (/UPDATE nex\.family_link\b/i.test(sql) && /revoked_reason/i.test(sql)) {
        revokeCalled = true;
        return {
          rows: [
            linkRow("revoked", "guardian_secondary", {
              revoked_at: new Date(),
              revoked_by: GUARDIAN,
            }),
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    };
    const r = await revokePrimaryGuardianWithCooldown({
      linkId: LINK_ID,
      actorAccountId: GUARDIAN,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.kind).toBe("immediate_revoke");
    expect(revokeCalled).toBe(true);
  });

  it("link not found → {ok:false, reason:'link_not_found'}", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const r = await revokePrimaryGuardianWithCooldown({
      linkId: LINK_ID,
      actorAccountId: GUARDIAN,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("link_not_found");
  });

  it("outsider actor → {ok:false, reason:'unauthorized_actor'}", async () => {
    withClientResponder = (sql: string) => {
      if (/SELECT \* FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("active")], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    const r = await revokePrimaryGuardianWithCooldown({
      linkId: LINK_ID,
      actorAccountId: OUTSIDER,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unauthorized_actor");
  });

  it("duplicate cooldown → {ok:false, reason:'cooldown_already_pending'}", async () => {
    withClientResponder = (sql: string) => {
      if (/SELECT \* FROM nex\.family_link WHERE link_id/i.test(sql)) {
        return { rows: [linkRow("active", "guardian_primary")], rowCount: 1 };
      }
      if (/INSERT INTO nex\.family_link_revocation_cooldown/i.test(sql)) {
        throw new Error(
          `duplicate key value violates unique constraint "family_link_revocation_cooldown_link_pending_uq"`,
        );
      }
      return { rows: [], rowCount: 0 };
    };
    const r = await revokePrimaryGuardianWithCooldown({
      linkId: LINK_ID,
      actorAccountId: GUARDIAN,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("cooldown_already_pending");
  });
});
