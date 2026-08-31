// src/lib/nex-mobility/__tests__/test-fixtures.ts · Philip 2026-08-29
//
// Test fixtures for the mobility integration suite. Every fixture tags its
// rows with `learner_ref` prefix `device:vitest-<runId>-...` so cleanupAll()
// can safely wipe them without touching production/demo data.
//
// Uses a real Postgres pool against nex_dev because the behaviours under
// test are DB-transactional (race resolution, wallet threshold, monthly
// allowance, price-lock snapshotting, idempotency). Pure unit tests would
// prove nothing about those.

import type pg from "pg";
import { getMobilityPool } from "../pool";

// Every run gets a fresh prefix so parallel runs don't collide.
export const TEST_RUN_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export const TEST_PREFIX = `device:vitest-${TEST_RUN_ID}`;

// Shared bike used for every test provider · assumed to exist in nex.bike_model.
const TEST_BIKE_SLUG = "honda-vario-160-red";
const TEST_BIKE_YEAR = 2024;
const TEST_BIKE_COLOR = "#111827";

export interface TestProviderInput {
  name: string;
  price: number;
  wallet: number;
  city?: string;
  available?: boolean;
  status?: "active" | "pending_review";
}

export interface TestProvider {
  provider_id: string;
  learner_ref: string;
  name: string;
  price: number;
  wallet_at_setup: number;
}

let counter = 0;

/**
 * Create a fresh test provider with a specific price + wallet balance.
 * Provider is 'active' + 'is_available=true' by default so they can appear
 * in broadcasts.
 */
export async function createTestProvider(input: TestProviderInput): Promise<TestProvider> {
  counter += 1;
  const learner_ref = `${TEST_PREFIX}-${counter}`;
  const city = input.city ?? "TestCity";
  const status = input.status ?? "active";
  const available = input.available ?? true;

  const pool = getMobilityPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Ensure a bike_model row exists for the slug (tests may run against
    // a nex_dev where the seed differs; upsert defensively).
    await client.query(
      `INSERT INTO nex.bike_model (slug, brand, model, year_range, cc, category,
                                    base_image, base_color, common_colors, is_active)
       VALUES ($1, 'Honda', 'Vario 160', '2022-2026', 160, 'matic',
               '/nex/bikes/honda-vario-160-red.png', '#dc2626', '{}', true)
       ON CONFLICT (slug) DO NOTHING`,
      [TEST_BIKE_SLUG],
    );

    const { rows } = await client.query(
      `INSERT INTO nex.provider_profile
         (learner_ref, full_name, whatsapp_e164, bike_slug, bike_year,
          bike_color_hex, plate, city, status, is_available,
          price_per_service_idr, approved_at)
       VALUES ($1, $2, '+6281200000000', $3, $4, $5, $6, $7, $8, $9, $10,
               CASE WHEN $8 = 'active' THEN now() ELSE NULL END)
       RETURNING provider_id`,
      [
        learner_ref, input.name, TEST_BIKE_SLUG, TEST_BIKE_YEAR, TEST_BIKE_COLOR,
        `TEST ${counter}`, city, status, available, input.price,
      ],
    );
    const provider_id = rows[0].provider_id as string;

    await client.query(
      `INSERT INTO nex.provider_wallet (provider_id, balance_idr)
       VALUES ($1, $2)
       ON CONFLICT (provider_id) DO UPDATE SET balance_idr = EXCLUDED.balance_idr`,
      [provider_id, input.wallet],
    );

    await client.query("COMMIT");
    return {
      provider_id,
      learner_ref,
      name: input.name,
      price: input.price,
      wallet_at_setup: input.wallet,
    };
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Create a service_request in REQUEST_BROADCAST state addressed to a set of
 * eligible providers, and fan out one offer per provider at their listed
 * price. Returns the request_id.
 */
export async function createTestBroadcast(input: {
  destination: string;
  eligibleProviders: TestProvider[];
  originText?: string | null;
  windowSeconds?: number;
  customerLearnerRef?: string;
}): Promise<string> {
  counter += 1;
  const pool = getMobilityPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const window = input.windowSeconds ?? 60;
    const customerLearner = input.customerLearnerRef ?? `${TEST_PREFIX}-cust-${counter}`;
    const eligibleIds = input.eligibleProviders.map((p) => p.provider_id);

    const { rows } = await client.query(
      `INSERT INTO nex.service_request
         (learner_ref, service_kind, destination_text, origin_text,
          state, state_entered_at,
          eligible_provider_ids, broadcast_at, first_accept_window_seconds,
          broadcast_expires_at, requested_at)
       VALUES ($1, 'bike', $2, $3,
               'REQUEST_BROADCAST', now(),
               $4, now(), $5::int,
               now() + make_interval(secs => $5::int),
               now())
       RETURNING request_id`,
      [
        customerLearner, input.destination, input.originText ?? null,
        eligibleIds, window,
      ],
    );
    const request_id = rows[0].request_id as string;

    for (const p of input.eligibleProviders) {
      await client.query(
        `INSERT INTO nex.service_request_offer
           (request_id, provider_id, offered_price_idr)
         VALUES ($1, $2, $3)`,
        [request_id, p.provider_id, p.price],
      );
    }
    await client.query("COMMIT");
    return request_id;
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Backdate a completed request so that it appears in a PREVIOUS calendar
 * month. Used by the monthly-reset test.
 */
export async function backdateCompletedRequest(input: {
  requestId: string;
  toIso: string;
}): Promise<void> {
  const pool = getMobilityPool();
  await pool.query(
    `UPDATE nex.service_request
     SET completed_at = $2::timestamptz,
         state_entered_at = $2::timestamptz,
         updated_at = $2::timestamptz
     WHERE request_id = $1`,
    [input.requestId, input.toIso],
  );
}

/** Read a request row (post-transaction state) for assertions. */
export async function readRequest(requestId: string) {
  const pool = getMobilityPool();
  const { rows } = await pool.query(
    `SELECT request_id, state, provider_id, price_agreed_idr,
            network_fee_idr, was_free_allowance, network_fee_deducted_at,
            completed_at, accepted_at, cancelled_at
     FROM nex.service_request
     WHERE request_id = $1`,
    [requestId],
  );
  return rows[0] ?? null;
}

/** Read the current wallet balance for a provider. */
export async function readWallet(providerId: string): Promise<number> {
  const pool = getMobilityPool();
  const { rows } = await pool.query(
    `SELECT balance_idr FROM nex.provider_wallet WHERE provider_id = $1`,
    [providerId],
  );
  return Number(rows[0]?.balance_idr ?? 0);
}

/** Read all wallet transactions for a provider (oldest → newest). */
export async function readLedger(providerId: string) {
  const pool = getMobilityPool();
  const { rows } = await pool.query(
    `SELECT kind, amount_idr, balance_after_idr, related_request_id, note, created_at
     FROM nex.provider_wallet_transaction
     WHERE provider_id = $1
     ORDER BY created_at ASC, transaction_id ASC`,
    [providerId],
  );
  return rows;
}

/** Read all offers for a request. */
export async function readOffers(requestId: string) {
  const pool = getMobilityPool();
  const { rows } = await pool.query(
    `SELECT offer_id, provider_id, offered_price_idr, response, responded_at
     FROM nex.service_request_offer
     WHERE request_id = $1
     ORDER BY sent_at ASC`,
    [requestId],
  );
  return rows;
}

/** Run the same shape of query the broadcast route runs, to test eligibility. */
export async function queryBroadcastEligible(city: string) {
  const pool = getMobilityPool();
  const { rows } = await pool.query(
    `SELECT p.provider_id, p.full_name,
            p.price_per_service_idr,
            COALESCE(w.balance_idr, 0) AS wallet_balance_idr,
            (SELECT COUNT(*)::int FROM nex.service_request sr
               WHERE sr.provider_id = p.provider_id
                 AND sr.state = 'COMPLETED'
                 AND sr.completed_at >= date_trunc('month', now())
            ) AS free_used_this_month
     FROM nex.provider_profile p
     LEFT JOIN nex.provider_wallet w ON w.provider_id = p.provider_id
     WHERE p.status = 'active'
       AND p.is_available = true
       AND p.city = $1
       AND p.price_per_service_idr IS NOT NULL`,
    [city],
  );
  return rows;
}

/**
 * Nuke every row created by THIS test run only.
 *
 * IMPORTANT: uses TEST_PREFIX (the per-run tag) rather than the generic
 * 'device:vitest-%' wildcard so parallel test files (mobility + midtrans
 * running concurrently under vitest 4) do NOT wipe each other's data
 * mid-run. Each file gets its own module instance and its own TEST_PREFIX.
 *
 * ORDER MATTERS: children before parents. Called by afterAll.
 */
export async function cleanupAllTestData(pool?: pg.Pool): Promise<void> {
  const p = pool ?? getMobilityPool();
  const prefix = TEST_PREFIX + "%";
  // 1. Offers + ledger (child rows on service_request/provider)
  await p.query(
    `DELETE FROM nex.service_request_offer
     WHERE request_id IN (
       SELECT request_id FROM nex.service_request
       WHERE learner_ref LIKE $1
     )`,
    [prefix],
  );
  await p.query(
    `DELETE FROM nex.provider_wallet_transaction
     WHERE provider_id IN (
       SELECT provider_id FROM nex.provider_profile
       WHERE learner_ref LIKE $1
     )`,
    [prefix],
  );
  // 2. Topup intents (child of provider) — Phase 4 addition
  await p.query(
    `DELETE FROM nex.provider_topup_intent
     WHERE provider_id IN (
       SELECT provider_id FROM nex.provider_profile
       WHERE learner_ref LIKE $1
     )`,
    [prefix],
  );
  // 3. Requests (may reference providers; delete before providers)
  await p.query(
    `DELETE FROM nex.service_request WHERE learner_ref LIKE $1`,
    [prefix],
  );
  // 4. Wallets, providers
  await p.query(
    `DELETE FROM nex.provider_wallet
     WHERE provider_id IN (
       SELECT provider_id FROM nex.provider_profile
       WHERE learner_ref LIKE $1
     )`,
    [prefix],
  );
  await p.query(
    `DELETE FROM nex.provider_profile WHERE learner_ref LIKE $1`,
    [prefix],
  );
}
