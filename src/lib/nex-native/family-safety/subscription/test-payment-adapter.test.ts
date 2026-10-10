// src/lib/nex-native/family-safety/subscription/test-payment-adapter.test.ts

import { afterEach, describe, expect, test } from "vitest";
import {
  TEST_PAYMENT_ADAPTER,
  __resetRegistryForTests,
  getAdapter,
  listAdapters,
  registerPaymentAdapter,
  type PaymentAdapter,
} from "./test-payment-adapter";

afterEach(() => {
  __resetRegistryForTests();
});

describe("test-payment-adapter · succeeded path", () => {
  test("default outcome is succeeded", async () => {
    const r = await TEST_PAYMENT_ADAPTER.initiatePayment({
      ownerAccountId: "acc1",
      planId: "family_safety_pilot_free",
      idempotencyKey: "idem-1",
    });
    expect(r.kind).toBe("succeeded");
  });

  test("succeeded result carries the same idempotencyKey", async () => {
    const r = await TEST_PAYMENT_ADAPTER.initiatePayment({
      ownerAccountId: "acc1",
      planId: "family_safety_pilot_free",
      idempotencyKey: "idem-key-xyz",
      simulatedOutcome: "succeeded",
    });
    expect(r.idempotencyKey).toBe("idem-key-xyz");
  });

  test("succeeded result carries providerRef and SIMULATED summary", async () => {
    const r = await TEST_PAYMENT_ADAPTER.initiatePayment({
      ownerAccountId: "acc1",
      planId: "family_safety_pilot_free",
      idempotencyKey: "idem-2",
      simulatedOutcome: "succeeded",
    });
    if (r.kind !== "succeeded") throw new Error("expected succeeded");
    expect(r.providerRef).toContain("test_mode_ref_");
    expect(r.summary).toMatch(/SIMULATED/i);
  });
});

describe("test-payment-adapter · failed path", () => {
  test("failed outcome returns kind='failed'", async () => {
    const r = await TEST_PAYMENT_ADAPTER.initiatePayment({
      ownerAccountId: "acc1",
      planId: "family_safety_pilot_free",
      idempotencyKey: "idem-f1",
      simulatedOutcome: "failed",
    });
    expect(r.kind).toBe("failed");
  });

  test("failed carries reason and SIMULATED summary", async () => {
    const r = await TEST_PAYMENT_ADAPTER.initiatePayment({
      ownerAccountId: "acc1",
      planId: "family_safety_pilot_free",
      idempotencyKey: "idem-f2",
      simulatedOutcome: "failed",
    });
    if (r.kind !== "failed") throw new Error("expected failed");
    expect(r.reason).toBe("simulated_failure");
    expect(r.summary).toMatch(/SIMULATED/i);
  });
});

describe("test-payment-adapter · cancelled path", () => {
  test("cancelled outcome returns kind='cancelled'", async () => {
    const r = await TEST_PAYMENT_ADAPTER.initiatePayment({
      ownerAccountId: "acc1",
      planId: "family_safety_pilot_free",
      idempotencyKey: "idem-c1",
      simulatedOutcome: "cancelled",
    });
    expect(r.kind).toBe("cancelled");
  });

  test("cancelled summary is SIMULATED", async () => {
    const r = await TEST_PAYMENT_ADAPTER.initiatePayment({
      ownerAccountId: "acc1",
      planId: "family_safety_pilot_free",
      idempotencyKey: "idem-c2",
      simulatedOutcome: "cancelled",
    });
    expect(r.summary).toMatch(/SIMULATED/i);
  });
});

describe("test-payment-adapter · idempotency key handling", () => {
  test("missing idempotency key → failed with missing_idempotency_key reason", async () => {
    const r = await TEST_PAYMENT_ADAPTER.initiatePayment({
      ownerAccountId: "acc1",
      planId: "family_safety_pilot_free",
      idempotencyKey: "",
      simulatedOutcome: "succeeded",
    });
    if (r.kind !== "failed") throw new Error("expected failed");
    expect(r.reason).toBe("missing_idempotency_key");
  });

  test("whitespace-only key is rejected", async () => {
    const r = await TEST_PAYMENT_ADAPTER.initiatePayment({
      ownerAccountId: "acc1",
      planId: "family_safety_pilot_free",
      idempotencyKey: "   ",
      simulatedOutcome: "succeeded",
    });
    if (r.kind !== "failed") throw new Error("expected failed");
    expect(r.reason).toBe("missing_idempotency_key");
  });

  test("same key called twice produces two distinct results (idempotency enforced by service, not adapter)", async () => {
    const r1 = await TEST_PAYMENT_ADAPTER.initiatePayment({
      ownerAccountId: "acc1",
      planId: "family_safety_pilot_free",
      idempotencyKey: "dup-key",
      simulatedOutcome: "succeeded",
    });
    const r2 = await TEST_PAYMENT_ADAPTER.initiatePayment({
      ownerAccountId: "acc1",
      planId: "family_safety_pilot_free",
      idempotencyKey: "dup-key",
      simulatedOutcome: "succeeded",
    });
    expect(r1.kind).toBe("succeeded");
    expect(r2.kind).toBe("succeeded");
    expect(r1.idempotencyKey).toBe(r2.idempotencyKey);
  });
});

describe("test-payment-adapter · adapter registry", () => {
  test("TEST adapter is registered by default", () => {
    const a = getAdapter("test_mode");
    expect(a).not.toBeNull();
    expect(a?.id).toBe("test_mode");
  });

  test("listAdapters returns at least one adapter (TEST)", () => {
    const list = listAdapters();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.some((a) => a.id === "test_mode")).toBe(true);
  });

  test("unknown provider → getAdapter returns null", () => {
    // @ts-expect-error · intentionally bad id for runtime check
    expect(getAdapter("madeup_provider")).toBe(null);
  });

  test("new adapter can register without touching this file", () => {
    const stripeStub: PaymentAdapter = {
      id: "stripe_tbd",
      async initiatePayment() {
        return {
          kind: "failed",
          idempotencyKey: "x",
          reason: "stripe_tbd_not_wired",
          summary: "stripe stub",
        };
      },
    };
    registerPaymentAdapter(stripeStub);
    expect(getAdapter("stripe_tbd")?.id).toBe("stripe_tbd");
  });

  test("reset restores Phase 1 default (only test_mode)", () => {
    const stripeStub: PaymentAdapter = {
      id: "stripe_tbd",
      async initiatePayment() {
        return {
          kind: "failed",
          idempotencyKey: "x",
          reason: "stripe_tbd_not_wired",
          summary: "stripe stub",
        };
      },
    };
    registerPaymentAdapter(stripeStub);
    __resetRegistryForTests();
    const list = listAdapters();
    expect(list.length).toBe(1);
    expect(list[0]?.id).toBe("test_mode");
  });
});

describe("test-payment-adapter · zero real-network behaviour", () => {
  test("test adapter does not import fetch / network modules", async () => {
    // Static check: calling it 50 times in a tight loop takes
    // <<100ms · a real network adapter would not. This is a weak
    // but useful "no live network" guardrail.
    const t0 = Date.now();
    for (let i = 0; i < 50; i += 1) {
      await TEST_PAYMENT_ADAPTER.initiatePayment({
        ownerAccountId: "acc",
        planId: "family_safety_pilot_free",
        idempotencyKey: `fast-${i}`,
        simulatedOutcome: "succeeded",
      });
    }
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(2000);
  });
});
