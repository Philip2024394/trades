// src/lib/nex-native/family-links/family-role-reader.test.ts
//
// Unit tests for the Family Links read-only resolver.
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
  isGuardianOf,
  listGuardianAccountIdsFor,
  listChildAccountIdsFor,
  resolveFamilyRelationshipKind,
} from "./family-role-reader";

const G = "11111111-1111-4111-8111-111111111111";
const C = "22222222-2222-4222-8222-222222222222";
const G2 = "33333333-3333-4333-8333-333333333333";
const C2 = "44444444-4444-4444-4444-444444444444";
const LINK = "55555555-5555-4555-8555-555555555555";

beforeEach(() => {
  withClientCalls = [];
  withClientResponder = null;
  withClientUnavailable = false;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────
// isGuardianOf
// ─────────────────────────────────────────────────────────────────────

describe("isGuardianOf", () => {
  it("returns isGuardian=false when ids are empty", async () => {
    const r = await isGuardianOf({ guardianAccountId: "", childAccountId: C });
    expect(r.isGuardian).toBe(false);
    expect(r.linkId).toBeNull();
    expect(withClientCalls).toHaveLength(0);
  });

  it("returns isGuardian=false when ids are identical", async () => {
    const r = await isGuardianOf({ guardianAccountId: G, childAccountId: G });
    expect(r.isGuardian).toBe(false);
  });

  it("returns isGuardian=true + role when an active primary guardian link exists", async () => {
    withClientResponder = () => ({
      rows: [{ link_id: LINK, role: "guardian_primary" }],
      rowCount: 1,
    });
    const r = await isGuardianOf({ guardianAccountId: G, childAccountId: C });
    expect(r.isGuardian).toBe(true);
    expect(r.role).toBe("guardian_primary");
    expect(r.linkId).toBe(LINK);
  });

  it("returns isGuardian=false when the pool is unavailable", async () => {
    withClientUnavailable = true;
    const r = await isGuardianOf({ guardianAccountId: G, childAccountId: C });
    expect(r.isGuardian).toBe(false);
  });

  it("filters to primary|secondary only (trusted_adult rows do NOT count)", async () => {
    withClientResponder = (sql) => {
      // The SQL hard-codes the role filter · simulate "no rows" as the
      // query already excludes trusted_adult.
      expect(sql).toMatch(/role\s+IN\s*\(\s*'guardian_primary'\s*,\s*'guardian_secondary'\s*\)/i);
      return { rows: [], rowCount: 0 };
    };
    const r = await isGuardianOf({ guardianAccountId: G, childAccountId: C });
    expect(r.isGuardian).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// listGuardianAccountIdsFor
// ─────────────────────────────────────────────────────────────────────

describe("listGuardianAccountIdsFor", () => {
  it("returns ordered guardian ids (primary first)", async () => {
    withClientResponder = () => ({
      rows: [
        { guardian_account_id: G },
        { guardian_account_id: G2 },
      ],
      rowCount: 2,
    });
    const ids = await listGuardianAccountIdsFor(C);
    expect(ids).toEqual([G, G2]);
  });

  it("returns [] on empty input", async () => {
    const ids = await listGuardianAccountIdsFor("");
    expect(ids).toEqual([]);
    expect(withClientCalls).toHaveLength(0);
  });

  it("returns [] when the pool is unavailable", async () => {
    withClientUnavailable = true;
    const ids = await listGuardianAccountIdsFor(C);
    expect(ids).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// listChildAccountIdsFor
// ─────────────────────────────────────────────────────────────────────

describe("listChildAccountIdsFor", () => {
  it("returns ordered child ids", async () => {
    withClientResponder = () => ({
      rows: [
        { child_account_id: C },
        { child_account_id: C2 },
      ],
      rowCount: 2,
    });
    const ids = await listChildAccountIdsFor(G);
    expect(ids).toEqual([C, C2]);
  });

  it("returns [] on empty input", async () => {
    const ids = await listChildAccountIdsFor("");
    expect(ids).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// resolveFamilyRelationshipKind
// ─────────────────────────────────────────────────────────────────────

describe("resolveFamilyRelationshipKind", () => {
  it("returns 'self' when viewer === target", async () => {
    const k = await resolveFamilyRelationshipKind({
      viewerAccountId: G,
      targetAccountId: G,
    });
    expect(k).toBe("self");
    expect(withClientCalls).toHaveLength(0);
  });

  it("returns 'no_relationship' when either id is empty", async () => {
    const k = await resolveFamilyRelationshipKind({
      viewerAccountId: "",
      targetAccountId: C,
    });
    expect(k).toBe("no_relationship");
  });

  it("returns 'guardian_of_target' when viewer has an active guardian link to target", async () => {
    withClientResponder = (sql) => {
      if (
        /guardian_account_id = \$1[\s\S]*child_account_id\s+= \$2[\s\S]*guardian_primary.*guardian_secondary/i.test(
          sql,
        )
      ) {
        return { rows: [{ "?column?": 1 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    };
    const k = await resolveFamilyRelationshipKind({
      viewerAccountId: G,
      targetAccountId: C,
    });
    expect(k).toBe("guardian_of_target");
  });

  it("returns 'child_of_target' when viewer is a child of target", async () => {
    let hit = 0;
    withClientResponder = (sql) => {
      hit += 1;
      // Query 1 (viewer-as-guardian) → no rows
      // Query 2 (viewer-as-child)    → one row
      if (hit === 2) return { rows: [{ "?column?": 1 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    };
    const k = await resolveFamilyRelationshipKind({
      viewerAccountId: C,
      targetAccountId: G,
    });
    expect(k).toBe("child_of_target");
  });

  it("returns 'trusted_adult_of_target' when only a trusted-adult link exists", async () => {
    let hit = 0;
    withClientResponder = () => {
      hit += 1;
      // Queries 1 (guardian) and 2 (child) → no rows; query 3 (trusted) → 1 row
      if (hit === 3) return { rows: [{ "?column?": 1 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    };
    const k = await resolveFamilyRelationshipKind({
      viewerAccountId: G,
      targetAccountId: C,
    });
    expect(k).toBe("trusted_adult_of_target");
  });

  it("returns 'no_relationship' when nothing matches", async () => {
    withClientResponder = () => ({ rows: [], rowCount: 0 });
    const k = await resolveFamilyRelationshipKind({
      viewerAccountId: G,
      targetAccountId: C,
    });
    expect(k).toBe("no_relationship");
  });

  it("returns 'no_relationship' when the pool is unavailable", async () => {
    withClientUnavailable = true;
    const k = await resolveFamilyRelationshipKind({
      viewerAccountId: G,
      targetAccountId: C,
    });
    expect(k).toBe("no_relationship");
  });
});
