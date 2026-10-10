// src/lib/nex-native/family-safety/privacy-invariants.test.ts
//
// FS-3 · 10 load-bearing privacy invariant scenarios (ONE per rule in
// the FS-3 brief). Each is an end-to-end integration-style test
// against the mocked DB. These prove the dashboard surface respects
// the founder's rules even under adversarial inputs.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

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
  resolveChildDashboardAccess,
  resolvePermissionFlag,
  listDashboardEntriesForGuardian,
} from "./dashboard-service";
import { getContactVisibilityForChild } from "./contact-visibility-service";
import { readSafeChatGuardianSummaryForChild } from "./safechat-status-reader";

const G = "11111111-1111-4111-8111-111111111111";
const G_OTHER_FAMILY = "aaaaaaaa-1111-4111-8111-111111111111";
const C = "22222222-2222-4222-8222-222222222222";
const C_OTHER_FAMILY = "bbbbbbbb-2222-4222-8222-222222222222";
const LINK = "55555555-5555-4555-8555-555555555555";
const LINK_OTHER = "66666666-6666-4666-8666-666666666666";

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
  withClientUnavailable = false;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═════════════════════════════════════════════════════════════════════
// Invariant 1 · Guardianship check (403 for non-guardian)
// ═════════════════════════════════════════════════════════════════════

describe("INVARIANT 1 · guardianship check", () => {
  it("non-guardian receives denied_not_guardian · never 'granted'", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const r = await resolveChildDashboardAccess({
      viewerAccountId: G_OTHER_FAMILY,
      childAccountId: C,
      surface: "child_dashboard",
    });
    expect(r.ok).toBe(false);
    expect(r.outcome).toBe("denied_not_guardian");
    expect(r.link).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// Invariant 2 · URL tampering (child-id substitution)
// ═════════════════════════════════════════════════════════════════════

describe("INVARIANT 2 · URL tampering", () => {
  it("substituting a different childAccountId in the URL still denies without data leak", async () => {
    // Attacker is guardian of C but asks about C_OTHER_FAMILY.
    withClientResponder = (sql, params) => {
      // The isGuardianOf SQL binds (viewer, child). It returns no row
      // for the mismatched pair.
      expect(params).toContain(G);
      expect(params).toContain(C_OTHER_FAMILY);
      return { rows: [], rowCount: 0 };
    };
    const r = await resolveChildDashboardAccess({
      viewerAccountId: G,
      childAccountId: C_OTHER_FAMILY,
      surface: "child_dashboard",
    });
    expect(r.ok).toBe(false);
    expect(r.outcome).toBe("denied_not_guardian");
    // Error path MUST NOT leak the child account id or the link id.
    expect(JSON.stringify(r)).not.toContain(C_OTHER_FAMILY);
    expect(JSON.stringify(r)).not.toContain(LINK);
  });
});

// ═════════════════════════════════════════════════════════════════════
// Invariant 3 · No raw-message / child-content column references
// ═════════════════════════════════════════════════════════════════════

describe("INVARIANT 3 · no raw-message queries", () => {
  it("every SQL executed by the dashboard-service is message-content-free", async () => {
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
    await resolveChildDashboardAccess({
      viewerAccountId: G,
      childAccountId: C,
      surface: "child_dashboard",
    });
    for (const c of withClientCalls) {
      expect(c.sql).not.toMatch(/\bnex_peer_message\b/i);
      expect(c.sql).not.toMatch(/\bnex\.safechat_classification\b/i);
      expect(c.sql).not.toMatch(/\bciphertext\b/i);
      expect(c.sql).not.toMatch(/\bplaintext\b/i);
      expect(c.sql).not.toMatch(/\brule_matches\b/i);
      expect(c.sql).not.toMatch(/\battachment_url\b/i);
    }
  });

  it("source files contain NO code reference to raw-message tables (greppable guard)", () => {
    function stripComments(s: string): string {
      return s
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^[ \t]*\/\/.*$/gm, "")
        .replace(/[ \t]+\/\/.*$/gm, "");
    }
    const files = [
      "dashboard-service.ts",
      "contact-visibility-service.ts",
      "safechat-status-reader.ts",
    ];
    for (const f of files) {
      const src = stripComments(
        fs.readFileSync(path.join(__dirname, f), "utf8"),
      );
      expect(src).not.toMatch(/nex_peer_message/i);
      expect(src).not.toMatch(/safechat_classification/i);
      expect(src).not.toMatch(/\bciphertext\b/i);
      expect(src).not.toMatch(/\bplaintext\b/i);
      expect(src).not.toMatch(/\brule_matches\b/i);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// Invariant 4 · No contact exposure by default (Phase 1)
// ═════════════════════════════════════════════════════════════════════

describe("INVARIANT 4 · no contact exposure by default", () => {
  it("contact visibility reader returns unavailable even for a valid guardian", async () => {
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
    const r = await getContactVisibilityForChild({
      viewerAccountId: G,
      childAccountId: C,
    });
    expect(r.available).toBe(false);
    // Contact tables are never read.
    for (const c of withClientCalls) {
      expect(c.sql).not.toMatch(/\bnex_contact\b/i);
      expect(c.sql).not.toMatch(/\bnex_friend_edge\b/i);
      expect(c.sql).not.toMatch(/\bnex_peer_conversation\b/i);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// Invariant 5 · No location exposure by default
// ═════════════════════════════════════════════════════════════════════

describe("INVARIANT 5 · no location exposure by default", () => {
  it("resolvePermissionFlag for can_see_location_when_shared denies even if DB flag is TRUE", async () => {
    let call = 0;
    withClientResponder = () => {
      call += 1;
      if (call === 1) {
        return {
          rows: [{ link_id: LINK, role: "guardian_primary" }],
          rowCount: 1,
        };
      }
      return {
        rows: [activeLinkRow({ can_see_location_when_shared: true })],
        rowCount: 1,
      };
    };
    const r = await resolvePermissionFlag({
      viewerAccountId: G,
      childAccountId: C,
      flag: "can_see_location_when_shared",
      surface: "child_dashboard",
    });
    expect(r.ok).toBe(false);
    expect(r.outcome).toBe("denied_flag_off");
  });
});

// ═════════════════════════════════════════════════════════════════════
// Invariant 6 · SafeChat summary unavailable in Phase 1
// ═════════════════════════════════════════════════════════════════════

describe("INVARIANT 6 · SafeChat summary unavailable", () => {
  it("readSafeChatGuardianSummaryForChild is UNCONDITIONALLY unavailable", () => {
    const r = readSafeChatGuardianSummaryForChild();
    expect(r.available).toBe(false);
  });

  it("permission flag for can_see_safety_summaries is denied", async () => {
    let call = 0;
    withClientResponder = () => {
      call += 1;
      if (call === 1) {
        return {
          rows: [{ link_id: LINK, role: "guardian_primary" }],
          rowCount: 1,
        };
      }
      return { rows: [activeLinkRow()], rowCount: 1 };
    };
    const r = await resolvePermissionFlag({
      viewerAccountId: G,
      childAccountId: C,
      flag: "can_see_safety_summaries",
      surface: "child_safechat",
    });
    expect(r.ok).toBe(false);
    expect(r.outcome).toBe("denied_flag_off");
  });
});

// ═════════════════════════════════════════════════════════════════════
// Invariant 7 · Revoked-link enforcement (race-window close)
// ═════════════════════════════════════════════════════════════════════

describe("INVARIANT 7 · revoked-link enforcement", () => {
  it("second call within the same second after revoke still denies", async () => {
    let call = 0;
    withClientResponder = () => {
      call += 1;
      // First dashboard access · still active.
      if (call === 1) {
        return {
          rows: [{ link_id: LINK, role: "guardian_primary" }],
          rowCount: 1,
        };
      }
      if (call === 2) {
        return { rows: [activeLinkRow()], rowCount: 1 };
      }
      // audit log inserts
      if (call === 3) return { rows: [], rowCount: 1 };
      // Second call (post-revoke race) · isGuardianOf now returns NO row.
      if (call === 4) return { rows: [], rowCount: 0 };
      // audit log for the denied call
      return { rows: [], rowCount: 1 };
    };
    const first = await resolveChildDashboardAccess({
      viewerAccountId: G,
      childAccountId: C,
      surface: "child_dashboard",
    });
    expect(first.ok).toBe(true);

    const second = await resolveChildDashboardAccess({
      viewerAccountId: G,
      childAccountId: C,
      surface: "child_dashboard",
    });
    expect(second.ok).toBe(false);
    expect(second.outcome).toBe("denied_not_guardian");
  });
});

// ═════════════════════════════════════════════════════════════════════
// Invariant 8 · Cross-account isolation
// ═════════════════════════════════════════════════════════════════════

describe("INVARIANT 8 · cross-account isolation", () => {
  it("guardian of family A asking about child B of family C is denied", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const r = await resolveChildDashboardAccess({
      viewerAccountId: G,
      childAccountId: C_OTHER_FAMILY,
      surface: "child_dashboard",
    });
    expect(r.ok).toBe(false);
    expect(r.outcome).toBe("denied_not_guardian");
    expect(r.link).toBeNull();
  });

  it("listDashboardEntriesForGuardian returns ONLY entries where guardian_account_id matches", async () => {
    withClientResponder = (_sql, params) => {
      // The service's SQL binds guardian_account_id = $1 · verify
      // the responder would only ever see the viewer's id.
      expect(params).toContain(G);
      expect(params).not.toContain(G_OTHER_FAMILY);
      return {
        rows: [activeLinkRow()],
        rowCount: 1,
      };
    };
    const r = await listDashboardEntriesForGuardian(G);
    expect(r.entries.length).toBe(1);
    expect(r.entries[0]!.childAccountId).toBe(C);
  });
});

// ═════════════════════════════════════════════════════════════════════
// Invariant 9 · Error paths don't leak
// ═════════════════════════════════════════════════════════════════════

describe("INVARIANT 9 · error paths don't leak", () => {
  it("denial result does NOT contain account ids, link ids, or content tokens", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const r = await resolveChildDashboardAccess({
      viewerAccountId: G_OTHER_FAMILY,
      childAccountId: C,
      surface: "child_dashboard",
    });
    const serialised = JSON.stringify(r);
    expect(serialised).not.toContain(G_OTHER_FAMILY);
    expect(serialised).not.toContain(C);
    expect(serialised).not.toContain(LINK);
    // The reason enum does NOT contain uuids or message tokens.
    expect(r.reason ?? "").not.toMatch(/[0-9a-f]{8}-/i);
    expect(r.reason ?? "").not.toMatch(/\bmessage\b/i);
  });

  it("invalid-input denial does not echo the attacker-supplied surface token back raw", async () => {
    const r = await resolveChildDashboardAccess({
      viewerAccountId: G,
      childAccountId: C,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      surface: "<script>alert('x')</script>" as any,
    });
    const serialised = JSON.stringify(r);
    expect(serialised).not.toContain("<script>");
    expect(serialised).not.toContain("alert(");
  });
});

// ═════════════════════════════════════════════════════════════════════
// Invariant 10 · Access logging (append-only, every outcome)
// ═════════════════════════════════════════════════════════════════════

describe("INVARIANT 10 · access logging", () => {
  it("audit log INSERTs are append-only · never UPDATE / DELETE on the audit table", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 1 });
    const r = await listDashboardEntriesForGuardian(G);
    expect(r.entries).toEqual([]);
    for (const c of withClientCalls) {
      if (/family_safety_dashboard_access_log/i.test(c.sql)) {
        expect(c.sql).not.toMatch(/\bUPDATE\b/i);
        expect(c.sql).not.toMatch(/\bDELETE\b/i);
      }
    }
  });

  it("every outcome bucket (granted / denied_*) results in an audit INSERT", async () => {
    // granted
    let call = 0;
    withClientResponder = () => {
      call += 1;
      if (call === 1)
        return {
          rows: [{ link_id: LINK, role: "guardian_primary" }],
          rowCount: 1,
        };
      if (call === 2) return { rows: [activeLinkRow()], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    };
    const granted = await resolveChildDashboardAccess({
      viewerAccountId: G,
      childAccountId: C,
      surface: "child_dashboard",
    });
    expect(granted.outcome).toBe("granted");

    withClientCalls = [];
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const notGuardian = await resolveChildDashboardAccess({
      viewerAccountId: G_OTHER_FAMILY,
      childAccountId: C,
      surface: "child_dashboard",
    });
    expect(notGuardian.outcome).toBe("denied_not_guardian");
    const inserts = withClientCalls.filter((c) =>
      /INSERT INTO nex\.family_safety_dashboard_access_log/i.test(c.sql),
    );
    expect(inserts.length).toBeGreaterThanOrEqual(1);
    expect(inserts[0]!.params[3]).toBe("denied_not_guardian");

    // flag_off
    withClientCalls = [];
    let c2 = 0;
    withClientResponder = () => {
      c2 += 1;
      if (c2 === 1)
        return {
          rows: [{ link_id: LINK, role: "guardian_primary" }],
          rowCount: 1,
        };
      if (c2 === 2) return { rows: [activeLinkRow()], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    };
    const flagOff = await resolvePermissionFlag({
      viewerAccountId: G,
      childAccountId: C,
      flag: "can_see_safety_summaries",
      surface: "child_safechat",
    });
    expect(flagOff.outcome).toBe("denied_flag_off");
    const inserts2 = withClientCalls.filter((c) =>
      /INSERT INTO nex\.family_safety_dashboard_access_log/i.test(c.sql),
    );
    const outcomes = inserts2.map((i) => i.params[3]);
    expect(outcomes).toContain("denied_flag_off");

    // revoked
    withClientCalls = [];
    let c3 = 0;
    withClientResponder = () => {
      c3 += 1;
      if (c3 === 1)
        return {
          rows: [{ link_id: LINK, role: "guardian_primary" }],
          rowCount: 1,
        };
      if (c3 === 2)
        return {
          rows: [activeLinkRow({ state: "revoked" })],
          rowCount: 1,
        };
      return { rows: [], rowCount: 1 };
    };
    const revoked = await resolveChildDashboardAccess({
      viewerAccountId: G,
      childAccountId: C,
      surface: "child_dashboard",
    });
    expect(revoked.outcome).toBe("denied_revoked");
    const inserts3 = withClientCalls.filter((c) =>
      /INSERT INTO nex\.family_safety_dashboard_access_log/i.test(c.sql),
    );
    expect(inserts3[0]!.params[3]).toBe("denied_revoked");
  });

  it("the audit INSERT ALWAYS writes simulated=TRUE hard-coded in SQL (never via param)", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 1 });
    await listDashboardEntriesForGuardian(G);
    const inserts = withClientCalls.filter((c) =>
      /INSERT INTO nex\.family_safety_dashboard_access_log/i.test(c.sql),
    );
    for (const ins of inserts) {
      expect(ins.sql).toMatch(/VALUES\s*\(\$1,\s*\$2,\s*\$3,\s*\$4,\s*TRUE\)/i);
      // 4 positional params · never a 5th for simulated.
      expect(ins.params.length).toBe(4);
    }
  });
});
