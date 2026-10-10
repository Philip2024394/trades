// src/lib/nex-native/family-safety/contact-visibility-service.test.ts
//
// FS-3 · contact-visibility reader tests. Mocks @/lib/nex/db · never
// touches a real database. The Phase 1 reader is UNCONDITIONAL
// unavailable · the tests pin that invariant across all input shapes
// AND assert the reader never issues a contact-adjacent query.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import {
  CONTACT_VISIBILITY_PHASE_1_REASON,
  getContactVisibilityForChild,
} from "./contact-visibility-service";

const G = "11111111-1111-4111-8111-111111111111";
const C = "22222222-2222-4222-8222-222222222222";
const G2 = "33333333-3333-4333-8333-333333333333";
const LINK = "55555555-5555-4555-8555-555555555555";

function activeLinkRow(overrides: Record<string, unknown> = {}) {
  return {
    link_id: LINK,
    guardian_account_id: G,
    child_account_id: C,
    role: "guardian_primary",
    state: "active",
    initiated_by: "guardian_invite",
    initiated_at: new Date().toISOString(),
    confirmed_at: new Date().toISOString(),
    revoked_at: null,
    revoked_by: null,
    revoked_reason: null,
    expires_at: null,
    can_see_emergency_alerts: true,
    can_see_safety_summaries: false,
    can_see_location_when_shared: false,
    simulated: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  withClientCalls = [];
  withClientResponder = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getContactVisibilityForChild · Phase 1 unavailable", () => {
  it("returns unavailable for a valid guardian + child pair", async () => {
    let call = 0;
    withClientResponder = () => {
      call += 1;
      if (call === 1) {
        return {
          rows: [{ link_id: LINK, role: "guardian_primary" }],
          rowCount: 1,
        };
      }
      if (call === 2) {
        return { rows: [activeLinkRow()], rowCount: 1 };
      }
      // Audit log inserts return nothing.
      return { rows: [], rowCount: 1 };
    };
    const r = await getContactVisibilityForChild({
      viewerAccountId: G,
      childAccountId: C,
    });
    expect(r.available).toBe(false);
    if (!r.available) {
      expect(r.reason).toBe(CONTACT_VISIBILITY_PHASE_1_REASON);
      expect(r.simulatedPhase1).toBe(true);
    }
  });

  it("returns unavailable for a non-guardian · never leaks the Phase 1 reason via a different path", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const r = await getContactVisibilityForChild({
      viewerAccountId: G2,
      childAccountId: C,
    });
    expect(r.available).toBe(false);
    if (!r.available) {
      expect(r.reason).toBe(CONTACT_VISIBILITY_PHASE_1_REASON);
    }
  });

  it("returns unavailable for empty viewer id", async () => {
    const r = await getContactVisibilityForChild({
      viewerAccountId: "",
      childAccountId: C,
    });
    expect(r.available).toBe(false);
  });

  it("returns unavailable for empty child id", async () => {
    const r = await getContactVisibilityForChild({
      viewerAccountId: G,
      childAccountId: "",
    });
    expect(r.available).toBe(false);
  });

  it("returns unavailable for revoked link", async () => {
    let call = 0;
    withClientResponder = () => {
      call += 1;
      if (call === 1) {
        return {
          rows: [{ link_id: LINK, role: "guardian_primary" }],
          rowCount: 1,
        };
      }
      if (call === 2) {
        return {
          rows: [activeLinkRow({ state: "revoked" })],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    };
    const r = await getContactVisibilityForChild({
      viewerAccountId: G,
      childAccountId: C,
    });
    expect(r.available).toBe(false);
  });

  it("NEVER issues a SELECT against any contact / friendship / conversation table", async () => {
    let call = 0;
    withClientResponder = () => {
      call += 1;
      if (call === 1) {
        return {
          rows: [{ link_id: LINK, role: "guardian_primary" }],
          rowCount: 1,
        };
      }
      if (call === 2) {
        return { rows: [activeLinkRow()], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    };
    await getContactVisibilityForChild({
      viewerAccountId: G,
      childAccountId: C,
    });
    for (const c of withClientCalls) {
      expect(c.sql).not.toMatch(/\bnex_contact\b/i);
      expect(c.sql).not.toMatch(/\bnex_friend_edge\b/i);
      expect(c.sql).not.toMatch(/\bnex_peer_conversation\b/i);
      expect(c.sql).not.toMatch(/\bnex_peer_message\b/i);
      expect(c.sql).not.toMatch(/\bnex_friendship\b/i);
    }
  });

  it("writes an audit log INSERT when the viewer IS a guardian (denied_flag_off)", async () => {
    let call = 0;
    withClientResponder = () => {
      call += 1;
      if (call === 1) {
        return {
          rows: [{ link_id: LINK, role: "guardian_primary" }],
          rowCount: 1,
        };
      }
      if (call === 2) {
        return { rows: [activeLinkRow()], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    };
    await getContactVisibilityForChild({
      viewerAccountId: G,
      childAccountId: C,
    });
    const inserts = withClientCalls.filter((c) =>
      /INSERT INTO nex\.family_safety_dashboard_access_log/i.test(c.sql),
    );
    // At least one · the base gate 'granted' row AND the flag_off row.
    expect(inserts.length).toBeGreaterThanOrEqual(2);
    const outcomes = inserts.map((i) => i.params[3]);
    expect(outcomes).toContain("denied_flag_off");
  });
});
