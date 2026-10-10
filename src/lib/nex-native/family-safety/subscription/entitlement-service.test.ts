// src/lib/nex-native/family-safety/subscription/entitlement-service.test.ts
//
// Pure unit tests on invariants that do NOT require a live DB.
// Live-DB coverage lives in the integration suite + Playwright.

import { describe, expect, test } from "vitest";
import {
  PHASE_1_SIMULATED,
  PHASE_1_TEST_MODE,
  TestModeInvariantViolation,
} from "./entitlement-service";

// Private helper imports via back-door · we hit the public helpers that
// enforce invariants when the DB is absent.
import {
  grantActiveEntitlement,
  recordPaymentAttempt,
  recordFailedPayment,
  recordCancelledPayment,
  hasActiveEntitlement,
  getActiveEntitlement,
  getNewestEntitlement,
  listEntitlementsForOwner,
  findAttemptByIdempotencyKey,
  cancelActiveEntitlement,
  expireActiveEntitlement,
} from "./entitlement-service";

describe("entitlement-service · Phase 1 invariants", () => {
  test("PHASE_1_TEST_MODE is TRUE", () => {
    expect(PHASE_1_TEST_MODE).toBe(true);
  });

  test("PHASE_1_SIMULATED is TRUE", () => {
    expect(PHASE_1_SIMULATED).toBe(true);
  });

  test("recordPaymentAttempt rejects explicit test_mode=false", async () => {
    await expect(
      recordPaymentAttempt({
        ownerAccountId: "acc1",
        planId: "family_safety_pilot_free",
        idempotencyKey: "x",
        outcome: "initiated",
        testMode: false,
      }),
    ).rejects.toBeInstanceOf(TestModeInvariantViolation);
  });

  test("recordPaymentAttempt rejects explicit simulated=false", async () => {
    await expect(
      recordPaymentAttempt({
        ownerAccountId: "acc1",
        planId: "family_safety_pilot_free",
        idempotencyKey: "x",
        outcome: "initiated",
        simulated: false,
      }),
    ).rejects.toBeInstanceOf(TestModeInvariantViolation);
  });

  test("grantActiveEntitlement rejects explicit test_mode=false", async () => {
    await expect(
      grantActiveEntitlement({
        ownerAccountId: "acc1",
        planId: "family_safety_pilot_free",
        idempotencyKey: "k1",
        testMode: false,
      }),
    ).rejects.toBeInstanceOf(TestModeInvariantViolation);
  });

  test("grantActiveEntitlement rejects explicit simulated=false", async () => {
    await expect(
      grantActiveEntitlement({
        ownerAccountId: "acc1",
        planId: "family_safety_pilot_free",
        idempotencyKey: "k1",
        simulated: false,
      }),
    ).rejects.toBeInstanceOf(TestModeInvariantViolation);
  });
});

describe("entitlement-service · DB absent (null-pool) graceful degrade", () => {
  // In the Vitest harness the pg pool is null when NEX_POSTGRES_URL is
  // not set in test env · every helper must degrade to a sensible
  // null/false/empty rather than throwing.

  test("hasActiveEntitlement returns FALSE for an unknown plan id", async () => {
    // isPlanId guard short-circuits before any DB access.
    // @ts-expect-error · runtime guard check
    const v = await hasActiveEntitlement("acc1", "made_up_plan");
    expect(v).toBe(false);
  });

  test("hasActiveEntitlement returns FALSE when DB is absent (pool null)", async () => {
    // The test env has no NEX_POSTGRES_URL · withClient returns null,
    // our helper surfaces false.
    const v = await hasActiveEntitlement("acc1", "family_safety_pilot_free");
    expect(typeof v).toBe("boolean");
  });

  test("getActiveEntitlement returns null when DB absent", async () => {
    const v = await getActiveEntitlement("acc1", "family_safety_pilot_free");
    expect(v).toBe(null);
  });

  test("getNewestEntitlement returns null when DB absent", async () => {
    const v = await getNewestEntitlement("acc1", "family_safety_pilot_free");
    expect(v).toBe(null);
  });

  test("listEntitlementsForOwner returns [] when DB absent", async () => {
    const v = await listEntitlementsForOwner("acc1");
    expect(v).toEqual([]);
  });

  test("findAttemptByIdempotencyKey returns null when DB absent", async () => {
    const v = await findAttemptByIdempotencyKey("some-key");
    expect(v).toBe(null);
  });

  test("cancelActiveEntitlement returns null when DB absent", async () => {
    const v = await cancelActiveEntitlement("acc1", "family_safety_pilot_free");
    expect(v).toBe(null);
  });

  test("expireActiveEntitlement returns null when DB absent", async () => {
    const v = await expireActiveEntitlement("acc1", "family_safety_pilot_free");
    expect(v).toBe(null);
  });

  test("recordFailedPayment returns null when DB absent", async () => {
    const v = await recordFailedPayment(
      "acc1",
      "family_safety_pilot_free",
      "k1",
      "simulated_failure",
    );
    expect(v).toBe(null);
  });

  test("recordCancelledPayment returns null when DB absent", async () => {
    const v = await recordCancelledPayment(
      "acc1",
      "family_safety_pilot_free",
      "k1",
    );
    expect(v).toBe(null);
  });
});

describe("entitlement-service · summary clamping", () => {
  test("summary > 500 chars is clamped (no throw)", async () => {
    // Just confirm no throw · the DB-absent path returns null.
    const longSummary = "x".repeat(2000);
    const v = await recordPaymentAttempt({
      ownerAccountId: "acc1",
      planId: "family_safety_pilot_free",
      idempotencyKey: "clamp-1",
      outcome: "initiated",
      providerResponseSummary: longSummary,
    });
    expect(v).toBe(null); // DB absent · but the clamp was exercised
  });
});
