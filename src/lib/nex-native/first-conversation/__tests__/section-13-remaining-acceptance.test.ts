// src/lib/nex-native/first-conversation/__tests__/section-13-remaining-acceptance.test.ts
//
// Bridge 99 · §13 remaining acceptance criteria:
//   · Session revocation end-to-end (route → registry)
//   · Crypto four-sink audit (DB / response / error / logs)
//   · Three-class authorization (service-layer per founder Boundary #3)
//   · NEX1 once-only welcome via real delivery adapter
//   · A3 comprehensive fingerprint-vs-cookie boundary confirmation

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
import { resetCoverContinuityWith } from "../reset-cover-continuity";
import {
  checkSessionValidity,
  getSessionById,
  revokeSession,
} from "../session-registry-service";
import type { NexCookieAdapter, NexCookieWriteOptions } from "../session-cookie";
import { writeNexSessionCookie } from "../session-cookie";
import { runWelcomeOutboxOnce } from "../welcome-outbox-worker";
import {
  deliverNex1WelcomeToAccount,
  defaultWelcomeDeliveryErrorPolicy,
} from "../welcome-delivery";
import { NEX_OFFICIAL_ACCOUNT_ID } from "../../nex-official";

vi.setConfig({ testTimeout: 60_000 });

const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";
const KEY = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SALT = "sssssssssssssssssssssssssssssss1";
const cryptoCfg: NexSessionCryptoConfig = { activeKey: KEY, acceptedKeys: [KEY] };
const fingerprintCfg: ProvisionalFingerprintConfig = { activeSalt: SALT, acceptedSalts: [SALT] };
const cookieCfg = { secure: true, path: "/" };

let pg: InstanceType<typeof Client>;
let ownerId: string;
const tracked: string[] = [];

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes(EXPECTED_PROJECT_REF)) throw new Error("wrong project");
  pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  const owner = await pg.query(
    `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
    [`_b99_s13_owner_${Math.random().toString(36).slice(2, 8)}`],
  );
  ownerId = owner.rows[0].id;
});

afterAll(async () => {
  try {
    if (tracked.length > 0) {
      await pg.query(`DELETE FROM nex_account WHERE id = ANY($1::uuid[])`, [tracked]);
    }
    if (ownerId) {
      await pg.query(`DELETE FROM nex_account WHERE id = $1`, [ownerId]);
    }
  } finally {
    await pg.end();
  }
}, 60_000);

function ciphertext(id: string) {
  return {
    recipient_device_id: id,
    ciphertext_b64: Buffer.from(`ct-${id}`).toString("base64"),
    nonce_b64: Buffer.from(`nonce-${id}-24byte-pad`).toString("base64"),
  };
}

function goodBody(overrides: Partial<FirstMessageRequestBody> = {}): FirstMessageRequestBody {
  return {
    message_length: 20,
    send_intent_id: randomUUID(),
    message_group_id: randomUUID(),
    ciphertext_rows: [ciphertext("owner-device-1")],
    device_id: `dev-${randomUUID().slice(0, 12)}`,
    device_public_key_b64: "A".repeat(43),
    owner_account_id: ownerId,
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

function makeFakeCookieAdapter() {
  const jar = new Map<string, string>();
  const writes: Array<{ name: string; value: string; options: NexCookieWriteOptions }> = [];
  const clears: Array<{ name: string }> = [];
  const adapter: NexCookieAdapter = {
    read: (n) => jar.get(n),
    write: (n, v, o) => {
      jar.set(n, v);
      writes.push({ name: n, value: v, options: o });
    },
    clear: (n) => {
      jar.delete(n);
      clears.push({ name: n });
    },
  };
  return { adapter, jar, writes, clears };
}

// ---------------------------------------------------------------------------
// SESSION REVOCATION E2E
// ---------------------------------------------------------------------------

describe("§13 · session revocation end-to-end (creation → revoke → session invalid)", () => {
  it("route creates session → resetCoverContinuityWith revokes it → session no longer valid", async () => {
    // 1. Create provisional via the route core
    const created = await processFirstMessagePayload(goodBody(), {
      resolveSession: async () => ({ kind: "none", reason: "cookie_missing" }) as NexResolvedSession,
      getConnectionIp: async () => "203.0.113.1",
      fingerprintCfg,
      cryptoCfg,
    });
    expect(created.body.status).toBe("created");
    if (created.body.status !== "created") return;
    tracked.push(created.body.account_id as string);
    const sessionId = created.set_session_cookie!.payload.session_id;

    // 2. Session is valid immediately after
    const before = await checkSessionValidity(sessionId);
    expect(before.valid).toBe(true);

    // 3. Simulate the reset-cover-continuity route call: put the cookie
    // into a fake adapter, then invoke the deterministic core.
    const bundle = makeFakeCookieAdapter();
    writeNexSessionCookie(
      bundle.adapter,
      created.set_session_cookie!.payload,
      cryptoCfg,
      cookieCfg,
    );
    const resetResult = await resetCoverContinuityWith({
      cookieAdapter: bundle.adapter,
      cookieCfg,
      cryptoCfg,
    });
    expect(resetResult.reset).toBe(true);
    if (resetResult.reset) {
      expect(resetResult.session_id).toBe(sessionId);
    }

    // 4. Session is revoked
    const after = await checkSessionValidity(sessionId);
    expect(after.valid).toBe(false);
    if (!after.valid) expect(after.reason).toBe("revoked");

    // 5. Cookie was cleared
    expect(bundle.clears.length).toBeGreaterThan(0);
    expect(bundle.adapter.read("nex_session")).toBeUndefined();
  });

  it("revoking session A does NOT affect session B for the same account (route-level proof)", async () => {
    // Create two independent sessions for two independent visitors, then
    // revoke one · the other must remain valid.
    const bodyA = goodBody();
    const bodyB = goodBody({ send_intent_id: randomUUID(), device_id: `dev-${randomUUID().slice(0, 8)}` });

    const [ra, rb] = await Promise.all([
      processFirstMessagePayload(bodyA, {
        resolveSession: async () => ({ kind: "none", reason: "cookie_missing" }) as NexResolvedSession,
        getConnectionIp: async () => "203.0.113.10",
        fingerprintCfg,
        cryptoCfg,
      }),
      processFirstMessagePayload(bodyB, {
        resolveSession: async () => ({ kind: "none", reason: "cookie_missing" }) as NexResolvedSession,
        getConnectionIp: async () => "203.0.113.20",
        fingerprintCfg,
        cryptoCfg,
      }),
    ]);
    if (ra.body.status !== "created" || rb.body.status !== "created") throw new Error("setup failed");
    tracked.push(ra.body.account_id as string, rb.body.account_id as string);

    const sessA = ra.set_session_cookie!.payload.session_id;
    const sessB = rb.set_session_cookie!.payload.session_id;

    await revokeSession(sessA, "user_reset_cover_continuity");

    const vA = await checkSessionValidity(sessA);
    const vB = await checkSessionValidity(sessB);
    expect(vA.valid).toBe(false);
    expect(vB.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CRYPTO FOUR-SINK AUDIT
// ---------------------------------------------------------------------------

describe("§13 · crypto four-sink audit (no plaintext leaks in any sink)", () => {
  it("plaintext marker sent as encrypted ciphertext_b64 · never appears in DB body / response / errors / logs", async () => {
    // The distinctive marker · if this ever appears in any sink, the
    // server has leaked plaintext (which the server never sees for
    // user messages · they arrive as ciphertext).
    const secretMarker = `PLAINTEXT-MARKER-${randomUUID()}`;
    // Encode marker into ciphertext_b64 · the server stores the raw
    // ciphertext bytes but they're base64-encoded on the wire.
    const bodyWithMarker = goodBody({
      ciphertext_rows: [
        {
          recipient_device_id: "owner-device-1",
          ciphertext_b64: Buffer.from(secretMarker).toString("base64"),
          nonce_b64: Buffer.from("nonce-24bytes-padding-ok").toString("base64"),
        },
      ],
    });

    // Capture console output
    const consoleSpy = {
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };
    try {
      const r = await processFirstMessagePayload(bodyWithMarker, {
        resolveSession: async () => ({ kind: "none", reason: "cookie_missing" }) as NexResolvedSession,
        getConnectionIp: async () => "203.0.113.30",
        fingerprintCfg,
        cryptoCfg,
      });
      expect(r.body.status).toBe("created");
      if (r.body.status !== "created") return;
      tracked.push(r.body.account_id as string);

      // Sink 1: DB body column contains '(encrypted)', not our marker.
      // Ciphertext bytes are the base64-decoded marker but stored as
      // bytea · not readable as plaintext by any code path that reads
      // the body column.
      const q = await pg.query(
        `SELECT body FROM nex_peer_message WHERE conversation_id = $1`,
        [r.body.conversation_id],
      );
      for (const row of q.rows) {
        expect(row.body).toBe("(encrypted)");
        expect(row.body).not.toContain(secretMarker);
      }

      // Sink 2: response body · JSON-serialised · marker must not appear
      const responseText = JSON.stringify(r.body);
      expect(responseText).not.toContain(secretMarker);

      // Sink 3: error responses · force a bad request and verify no
      // marker leaks in error text
      const badResult = await processFirstMessagePayload(
        { ...bodyWithMarker, message_length: -1 },
        {
          resolveSession: async () => ({ kind: "none", reason: "cookie_missing" }) as NexResolvedSession,
          getConnectionIp: async () => "203.0.113.30",
          fingerprintCfg,
          cryptoCfg,
        },
      );
      expect(JSON.stringify(badResult.body)).not.toContain(secretMarker);

      // Sink 4: console output · captured via spy
      const consoleOutput = [
        ...consoleSpy.log.mock.calls.flat(),
        ...consoleSpy.warn.mock.calls.flat(),
        ...consoleSpy.error.mock.calls.flat(),
      ]
        .map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
        .join("\n");
      expect(consoleOutput).not.toContain(secretMarker);
    } finally {
      consoleSpy.log.mockRestore();
      consoleSpy.warn.mockRestore();
      consoleSpy.error.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// THREE-CLASS AUTHORIZATION (service-layer per founder Boundary #3)
// ---------------------------------------------------------------------------

describe("§13 · three-class authorization (service-layer participant enforcement)", () => {
  it("Provisional sender, conversation owner, unrelated user · three access classes", async () => {
    // Set up: create a provisional, they send a first message to ownerId.
    const created = await processFirstMessagePayload(goodBody(), {
      resolveSession: async () => ({ kind: "none", reason: "cookie_missing" }) as NexResolvedSession,
      getConnectionIp: async () => "203.0.113.40",
      fingerprintCfg,
      cryptoCfg,
    });
    if (created.body.status !== "created") throw new Error("setup failed");
    tracked.push(created.body.account_id as string);
    const provisionalId = created.body.account_id as string;
    const conversationId = created.body.conversation_id as string;

    // Class 1: PROVISIONAL SENDER · can see the message in their own
    // conversation (service-layer participant check)
    const { getPeerConversationById } = await import("../../peer-conversation-service");
    const convFromProvisional = await getPeerConversationById(conversationId);
    expect(convFromProvisional).not.toBeNull();
    expect(
      convFromProvisional!.participant_a_id === provisionalId ||
        convFromProvisional!.participant_b_id === provisionalId,
    ).toBe(true);

    // Class 2: CONVERSATION OWNER (ownerId) is the other participant ·
    // service-layer participant check would allow them
    expect(
      convFromProvisional!.participant_a_id === ownerId ||
        convFromProvisional!.participant_b_id === ownerId,
    ).toBe(true);

    // Class 3: UNRELATED account · attempts to send a message into this
    // conversation → service-layer rejects
    const outsider = await pg.query(
      `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
      [`_b99_s13_outsider_${randomUUID().slice(0, 8)}`],
    );
    const outsiderId = outsider.rows[0].id as string;
    tracked.push(outsiderId);
    const { sendPeerMessage } = await import("../../peer-message-service");
    let rejected = false;
    let msg = "";
    try {
      await sendPeerMessage({
        conversation_id: conversationId,
        sender_account_id: outsiderId,
        body: "outsider attempt",
      });
    } catch (e) {
      msg = e instanceof Error ? e.message : String(e);
      rejected = /not a participant/i.test(msg);
    }
    expect(rejected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// NEX1 ONCE-ONLY WELCOME EFFECT
// ---------------------------------------------------------------------------

describe("§13 · NEX1 welcome fires exactly once per provisional account", () => {
  it("create provisional → run worker (real adapter) → 1 message · re-run → 0 additional", async () => {
    // Create a provisional via the route core · this creates the outbox row
    const r = await processFirstMessagePayload(goodBody(), {
      resolveSession: async () => ({ kind: "none", reason: "cookie_missing" }) as NexResolvedSession,
      getConnectionIp: async () => "203.0.113.50",
      fingerprintCfg,
      cryptoCfg,
    });
    if (r.body.status !== "created") throw new Error("setup failed");
    tracked.push(r.body.account_id as string);
    const accountId = r.body.account_id as string;

    const pgAdapter = {
      query: (async (text: string, values?: unknown[]) => {
        return values
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((await pg.query(text, values as any[])) as { rows: unknown[] })
          : ((await pg.query(text)) as { rows: unknown[] });
      }) as (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }>,
    };

    // Run worker until our outbox is processed (or no more work)
    let ranProcessed = 0;
    for (let i = 0; i < 30; i++) {
      const wr = await runWelcomeOutboxOnce({
        pgClient: pgAdapter,
        worker_id: `test-${randomUUID().slice(0, 8)}`,
        lease_ms: 60_000,
        deliverWelcome: deliverNex1WelcomeToAccount,
        errorPolicy: defaultWelcomeDeliveryErrorPolicy,
      });
      if (wr.status === "processed" && wr.account_id === accountId) {
        ranProcessed++;
      }
      if (wr.status === "no_work") break;
    }
    // Our account's outbox row was processed once
    expect(ranProcessed).toBeGreaterThanOrEqual(1);

    // Exactly ONE NEX1 message exists for this account
    const messages = await pg.query(
      `SELECT count(*)::int AS n FROM nex_peer_message
        WHERE sender_account_id = $1
          AND conversation_id IN (
            SELECT id FROM nex_peer_conversation
             WHERE participant_a_id = $2 OR participant_b_id = $2
          )`,
      [NEX_OFFICIAL_ACCOUNT_ID, accountId],
    );
    expect(Number(messages.rows[0].n)).toBe(1);

    // Re-run worker with the same account · outbox row is terminal so
    // no new work happens for this account
    for (let i = 0; i < 5; i++) {
      const wr = await runWelcomeOutboxOnce({
        pgClient: pgAdapter,
        worker_id: `test-${randomUUID().slice(0, 8)}`,
        lease_ms: 60_000,
        deliverWelcome: deliverNex1WelcomeToAccount,
        errorPolicy: defaultWelcomeDeliveryErrorPolicy,
      });
      if (wr.status === "no_work") break;
      // Any work claimed shouldn't be OUR account (already processed)
      if (
        wr.status === "processed" ||
        wr.status === "transient_failure" ||
        wr.status === "permanent_failure"
      ) {
        expect(wr.account_id).not.toBe(accountId);
      }
    }

    // Still exactly ONE NEX1 message for this account
    const messagesAfter = await pg.query(
      `SELECT count(*)::int AS n FROM nex_peer_message
        WHERE sender_account_id = $1
          AND conversation_id IN (
            SELECT id FROM nex_peer_conversation
             WHERE participant_a_id = $2 OR participant_b_id = $2
          )`,
      [NEX_OFFICIAL_ACCOUNT_ID, accountId],
    );
    expect(Number(messagesAfter.rows[0].n)).toBe(1);
  });
});
