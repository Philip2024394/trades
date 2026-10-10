// src/lib/nex/marketing/auto/__tests__/operating-budget.test.ts
//
// NEX Stage 5 · Operating budget acceptance suite
// Founder-authorised programme.
//
// Proves AUTO accounting invariants + lane-isolation canary (AUTO never
// touches nex.marketing_package · verified via mock canary flag).

import { describe, it, expect, beforeEach } from "vitest";
import {
  createBudget,
  loadBudgetById,
  reserveBudget,
  consumeBudget,
  releaseBudget,
  deriveBudgetAttributionKey,
} from "..";
import { makeMockPool, insertBudget, seedMemberPackageCanary } from "./mock-pool";

let mock: ReturnType<typeof makeMockPool>;
beforeEach(() => { mock = makeMockPool(); });

// ═══════════════════════════════════════════════════════════════════
// (A) Budget lifecycle
// ═══════════════════════════════════════════════════════════════════
describe("Stage 5 · (A) operating budget lifecycle", () => {
  it("(A1) creates budget with active status", async () => {
    const b = await createBudget(mock.client, { name: "auto-marketing-test", purchased_capacity: 1000, actor: "test" });
    expect(b.status).toBe("active");
    expect(b.reserved_capacity).toBe(0);
    expect(b.consumed_capacity).toBe(0);
  });

  it("(A2) loadBudgetById round-trips", async () => {
    const b = await createBudget(mock.client, { name: "b2", purchased_capacity: 100, actor: "test" });
    const back = await loadBudgetById(mock.client, b.budget_id);
    expect(back?.budget_id).toBe(b.budget_id);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (B) Reserve / consume / release
// ═══════════════════════════════════════════════════════════════════
describe("Stage 5 · (B) reserve/consume/release", () => {
  it("(B1) reserve on active budget succeeds · reserved_capacity=1", async () => {
    const b = insertBudget(mock, { name: "b", purchased_capacity: 10 });
    const r = await reserveBudget(mock.client, { budget_id: b.budget_id, campaign_id: "camp-1", contact_id: "c-1", queue_id: "q-1" });
    expect(r.kind).toBe("reserved");
    const bud = await loadBudgetById(mock.client, b.budget_id);
    expect(bud?.reserved_capacity).toBe(1);
  });

  it("(B2) reserve idempotent · same key returns already_attributed · no double-reserve", async () => {
    const b = insertBudget(mock, { name: "b", purchased_capacity: 10 });
    const args = { budget_id: b.budget_id, campaign_id: "c", contact_id: "u", queue_id: "q", attempt_id: 1 };
    const r1 = await reserveBudget(mock.client, args);
    const r2 = await reserveBudget(mock.client, args);
    expect(r1.kind).toBe("reserved");
    expect(r2.kind).toBe("already_attributed");
    const bud = await loadBudgetById(mock.client, b.budget_id);
    expect(bud?.reserved_capacity).toBe(1);
  });

  it("(B3) capacity_exhausted refuses · caller must defer", async () => {
    const b = insertBudget(mock, { name: "b", purchased_capacity: 1 });
    await reserveBudget(mock.client, { budget_id: b.budget_id, campaign_id: "c", contact_id: "u1", queue_id: "q1" });
    const r2 = await reserveBudget(mock.client, { budget_id: b.budget_id, campaign_id: "c", contact_id: "u2", queue_id: "q2" });
    expect(r2.kind).toBe("capacity_exhausted");
  });

  it("(B4) consume reserved → consumed · counters updated", async () => {
    const b = insertBudget(mock, { name: "b", purchased_capacity: 10 });
    const r = await reserveBudget(mock.client, { budget_id: b.budget_id, campaign_id: "c", contact_id: "u", queue_id: "q" });
    if (r.kind !== "reserved") throw new Error("expected reserved");
    const c = await consumeBudget(mock.client, r.attribution.attribution_id);
    expect(c.ok).toBe(true);
    const bud = await loadBudgetById(mock.client, b.budget_id);
    expect(bud?.reserved_capacity).toBe(0);
    expect(bud?.consumed_capacity).toBe(1);
  });

  it("(B5) release reserved → released · reserved returns to remaining", async () => {
    const b = insertBudget(mock, { name: "b", purchased_capacity: 10 });
    const r = await reserveBudget(mock.client, { budget_id: b.budget_id, campaign_id: "c", contact_id: "u", queue_id: "q" });
    if (r.kind !== "reserved") throw new Error("expected reserved");
    const rel = await releaseBudget(mock.client, r.attribution.attribution_id, "test_release");
    expect(rel.ok).toBe(true);
    const bud = await loadBudgetById(mock.client, b.budget_id);
    expect(bud?.reserved_capacity).toBe(0);
    expect(bud?.consumed_capacity).toBe(0);
  });

  it("(B6) release consumed FORBIDDEN · matches Stage 3 discipline", async () => {
    const b = insertBudget(mock, { name: "b", purchased_capacity: 10 });
    const r = await reserveBudget(mock.client, { budget_id: b.budget_id, campaign_id: "c", contact_id: "u", queue_id: "q" });
    if (r.kind !== "reserved") throw new Error("expected reserved");
    await consumeBudget(mock.client, r.attribution.attribution_id);
    const rel = await releaseBudget(mock.client, r.attribution.attribution_id, "attempted");
    expect(rel.ok).toBe(false);
    expect(rel.err).toBe("cannot_release_consumed");
  });

  it("(B7) concurrent reserves at limit=5 · exactly 5 succeed · no double-consume", async () => {
    const b = insertBudget(mock, { name: "b", purchased_capacity: 5 });
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) =>
      reserveBudget(mock.client, { budget_id: b.budget_id, campaign_id: "c", contact_id: `u-${i}`, queue_id: `q-${i}` })
    ));
    const reserved = results.filter(r => r.kind === "reserved").length;
    expect(reserved).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (C) Idempotency-key determinism
// ═══════════════════════════════════════════════════════════════════
describe("Stage 5 · (C) idempotency-key determinism", () => {
  it("(C1) same input → same key", () => {
    const k1 = deriveBudgetAttributionKey({ budget_id: "b", campaign_id: "c", contact_id: "u", queue_id: "q", attempt_id: 1 });
    const k2 = deriveBudgetAttributionKey({ budget_id: "b", campaign_id: "c", contact_id: "u", queue_id: "q", attempt_id: 1 });
    expect(k1).toBe(k2);
  });
  it("(C2) different contact → different key", () => {
    const k1 = deriveBudgetAttributionKey({ budget_id: "b", campaign_id: "c", contact_id: "u1", queue_id: "q" });
    const k2 = deriveBudgetAttributionKey({ budget_id: "b", campaign_id: "c", contact_id: "u2", queue_id: "q" });
    expect(k1).not.toBe(k2);
  });
  it("(C3) different attempt → different key (permits intentional retry with fresh key)", () => {
    const k1 = deriveBudgetAttributionKey({ budget_id: "b", campaign_id: "c", contact_id: "u", queue_id: "q", attempt_id: 1 });
    const k2 = deriveBudgetAttributionKey({ budget_id: "b", campaign_id: "c", contact_id: "u", queue_id: "q", attempt_id: 2 });
    expect(k1).not.toBe(k2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (D) LANE ISOLATION CANARY · AUTO never touches member_package
// ═══════════════════════════════════════════════════════════════════
describe("Stage 5 · (D) LANE ISOLATION · AUTO never touches member_package", () => {
  it("(D1) createBudget · reserveBudget · consumeBudget · releaseBudget · NONE reads or writes nex.marketing_package", async () => {
    seedMemberPackageCanary(mock, "member-package-decoy");
    const b = await createBudget(mock.client, { name: "b", purchased_capacity: 100, actor: "test" });
    const r = await reserveBudget(mock.client, { budget_id: b.budget_id, campaign_id: "c", contact_id: "u", queue_id: "q" });
    if (r.kind !== "reserved") throw new Error("expected reserved");
    await consumeBudget(mock.client, r.attribution.attribution_id);
    const b2 = insertBudget(mock, { name: "b2", purchased_capacity: 5 });
    const r2 = await reserveBudget(mock.client, { budget_id: b2.budget_id, campaign_id: "c2", contact_id: "u2", queue_id: "q2" });
    if (r2.kind === "reserved") await releaseBudget(mock.client, r2.attribution.attribution_id, "test");

    // CANARY: mock flips this flag on ANY query mentioning nex.marketing_package · must remain FALSE
    expect(mock.store.member_package_touched).toBe(false);
    // Member package unchanged
    expect(mock.store.member_packages.get("member-package-decoy")?.consumed_capacity).toBe(0);
  });

  it("(D2) module boundary marker exists (structural)", async () => {
    const mod = await import("../operating-budget");
    expect((mod as any)._AUTO_BUDGET_IS_NOT_MEMBER_PACKAGE).toBe("auto_lane_only_no_member_package_touch");
  });

  it("(D3) module exports NO contact-address extraction (structural)", async () => {
    const mod = await import("..");
    expect((mod as any).exportContacts).toBeUndefined();
    expect((mod as any).downloadLeads).toBeUndefined();
    expect((mod as any).getAudienceEmails).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// (E) Budget states
// ═══════════════════════════════════════════════════════════════════
describe("Stage 5 · (E) budget states", () => {
  it("(E1) paused budget refuses reserve · budget_not_active", async () => {
    const b = insertBudget(mock, { name: "b", purchased_capacity: 10, status: "paused" });
    const r = await reserveBudget(mock.client, { budget_id: b.budget_id, campaign_id: "c", contact_id: "u", queue_id: "q" });
    expect(r.kind).toBe("budget_not_active");
  });

  it("(E2) missing budget → budget_not_found", async () => {
    const r = await reserveBudget(mock.client, { budget_id: "nonexistent", campaign_id: "c", contact_id: "u", queue_id: "q" });
    expect(r.kind).toBe("budget_not_found");
  });
});
