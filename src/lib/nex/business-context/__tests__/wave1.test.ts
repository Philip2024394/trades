// NEX Business Context · Wave 1 · Foundation tests
// ==================================================
// Covers:
//   · blueprint-serialisation (pure round-trip + revision helper)
//   · registry sync API preserved (backwards-compat for ~27 callers)
//   · registry async persistence helpers (mocked DB adapter)
//   · permissions.assertPermission backwards-compat when requiredTier omitted
//   · permissions.tierMeetsRequirement matrix
//   · permissions.assertPermissionAsync gate with requiredTier (mocked)
//
// No real Supabase involved — the database module is vi.mocked so tests
// run hermetically. Real DB integration is out of scope for this wave.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------
// Mock the DB adapter BEFORE importing modules that pull it in.
// The registry uses lazy dynamic import → vi.doMock is what applies.
// ---------------------------------------------------------------------
const loadBlueprintBySlug = vi.fn();
const publishBlueprintForSlug = vi.fn();
const listPublishedBlueprints = vi.fn();
const readListingTier = vi.fn();
const resolveOwningEntityIdForSlug = vi.fn();
const loadBlueprintByOwningEntityId = vi.fn();

vi.mock("../database", () => ({
  loadBlueprintBySlug,
  publishBlueprintForSlug,
  listPublishedBlueprints,
  readListingTier,
  resolveOwningEntityIdForSlug,
  loadBlueprintByOwningEntityId,
}));

import { staircaseCompletedBlueprint } from "@/lib/app-builder/examples/staircase-company-completed";
import {
  serialiseBlueprint,
  deserialiseBlueprint,
  nextBlueprintRevision,
} from "../blueprint-serialisation";
import {
  registerBusiness,
  getBusiness,
  listBusinesses,
  toCustomerIdentity,
  toOwnerIdentity,
  _resetRegistryForTest,
  warmBusinessFromDatabase,
  publishBusinessToDatabase,
  warmAllBusinessesFromDatabase,
} from "../registry";
import {
  assertPermission,
  assertPermissionAsync,
  tierMeetsRequirement,
} from "../permissions";
import type { NexSession } from "../types";
import { TIER_CATALOG } from "@/lib/tierCatalog";

beforeEach(() => {
  _resetRegistryForTest();
  loadBlueprintBySlug.mockReset();
  publishBlueprintForSlug.mockReset();
  listPublishedBlueprints.mockReset();
  readListingTier.mockReset();
  resolveOwningEntityIdForSlug.mockReset();
  loadBlueprintByOwningEntityId.mockReset();
});

// =====================================================================
// blueprint-serialisation
// =====================================================================
describe("blueprint-serialisation", () => {
  it("round-trips an AppBlueprint through jsonb without shape drift", () => {
    const original = staircaseCompletedBlueprint;
    const stored = serialiseBlueprint(original);
    const restored = deserialiseBlueprint(stored);
    // JSON round-trip must preserve every field the AppBlueprint carries.
    expect(restored).toEqual(original);
  });

  it("nextBlueprintRevision increments monotonically from 1", () => {
    expect(nextBlueprintRevision(0)).toBe(1);
    expect(nextBlueprintRevision(1)).toBe(2);
    expect(nextBlueprintRevision(42)).toBe(43);
  });

  it("nextBlueprintRevision recovers from garbage input", () => {
    expect(nextBlueprintRevision(Number.NaN)).toBe(1);
    expect(nextBlueprintRevision(-5)).toBe(1);
    expect(nextBlueprintRevision(3.9)).toBe(4);
  });

  it("deserialiseBlueprint rejects non-object rows loudly", () => {
    expect(() => deserialiseBlueprint(null)).toThrow(/expected object/);
    expect(() => deserialiseBlueprint("blueprint" as unknown)).toThrow(/expected object/);
  });
});

// =====================================================================
// registry — synchronous API (backwards-compat contract)
// =====================================================================
describe("registry sync API (backwards-compat · Wave 1 must not break existing callers)", () => {
  it("registerBusiness + getBusiness round-trip via the in-memory cache", () => {
    const rec = registerBusiness("rowan-staircases", staircaseCompletedBlueprint);
    expect(rec.slug).toBe("rowan-staircases");
    expect(rec.blueprint).toBe(staircaseCompletedBlueprint);

    const fetched = getBusiness("rowan-staircases");
    expect(fetched).not.toBeNull();
    expect(fetched?.blueprint.id).toBe(staircaseCompletedBlueprint.id);
  });

  it("getBusiness returns null for unknown slug", () => {
    expect(getBusiness("nonexistent")).toBeNull();
  });

  it("listBusinesses returns every registered record", () => {
    registerBusiness("a", staircaseCompletedBlueprint);
    registerBusiness("b", staircaseCompletedBlueprint);
    expect(listBusinesses()).toHaveLength(2);
  });

  it("toCustomerIdentity never exposes owner-only fields", () => {
    const rec = registerBusiness("rowan-staircases", staircaseCompletedBlueprint);
    const c = toCustomerIdentity(rec);
    expect(c).toHaveProperty("displayName");
    expect(c).toHaveProperty("brand");
    expect(c).not.toHaveProperty("legalName");
    expect(c).not.toHaveProperty("blueprintId");
    expect(c).not.toHaveProperty("provenanceKeys");
    expect(c).not.toHaveProperty("locations");
  });

  it("toOwnerIdentity extends customer identity with owner-only fields", () => {
    const rec = registerBusiness("rowan-staircases", staircaseCompletedBlueprint);
    const o = toOwnerIdentity(rec);
    expect(o.displayName).toBe(rec.blueprint.identity.displayName);
    expect(o.blueprintId).toBe(rec.blueprint.id);
    expect(o.blueprintRevision).toBe(rec.blueprint.meta.revision);
    expect(Array.isArray(o.provenanceKeys)).toBe(true);
    expect(Array.isArray(o.locations)).toBe(true);
  });
});

// =====================================================================
// registry — async persistence helpers (Wave 1 new surface)
// =====================================================================
describe("registry async persistence helpers", () => {
  it("warmBusinessFromDatabase populates the cache from a DB row", async () => {
    const record = {
      slug: "rowan-staircases",
      blueprint: staircaseCompletedBlueprint,
      createdAt: "2026-09-23T00:00:00.000Z",
      updatedAt: "2026-09-23T00:00:00.000Z",
    };
    loadBlueprintBySlug.mockResolvedValueOnce(record);

    const returned = await warmBusinessFromDatabase("rowan-staircases");
    expect(returned).toEqual(record);
    // Subsequent sync read hits the cache
    expect(getBusiness("rowan-staircases")).toEqual(record);
  });

  it("warmBusinessFromDatabase returns null and leaves cache untouched when DB has no row", async () => {
    loadBlueprintBySlug.mockResolvedValueOnce(null);
    const returned = await warmBusinessFromDatabase("unknown-slug");
    expect(returned).toBeNull();
    expect(getBusiness("unknown-slug")).toBeNull();
  });

  it("publishBusinessToDatabase writes through and updates the cache", async () => {
    const record = {
      slug: "rowan-staircases",
      blueprint: staircaseCompletedBlueprint,
      createdAt: "2026-09-23T00:00:00.000Z",
      updatedAt: "2026-09-23T00:00:01.000Z",
    };
    publishBlueprintForSlug.mockResolvedValueOnce({
      ok: true,
      dbRevision: 2,
      publishedAt: "2026-09-23T00:00:01.000Z",
      record,
    });

    const returned = await publishBusinessToDatabase(
      "rowan-staircases",
      staircaseCompletedBlueprint,
      { publishedByPartyId: "party-123" }
    );
    expect(returned).toEqual(record);
    expect(getBusiness("rowan-staircases")).toEqual(record);
    expect(publishBlueprintForSlug).toHaveBeenCalledWith(
      "rowan-staircases",
      staircaseCompletedBlueprint,
      { publishedByPartyId: "party-123" }
    );
  });

  it("publishBusinessToDatabase throws (does not silently succeed) on DB failure", async () => {
    publishBlueprintForSlug.mockResolvedValueOnce({
      ok: false,
      status: 404,
      error: "no os_business_listings row for slug \"missing\"",
    });
    await expect(
      publishBusinessToDatabase("missing", staircaseCompletedBlueprint)
    ).rejects.toThrow(/404/);
    // Failure must not populate cache
    expect(getBusiness("missing")).toBeNull();
  });

  it("warmAllBusinessesFromDatabase bulk-populates the cache", async () => {
    const records = [
      {
        slug: "rowan-staircases",
        blueprint: staircaseCompletedBlueprint,
        createdAt: "2026-09-23T00:00:00.000Z",
        updatedAt: "2026-09-23T00:00:00.000Z",
      },
      {
        slug: "second-business",
        blueprint: staircaseCompletedBlueprint,
        createdAt: "2026-09-23T00:00:01.000Z",
        updatedAt: "2026-09-23T00:00:01.000Z",
      },
    ];
    listPublishedBlueprints.mockResolvedValueOnce(records);
    const n = await warmAllBusinessesFromDatabase();
    expect(n).toBe(2);
    expect(listBusinesses()).toHaveLength(2);
  });
});

// =====================================================================
// permissions — backwards-compat + new tier logic
// =====================================================================
describe("permissions.assertPermission (sync · backwards-compat when requiredTier omitted)", () => {
  const anonSession: NexSession = { role: "anonymous" };
  const customerSession: NexSession = { role: "customer", businessSlug: "rowan-staircases", customerId: "c1" };
  const ownerSession: NexSession = { role: "owner", businessSlug: "rowan-staircases", ownerAccountId: "o1" };

  it("blocks anonymous when a non-anonymous role is required", () => {
    const r = assertPermission(anonSession, { requiredRole: "owner" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("allows anonymous when anonymous is explicitly allowed", () => {
    const r = assertPermission(anonSession, { requiredRole: ["anonymous", "customer"] });
    expect(r.ok).toBe(true);
  });

  it("blocks role mismatch with 403", () => {
    const r = assertPermission(customerSession, { requiredRole: "owner" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("blocks businessSlug mismatch with 403", () => {
    const r = assertPermission(ownerSession, {
      requiredRole: "owner",
      businessSlug: "other-business",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("passes owner + matching slug when tier is not asked", () => {
    const r = assertPermission(ownerSession, {
      requiredRole: "owner",
      businessSlug: "rowan-staircases",
    });
    expect(r.ok).toBe(true);
  });

  it("ignores requiredTier in sync path (backwards-compat guardrail)", () => {
    // The sync gate must not attempt DB work · it warns in dev and passes.
    const r = assertPermission(ownerSession, {
      requiredRole: "owner",
      businessSlug: "rowan-staircases",
      requiredTier: "business",
    });
    expect(r.ok).toBe(true);
    // Sync path must NEVER call the DB adapter
    expect(readListingTier).not.toHaveBeenCalled();
  });
});

describe("permissions.tierMeetsRequirement matrix", () => {
  it("respects TIER_ORDER (free < starter < professional < business < works)", () => {
    expect(tierMeetsRequirement("free", "free")).toBe(true);
    expect(tierMeetsRequirement("free", "starter")).toBe(false);
    expect(tierMeetsRequirement("starter", "free")).toBe(true);
    expect(tierMeetsRequirement("business", "professional")).toBe(true);
    expect(tierMeetsRequirement("works", "business")).toBe(true);
    expect(tierMeetsRequirement("professional", "works")).toBe(false);
  });
});

describe("permissions.assertPermissionAsync (Wave 1 tier enforcement)", () => {
  const ownerSession: NexSession = { role: "owner", businessSlug: "rowan-staircases", ownerAccountId: "o1" };

  it("delegates to assertPermission (no DB call) when requiredTier is omitted", async () => {
    const r = await assertPermissionAsync(ownerSession, {
      requiredRole: "owner",
      businessSlug: "rowan-staircases",
    });
    expect(r.ok).toBe(true);
    expect(readListingTier).not.toHaveBeenCalled();
  });

  it("returns 403 when businessSlug cannot be resolved for tier check", async () => {
    const noSlugSession: NexSession = { role: "owner", ownerAccountId: "o1" };
    const r = await assertPermissionAsync(noSlugSession, {
      requiredRole: "owner",
      requiredTier: "professional",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("allows when DB tier meets required", async () => {
    readListingTier.mockResolvedValueOnce("business");
    const r = await assertPermissionAsync(ownerSession, {
      requiredRole: "owner",
      businessSlug: "rowan-staircases",
      requiredTier: "professional",
    });
    expect(r.ok).toBe(true);
    expect(readListingTier).toHaveBeenCalledWith("rowan-staircases");
  });

  it("denies with 403 when DB tier does not meet required", async () => {
    readListingTier.mockResolvedValueOnce("free");
    const r = await assertPermissionAsync(ownerSession, {
      requiredRole: "owner",
      businessSlug: "rowan-staircases",
      requiredTier: "professional",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(403);
      expect(r.error).toMatch(/does not meet/);
    }
  });

  it("resolves DB legacy tier strings via tierFromDbValue (app_paid → professional)", async () => {
    readListingTier.mockResolvedValueOnce("app_paid");
    const r = await assertPermissionAsync(ownerSession, {
      requiredRole: "owner",
      businessSlug: "rowan-staircases",
      requiredTier: TIER_CATALOG.professional.key,
    });
    expect(r.ok).toBe(true);
  });

  it("propagates upstream permission failures without touching the DB", async () => {
    const customerSession: NexSession = { role: "customer", businessSlug: "rowan-staircases" };
    const r = await assertPermissionAsync(customerSession, {
      requiredRole: "owner",
      businessSlug: "rowan-staircases",
      requiredTier: "professional",
    });
    expect(r.ok).toBe(false);
    expect(readListingTier).not.toHaveBeenCalled();
  });
});
