// src/lib/nex-midtrans/__tests__/topup-webhook.integration.test.ts
// Philip 2026-08-29
//
// Integration tests for the Midtrans top-up + webhook path. Real Postgres
// (nex_dev) · injected Snap-create mock (no real Midtrans call).
//
// Cleanup piggybacks on the mobility fixtures' `device:vitest-*` prefix
// so test intents disappear along with their providers.

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getMobilityPool } from "@/lib/nex-mobility/pool";
import { createTestProvider, cleanupAllTestData } from "@/lib/nex-mobility/__tests__/test-fixtures";
import { initiateTopup, type SnapCreateFn } from "../initiate-topup";
import { handleMidtransWebhook, type MidtransWebhookBody } from "../handle-webhook";
import { computeMidtransSignature } from "../signature";

const TEST_SERVER_KEY = "SB-Mid-server-VITEST-KEY";

/** A Snap-create stub that always returns a deterministic token. */
const mockSnap: SnapCreateFn = async (req) => ({
  token: "snap-token-" + req.transaction_details.order_id.slice(-6),
  redirect_url: "https://app.sandbox.midtrans.com/snap/v2/vtweb/" + req.transaction_details.order_id,
});

/** Build a signed webhook body matching a given intent + status. */
function buildWebhook(input: {
  order_id: string;
  amount_idr: number;
  transaction_status: string;
  fraud_status?: string;
  transaction_id?: string;
  payment_type?: string;
}): MidtransWebhookBody {
  const status_code = "200";
  const gross_amount = input.amount_idr.toFixed(2); // Midtrans always sends 2dp
  const signature_key = computeMidtransSignature({
    order_id: input.order_id, status_code, gross_amount, server_key: TEST_SERVER_KEY,
  });
  return {
    order_id: input.order_id,
    status_code,
    gross_amount,
    signature_key,
    transaction_status: input.transaction_status,
    fraud_status: input.fraud_status,
    transaction_id: input.transaction_id ?? ("mtx-" + input.order_id.slice(-6)),
    payment_type: input.payment_type ?? "gopay",
  };
}

async function readWallet(providerId: string): Promise<number> {
  const { rows } = await getMobilityPool().query(
    `SELECT balance_idr FROM nex.provider_wallet WHERE provider_id = $1`, [providerId]);
  return Number(rows[0]?.balance_idr ?? 0);
}
async function readIntent(intentId: string) {
  const { rows } = await getMobilityPool().query(
    `SELECT state, credited_at, last_webhook_status, midtrans_transaction_id, midtrans_payment_type
     FROM nex.provider_topup_intent WHERE intent_id = $1`, [intentId]);
  return rows[0];
}
async function countTopupRowsForIntent(intentId: string): Promise<number> {
  const { rows } = await getMobilityPool().query(
    `SELECT COUNT(*)::int AS n FROM nex.provider_wallet_transaction
     WHERE related_topup_intent_id = $1 AND kind = 'topup'`, [intentId]);
  return Number(rows[0].n);
}

beforeAll(async () => { await cleanupAllTestData(); });
afterAll(async () => { await cleanupAllTestData(); });

// ─────────────────────────────────────────────────────────────────────
// Happy path
// ─────────────────────────────────────────────────────────────────────
describe("Midtrans · happy path settlement credits wallet exactly once", () => {
  it("initiate → settlement webhook → wallet += amount · intent = paid", async () => {
    const provider = await createTestProvider({
      name: "TopupHappy", price: 18000, wallet: 5000, city: "TestCityM1",
    });
    const balanceBefore = await readWallet(provider.provider_id);

    const init = await initiateTopup({
      pool: getMobilityPool(),
      learnerRef: provider.learner_ref,
      amountIdr: 50000,
      snapCreate: mockSnap,
    });
    expect(init.ok).toBe(true);
    if (!init.ok) throw new Error("unreachable");
    expect(init.snap_token).toContain("snap-token-");

    const webhook = buildWebhook({
      order_id: init.midtrans_order_id,
      amount_idr: init.amount_idr,
      transaction_status: "settlement",
    });
    const out = await handleMidtransWebhook({
      pool: getMobilityPool(),
      serverKey: TEST_SERVER_KEY,
      body: webhook,
    });
    expect(out.ok).toBe(true);
    if (!out.ok || out.result !== "credited") throw new Error("expected credited");

    expect(await readWallet(provider.provider_id)).toBe(balanceBefore + 50000);
    const intent = await readIntent(init.intent_id);
    expect(intent.state).toBe("paid");
    expect(intent.credited_at).not.toBeNull();
    expect(intent.last_webhook_status).toBe("settlement");
    expect(await countTopupRowsForIntent(init.intent_id)).toBe(1);
  }, 30_000);

  it("capture + fraud_status=accept credits (card path)", async () => {
    const provider = await createTestProvider({
      name: "TopupCard", price: 18000, wallet: 0, city: "TestCityM2",
    });
    const init = await initiateTopup({
      pool: getMobilityPool(), learnerRef: provider.learner_ref, amountIdr: 100000,
      snapCreate: mockSnap,
    });
    expect(init.ok).toBe(true); if (!init.ok) throw new Error("unreachable");

    const out = await handleMidtransWebhook({
      pool: getMobilityPool(), serverKey: TEST_SERVER_KEY,
      body: buildWebhook({
        order_id: init.midtrans_order_id, amount_idr: init.amount_idr,
        transaction_status: "capture", fraud_status: "accept",
        payment_type: "credit_card",
      }),
    });
    expect(out.ok && out.result === "credited").toBe(true);
    expect(await readWallet(provider.provider_id)).toBe(100000);
  }, 30_000);
});

// ─────────────────────────────────────────────────────────────────────
// Idempotency
// ─────────────────────────────────────────────────────────────────────
describe("Midtrans · duplicate settlement webhook is a no-op", () => {
  it("three retries of the same webhook → wallet unchanged, one ledger row", async () => {
    const provider = await createTestProvider({
      name: "TopupIdemp", price: 18000, wallet: 0, city: "TestCityM3",
    });
    const init = await initiateTopup({
      pool: getMobilityPool(), learnerRef: provider.learner_ref, amountIdr: 20000,
      snapCreate: mockSnap,
    });
    if (!init.ok) throw new Error("unreachable");
    const webhook = buildWebhook({
      order_id: init.midtrans_order_id, amount_idr: init.amount_idr,
      transaction_status: "settlement",
    });

    // First: credited
    const first = await handleMidtransWebhook({
      pool: getMobilityPool(), serverKey: TEST_SERVER_KEY, body: webhook,
    });
    expect(first.ok && first.result === "credited").toBe(true);
    const balanceAfter = await readWallet(provider.provider_id);
    expect(balanceAfter).toBe(20000);

    // Retries: already_paid
    for (let i = 0; i < 3; i++) {
      const again = await handleMidtransWebhook({
        pool: getMobilityPool(), serverKey: TEST_SERVER_KEY, body: webhook,
      });
      expect(again.ok).toBe(true);
      if (again.ok) expect(again.result).toBe("already_paid");
    }
    expect(await readWallet(provider.provider_id)).toBe(balanceAfter);
    expect(await countTopupRowsForIntent(init.intent_id)).toBe(1);
  }, 30_000);
});

// ─────────────────────────────────────────────────────────────────────
// Signature invalid
// ─────────────────────────────────────────────────────────────────────
describe("Midtrans · forged signature is rejected · no state change", () => {
  it("bad signature → 403 · intent stays pending · wallet untouched", async () => {
    const provider = await createTestProvider({
      name: "TopupForged", price: 18000, wallet: 0, city: "TestCityM4",
    });
    const init = await initiateTopup({
      pool: getMobilityPool(), learnerRef: provider.learner_ref, amountIdr: 50000,
      snapCreate: mockSnap,
    });
    if (!init.ok) throw new Error("unreachable");

    // Build a real webhook then tamper with signature
    const good = buildWebhook({
      order_id: init.midtrans_order_id, amount_idr: init.amount_idr,
      transaction_status: "settlement",
    });
    const forged: MidtransWebhookBody = { ...good, signature_key: "0".repeat(128) };

    const out = await handleMidtransWebhook({
      pool: getMobilityPool(), serverKey: TEST_SERVER_KEY, body: forged,
    });
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("unreachable");
    expect(out.status).toBe(403);

    // No state change, no credit
    expect(await readWallet(provider.provider_id)).toBe(0);
    const intent = await readIntent(init.intent_id);
    expect(intent.state).toBe("pending");
    expect(intent.credited_at).toBeNull();
  }, 30_000);
});

// ─────────────────────────────────────────────────────────────────────
// Amount tamper
// ─────────────────────────────────────────────────────────────────────
describe("Midtrans · amount mismatch is refused", () => {
  it("payload gross_amount != intent amount_idr → 409 · no credit · flag", async () => {
    const provider = await createTestProvider({
      name: "TopupTamper", price: 18000, wallet: 0, city: "TestCityM5",
    });
    const init = await initiateTopup({
      pool: getMobilityPool(), learnerRef: provider.learner_ref, amountIdr: 50000,
      snapCreate: mockSnap,
    });
    if (!init.ok) throw new Error("unreachable");

    // Signature is valid for the INFLATED amount · but intent says 50000.
    const inflated = buildWebhook({
      order_id: init.midtrans_order_id, amount_idr: 500000, // 10× the intent
      transaction_status: "settlement",
    });
    const out = await handleMidtransWebhook({
      pool: getMobilityPool(), serverKey: TEST_SERVER_KEY, body: inflated,
    });
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("unreachable");
    expect(out.status).toBe(409);
    expect(out.error).toBe("amount_mismatch");

    expect(await readWallet(provider.provider_id)).toBe(0);
    const intent = await readIntent(init.intent_id);
    expect(intent.state).toBe("pending");
    expect(intent.last_webhook_status).toBe("amount_mismatch");
  }, 30_000);
});

// ─────────────────────────────────────────────────────────────────────
// Status matrix
// ─────────────────────────────────────────────────────────────────────
describe("Midtrans · non-settlement statuses transition without crediting", () => {
  const table: { status: string; fraud?: string; expectedState: string }[] = [
    { status: "deny",    expectedState: "denied" },
    { status: "cancel",  expectedState: "cancelled" },
    { status: "expire",  expectedState: "expired" },
    { status: "failure", expectedState: "failed" },
    { status: "capture", fraud: "deny", expectedState: "denied" },
    { status: "pending", expectedState: "pending" },
  ];
  for (const t of table) {
    it(`transaction_status="${t.status}"${t.fraud ? ` fraud=${t.fraud}` : ""} → intent.state=${t.expectedState} · wallet unchanged`, async () => {
      const provider = await createTestProvider({
        name: `Topup-${t.status}`, price: 18000, wallet: 0, city: `TestCityM-${t.status}`,
      });
      const init = await initiateTopup({
        pool: getMobilityPool(), learnerRef: provider.learner_ref, amountIdr: 20000,
        snapCreate: mockSnap,
      });
      if (!init.ok) throw new Error("unreachable");
      const out = await handleMidtransWebhook({
        pool: getMobilityPool(), serverKey: TEST_SERVER_KEY,
        body: buildWebhook({
          order_id: init.midtrans_order_id, amount_idr: init.amount_idr,
          transaction_status: t.status, fraud_status: t.fraud,
        }),
      });
      expect(out.ok).toBe(true);
      if (!out.ok) throw new Error("unreachable");
      expect(out.result).toBe("state_updated");
      expect(await readWallet(provider.provider_id)).toBe(0);
      const intent = await readIntent(init.intent_id);
      expect(intent.state).toBe(t.expectedState);
    }, 30_000);
  }
});

// ─────────────────────────────────────────────────────────────────────
// Pending → settlement transition
// ─────────────────────────────────────────────────────────────────────
describe("Midtrans · pending then settlement · wallet credited once", () => {
  it("pending webhook keeps state=pending · settlement then credits", async () => {
    const provider = await createTestProvider({
      name: "TopupPendThenSet", price: 18000, wallet: 0, city: "TestCityM6",
    });
    const init = await initiateTopup({
      pool: getMobilityPool(), learnerRef: provider.learner_ref, amountIdr: 50000,
      snapCreate: mockSnap,
    });
    if (!init.ok) throw new Error("unreachable");

    // Pending
    const pending = await handleMidtransWebhook({
      pool: getMobilityPool(), serverKey: TEST_SERVER_KEY,
      body: buildWebhook({
        order_id: init.midtrans_order_id, amount_idr: init.amount_idr,
        transaction_status: "pending",
      }),
    });
    expect(pending.ok && pending.result === "state_updated").toBe(true);
    expect(await readWallet(provider.provider_id)).toBe(0);
    let intent = await readIntent(init.intent_id);
    expect(intent.state).toBe("pending");

    // Settlement
    const settled = await handleMidtransWebhook({
      pool: getMobilityPool(), serverKey: TEST_SERVER_KEY,
      body: buildWebhook({
        order_id: init.midtrans_order_id, amount_idr: init.amount_idr,
        transaction_status: "settlement",
      }),
    });
    expect(settled.ok && settled.result === "credited").toBe(true);
    expect(await readWallet(provider.provider_id)).toBe(50000);
    intent = await readIntent(init.intent_id);
    expect(intent.state).toBe("paid");
    expect(await countTopupRowsForIntent(init.intent_id)).toBe(1);
  }, 30_000);
});

// ─────────────────────────────────────────────────────────────────────
// Concurrent settlement webhooks (race)
// ─────────────────────────────────────────────────────────────────────
describe("Midtrans · concurrent settlement webhooks → one credit only", () => {
  it("two identical settlement webhooks in parallel · exactly one ledger row", async () => {
    const provider = await createTestProvider({
      name: "TopupRace", price: 18000, wallet: 0, city: "TestCityM7",
    });
    const init = await initiateTopup({
      pool: getMobilityPool(), learnerRef: provider.learner_ref, amountIdr: 100000,
      snapCreate: mockSnap,
    });
    if (!init.ok) throw new Error("unreachable");
    const wh = buildWebhook({
      order_id: init.midtrans_order_id, amount_idr: init.amount_idr,
      transaction_status: "settlement",
    });

    const [a, b] = await Promise.all([
      handleMidtransWebhook({ pool: getMobilityPool(), serverKey: TEST_SERVER_KEY, body: wh }),
      handleMidtransWebhook({ pool: getMobilityPool(), serverKey: TEST_SERVER_KEY, body: wh }),
    ]);

    // One must credit; the other must observe already_paid.
    const results = [a, b];
    const credits    = results.filter((r) => r.ok && r.result === "credited").length;
    const alreadyPaid = results.filter((r) => r.ok && r.result === "already_paid").length;
    expect(credits).toBe(1);
    expect(alreadyPaid).toBe(1);

    expect(await readWallet(provider.provider_id)).toBe(100000);
    expect(await countTopupRowsForIntent(init.intent_id)).toBe(1);
  }, 30_000);
});

// ─────────────────────────────────────────────────────────────────────
// Approved-tier gate
// ─────────────────────────────────────────────────────────────────────
describe("initiateTopup · refuses non-approved amounts before hitting Midtrans", () => {
  it("Rp 12345 → 400 · no intent inserted · Snap never called", async () => {
    const provider = await createTestProvider({
      name: "TopupBadAmt", price: 18000, wallet: 0, city: "TestCityM8",
    });
    let snapCalled = false;
    const spy: SnapCreateFn = async (r) => { snapCalled = true; return mockSnap(r); };
    const out = await initiateTopup({
      pool: getMobilityPool(), learnerRef: provider.learner_ref, amountIdr: 12345,
      snapCreate: spy,
    });
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("unreachable");
    expect(out.status).toBe(400);
    expect(snapCalled).toBe(false);
  }, 30_000);
});
