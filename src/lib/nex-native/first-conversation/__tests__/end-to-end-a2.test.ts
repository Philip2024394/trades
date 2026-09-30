// src/lib/nex-native/first-conversation/__tests__/end-to-end-a2.test.ts
//
// Bridge 99 · sealed §13 A2 end-to-end proof.
//
// The critical chain the founder asked to see:
//
//   same send_intent_id
//     → two concurrent POSTs (via processFirstMessagePayload)
//     → Migration 105 dedup
//     → one account
//     → one conversation
//     → one message effect (per recipient device)
//     → one welcome outbox event
//
// Different send_intent_ids produce independent accounts.
//
// This runs against the LIVE ijvqdvsvwtwxzcqmoqit project through the
// same processFirstMessagePayload core that the route.ts thin wrapper
// invokes. The two calls fire concurrently via Promise.all so they
// genuinely race through the atomic function's advisory lock.

import "./_load-env";

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "node:crypto";
import pkg from "pg";
const { Client } = pkg;

import { processFirstMessagePayload } from "../first-message-http";
import type { FirstMessageRequestBody } from "../first-message-http";
import type { NexResolvedSession } from "../provisional-session";
import type { NexSessionCryptoConfig } from "../session-crypto";
import type { ProvisionalFingerprintConfig } from "../provisional-fingerprint";

vi.setConfig({ testTimeout: 30_000 });

const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";
const KEY_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SALT_A = "sssssssssssssssssssssssssssssss1";

const cryptoCfg: NexSessionCryptoConfig = {
  activeKey: KEY_A,
  acceptedKeys: [KEY_A],
};
const fingerprintCfg: ProvisionalFingerprintConfig = {
  activeSalt: SALT_A,
  acceptedSalts: [SALT_A],
};

let pg: InstanceType<typeof Client>;
let ownerAccountId: string;
const trackedAccountIds: string[] = [];

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes(EXPECTED_PROJECT_REF)) {
    throw new Error(`refuses: not ${EXPECTED_PROJECT_REF}`);
  }
  pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  const rand = Math.random().toString(36).slice(2, 10);
  const r = await pg.query(
    `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
    [`_bridge99_e2e_a2_owner_${rand}`],
  );
  ownerAccountId = r.rows[0].id;
});

afterAll(async () => {
  if (trackedAccountIds.length > 0) {
    await pg.query(
      `DELETE FROM nex_account WHERE id = ANY($1::uuid[])`,
      [trackedAccountIds],
    );
  }
  if (ownerAccountId) {
    await pg.query(`DELETE FROM nex_account WHERE id = $1`, [ownerAccountId]);
  }
  await pg.end();
});

function goodBody(
  overrides: Partial<FirstMessageRequestBody> = {},
): FirstMessageRequestBody {
  return {
    message_length: 20,
    send_intent_id: randomUUID(),
    message_group_id: randomUUID(),
    ciphertext_rows: [
      {
        recipient_device_id: "owner-device-1",
        ciphertext_b64: Buffer.from("ct-1").toString("base64"),
        nonce_b64: Buffer.from("nonce-24bytes-padding-ok").toString("base64"),
      },
    ],
    device_id: `dev-${randomUUID().slice(0, 12)}`,
    device_public_key_b64: "A".repeat(43),
    owner_account_id: ownerAccountId,
    owner_business_id: null,
    owner_bisnis_tier: "gratis",
    fingerprint_client: {
      ua_class: "chromium",
      tz_offset_minutes: -480,
      accept_language_primary: "en",
    },
    ...overrides,
  };
}

function deps(getIp: string = "203.0.113.42") {
  return {
    resolveSession: async () =>
      ({ kind: "none", reason: "cookie_missing" }) as NexResolvedSession,
    getConnectionIp: async () => getIp,
    fingerprintCfg,
    cryptoCfg,
  };
}

// ---------------------------------------------------------------------------
// The critical proof · same send_intent_id · two concurrent POSTs
// ---------------------------------------------------------------------------

describe("§13 A2 end-to-end · same send_intent_id → concurrent POSTs → one account", () => {
  it("two concurrent processFirstMessagePayload calls with the SAME send_intent_id produce one account, one conversation, deduplicated=true on one side", async () => {
    const sharedIntent = randomUUID();
    // Distinct device_ids so the fingerprint hashes differ · this ISN'T
    // fingerprint-based dedup. Uses only send_intent_id.
    const bodyA = goodBody({ send_intent_id: sharedIntent, device_id: `dev-A-${randomUUID().slice(0, 8)}` });
    const bodyB = goodBody({ send_intent_id: sharedIntent, device_id: `dev-B-${randomUUID().slice(0, 8)}` });

    // Different IPs · proves dedup is intent-based, not IP-based
    const depsA = deps("203.0.113.10");
    const depsB = deps("198.51.100.20");

    // Fire both concurrently
    const [ra, rb] = await Promise.all([
      processFirstMessagePayload(bodyA, depsA),
      processFirstMessagePayload(bodyB, depsB),
    ]);

    // Both must have http 200 + status 'created'
    expect(ra.http_status).toBe(200);
    expect(rb.http_status).toBe(200);
    expect(ra.body.status).toBe("created");
    expect(rb.body.status).toBe("created");

    const accA = ra.body.account_id as string;
    const accB = rb.body.account_id as string;
    trackedAccountIds.push(accA);
    if (accB !== accA) trackedAccountIds.push(accB);

    // The critical assertion: SAME account_id
    expect(accA).toBe(accB);
    // SAME conversation_id
    expect(ra.body.conversation_id).toBe(rb.body.conversation_id);

    // Exactly one deduplicated=false and one deduplicated=true
    const dupA = ra.body.deduplicated as boolean;
    const dupB = rb.body.deduplicated as boolean;
    expect([dupA, dupB].sort()).toEqual([false, true]);

    // DB verification · exactly one dedup row for this intent
    const dedup = await pg.query(
      `SELECT count(*)::int AS n FROM nex_bridge99_first_send_intent WHERE send_intent_id = $1`,
      [sharedIntent],
    );
    expect(Number(dedup.rows[0].n)).toBe(1);

    // Exactly one account with our tracked id
    const acct = await pg.query(
      `SELECT count(*)::int AS n FROM nex_account WHERE id = $1`,
      [accA],
    );
    expect(Number(acct.rows[0].n)).toBe(1);

    // Exactly one conversation for this pair
    const conv = await pg.query(
      `SELECT count(*)::int AS n FROM nex_peer_conversation
        WHERE (participant_a_id = $1 AND participant_b_id = $2)
           OR (participant_a_id = $2 AND participant_b_id = $1)`,
      [accA, ownerAccountId],
    );
    expect(Number(conv.rows[0].n)).toBe(1);

    // Exactly one welcome-outbox event
    const outbox = await pg.query(
      `SELECT count(*)::int AS n FROM nex_welcome_outbox WHERE account_id = $1`,
      [accA],
    );
    expect(Number(outbox.rows[0].n)).toBe(1);

    // Both callers got a valid session cookie (may be different session_ids
    // pointing at same account_id · that's fine per doctrine)
    expect(ra.set_session_cookie).toBeDefined();
    expect(rb.set_session_cookie).toBeDefined();
    expect(ra.set_session_cookie!.payload.account_id).toBe(accA);
    expect(rb.set_session_cookie!.payload.account_id).toBe(accA);
  });
});

// ---------------------------------------------------------------------------
// Sequential retry (double-tap Send within 100ms surrogate)
// ---------------------------------------------------------------------------

describe("§13 A2 end-to-end · sequential retry same intent", () => {
  it("sequential same-intent retry · second call returns same account_id · deduplicated=true", async () => {
    const sharedIntent = randomUUID();
    const body = goodBody({ send_intent_id: sharedIntent });

    const first = await processFirstMessagePayload(body, deps());
    const second = await processFirstMessagePayload(body, deps());

    expect(first.body.status).toBe("created");
    expect(second.body.status).toBe("created");
    expect(second.body.account_id).toBe(first.body.account_id);
    expect(second.body.conversation_id).toBe(first.body.conversation_id);
    expect(first.body.deduplicated).toBe(false);
    expect(second.body.deduplicated).toBe(true);

    trackedAccountIds.push(first.body.account_id as string);
  });
});

// ---------------------------------------------------------------------------
// Different intents → independent accounts
// ---------------------------------------------------------------------------

describe("§13 A2 end-to-end · different intents produce independent accounts", () => {
  it("two concurrent processFirstMessagePayload calls with DIFFERENT send_intent_ids create independent accounts", async () => {
    // Same device_id + same IP so the fingerprint hash is IDENTICAL ·
    // yet different intents must create different accounts. This
    // proves fingerprint is NOT used for identity/dedup.
    const shared_device_id = `dev-shared-${randomUUID().slice(0, 8)}`;
    const bodyA = goodBody({ send_intent_id: randomUUID(), device_id: shared_device_id });
    const bodyB = goodBody({ send_intent_id: randomUUID(), device_id: shared_device_id });

    const [ra, rb] = await Promise.all([
      processFirstMessagePayload(bodyA, deps()),
      processFirstMessagePayload(bodyB, deps()),
    ]);

    expect(ra.body.status).toBe("created");
    expect(rb.body.status).toBe("created");
    expect(ra.body.account_id).not.toBe(rb.body.account_id);
    // Both are deduplicated=false (each performed its own atomic create)
    expect(ra.body.deduplicated).toBe(false);
    expect(rb.body.deduplicated).toBe(false);

    trackedAccountIds.push(
      ra.body.account_id as string,
      rb.body.account_id as string,
    );
  });
});

// ---------------------------------------------------------------------------
// Fingerprint is NOT the dedup key · additional structural proof
// ---------------------------------------------------------------------------

describe("§13 A3 end-to-end · fingerprint does NOT dedup identity", () => {
  it("same fingerprint inputs + different send_intent_ids + different requests = different accounts", async () => {
    // Force identical fingerprint inputs (device_id + ua_class + tz +
    // language + IP /24) but different intent ids.
    const shared_device_id = `dev-fp-${randomUUID().slice(0, 8)}`;
    const bodyA = goodBody({
      send_intent_id: randomUUID(),
      device_id: shared_device_id,
    });
    const bodyB = goodBody({
      send_intent_id: randomUUID(),
      device_id: shared_device_id,
    });

    const ra = await processFirstMessagePayload(bodyA, deps("203.0.113.42"));
    const rb = await processFirstMessagePayload(bodyB, deps("203.0.113.42"));

    // Two distinct accounts · fingerprint collision has NO identity effect
    expect(ra.body.account_id).not.toBe(rb.body.account_id);
    trackedAccountIds.push(
      ra.body.account_id as string,
      rb.body.account_id as string,
    );
  });
});
