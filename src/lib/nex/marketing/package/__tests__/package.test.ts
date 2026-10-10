// src/lib/nex/marketing/package/__tests__/package.test.ts
//
// NEX Stage 3 · Member Marketing Package acceptance suite
// Founder-authorised programme (three-lane operating doctrine · ADR-0003a).
//
// Comprehensive under-test verification. World-proof boundary remains CLOSED.

import { describe, it, expect, beforeEach } from "vitest";
import {
  createPackage,
  loadPackageById,
  listPackagesForMember,
  transitionStatus,
  reserve,
  consume,
  release,
  derivePackageAttributionKey,
  assertMemberLane,
  loadAttributionById,
  computeCapacity,
  assertPackageDenominationLanguage,
  InvalidPackageStatusTransitionError,
  MemberIsolationViolationError,
  PackageError,
  type PackageStatus,
} from "..";
import { makeMockPool, insertPackage } from "./mock-pool";

let mock: ReturnType<typeof makeMockPool>;
beforeEach(() => { mock = makeMockPool(); });

// ═══════════════════════════════════════════════════════════════════
// (A) Denomination-language guard (ADR-0003a Clause 3)
// ═══════════════════════════════════════════════════════════════════
describe("Stage 3 · (A) denomination-language guard", () => {
  it("(A1) allows managed-capacity language", () => {
    expect(() => assertPackageDenominationLanguage("starter-500-managed-sends", "500 managed campaign sends", "test")).not.toThrow();
    expect(() => assertPackageDenominationLanguage("monthly-2000-managed-sends", "Monthly capacity", "test")).not.toThrow();
    expect(() => assertPackageDenominationLanguage("1-campaign-package", "1 campaign", "test")).not.toThrow();
  });
  it("(A2) refuses '500 leads'", () => {
    expect(() => assertPackageDenominationLanguage("500-leads", "500 leads pack", "test")).toThrow(PackageError);
  });
  it("(A3) refuses 'raw addresses'", () => {
    expect(() => assertPackageDenominationLanguage("basic", "Raw addresses pack", "test")).toThrow(PackageError);
  });
  it("(A4) refuses 'contact list'", () => {
    expect(() => assertPackageDenominationLanguage("basic", "USA contact list", "test")).toThrow(PackageError);
  });
  it("(A5) refuses 'downloadable csv'", () => {
    expect(() => assertPackageDenominationLanguage("basic", "Downloadable CSV export pack", "test")).toThrow(PackageError);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (B) Package creation + purchase idempotency
// ═══════════════════════════════════════════════════════════════════
describe("Stage 3 · (B) package creation + purchase idempotency", () => {
  it("(B1) creates a package in 'available' state · zero used", async () => {
    const pkg = await createPackage(mock.client, {
      member_id: "member-1",
      package_type: "starter-500-managed-sends",
      display_name: "500 managed campaign sends",
      purchased_capacity: 500,
      actor: "member:member-1",
    });
    expect(pkg.status).toBe("available");
    expect(pkg.purchased_capacity).toBe(500);
    expect(pkg.reserved_capacity).toBe(0);
    expect(pkg.consumed_capacity).toBe(0);
  });

  it("(B2) refuses creation with forbidden 'leads' language", async () => {
    await expect(createPackage(mock.client, {
      member_id: "m",
      package_type: "500-leads-pack",     // forbidden
      purchased_capacity: 500,
      actor: "test",
    })).rejects.toThrow(PackageError);
  });

  it("(B3) duplicate purchase_reference returns EXISTING package (idempotent)", async () => {
    const first = await createPackage(mock.client, {
      member_id: "m",
      package_type: "starter-managed-sends",
      purchased_capacity: 100,
      purchase_reference: "stripe-sub-XYZ-123",
      actor: "test",
    });
    const second = await createPackage(mock.client, {
      member_id: "m",
      package_type: "starter-managed-sends",
      purchased_capacity: 200,   // even with different capacity
      purchase_reference: "stripe-sub-XYZ-123",
      actor: "test",
    });
    // Same package_id · same purchased_capacity (from first)
    expect(second.package_id).toBe(first.package_id);
    expect(second.purchased_capacity).toBe(100);
  });

  it("(B4) same purchase_reference but DIFFERENT member creates a NEW package", async () => {
    const a = await createPackage(mock.client, {
      member_id: "m1", package_type: "starter", purchased_capacity: 100,
      purchase_reference: "sub-1", actor: "test",
    });
    const b = await createPackage(mock.client, {
      member_id: "m2", package_type: "starter", purchased_capacity: 100,
      purchase_reference: "sub-1", actor: "test",
    });
    expect(b.package_id).not.toBe(a.package_id);
  });

  it("(B5) refuses negative capacity", async () => {
    await expect(createPackage(mock.client, {
      member_id: "m", package_type: "starter", purchased_capacity: -1, actor: "test",
    })).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// (C) Status transitions (M23-style)
// ═══════════════════════════════════════════════════════════════════
describe("Stage 3 · (C) status transitions", () => {
  it("(C1) available → active valid", async () => {
    const p = await createPackage(mock.client, { member_id: "m", package_type: "s", purchased_capacity: 10, actor: "t" });
    const p2 = await transitionStatus(mock.client, p.package_id, "active", "test");
    expect(p2.status).toBe("active");
    expect(p2.activated_at).not.toBe(null);
  });

  it("(C2) active → paused → active valid (reversible)", async () => {
    const p = insertPackage(mock, { member_id: "m", purchased_capacity: 10, status: "active" });
    const paused = await transitionStatus(mock.client, p.package_id, "paused", "test");
    expect(paused.status).toBe("paused");
    const resumed = await transitionStatus(mock.client, p.package_id, "active", "test");
    expect(resumed.status).toBe("active");
  });

  it("(C3) invalid transition available → exhausted throws", async () => {
    const p = await createPackage(mock.client, { member_id: "m", package_type: "s", purchased_capacity: 10, actor: "t" });
    await expect(transitionStatus(mock.client, p.package_id, "exhausted", "test"))
      .rejects.toThrow(InvalidPackageStatusTransitionError);
  });

  it("(C4) expired is terminal · no transitions out", async () => {
    const p = insertPackage(mock, { member_id: "m", purchased_capacity: 10, status: "active" });
    await transitionStatus(mock.client, p.package_id, "expired", "test");
    await expect(transitionStatus(mock.client, p.package_id, "active", "test"))
      .rejects.toThrow(InvalidPackageStatusTransitionError);
  });

  it("(C5) cancelled is terminal", async () => {
    const p = insertPackage(mock, { member_id: "m", purchased_capacity: 10, status: "active" });
    await transitionStatus(mock.client, p.package_id, "cancelled", "test");
    await expect(transitionStatus(mock.client, p.package_id, "active", "test"))
      .rejects.toThrow(InvalidPackageStatusTransitionError);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (D) Reserve · basic
// ═══════════════════════════════════════════════════════════════════
describe("Stage 3 · (D) reserve", () => {
  it("(D1) reserve on active package with capacity · succeeds · reserved_capacity=1", async () => {
    const p = insertPackage(mock, { member_id: "m1", purchased_capacity: 10 });
    const r = await reserve(mock.client, {
      package_id: p.package_id, member_id: "m1",
      campaign_id: "c1", contact_id: "u1", queue_id: "q1",
    });
    expect(r.kind).toBe("reserved");
    const pkg = await loadPackageById(mock.client, p.package_id);
    expect(pkg?.reserved_capacity).toBe(1);
  });

  it("(D2) reserve on 'available' (not active) package refuses · package_not_consumable", async () => {
    const p = insertPackage(mock, { member_id: "m1", purchased_capacity: 10, status: "available" });
    const r = await reserve(mock.client, {
      package_id: p.package_id, member_id: "m1",
      campaign_id: "c1", contact_id: "u1",
    });
    expect(r.kind).toBe("package_not_consumable");
    if (r.kind === "package_not_consumable") expect(r.status).toBe("available");
  });

  it("(D3) reserve on missing package · package_not_found", async () => {
    const r = await reserve(mock.client, {
      package_id: "does-not-exist", member_id: "m1",
      campaign_id: "c1", contact_id: "u1",
    });
    expect(r.kind).toBe("package_not_found");
  });
});

// ═══════════════════════════════════════════════════════════════════
// (E) Reserve · capacity exhaustion
// ═══════════════════════════════════════════════════════════════════
describe("Stage 3 · (E) reserve · capacity exhaustion", () => {
  it("(E1) reserving all N units succeeds · N+1 refuses · package auto-transitions to exhausted", async () => {
    const p = insertPackage(mock, { member_id: "m", purchased_capacity: 2 });
    const r1 = await reserve(mock.client, { package_id: p.package_id, member_id: "m", campaign_id: "c", contact_id: "u1", queue_id: "q1" });
    const r2 = await reserve(mock.client, { package_id: p.package_id, member_id: "m", campaign_id: "c", contact_id: "u2", queue_id: "q2" });
    const r3 = await reserve(mock.client, { package_id: p.package_id, member_id: "m", campaign_id: "c", contact_id: "u3", queue_id: "q3" });
    expect(r1.kind).toBe("reserved");
    expect(r2.kind).toBe("reserved");
    // After 2/2 reserved · package moves to 'exhausted' · then r3 sees status not consumable
    expect(["capacity_exhausted", "package_not_consumable"]).toContain(r3.kind);
  });

  it("(E2) 'units' > remaining refuses · capacity_exhausted · no partial reservation", async () => {
    const p = insertPackage(mock, { member_id: "m", purchased_capacity: 3 });
    const r = await reserve(mock.client, {
      package_id: p.package_id, member_id: "m",
      campaign_id: "c", contact_id: "u", queue_id: "q",
      units: 5,
    });
    expect(r.kind).toBe("capacity_exhausted");
    const pkg = await loadPackageById(mock.client, p.package_id);
    expect(pkg?.reserved_capacity).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (F) Reserve · idempotency (retry-safe)
// ═══════════════════════════════════════════════════════════════════
describe("Stage 3 · (F) reserve · idempotency", () => {
  it("(F1) same (package, campaign, contact, queue, attempt) retry → already_attributed · no double-consume", async () => {
    const p = insertPackage(mock, { member_id: "m", purchased_capacity: 10 });
    const args = { package_id: p.package_id, member_id: "m", campaign_id: "c1", contact_id: "u1", queue_id: "q1", attempt_id: 1 };
    const r1 = await reserve(mock.client, args);
    const r2 = await reserve(mock.client, args);
    expect(r1.kind).toBe("reserved");
    expect(r2.kind).toBe("already_attributed");
    const pkg = await loadPackageById(mock.client, p.package_id);
    expect(pkg?.reserved_capacity).toBe(1);   // NOT 2 · idempotency prevents double-charge
  });

  it("(F2) different attempt_id → different key → NEW reservation", async () => {
    const p = insertPackage(mock, { member_id: "m", purchased_capacity: 10 });
    const args1 = { package_id: p.package_id, member_id: "m", campaign_id: "c1", contact_id: "u1", queue_id: "q1", attempt_id: 1 };
    const args2 = { ...args1, attempt_id: 2 };
    await reserve(mock.client, args1);
    await reserve(mock.client, args2);
    const pkg = await loadPackageById(mock.client, p.package_id);
    expect(pkg?.reserved_capacity).toBe(2);
  });

  it("(F3) derivePackageAttributionKey is deterministic for same inputs", () => {
    const k1 = derivePackageAttributionKey({ package_id: "p", campaign_id: "c", contact_id: "u", queue_id: "q", attempt_id: 1 });
    const k2 = derivePackageAttributionKey({ package_id: "p", campaign_id: "c", contact_id: "u", queue_id: "q", attempt_id: 1 });
    expect(k1).toBe(k2);
  });

  it("(F4) derivePackageAttributionKey differs for different inputs", () => {
    const k1 = derivePackageAttributionKey({ package_id: "p", campaign_id: "c", contact_id: "u1", queue_id: "q" });
    const k2 = derivePackageAttributionKey({ package_id: "p", campaign_id: "c", contact_id: "u2", queue_id: "q" });
    expect(k1).not.toBe(k2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (G) Reserve · member isolation (Clause 4)
// ═══════════════════════════════════════════════════════════════════
describe("Stage 3 · (G) member isolation", () => {
  it("(G1) Member B cannot reserve on Member A's package · member_isolation_violation", async () => {
    const pA = insertPackage(mock, { member_id: "member-A", purchased_capacity: 10 });
    const r = await reserve(mock.client, {
      package_id: pA.package_id, member_id: "member-B",   // WRONG member
      campaign_id: "c", contact_id: "u", queue_id: "q",
    });
    expect(r.kind).toBe("member_isolation_violation");
    if (r.kind === "member_isolation_violation") {
      expect(r.expected_member).toBe("member-A");
      expect(r.got_member).toBe("member-B");
    }
    const pkg = await loadPackageById(mock.client, pA.package_id);
    expect(pkg?.reserved_capacity).toBe(0);   // Nothing consumed
  });

  it("(G2) listPackagesForMember returns ONLY the caller's packages", async () => {
    insertPackage(mock, { member_id: "A", purchased_capacity: 10 });
    insertPackage(mock, { member_id: "A", purchased_capacity: 20 });
    insertPackage(mock, { member_id: "B", purchased_capacity: 30 });
    const listA = await listPackagesForMember(mock.client, "A");
    const listB = await listPackagesForMember(mock.client, "B");
    expect(listA.length).toBe(2);
    expect(listB.length).toBe(1);
    for (const p of listA) expect(p.member_id).toBe("A");
    for (const p of listB) expect(p.member_id).toBe("B");
  });

  it("(G3) Member B replay with SAME idempotency-key seed but wrong member_id → still refused", async () => {
    const pA = insertPackage(mock, { member_id: "A", purchased_capacity: 10 });
    // A reserves successfully
    await reserve(mock.client, {
      package_id: pA.package_id, member_id: "A",
      campaign_id: "c1", contact_id: "u1", queue_id: "q1", attempt_id: 1,
    });
    // B replays the same operation identifiers but under their own member_id
    // This is a defence-in-depth check · the loadByKey path re-verifies member
    const r = await reserve(mock.client, {
      package_id: pA.package_id, member_id: "B",
      campaign_id: "c1", contact_id: "u1", queue_id: "q1", attempt_id: 1,
    });
    // Two ways this can be refused correctly:
    //   1. attribution found with member_id=A → member_isolation_violation
    //   2. package member_id mismatch on the reserve path
    // Both correctly refuse. The key is that Member B CANNOT complete this.
    expect(["member_isolation_violation"]).toContain(r.kind);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (H) Consume
// ═══════════════════════════════════════════════════════════════════
describe("Stage 3 · (H) consume", () => {
  it("(H1) reserved → consumed transition · reserved_capacity moves to consumed_capacity", async () => {
    const p = insertPackage(mock, { member_id: "m", purchased_capacity: 10 });
    const r = await reserve(mock.client, { package_id: p.package_id, member_id: "m", campaign_id: "c", contact_id: "u", queue_id: "q" });
    if (r.kind !== "reserved") throw new Error("expected reserved");
    const c = await consume(mock.client, { attribution_id: r.attribution.attribution_id });
    expect(c.kind).toBe("consumed");
    const pkg = await loadPackageById(mock.client, p.package_id);
    expect(pkg?.reserved_capacity).toBe(0);
    expect(pkg?.consumed_capacity).toBe(1);
  });

  it("(H2) consume idempotent · already_consumed on retry", async () => {
    const p = insertPackage(mock, { member_id: "m", purchased_capacity: 10 });
    const r = await reserve(mock.client, { package_id: p.package_id, member_id: "m", campaign_id: "c", contact_id: "u", queue_id: "q" });
    if (r.kind !== "reserved") throw new Error("expected reserved");
    await consume(mock.client, { attribution_id: r.attribution.attribution_id });
    const c2 = await consume(mock.client, { attribution_id: r.attribution.attribution_id });
    expect(c2.kind).toBe("already_consumed");
    const pkg = await loadPackageById(mock.client, p.package_id);
    expect(pkg?.consumed_capacity).toBe(1);   // Not 2
  });

  it("(H3) consume unknown attribution · attribution_not_found", async () => {
    const c = await consume(mock.client, { attribution_id: "nonexistent" });
    expect(c.kind).toBe("attribution_not_found");
  });
});

// ═══════════════════════════════════════════════════════════════════
// (I) Release
// ═══════════════════════════════════════════════════════════════════
describe("Stage 3 · (I) release", () => {
  it("(I1) reserved → released · reserved_capacity returns to remaining", async () => {
    const p = insertPackage(mock, { member_id: "m", purchased_capacity: 10 });
    const r = await reserve(mock.client, { package_id: p.package_id, member_id: "m", campaign_id: "c", contact_id: "u", queue_id: "q" });
    if (r.kind !== "reserved") throw new Error("expected reserved");
    const rel = await release(mock.client, { attribution_id: r.attribution.attribution_id, reason: "queue_cancelled" });
    expect(rel.kind).toBe("released");
    const pkg = await loadPackageById(mock.client, p.package_id);
    expect(pkg?.reserved_capacity).toBe(0);
    expect(pkg?.consumed_capacity).toBe(0);
  });

  it("(I2) release consumed FORBIDDEN · cannot_release_consumed", async () => {
    const p = insertPackage(mock, { member_id: "m", purchased_capacity: 10 });
    const r = await reserve(mock.client, { package_id: p.package_id, member_id: "m", campaign_id: "c", contact_id: "u", queue_id: "q" });
    if (r.kind !== "reserved") throw new Error("expected reserved");
    await consume(mock.client, { attribution_id: r.attribution.attribution_id });
    const rel = await release(mock.client, { attribution_id: r.attribution.attribution_id, reason: "test" });
    expect(rel.kind).toBe("cannot_release_consumed");
  });

  it("(I3) release idempotent · already_released", async () => {
    const p = insertPackage(mock, { member_id: "m", purchased_capacity: 10 });
    const r = await reserve(mock.client, { package_id: p.package_id, member_id: "m", campaign_id: "c", contact_id: "u", queue_id: "q" });
    if (r.kind !== "reserved") throw new Error("expected reserved");
    await release(mock.client, { attribution_id: r.attribution.attribution_id, reason: "first" });
    const rel2 = await release(mock.client, { attribution_id: r.attribution.attribution_id, reason: "retry" });
    expect(rel2.kind).toBe("already_released");
  });

  it("(I4) release un-exhausts a package when it was exhausted only by reservations", async () => {
    const p = insertPackage(mock, { member_id: "m", purchased_capacity: 1 });
    const r = await reserve(mock.client, { package_id: p.package_id, member_id: "m", campaign_id: "c", contact_id: "u", queue_id: "q" });
    if (r.kind !== "reserved") throw new Error("expected reserved");
    const pkg_before = await loadPackageById(mock.client, p.package_id);
    expect(pkg_before?.status).toBe("exhausted");
    await release(mock.client, { attribution_id: r.attribution.attribution_id, reason: "queue_failed" });
    const pkg_after = await loadPackageById(mock.client, p.package_id);
    expect(pkg_after?.status).toBe("active");   // Reverted back
    expect(pkg_after?.reserved_capacity).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (J) Concurrent reservation safety
// ═══════════════════════════════════════════════════════════════════
describe("Stage 3 · (J) concurrent reservation safety", () => {
  it("(J1) 10 parallel reserves against limit=5 · exactly FIVE succeed · reserved_capacity=5", async () => {
    const p = insertPackage(mock, { member_id: "m", purchased_capacity: 5 });
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => reserve(mock.client, {
      package_id: p.package_id, member_id: "m",
      campaign_id: "c", contact_id: `u-${i}`, queue_id: `q-${i}`,
    })));
    const reserved = results.filter(r => r.kind === "reserved").length;
    expect(reserved).toBe(5);
    const pkg = await loadPackageById(mock.client, p.package_id);
    expect(pkg?.reserved_capacity).toBe(5);
  });

  it("(J2) same idempotency-key parallel retry · exactly ONE reserved · others already_attributed", async () => {
    const p = insertPackage(mock, { member_id: "m", purchased_capacity: 10 });
    const args = { package_id: p.package_id, member_id: "m", campaign_id: "c", contact_id: "u", queue_id: "q", attempt_id: 1 };
    const results = await Promise.all(Array.from({ length: 5 }, () => reserve(mock.client, args)));
    const reserved = results.filter(r => r.kind === "reserved").length;
    const already = results.filter(r => r.kind === "already_attributed").length;
    expect(reserved).toBe(1);
    expect(already).toBe(4);
    const pkg = await loadPackageById(mock.client, p.package_id);
    expect(pkg?.reserved_capacity).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (K) Lane isolation (three-lane doctrine)
// ═══════════════════════════════════════════════════════════════════
describe("Stage 3 · (K) lane isolation · package is MEMBER-lane only", () => {
  it("(K1) assertMemberLane permits 'member' · refuses 'auto' and 'founder'", () => {
    expect(() => assertMemberLane("member", "test")).not.toThrow();
    expect(() => assertMemberLane("auto", "test")).toThrow(/three-lane operating doctrine/);
    expect(() => assertMemberLane("founder", "test")).toThrow(/three-lane operating doctrine/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (L) computeCapacity view
// ═══════════════════════════════════════════════════════════════════
describe("Stage 3 · (L) capacity view", () => {
  it("(L1) computes remaining = purchased - reserved - consumed", async () => {
    const p = insertPackage(mock, { member_id: "m", purchased_capacity: 10 });
    p.reserved_capacity = 3;
    p.consumed_capacity = 2;
    const cap = computeCapacity(p);
    expect(cap.remaining).toBe(5);
    expect(cap.is_consumable).toBe(true);
  });

  it("(L2) is_consumable false for non-active status", async () => {
    const p = insertPackage(mock, { member_id: "m", purchased_capacity: 10, status: "paused" });
    const cap = computeCapacity(p);
    expect(cap.is_consumable).toBe(false);
  });

  it("(L3) is_consumable false when remaining=0", async () => {
    const p = insertPackage(mock, { member_id: "m", purchased_capacity: 10, status: "active" });
    p.consumed_capacity = 10;
    const cap = computeCapacity(p);
    expect(cap.is_consumable).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (M) Contact-boundary preservation (ADR-0003a Clause 1)
// ═══════════════════════════════════════════════════════════════════
describe("Stage 3 · (M) contact-boundary preservation (structural)", () => {
  it("(M1) package types module exports NO 'exportContacts' / 'downloadLeads' / 'listAddresses' function", async () => {
    const pkg = await import("..");
    // Structural assertion: none of the forbidden exports exist
    expect((pkg as any).exportContacts).toBeUndefined();
    expect((pkg as any).downloadLeads).toBeUndefined();
    expect((pkg as any).listAddresses).toBeUndefined();
    expect((pkg as any).exportContactList).toBeUndefined();
  });

  it("(M2) Attribution ledger stores contact_id (opaque UUID) NOT email address", async () => {
    const p = insertPackage(mock, { member_id: "m", purchased_capacity: 10 });
    const r = await reserve(mock.client, {
      package_id: p.package_id, member_id: "m",
      campaign_id: "c", contact_id: "opaque-uuid-not-email", queue_id: "q",
    });
    if (r.kind !== "reserved") throw new Error("expected reserved");
    expect((r.attribution as any).email).toBeUndefined();
    expect(r.attribution.contact_id).toBe("opaque-uuid-not-email");
  });
});

// ═══════════════════════════════════════════════════════════════════
// (N) Restart persistence
// ═══════════════════════════════════════════════════════════════════
describe("Stage 3 · (N) restart persistence", () => {
  it("(N1) packages + attributions survive client reconnect (same store)", async () => {
    const p = insertPackage(mock, { member_id: "m", purchased_capacity: 10 });
    const r = await reserve(mock.client, { package_id: p.package_id, member_id: "m", campaign_id: "c", contact_id: "u", queue_id: "q" });
    if (r.kind !== "reserved") throw new Error("expected reserved");
    const reconnect = mock.reconnect();
    const attr = await loadAttributionById(reconnect.client, r.attribution.attribution_id);
    expect(attr?.state).toBe("reserved");
    const pkg = await loadPackageById(reconnect.client, p.package_id);
    expect(pkg?.reserved_capacity).toBe(1);
  });
});
