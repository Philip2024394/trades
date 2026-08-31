// src/lib/nex-mobility/__tests__/fee-and-wallet.integration.test.ts
// Philip 2026-08-29
//
// Integration test matrix for the NEX Mobility financial + concurrency layer.
// Runs against a real Postgres (nex_dev) because the properties under test —
// row-level locking, partial unique indexes, monthly boundary via
// date_trunc(), transactional idempotency — cannot be proven with mocks.
//
// Every test creates its own providers/requests with a `device:vitest-*`
// prefix and cleans up in afterAll.

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { getMobilityPool } from "../pool";
import { acceptOffer } from "../accept-offer";
import { completeRequest } from "../complete-request";
import { calcNetworkFee, isProviderEligibleForBroadcast } from "../fee";
import {
  createTestProvider,
  createTestBroadcast,
  backdateCompletedRequest,
  cleanupAllTestData,
  queryBroadcastEligible,
  readRequest,
  readWallet,
  readLedger,
  readOffers,
  TEST_PREFIX,
} from "./test-fixtures";

const CITY = "TestCityVitest";

beforeAll(async () => {
  // Fresh slate: wipe any stragglers from a crashed prior run.
  await cleanupAllTestData();
});

afterAll(async () => {
  await cleanupAllTestData();
  await getMobilityPool().end();
});

// ─────────────────────────────────────────────────────────────────────
// TEST #2 · Two free service requests per calendar month
// ─────────────────────────────────────────────────────────────────────
describe("Test #2 · 2 free requests per calendar month", () => {
  it("requests 1 and 2 carry no fee; requests 3 and 4 charge 8%", async () => {
    const provider = await createTestProvider({
      name: "Andi-Free", price: 20000, wallet: 100_000, city: `${CITY}-2`,
    });
    const pool = getMobilityPool();

    const runOne = async (): Promise<{ was_free_allowance: boolean; fee: number }> => {
      const requestId = await createTestBroadcast({
        destination: "Malioboro", eligibleProviders: [provider],
      });
      const acc = await acceptOffer({ pool, requestId, providerId: provider.provider_id, action: "accept" });
      expect(acc.ok).toBe(true);
      const done = await completeRequest({ pool, requestId });
      expect(done.ok).toBe(true);
      if (!done.ok) throw new Error("unreachable");
      return { was_free_allowance: done.was_free_allowance, fee: done.network_fee_idr };
    };

    const r1 = await runOne();
    const r2 = await runOne();
    const r3 = await runOne();
    const r4 = await runOne();

    expect(r1).toEqual({ was_free_allowance: true, fee: 0 });
    expect(r2).toEqual({ was_free_allowance: true, fee: 0 });
    expect(r3).toEqual({ was_free_allowance: false, fee: calcNetworkFee(20000) });
    expect(r4).toEqual({ was_free_allowance: false, fee: calcNetworkFee(20000) });

    // Wallet balance = 100k - 2 * 1600 = 96_800
    expect(await readWallet(provider.provider_id)).toBe(100_000 - 2 * 1600);
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// TEST #3 · Exact wallet threshold at eligibility
// ─────────────────────────────────────────────────────────────────────
describe("Test #3 · exact wallet threshold", () => {
  it("wallet exactly = fee passes; wallet fee-1 excluded; wallet > fee passes", async () => {
    const city = `${CITY}-3`;
    const price = 18000;
    const fee = calcNetworkFee(price); // 1440

    const providerAtFee = await createTestProvider({
      name: "AtFee", price, wallet: fee, city,
    });
    const providerBelow = await createTestProvider({
      name: "Below", price, wallet: fee - 1, city,
    });
    const providerAbove = await createTestProvider({
      name: "Above", price, wallet: fee + 100_000, city,
    });

    // Consume the free allowance for all three so we're testing the wallet
    // gate specifically (not the free-remaining bypass).
    for (const p of [providerAtFee, providerBelow, providerAbove]) {
      for (let i = 0; i < 2; i++) {
        const rid = await createTestBroadcast({
          destination: "burnFree", eligibleProviders: [p],
        });
        await acceptOffer({ pool: getMobilityPool(), requestId: rid, providerId: p.provider_id, action: "accept" });
        await completeRequest({ pool: getMobilityPool(), requestId: rid });
      }
    }

    // Provider wallets after burning free allowance still reflect setup.
    expect(await readWallet(providerAtFee.provider_id)).toBe(fee);
    expect(await readWallet(providerBelow.provider_id)).toBe(fee - 1);

    // Run the same shape of eligibility query the broadcast route runs.
    const rows = await queryBroadcastEligible(city);
    const eligible = rows
      .filter(isProviderEligibleForBroadcast)
      .map((r) => r.provider_id as string);

    expect(eligible).toContain(providerAtFee.provider_id);
    expect(eligible).not.toContain(providerBelow.provider_id);
    expect(eligible).toContain(providerAbove.provider_id);
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// TEST #4 · Insufficient wallet + wallet never goes negative
// ─────────────────────────────────────────────────────────────────────
describe("Test #4 · insufficient wallet", () => {
  it("provider with free allowance participates without wallet deduction", async () => {
    const provider = await createTestProvider({
      name: "FreshFree", price: 18000, wallet: 0, city: `${CITY}-4a`,
    });
    const rid = await createTestBroadcast({
      destination: "Test", eligibleProviders: [provider],
    });
    await acceptOffer({ pool: getMobilityPool(), requestId: rid, providerId: provider.provider_id, action: "accept" });
    const done = await completeRequest({ pool: getMobilityPool(), requestId: rid });
    expect(done.ok).toBe(true);
    if (done.ok) expect(done.network_fee_idr).toBe(0);
    expect(await readWallet(provider.provider_id)).toBe(0);
  }, 30_000);

  it("wallet never goes negative under any completion path", async () => {
    // Force underfunded completion path: consume allowance, then set wallet
    // < fee, run complete. Expected: request completes, wallet remains 0
    // (never negative), an 'adjustment' ledger row is written.
    const price = 20000;
    const provider = await createTestProvider({
      name: "Underfunded", price, wallet: 5000, city: `${CITY}-4b`,
    });
    for (let i = 0; i < 2; i++) {
      const rid = await createTestBroadcast({
        destination: "burnFree", eligibleProviders: [provider],
      });
      await acceptOffer({ pool: getMobilityPool(), requestId: rid, providerId: provider.provider_id, action: "accept" });
      await completeRequest({ pool: getMobilityPool(), requestId: rid });
    }
    // Drain wallet to 500 (below the 1600 fee)
    await getMobilityPool().query(
      `UPDATE nex.provider_wallet SET balance_idr = 500 WHERE provider_id = $1`,
      [provider.provider_id],
    );
    const rid = await createTestBroadcast({
      destination: "Underfunded", eligibleProviders: [provider],
    });
    await acceptOffer({ pool: getMobilityPool(), requestId: rid, providerId: provider.provider_id, action: "accept" });
    const done = await completeRequest({ pool: getMobilityPool(), requestId: rid });
    expect(done.ok).toBe(true);
    // Wallet unchanged at 500 (underfunded path does NOT deduct)
    expect(await readWallet(provider.provider_id)).toBe(500);
    // Ledger has an adjustment row noting underfunded
    const ledger = await readLedger(provider.provider_id);
    const flagged = ledger.find((r) => r.kind === "adjustment" && r.note?.includes("WALLET_UNDERFUNDED"));
    expect(flagged).toBeDefined();
  }, 60_000);

  it("provider with 0 wallet and no free allowance is NOT eligible for broadcast", async () => {
    const city = `${CITY}-4c`;
    const provider = await createTestProvider({
      name: "Dry", price: 18000, wallet: 0, city,
    });
    // Consume free allowance
    for (let i = 0; i < 2; i++) {
      const rid = await createTestBroadcast({
        destination: "burnFree", eligibleProviders: [provider],
      });
      await acceptOffer({ pool: getMobilityPool(), requestId: rid, providerId: provider.provider_id, action: "accept" });
      await completeRequest({ pool: getMobilityPool(), requestId: rid });
    }
    const rows = await queryBroadcastEligible(city);
    const eligible = rows.filter(isProviderEligibleForBroadcast).map((r) => r.provider_id);
    expect(eligible).not.toContain(provider.provider_id);
  }, 30_000);
});

// ─────────────────────────────────────────────────────────────────────
// TEST #5 · Concurrent acceptance race
// ─────────────────────────────────────────────────────────────────────
describe("Test #5 · concurrent accept race", () => {
  it("two providers accept simultaneously → exactly one wins", async () => {
    const city = `${CITY}-5`;
    const providerA = await createTestProvider({ name: "RaceA", price: 15000, wallet: 50_000, city });
    const providerB = await createTestProvider({ name: "RaceB", price: 15000, wallet: 50_000, city });

    const requestId = await createTestBroadcast({
      destination: "RaceTarget", eligibleProviders: [providerA, providerB],
    });

    // Fire both accepts truly in parallel
    const [resA, resB] = await Promise.all([
      acceptOffer({ pool: getMobilityPool(), requestId, providerId: providerA.provider_id, action: "accept" }),
      acceptOffer({ pool: getMobilityPool(), requestId, providerId: providerB.provider_id, action: "accept" }),
    ]);

    const results = [resA, resB];
    const winners = results.filter((r) => r.ok && r.action === "accepted");
    const losers  = results.filter((r) => !r.ok);
    expect(winners.length).toBe(1);
    expect(losers.length).toBe(1);

    // Loser's error code is one of the calm race codes with status 409
    const loser = losers[0];
    if (!loser.ok) {
      expect(loser.status).toBe(409);
      expect([
        "already_resolved",
        "another_provider_accepted_first",
        "offer_not_found_or_already_responded",
      ]).toContain(loser.error);
    }

    // DB invariants
    const req = await readRequest(requestId);
    expect(req.state).toBe("CONNECTED");
    expect(req.provider_id).toBe(winners[0].ok && winners[0].provider ? winners[0].provider.provider_id : null);
    expect(req.price_agreed_idr).toBe(15000);

    const offers = await readOffers(requestId);
    const accepted = offers.filter((o) => o.response === "accepted");
    const withdrawn = offers.filter((o) => o.response === "withdrawn");
    expect(accepted.length).toBe(1);
    expect(withdrawn.length).toBe(1);

    // No duplicate fee: complete once, ledger has exactly one network_fee OR
    // zero (if free allowance). Providers here have full free allowance so
    // fee will be 0. Prove no duplicate ledger regardless.
    await completeRequest({ pool: getMobilityPool(), requestId });
    const winnerId = accepted[0].provider_id as string;
    const ledger = await readLedger(winnerId);
    const feeRows = ledger.filter((r) => r.related_request_id === requestId);
    expect(feeRows.length).toBeLessThanOrEqual(1);
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// TEST #6 · Price lock after acceptance
// ─────────────────────────────────────────────────────────────────────
describe("Test #6 · price lock after acceptance", () => {
  it("later provider price changes do NOT alter the existing request price", async () => {
    const provider = await createTestProvider({
      name: "PriceLock", price: 18000, wallet: 100_000, city: `${CITY}-6`,
    });
    // Consume free allowance so a fee actually gets computed on completion
    for (let i = 0; i < 2; i++) {
      const rid = await createTestBroadcast({
        destination: "burnFree", eligibleProviders: [provider],
      });
      await acceptOffer({ pool: getMobilityPool(), requestId: rid, providerId: provider.provider_id, action: "accept" });
      await completeRequest({ pool: getMobilityPool(), requestId: rid });
    }

    const requestId = await createTestBroadcast({
      destination: "PriceLockTarget", eligibleProviders: [provider],
    });
    await acceptOffer({ pool: getMobilityPool(), requestId, providerId: provider.provider_id, action: "accept" });

    // Snapshot right after acceptance
    const after = await readRequest(requestId);
    expect(after.price_agreed_idr).toBe(18000);

    // Change provider price and complete: the request retains the OLD price.
    await getMobilityPool().query(
      `UPDATE nex.provider_profile SET price_per_service_idr = 25000 WHERE provider_id = $1`,
      [provider.provider_id],
    );
    const done = await completeRequest({ pool: getMobilityPool(), requestId });
    expect(done.ok).toBe(true);

    const finalRow = await readRequest(requestId);
    expect(finalRow.price_agreed_idr).toBe(18000);
    expect(finalRow.network_fee_idr).toBe(calcNetworkFee(18000)); // 1440, NOT 2000
    expect(finalRow.network_fee_idr).not.toBe(calcNetworkFee(25000));
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// TEST #7 · Monthly reset
// ─────────────────────────────────────────────────────────────────────
describe("Test #7 · monthly reset", () => {
  it("previous month's usage does not leak into the new month", async () => {
    const provider = await createTestProvider({
      name: "MonthReset", price: 20000, wallet: 100_000, city: `${CITY}-7`,
    });

    // Complete two requests, then backdate them to the previous month.
    const oldIds: string[] = [];
    for (let i = 0; i < 2; i++) {
      const rid = await createTestBroadcast({
        destination: "prevMonth", eligibleProviders: [provider],
      });
      await acceptOffer({ pool: getMobilityPool(), requestId: rid, providerId: provider.provider_id, action: "accept" });
      const done = await completeRequest({ pool: getMobilityPool(), requestId: rid });
      expect(done.ok && done.was_free_allowance).toBe(true);
      oldIds.push(rid);
    }
    // Backdate to first day of the previous month
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15, 12, 0, 0).toISOString();
    for (const id of oldIds) {
      await backdateCompletedRequest({ requestId: id, toIso: prevMonthDate });
    }

    // Now complete a "current-month" request. Because the previous ones no
    // longer count against this month, this one should be free again.
    const rid = await createTestBroadcast({
      destination: "newMonth", eligibleProviders: [provider],
    });
    await acceptOffer({ pool: getMobilityPool(), requestId: rid, providerId: provider.provider_id, action: "accept" });
    const done = await completeRequest({ pool: getMobilityPool(), requestId: rid });
    expect(done.ok).toBe(true);
    if (done.ok) {
      expect(done.was_free_allowance).toBe(true);
      expect(done.network_fee_idr).toBe(0);
      expect(done.free_requests_used_this_month_after).toBe(1);
    }
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// TEST #8 · Failed/cancelled requests do NOT consume free allowance
// ─────────────────────────────────────────────────────────────────────
describe("Test #8 · non-completed requests never consume allowance", () => {
  it("decline · cancel · expire do not decrement free allowance", async () => {
    const provider = await createTestProvider({
      name: "NoConsume", price: 20000, wallet: 100_000, city: `${CITY}-8`,
    });

    // Decline scenario
    const declineRid = await createTestBroadcast({
      destination: "decl", eligibleProviders: [provider],
    });
    await acceptOffer({ pool: getMobilityPool(), requestId: declineRid, providerId: provider.provider_id, action: "decline" });

    // Cancelled-before-accept scenario
    const cancelRid = await createTestBroadcast({
      destination: "canc", eligibleProviders: [provider],
    });
    await getMobilityPool().query(
      `UPDATE nex.service_request
       SET state = 'CANCELLED_BY_USER', cancelled_at = now(), updated_at = now()
       WHERE request_id = $1`,
      [cancelRid],
    );

    // Expired-window scenario · short window then wait
    const expireRid = await createTestBroadcast({
      destination: "exp", eligibleProviders: [provider], windowSeconds: 5,
    });
    // Directly mark expired to avoid a real wait in tests
    await getMobilityPool().query(
      `UPDATE nex.service_request
       SET state = 'TIMED_OUT', broadcast_expires_at = now() - interval '1 second',
           updated_at = now()
       WHERE request_id = $1`,
      [expireRid],
    );

    // Now a real completion · should be free #1
    const realRid = await createTestBroadcast({
      destination: "real", eligibleProviders: [provider],
    });
    await acceptOffer({ pool: getMobilityPool(), requestId: realRid, providerId: provider.provider_id, action: "accept" });
    const done = await completeRequest({ pool: getMobilityPool(), requestId: realRid });
    expect(done.ok).toBe(true);
    if (done.ok) {
      expect(done.was_free_allowance).toBe(true);
      expect(done.free_requests_used_this_month_after).toBe(1);
    }
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// TEST #9 · CRITICAL customer-price consistency chain
// ─────────────────────────────────────────────────────────────────────
describe("Test #9 · CRITICAL · customer price consistency across the whole chain", () => {
  it("price at profile == offer == accept snapshot == complete == fee-basis", async () => {
    const CUSTOMER_FACING_PRICE = 18000;
    const provider = await createTestProvider({
      name: "PriceChain", price: CUSTOMER_FACING_PRICE, wallet: 100_000, city: `${CITY}-9`,
    });
    // Consume free allowance so completion actually charges a fee
    for (let i = 0; i < 2; i++) {
      const rid = await createTestBroadcast({
        destination: "burnFree", eligibleProviders: [provider],
      });
      await acceptOffer({ pool: getMobilityPool(), requestId: rid, providerId: provider.provider_id, action: "accept" });
      await completeRequest({ pool: getMobilityPool(), requestId: rid });
    }
    const balanceBefore = await readWallet(provider.provider_id);

    // 1. Provider's configured price
    const { rows: pRows } = await getMobilityPool().query(
      `SELECT price_per_service_idr FROM nex.provider_profile WHERE provider_id = $1`,
      [provider.provider_id],
    );
    expect(pRows[0].price_per_service_idr).toBe(CUSTOMER_FACING_PRICE);

    // 2. Broadcast · offer row has this price
    const requestId = await createTestBroadcast({
      destination: "ChainTest", eligibleProviders: [provider],
    });
    const offers = await readOffers(requestId);
    expect(offers[0].offered_price_idr).toBe(CUSTOMER_FACING_PRICE);

    // 3. Provider accepts · returns the exact price to the customer
    const acc = await acceptOffer({ pool: getMobilityPool(), requestId, providerId: provider.provider_id, action: "accept" });
    expect(acc.ok).toBe(true);
    if (acc.ok && acc.action === "accepted") {
      expect(acc.price_agreed_idr).toBe(CUSTOMER_FACING_PRICE);
    }

    // 4. Request row has the snapshotted price
    const afterAccept = await readRequest(requestId);
    expect(afterAccept.price_agreed_idr).toBe(CUSTOMER_FACING_PRICE);

    // 5. Provider changes their profile price · request price MUST NOT change
    await getMobilityPool().query(
      `UPDATE nex.provider_profile SET price_per_service_idr = 30000 WHERE provider_id = $1`,
      [provider.provider_id],
    );

    // 6. Completion snapshots the fee off the ORIGINAL price
    const done = await completeRequest({ pool: getMobilityPool(), requestId });
    expect(done.ok).toBe(true);
    if (done.ok) {
      expect(done.network_fee_idr).toBe(calcNetworkFee(CUSTOMER_FACING_PRICE));
      // Explicitly NOT the new profile price
      expect(done.network_fee_idr).not.toBe(calcNetworkFee(30000));
    }

    // 7. Wallet deduction matches the original-price fee exactly
    const balanceAfter = await readWallet(provider.provider_id);
    const expectedFee = calcNetworkFee(CUSTOMER_FACING_PRICE);
    expect(balanceBefore - balanceAfter).toBe(expectedFee);

    // 8. Ledger row records the same fee, tied to this request
    const ledger = await readLedger(provider.provider_id);
    const feeRow = ledger.find((r) => r.related_request_id === requestId && r.kind === "network_fee");
    expect(feeRow).toBeDefined();
    if (feeRow) {
      expect(Number(feeRow.amount_idr)).toBe(-expectedFee);
      expect(Number(feeRow.balance_after_idr)).toBe(balanceAfter);
    }
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// TEST #10 · Completion idempotency
// ─────────────────────────────────────────────────────────────────────
describe("Test #10 · completeRequest is idempotent under retry", () => {
  it("second call does not deduct wallet, does not consume allowance, does not duplicate ledger", async () => {
    const provider = await createTestProvider({
      name: "Idempotent", price: 20000, wallet: 100_000, city: `${CITY}-10`,
    });
    // Consume free allowance so a real fee is charged
    for (let i = 0; i < 2; i++) {
      const rid = await createTestBroadcast({
        destination: "burnFree", eligibleProviders: [provider],
      });
      await acceptOffer({ pool: getMobilityPool(), requestId: rid, providerId: provider.provider_id, action: "accept" });
      await completeRequest({ pool: getMobilityPool(), requestId: rid });
    }
    const balanceBeforeCompletion = await readWallet(provider.provider_id);

    const requestId = await createTestBroadcast({
      destination: "IdempTarget", eligibleProviders: [provider],
    });
    await acceptOffer({ pool: getMobilityPool(), requestId, providerId: provider.provider_id, action: "accept" });
    const first = await completeRequest({ pool: getMobilityPool(), requestId });
    expect(first.ok).toBe(true);
    const balanceAfterFirst = await readWallet(provider.provider_id);
    const ledgerAfterFirst = await readLedger(provider.provider_id);
    const requestAfterFirst = await readRequest(requestId);

    // Repeat 3x (simulating client retries)
    for (let i = 0; i < 3; i++) {
      const again = await completeRequest({ pool: getMobilityPool(), requestId });
      expect(again.ok).toBe(false);
      if (!again.ok) {
        expect(again.error).toBe("already_completed");
        expect(again.status).toBe(409);
      }
    }

    // Invariants: wallet unchanged, ledger unchanged, request unchanged
    expect(await readWallet(provider.provider_id)).toBe(balanceAfterFirst);
    const ledgerNow = await readLedger(provider.provider_id);
    expect(ledgerNow.length).toBe(ledgerAfterFirst.length);
    const requestNow = await readRequest(requestId);
    expect(requestNow.price_agreed_idr).toBe(requestAfterFirst.price_agreed_idr);
    expect(requestNow.network_fee_idr).toBe(requestAfterFirst.network_fee_idr);
    expect(requestNow.was_free_allowance).toBe(requestAfterFirst.was_free_allowance);
    expect(requestNow.completed_at).toEqual(requestAfterFirst.completed_at);

    // Fee actually charged matches the calc for the request's price
    const feeCharged = balanceBeforeCompletion - balanceAfterFirst;
    expect(feeCharged).toBe(calcNetworkFee(requestAfterFirst.price_agreed_idr));
  }, 60_000);
});

// Sanity: ensure the run tag prefix is stable and unique per run.
describe("run-tag sanity", () => {
  it("TEST_PREFIX starts with device:vitest-", () => {
    expect(TEST_PREFIX).toMatch(/^device:vitest-/);
  });
});
