// src/lib/nex-native/family-safety/home-service.test.ts
//
// Unit tests for the Family Safety home-page snapshot service.
// Deps are injected · we never touch the real DB.

import { describe, expect, it } from "vitest";

import { getFamilyHomeSnapshot } from "./home-service";
import { FAMILY_HOME_SNAPSHOT_SAFE_DEFAULT } from "@/components/nex-native/family-safety/types";

const VIEWER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function stubDeps(opts: {
  guardians?: readonly string[];
  children?: readonly string[];
  pending?: number;
  throwOn?: "guardians" | "children" | "pending";
}): {
  listGuardianAccountIdsFor: (v: string) => Promise<readonly string[]>;
  listChildAccountIdsFor: (v: string) => Promise<readonly string[]>;
  countPendingInvitations: (v: string) => Promise<number>;
} {
  return {
    listGuardianAccountIdsFor: async () => {
      if (opts.throwOn === "guardians") throw new Error("db down");
      return opts.guardians ?? [];
    },
    listChildAccountIdsFor: async () => {
      if (opts.throwOn === "children") throw new Error("db down");
      return opts.children ?? [];
    },
    countPendingInvitations: async () => {
      if (opts.throwOn === "pending") throw new Error("db down");
      return opts.pending ?? 0;
    },
  };
}

describe("getFamilyHomeSnapshot · default-closed shape", () => {
  it("returns the safe default when the viewerAccountId is blank", async () => {
    const snap = await getFamilyHomeSnapshot(
      { viewerAccountId: "" },
      stubDeps({}),
    );
    expect(snap).toEqual(FAMILY_HOME_SNAPSHOT_SAFE_DEFAULT);
  });

  it("returns the safe default when the viewerAccountId is whitespace only", async () => {
    const snap = await getFamilyHomeSnapshot(
      { viewerAccountId: "   " },
      stubDeps({}),
    );
    expect(snap).toEqual(FAMILY_HOME_SNAPSHOT_SAFE_DEFAULT);
  });
});

describe("getFamilyHomeSnapshot · membership state resolution", () => {
  it("resolves 'none' when the viewer has no links", async () => {
    const snap = await getFamilyHomeSnapshot(
      { viewerAccountId: VIEWER },
      stubDeps({}),
    );
    expect(snap.familyMembershipState).toBe("none");
    expect(snap.hasAnyChildLink).toBe(false);
    expect(snap.hasAnyGuardianLink).toBe(false);
    expect(snap.pendingInvitationCount).toBe(0);
    expect(snap.canAccessDashboard).toBe(false);
    expect(snap.canConfigureSafeChat).toBe(false);
  });

  it("resolves 'active_guardian' when the viewer has at least one ward", async () => {
    const snap = await getFamilyHomeSnapshot(
      { viewerAccountId: VIEWER },
      stubDeps({ children: [OTHER] }),
    );
    expect(snap.familyMembershipState).toBe("active_guardian");
    expect(snap.hasAnyGuardianLink).toBe(true);
    expect(snap.hasAnyChildLink).toBe(false);
    expect(snap.canAccessDashboard).toBe(true);
    expect(snap.canConfigureSafeChat).toBe(true);
  });

  it("resolves 'active_child' when the viewer has at least one guardian", async () => {
    const snap = await getFamilyHomeSnapshot(
      { viewerAccountId: VIEWER },
      stubDeps({ guardians: [OTHER] }),
    );
    expect(snap.familyMembershipState).toBe("active_child");
    expect(snap.hasAnyChildLink).toBe(true);
    expect(snap.hasAnyGuardianLink).toBe(false);
    expect(snap.canAccessDashboard).toBe(true);
    expect(snap.canConfigureSafeChat).toBe(false);
  });

  it("resolves 'pending_invitation' when the viewer has only a pending invite", async () => {
    const snap = await getFamilyHomeSnapshot(
      { viewerAccountId: VIEWER },
      stubDeps({ pending: 2 }),
    );
    expect(snap.familyMembershipState).toBe("pending_invitation");
    expect(snap.pendingInvitationCount).toBe(2);
    expect(snap.canAccessDashboard).toBe(false);
    expect(snap.canConfigureSafeChat).toBe(false);
  });

  it("prefers 'active_guardian' over a stray pending invitation", async () => {
    const snap = await getFamilyHomeSnapshot(
      { viewerAccountId: VIEWER },
      stubDeps({ children: [OTHER], pending: 1 }),
    );
    expect(snap.familyMembershipState).toBe("active_guardian");
    expect(snap.pendingInvitationCount).toBe(1);
  });

  it("prefers 'active_child' over a stray pending invitation", async () => {
    const snap = await getFamilyHomeSnapshot(
      { viewerAccountId: VIEWER },
      stubDeps({ guardians: [OTHER], pending: 1 }),
    );
    expect(snap.familyMembershipState).toBe("active_child");
    expect(snap.pendingInvitationCount).toBe(1);
  });
});

describe("getFamilyHomeSnapshot · safe-default fallback on errors", () => {
  it("returns the safe default if the guardians reader throws", async () => {
    const snap = await getFamilyHomeSnapshot(
      { viewerAccountId: VIEWER },
      stubDeps({ throwOn: "guardians" }),
    );
    expect(snap).toEqual(FAMILY_HOME_SNAPSHOT_SAFE_DEFAULT);
  });

  it("returns the safe default if the children reader throws", async () => {
    const snap = await getFamilyHomeSnapshot(
      { viewerAccountId: VIEWER },
      stubDeps({ throwOn: "children" }),
    );
    expect(snap).toEqual(FAMILY_HOME_SNAPSHOT_SAFE_DEFAULT);
  });

  it("returns the safe default if the pending-count reader throws", async () => {
    const snap = await getFamilyHomeSnapshot(
      { viewerAccountId: VIEWER },
      stubDeps({ throwOn: "pending" }),
    );
    expect(snap).toEqual(FAMILY_HOME_SNAPSHOT_SAFE_DEFAULT);
  });

  it("coerces a negative pending count to 0", async () => {
    const snap = await getFamilyHomeSnapshot(
      { viewerAccountId: VIEWER },
      stubDeps({ pending: -5 }),
    );
    expect(snap.pendingInvitationCount).toBe(0);
    expect(snap.familyMembershipState).toBe("none");
  });

  it("coerces a non-finite pending count to 0", async () => {
    const snap = await getFamilyHomeSnapshot(
      { viewerAccountId: VIEWER },
      stubDeps({ pending: Number.NaN }),
    );
    expect(snap.pendingInvitationCount).toBe(0);
  });

  it("floors a fractional pending count", async () => {
    const snap = await getFamilyHomeSnapshot(
      { viewerAccountId: VIEWER },
      stubDeps({ pending: 2.9 }),
    );
    expect(snap.pendingInvitationCount).toBe(2);
  });
});
