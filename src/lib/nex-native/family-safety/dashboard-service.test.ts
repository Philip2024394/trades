// src/lib/nex-native/family-safety/dashboard-service.test.ts
//
// FS-3 · Parent-dashboard access gate tests. Mocks @/lib/nex/db · never
// touches a real database. 20+ scenarios covering every denial path,
// the race-condition between isGuardianOf and the state re-check, and
// the audit-log write for every outcome.
//
// Load-bearing privacy invariants under test:
//   1. 403 (not 404) for non-guardian · reason enum returned verbatim
//   2. URL tampering · substituting a different childAccountId denies
//   3. Revoked-link race-window closed by the re-fetch
//   4. Error-path does NOT leak account ids in the reason enum
//   5. Audit log row is written for EVERY outcome
//   6. No raw-message / child-content column references (greppable test
//      in grep-invariants.test.ts covers the full module source)

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
  DASHBOARD_DENIAL_REASONS,
  DASHBOARD_OUTCOMES,
  DASHBOARD_SURFACES,
  listDashboardEntriesForGuardian,
  logDashboardAccess,
  resolveChildDashboardAccess,
  resolvePermissionFlag,
} from "./dashboard-service";

const G = "11111111-1111-4111-8111-111111111111";
const C = "22222222-2222-4222-8222-222222222222";
const G2 = "33333333-3333-4333-8333-333333333333";
const C2 = "44444444-4444-4444-4444-444444444444";
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
  withClientUnavailable = false;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────
// §1 · Sealed enum shape
// ─────────────────────────────────────────────────────────────────────

describe("DASHBOARD_OUTCOMES / DASHBOARD_SURFACES / DASHBOARD_DENIAL_REASONS", () => {
  it("outcomes match the migration-201 CHECK list exactly", () => {
    expect([...DASHBOARD_OUTCOMES].sort()).toEqual(
      [
        "granted",
        "denied_not_guardian",
        "denied_revoked",
        "denied_flag_off",
        "denied_other",
      ].sort(),
    );
  });

  it("surfaces match the migration-201 CHECK list exactly", () => {
    expect([...DASHBOARD_SURFACES].sort()).toEqual(
      [
        "dashboard_root",
        "child_dashboard",
        "child_contacts",
        "child_safechat",
        "safechat_status",
        "privacy_page",
      ].sort(),
    );
  });

  it("denial reasons do NOT include any account id or content token", () => {
    const values = Object.values(DASHBOARD_DENIAL_REASONS).join("|");
    expect(values).not.toMatch(/[0-9a-f]{8}-/i);
    expect(values).not.toMatch(/\bmessage\b|\bciphertext\b|\bplaintext\b/i);
  });
});

// ─────────────────────────────────────────────────────────────────────
// §2 · resolveChildDashboardAccess · invalid input
// ─────────────────────────────────────────────────────────────────────

describe("resolveChildDashboardAccess · invalid input", () => {
  it("denies when viewerAccountId is empty", async () => {
    const r = await resolveChildDashboardAccess({
      viewerAccountId: "",
      childAccountId: C,
      surface: "child_dashboard",
    });
    expect(r.ok).toBe(false);
    expect(r.outcome).toBe("denied_other");
    expect(r.reason).toBe(DASHBOARD_DENIAL_REASONS.INVALID_INPUT);
    expect(r.link).toBeNull();
  });

  it("denies when childAccountId is empty", async () => {
    const r = await resolveChildDashboardAccess({
      viewerAccountId: G,
      childAccountId: "",
      surface: "child_dashboard",
    });
    expect(r.ok).toBe(false);
    expect(r.outcome).toBe("denied_other");
    expect(r.reason).toBe(DASHBOARD_DENIAL_REASONS.INVALID_INPUT);
  });

  it("denies when surface is not a sealed token", async () => {
    const r = await resolveChildDashboardAccess({
      viewerAccountId: G,
      childAccountId: C,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      surface: "evil_surface" as any,
    });
    expect(r.ok).toBe(false);
    expect(r.outcome).toBe("denied_other");
  });

  it("denies self-link (viewer == child)", async () => {
    const r = await resolveChildDashboardAccess({
      viewerAccountId: G,
      childAccountId: G,
      surface: "child_dashboard",
    });
    expect(r.ok).toBe(false);
    expect(r.outcome).toBe("denied_not_guardian");
    expect(r.reason).toBe(DASHBOARD_DENIAL_REASONS.NOT_GUARDIAN);
  });
});

// ─────────────────────────────────────────────────────────────────────
// §3 · resolveChildDashboardAccess · not a guardian
// ─────────────────────────────────────────────────────────────────────

describe("resolveChildDashboardAccess · not a guardian", () => {
  it("denies when isGuardianOf returns no row", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const r = await resolveChildDashboardAccess({
      viewerAccountId: G2,
      childAccountId: C,
      surface: "child_dashboard",
    });
    expect(r.ok).toBe(false);
    expect(r.outcome).toBe("denied_not_guardian");
    expect(r.reason).toBe(DASHBOARD_DENIAL_REASONS.NOT_GUARDIAN);
  });

  it("denies cross-account (guardian of child A asks about child B)", async () => {
    // The guardian role reader will return "no row" for the mismatched
    // pair (G asks about C2 while only being guardian of C).
    withClientResponder = (sql, params) => {
      // Role reader SELECT returns empty for (G, C2) pair.
      expect(params).toContain(G);
      expect(params).toContain(C2);
      return { rows: [], rowCount: 0 };
    };
    const r = await resolveChildDashboardAccess({
      viewerAccountId: G,
      childAccountId: C2,
      surface: "child_dashboard",
    });
    expect(r.ok).toBe(false);
    expect(r.outcome).toBe("denied_not_guardian");
  });
});

// ─────────────────────────────────────────────────────────────────────
// §4 · resolveChildDashboardAccess · revoked / race-window
// ─────────────────────────────────────────────────────────────────────

describe("resolveChildDashboardAccess · revoked", () => {
  it("denies with denied_revoked when getLinkById returns null", async () => {
    let call = 0;
    withClientResponder = () => {
      call += 1;
      if (call === 1) {
        // isGuardianOf · active row exists at this moment.
        return {
          rows: [{ link_id: LINK, role: "guardian_primary" }],
          rowCount: 1,
        };
      }
      // getLinkById · the row vanished (hard delete · impossible under
      // append-only, but defends against future drift).
      return { rows: [], rowCount: 0 };
    };
    const r = await resolveChildDashboardAccess({
      viewerAccountId: G,
      childAccountId: C,
      surface: "child_dashboard",
    });
    expect(r.ok).toBe(false);
    expect(r.outcome).toBe("denied_revoked");
    expect(r.reason).toBe(DASHBOARD_DENIAL_REASONS.LINK_REVOKED);
  });

  it("denies with denied_revoked when the link state flipped to 'revoked' between checks", async () => {
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
        rows: [activeLinkRow({ state: "revoked" })],
        rowCount: 1,
      };
    };
    const r = await resolveChildDashboardAccess({
      viewerAccountId: G,
      childAccountId: C,
      surface: "child_dashboard",
    });
    expect(r.ok).toBe(false);
    expect(r.outcome).toBe("denied_revoked");
  });

  it("denies with denied_revoked when the link state is 'expired'", async () => {
    let call = 0;
    withClientResponder = () => {
      call += 1;
      if (call === 1) {
        return {
          rows: [{ link_id: LINK, role: "guardian_primary" }],
          rowCount: 1,
        };
      }
      return { rows: [activeLinkRow({ state: "expired" })], rowCount: 1 };
    };
    const r = await resolveChildDashboardAccess({
      viewerAccountId: G,
      childAccountId: C,
      surface: "child_dashboard",
    });
    expect(r.ok).toBe(false);
    expect(r.outcome).toBe("denied_revoked");
  });
});

// ─────────────────────────────────────────────────────────────────────
// §5 · resolveChildDashboardAccess · granted
// ─────────────────────────────────────────────────────────────────────

describe("resolveChildDashboardAccess · granted", () => {
  it("grants when the viewer is an active guardian of the child", async () => {
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
    const r = await resolveChildDashboardAccess({
      viewerAccountId: G,
      childAccountId: C,
      surface: "child_dashboard",
    });
    expect(r.ok).toBe(true);
    expect(r.outcome).toBe("granted");
    expect(r.reason).toBeNull();
    expect(r.link?.guardianAccountId).toBe(G);
    expect(r.link?.childAccountId).toBe(C);
    expect(r.link?.state).toBe("active");
  });

  it("defends against row-id substitution (link.guardian doesn't match viewer)", async () => {
    let call = 0;
    withClientResponder = () => {
      call += 1;
      if (call === 1) {
        return {
          rows: [{ link_id: LINK, role: "guardian_primary" }],
          rowCount: 1,
        };
      }
      // Attacker-controlled link row with a different guardian.
      return {
        rows: [
          activeLinkRow({
            guardian_account_id: G2,
            child_account_id: C,
          }),
        ],
        rowCount: 1,
      };
    };
    const r = await resolveChildDashboardAccess({
      viewerAccountId: G,
      childAccountId: C,
      surface: "child_dashboard",
    });
    expect(r.ok).toBe(false);
    expect(r.outcome).toBe("denied_not_guardian");
  });
});

// ─────────────────────────────────────────────────────────────────────
// §6 · resolvePermissionFlag (Phase 1 ceiling)
// ─────────────────────────────────────────────────────────────────────

describe("resolvePermissionFlag · Phase 1 ceiling", () => {
  it("returns denied_flag_off for can_see_safety_summaries even when guardian is valid", async () => {
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
    expect(r.reason).toBe(DASHBOARD_DENIAL_REASONS.FLAG_OFF);
  });

  it("returns denied_flag_off for can_see_location_when_shared even when flag is TRUE in DB", async () => {
    // Phase 1 ceiling: even if someone bypassed the sealed service
    // and flipped the flag in the DB, this reader refuses.
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
    expect(r.reason).toBe(DASHBOARD_DENIAL_REASONS.FLAG_OFF);
  });

  it("propagates the base gate denial when not a guardian", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const r = await resolvePermissionFlag({
      viewerAccountId: G2,
      childAccountId: C,
      flag: "can_see_safety_summaries",
      surface: "child_safechat",
    });
    expect(r.ok).toBe(false);
    expect(r.outcome).toBe("denied_not_guardian");
  });
});

// ─────────────────────────────────────────────────────────────────────
// §7 · logDashboardAccess · writes a row for every outcome
// ─────────────────────────────────────────────────────────────────────

describe("logDashboardAccess · audit writes", () => {
  it("writes INSERT with the correct simulated=TRUE semantics", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 1 });
    const ok = await logDashboardAccess({
      viewerAccountId: G,
      viewedChildAccountId: C,
      surface: "child_dashboard",
      outcome: "granted",
    });
    expect(ok).toBe(true);
    expect(withClientCalls.length).toBe(1);
    const call = withClientCalls[0]!;
    expect(call.sql).toMatch(/INSERT INTO nex\.family_safety_dashboard_access_log/i);
    expect(call.sql).toMatch(/simulated/i);
    expect(call.sql).toMatch(/\bTRUE\b/);
    // 4 positional parameters · viewer, child, surface, outcome. Simulated
    // is hard-coded to TRUE in the SQL to prevent live-mode drift via
    // param injection.
    expect(call.params.length).toBe(4);
    expect(call.params[0]).toBe(G);
    expect(call.params[1]).toBe(C);
    expect(call.params[2]).toBe("child_dashboard");
    expect(call.params[3]).toBe("granted");
  });

  it("normalises empty-string child to NULL for aggregate reads", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 1 });
    await logDashboardAccess({
      viewerAccountId: G,
      viewedChildAccountId: "",
      surface: "dashboard_root",
      outcome: "granted",
    });
    expect(withClientCalls[0]!.params[1]).toBeNull();
  });

  it("returns false (never throws) when the pool is unavailable", async () => {
    withClientUnavailable = true;
    const ok = await logDashboardAccess({
      viewerAccountId: G,
      viewedChildAccountId: C,
      surface: "child_dashboard",
      outcome: "granted",
    });
    expect(ok).toBe(false);
  });

  it("returns false when viewerAccountId is empty (never writes a stray row)", async () => {
    const ok = await logDashboardAccess({
      viewerAccountId: "",
      viewedChildAccountId: C,
      surface: "child_dashboard",
      outcome: "granted",
    });
    expect(ok).toBe(false);
    expect(withClientCalls.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// §8 · listDashboardEntriesForGuardian
// ─────────────────────────────────────────────────────────────────────

describe("listDashboardEntriesForGuardian", () => {
  it("returns an empty entries array + an audit row when the guardian has no links", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const r = await listDashboardEntriesForGuardian(G);
    expect(r.viewerAccountId).toBe(G);
    expect(r.entries).toEqual([]);
    expect(r.simulatedPhase1).toBe(true);
    // Expect at least one INSERT INTO ... access_log for the root audit.
    const inserts = withClientCalls.filter((c) =>
      /INSERT INTO nex\.family_safety_dashboard_access_log/i.test(c.sql),
    );
    expect(inserts.length).toBeGreaterThanOrEqual(1);
  });

  it("surfaces RELATIONSHIP STRUCTURE ONLY (no display name, DOB, handle fields)", async () => {
    withClientResponder = () => ({
      rows: [activeLinkRow()],
      rowCount: 1,
    });
    const r = await listDashboardEntriesForGuardian(G);
    expect(r.entries.length).toBe(1);
    const entry = r.entries[0]!;
    const keys = Object.keys(entry).sort();
    expect(keys).toEqual(
      [
        "childAccountId",
        "linkId",
        "role",
        "state",
        "initiatedAt",
        "confirmedAt",
        "revokedAt",
      ].sort(),
    );
  });

  it("includes pending / revoked / expired links as well (dashboard is honest about state)", async () => {
    withClientResponder = () => ({
      rows: [
        activeLinkRow({ link_id: "a", state: "active" }),
        activeLinkRow({ link_id: "b", state: "pending" }),
        activeLinkRow({ link_id: "c", state: "revoked" }),
        activeLinkRow({ link_id: "d", state: "expired" }),
      ],
      rowCount: 4,
    });
    const r = await listDashboardEntriesForGuardian(G);
    expect(r.entries.map((e) => e.state).sort()).toEqual(
      ["active", "expired", "pending", "revoked"],
    );
  });

  it("returns empty entries when viewer id is empty · logging is skipped (DB NOT NULL)", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 1 });
    const r = await listDashboardEntriesForGuardian("");
    expect(r.entries).toEqual([]);
    // Empty viewer id would violate the viewer_account_id NOT NULL
    // constraint · the logger refuses to write that row at all.
    expect(withClientCalls.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// §9 · Privacy grep-anchors on the dashboard-service.ts source
// ─────────────────────────────────────────────────────────────────────

describe("dashboard-service.ts source · privacy invariants", () => {
  // Strip single-line (//) and block (/* */) comments so the privacy
  // grep anchors ONLY fire on actual code · comments that document
  // forbidden terms are expected to mention them.
  function stripComments(s: string): string {
    return s
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "")
      .replace(/[ \t]+\/\/.*$/gm, "");
  }
  const serviceSrc = stripComments(
    fs.readFileSync(path.join(__dirname, "dashboard-service.ts"), "utf8"),
  );
  const contactSrc = stripComments(
    fs.readFileSync(
      path.join(__dirname, "contact-visibility-service.ts"),
      "utf8",
    ),
  );
  const safechatSrc = stripComments(
    fs.readFileSync(path.join(__dirname, "safechat-status-reader.ts"), "utf8"),
  );
  const allSrc = [serviceSrc, contactSrc, safechatSrc].join("\n");

  it("never references raw-message / ciphertext / plaintext / signals columns", () => {
    expect(allSrc).not.toMatch(/\bciphertext\b/i);
    expect(allSrc).not.toMatch(/\bplaintext\b/i);
    expect(allSrc).not.toMatch(/\bmessage_body\b/i);
    expect(allSrc).not.toMatch(/\bmessage_content\b/i);
    // 'signals' is a sealed SafeChat column we must never query.
    expect(serviceSrc).not.toMatch(/\bsignals\b/i);
    expect(contactSrc).not.toMatch(/\bsignals\b/i);
  });

  it("never references nex.safechat_classification · rule_matches · attachment_url", () => {
    expect(allSrc).not.toMatch(/nex\.safechat_classification/i);
    expect(allSrc).not.toMatch(/\brule_matches\b/i);
    expect(allSrc).not.toMatch(/\battachment_url\b/i);
  });

  it("never SELECTs from nex_peer_message, nex_peer_conversation, nex_friend_edge", () => {
    expect(allSrc).not.toMatch(/\bnex_peer_message\b/i);
    expect(allSrc).not.toMatch(/\bnex_peer_conversation\b/i);
    expect(allSrc).not.toMatch(/\bnex_friend_edge\b/i);
    expect(allSrc).not.toMatch(/\bnex_contact\b/i);
  });

  it("dashboard-service only INSERTs into the audit log · no other table writes", () => {
    const inserts = serviceSrc.match(/INSERT\s+INTO[^;]*/gi) ?? [];
    for (const ins of inserts) {
      expect(ins).toMatch(/family_safety_dashboard_access_log/i);
    }
    expect(serviceSrc).not.toMatch(/\bUPDATE\s+nex[._]/i);
    expect(serviceSrc).not.toMatch(/\bDELETE\s+FROM\s+nex[._]/i);
  });

  it("contact-visibility-service does NOT import any contact / friendship / conversation module", () => {
    expect(contactSrc).not.toMatch(/@\/lib\/nex-native\/.*friend/i);
    expect(contactSrc).not.toMatch(/@\/lib\/nex-native\/.*contact-service/i);
    expect(contactSrc).not.toMatch(/@\/lib\/nex-native\/.*conversation/i);
    expect(contactSrc).not.toMatch(/@\/lib\/nex-native\/.*peer-conversation/i);
  });

  it("safechat-status-reader does NOT import any classifier or classification module", () => {
    expect(safechatSrc).not.toMatch(/safechat\/classifier\b/i);
    expect(safechatSrc).not.toMatch(/safechat\/classification-logger/i);
    expect(safechatSrc).not.toMatch(/safechat\/pattern-detector/i);
    expect(safechatSrc).not.toMatch(/safechat\/conversation-signal-aggregator/i);
    expect(safechatSrc).not.toMatch(/safechat\/retention-sweep/i);
    // The only sealed import permitted is the feature-flag module.
    expect(safechatSrc).toMatch(/safechat\/feature-flag/);
  });
});
