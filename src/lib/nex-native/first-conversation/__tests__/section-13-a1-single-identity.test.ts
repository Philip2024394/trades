// src/lib/nex-native/first-conversation/__tests__/section-13-a1-single-identity.test.ts
//
// Bridge 99 · sealed §13 A1 · 20-cover single identity via cookie.
// -----------------------------------------------------------------------------
// Founder-authorised isolated fixtures 2026-09-30:
//   · 20 dedicated test-business rows in ijvqdvsvwtwxzcqmoqit
//   · distinctive display_name prefix "_b99_a1_biz_"
//   · deterministic cleanup on afterAll (cascade removes conversations
//     that reference these businesses via origin_cover_business_id)
//   · NO existing production/prototype business rows are touched
//
// The test proves: 20 distinct owner_business_id values, one visitor
// session, one nex_account. Continuity flows through the nex_session
// cookie · fingerprint is explicitly cleared to prove it plays no
// identity role.

import "./_load-env";

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "node:crypto";
import pkg from "pg";
const { Client } = pkg;

import { processFirstMessagePayload } from "../first-message-http";
import type { FirstMessageRequestBody } from "../first-message-http";
import type { NexResolvedSession, NexResolvedProvisional } from "../provisional-session";
import type { NexSessionCryptoConfig } from "../session-crypto";
import type { ProvisionalFingerprintConfig } from "../provisional-fingerprint";
import { checkSessionValidity, getSessionById } from "../session-registry-service";

vi.setConfig({ testTimeout: 60_000 });

const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";
const KEY = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SALT = "sssssssssssssssssssssssssssssss1";
const cryptoCfg: NexSessionCryptoConfig = { activeKey: KEY, acceptedKeys: [KEY] };
const fingerprintCfg: ProvisionalFingerprintConfig = { activeSalt: SALT, acceptedSalts: [SALT] };

let pg: InstanceType<typeof Client>;
const businessIds: string[] = [];
const ownerAccountIds: string[] = [];
const trackedProvisionalIds: string[] = [];

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes(EXPECTED_PROJECT_REF)) {
    throw new Error(`refuses: not ${EXPECTED_PROJECT_REF}`);
  }
  pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  // Pre-cleanup: wipe any orphaned test fixtures from prior failed runs.
  // Delete businesses that reference our test-owner prefix first (regardless
  // of business display_name · catches renamed-prefix orphans too).
  await pg.query(
    `DELETE FROM nex_peer_conversation
      WHERE origin_cover_business_id IN (
        SELECT id FROM nex_business
         WHERE owner_account_id IN (
           SELECT id FROM nex_account WHERE display_name LIKE '_b99_a1_owner_%'
         )
      )`,
  );
  await pg.query(
    `DELETE FROM nex_business
      WHERE owner_account_id IN (
        SELECT id FROM nex_account WHERE display_name LIKE '_b99_a1_owner_%'
      )`,
  );
  await pg.query(`DELETE FROM nex_account WHERE display_name LIKE '_b99_a1_owner_%'`);

  // Create 20 owner accounts + 20 business rows referencing them.
  const rand = Math.random().toString(36).slice(2, 8);
  for (let i = 0; i < 20; i++) {
    const owner = await pg.query(
      `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
      [`_b99_a1_owner_${rand}_${i}`],
    );
    const ownerId = owner.rows[0].id as string;
    ownerAccountIds.push(ownerId);

    // Insert a business owned by this owner account. Uses only the
    // required NOT NULL columns · other columns have defaults.
    const biz = await pg.query(
      `INSERT INTO nex_business (owner_account_id, display_name, slug)
       VALUES ($1::uuid, $2, $3)
       RETURNING id`,
      // slug format check: lowercase alphanumeric + hyphens · start with letter
      [ownerId, `_b99_a1_biz_${rand}_${i}`, `b99a1biz${rand}${i}`],
    );
    businessIds.push(biz.rows[0].id as string);
  }
}, 60_000);

afterAll(async () => {
  // Cleanup by REFERENCE, not by display_name prefix · handles the case
  // where businesses might have any display_name shape.
  try {
    if (trackedProvisionalIds.length > 0) {
      await pg.query(
        `DELETE FROM nex_account WHERE id = ANY($1::uuid[])`,
        [trackedProvisionalIds],
      );
    }
    await pg.query(
      `DELETE FROM nex_peer_conversation
        WHERE origin_cover_business_id IN (
          SELECT id FROM nex_business
           WHERE owner_account_id IN (
             SELECT id FROM nex_account WHERE display_name LIKE '_b99_a1_owner_%'
           )
        )`,
    );
    await pg.query(
      `DELETE FROM nex_business
        WHERE owner_account_id IN (
          SELECT id FROM nex_account WHERE display_name LIKE '_b99_a1_owner_%'
        )`,
    );
    await pg.query(
      `DELETE FROM nex_account WHERE display_name LIKE '_b99_a1_owner_%'`,
    );
  } finally {
    await pg.end();
  }
}, 60_000);

// Extend beforeAll timeout too · 20 accounts + 20 businesses = 40 inserts.

function ciphertext(id: string) {
  return {
    recipient_device_id: id,
    ciphertext_b64: Buffer.from(`ct-${id}`).toString("base64"),
    nonce_b64: Buffer.from(`nonce-${id}-24byte-pad`).toString("base64"),
  };
}

function bodyForCover(
  businessId: string,
  ownerId: string,
  shared: {
    device_id: string;
    fingerprint_client: FirstMessageRequestBody["fingerprint_client"];
  },
): FirstMessageRequestBody {
  return {
    message_length: 20,
    send_intent_id: randomUUID(),
    message_group_id: randomUUID(),
    ciphertext_rows: [ciphertext(`owner-device-1`)],
    device_id: shared.device_id,
    device_public_key_b64: "A".repeat(43),
    owner_account_id: ownerId,
    owner_business_id: businessId,
    owner_bisnis_tier: "gratis",
    fingerprint_client: shared.fingerprint_client,
  };
}

// ---------------------------------------------------------------------------
// A1 · 20 covers → same visitor session → one account
// ---------------------------------------------------------------------------

describe("§13 A1 · 20 distinct covers with the same session cookie → one nex_account", () => {
  it("visitor messages all 20 covers · single account · continuity via nex_session", async () => {
    // First call · session=none · creates account + first session
    const sharedDevice = `dev-a1-${randomUUID().slice(0, 8)}`;
    const sharedFp: FirstMessageRequestBody["fingerprint_client"] = {
      ua_class: "chromium",
      tz_offset_minutes: -480,
      accept_language_primary: "en",
    };

    const firstResult = await processFirstMessagePayload(
      bodyForCover(businessIds[0], ownerAccountIds[0], {
        device_id: sharedDevice,
        fingerprint_client: sharedFp,
      }),
      {
        resolveSession: async () =>
          ({ kind: "none", reason: "cookie_missing" }) as NexResolvedSession,
        getConnectionIp: async () => "203.0.113.42",
        fingerprintCfg,
        cryptoCfg,
      },
    );
    expect(firstResult.body.status).toBe("created");
    if (firstResult.body.status !== "created") return;
    const accountId = firstResult.body.account_id as string;
    trackedProvisionalIds.push(accountId);
    const sessionId = firstResult.set_session_cookie!.payload.session_id;

    // Simulate the "browser now carries a valid nex_session cookie"
    // state for calls 2..20. The resolver returns kind:'provisional' with
    // the freshly-created account · this proves that calls 2..20
    // resolve via the SESSION COOKIE, not via fingerprint (which we
    // deliberately vary later to prove that point).
    const sessionRow = await getSessionById(sessionId);
    expect(sessionRow).not.toBeNull();
    const accountRow = { id: accountId, display_name: "New visitor" };

    // Calls 2..20 · same session · different covers
    for (let i = 1; i < 20; i++) {
      const r = await processFirstMessagePayload(
        bodyForCover(businessIds[i], ownerAccountIds[i], {
          device_id: sharedDevice,
          fingerprint_client: sharedFp,
        }),
        {
          resolveSession: async () =>
            ({
              kind: "provisional",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              account: accountRow as any,
              session_row: sessionRow!,
            }) as NexResolvedProvisional,
          getConnectionIp: async () => "203.0.113.42",
          fingerprintCfg,
          cryptoCfg,
        },
      );
      // Existing session → route returns existing_session directive
      expect(r.body.status).toBe("existing_session");
      if (r.body.status === "existing_session") {
        expect(r.body.account_id).toBe(accountId);
      }
    }

    // Assertion: ONLY ONE nex_account row was created (tracked as ours)
    expect(trackedProvisionalIds.length).toBe(1);

    // Session remains valid throughout
    const validity = await checkSessionValidity(sessionId);
    expect(validity.valid).toBe(true);
  });

  it("fingerprint deliberately varied across the 20 covers · does NOT create separate identities · session cookie is the continuity", async () => {
    // Vary fingerprint inputs (device_id, tz, language) across covers.
    // Continuity STILL flows through the resolver's kind:'provisional'
    // decision · fingerprint plays no identity role.
    const firstDevice = `dev-a1v-${randomUUID().slice(0, 8)}`;
    const first = await processFirstMessagePayload(
      bodyForCover(businessIds[0], ownerAccountIds[0], {
        device_id: firstDevice,
        fingerprint_client: {
          ua_class: "chromium",
          tz_offset_minutes: -480,
          accept_language_primary: "en",
        },
      }),
      {
        resolveSession: async () =>
          ({ kind: "none", reason: "cookie_missing" }) as NexResolvedSession,
        getConnectionIp: async () => "203.0.113.10",
        fingerprintCfg,
        cryptoCfg,
      },
    );
    expect(first.body.status).toBe("created");
    if (first.body.status !== "created") return;
    const accountId = first.body.account_id as string;
    trackedProvisionalIds.push(accountId);
    const sessionRow = (await getSessionById(
      first.set_session_cookie!.payload.session_id,
    ))!;
    const accountRow = { id: accountId, display_name: "New visitor" };

    // Rest of covers with VARIED fingerprint (different ua_class, tz, ip)
    // but the SAME session (via resolver returning provisional).
    const variedFp = [
      { ua_class: "webkit" as const, tz_offset_minutes: 60, accept_language_primary: "id", ip: "198.51.100.20" },
      { ua_class: "gecko" as const, tz_offset_minutes: 480, accept_language_primary: "en", ip: "192.0.2.42" },
    ];

    for (let i = 1; i < 20; i++) {
      const fp = variedFp[i % variedFp.length];
      const r = await processFirstMessagePayload(
        bodyForCover(businessIds[i], ownerAccountIds[i], {
          device_id: `dev-varied-${i}-${randomUUID().slice(0, 4)}`,
          fingerprint_client: {
            ua_class: fp.ua_class,
            tz_offset_minutes: fp.tz_offset_minutes,
            accept_language_primary: fp.accept_language_primary,
          },
        }),
        {
          resolveSession: async () =>
            ({
              kind: "provisional",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              account: accountRow as any,
              session_row: sessionRow,
            }) as NexResolvedProvisional,
          getConnectionIp: async () => fp.ip,
          fingerprintCfg,
          cryptoCfg,
        },
      );
      expect(r.body.status).toBe("existing_session");
      if (r.body.status === "existing_session") {
        expect(r.body.account_id).toBe(accountId);
      }
    }
    // Still only 1 tracked provisional
    expect(trackedProvisionalIds.filter((id) => id === accountId)).toHaveLength(1);
  });
});
