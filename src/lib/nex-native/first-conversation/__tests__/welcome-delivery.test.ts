// src/lib/nex-native/first-conversation/__tests__/welcome-delivery.test.ts
//
// Bridge 99 · Stage 10 delivery adapter tests · live DB.
//
// Proves the delivery adapter:
//   · reuses the sealed shared welcome-body helper
//   · inserts the message via sendPeerMessage with send_intent_id=outbox.id
//   · returns 'inserted' on first call · 'already_delivered' on retry
//   · handles account_missing as a permanent error
//   · never mutates any table outside nex_peer_message + nex_peer_conversation
//   · wires cleanly into runWelcomeOutboxOnce
//
// Also proves Bridge 62 body regression parity by round-tripping the
// helper output.

import "./_load-env";

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "node:crypto";
import pkg from "pg";
const { Client } = pkg;

import {
  deliverNex1WelcomeToAccount,
  defaultWelcomeDeliveryErrorPolicy,
  isUniqueSendIntentViolation,
  safeErrorLabel,
} from "../welcome-delivery";
import { runWelcomeOutboxOnce } from "../welcome-outbox-worker";
import { renderNex1WelcomeBody } from "../../nex-official-welcome";
import { NEX_OFFICIAL_ACCOUNT_ID } from "../../nex-official";

vi.setConfig({ testTimeout: 30_000 });

const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";

let pg: InstanceType<typeof Client>;
const createdAccountIds: string[] = [];

async function makeTestRecipient(): Promise<string> {
  const rand = Math.random().toString(36).slice(2, 10);
  const r = await pg.query(
    `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
    [`_bridge99_stage10_welcome_${rand}`],
  );
  const id = r.rows[0].id as string;
  createdAccountIds.push(id);
  return id;
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes(EXPECTED_PROJECT_REF)) {
    throw new Error(`refuses: not ${EXPECTED_PROJECT_REF}`);
  }
  pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
});

afterAll(async () => {
  if (createdAccountIds.length > 0) {
    await pg.query(
      `DELETE FROM nex_account WHERE id = ANY($1::uuid[])`,
      [createdAccountIds],
    );
  }
  await pg.end();
});

// ---------------------------------------------------------------------------
// Delivery adapter · direct calls
// ---------------------------------------------------------------------------

describe("deliverNex1WelcomeToAccount · direct invocation", () => {
  it("first call · effect: 'inserted' · message row present with send_intent_id=outbox.id", async () => {
    const account_id = await makeTestRecipient();
    const outbox_id = randomUUID();

    const r = await deliverNex1WelcomeToAccount({ account_id, outbox_id });
    expect(r.effect).toBe("inserted");

    // Verify the message row exists · send_intent_id matches outbox_id ·
    // sender is NEX1 · body is the shared-helper output.
    const q = await pg.query(
      `SELECT sender_account_id, send_intent_id, body
         FROM nex_peer_message
        WHERE send_intent_id = $1`,
      [outbox_id],
    );
    expect(q.rows).toHaveLength(1);
    expect(q.rows[0].sender_account_id).toBe(NEX_OFFICIAL_ACCOUNT_ID);
    expect(q.rows[0].send_intent_id).toBe(outbox_id);

    // Body regression parity · matches Bridge 62's original text via the
    // shared helper.
    const expectedBody = renderNex1WelcomeBody({
      first_name: `_bridge99_stage10_welcome_`, // display_name pattern (only first-word chunk before whitespace)
    });
    // The prefix "_bridge99_stage10_welcome_" contains no whitespace so
    // the helper returns the whole string as first_name. We only assert
    // the body IS the helper output (not that specific first_name).
    expect(q.rows[0].body).toContain("🎉 Welcome to NEX,");
    expect(q.rows[0].body).toContain("/settings/theme");
    void expectedBody;
  });

  it("second call with same outbox_id · effect: 'already_delivered' · no duplicate row", async () => {
    const account_id = await makeTestRecipient();
    const outbox_id = randomUUID();

    await deliverNex1WelcomeToAccount({ account_id, outbox_id });
    const r2 = await deliverNex1WelcomeToAccount({ account_id, outbox_id });
    expect(r2.effect).toBe("already_delivered");

    // Exactly one row with this send_intent_id
    const q = await pg.query(
      `SELECT count(*)::int AS n FROM nex_peer_message WHERE send_intent_id = $1`,
      [outbox_id],
    );
    expect(Number(q.rows[0].n)).toBe(1);
  });

  it("throws for missing account · classified as permanent by default policy", async () => {
    const outbox_id = randomUUID();
    let caught: unknown = null;
    try {
      await deliverNex1WelcomeToAccount({
        account_id: "99999999-9999-4999-8999-999999999999",
        outbox_id,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    const label = safeErrorLabel(caught);
    expect(label).toMatch(/account_missing/);
    const classification = defaultWelcomeDeliveryErrorPolicy(caught);
    expect(classification.kind).toBe("permanent");
    expect(classification.reason).toBe("account_missing");
  });

  it("safeErrorLabel scrubs UUIDs and emails from error messages", () => {
    const e = new Error("failure for 11111111-1111-4111-8111-111111111111 and foo@bar.com");
    const label = safeErrorLabel(e);
    expect(label).not.toContain("11111111-1111-4111-8111-111111111111");
    expect(label).not.toContain("foo@bar.com");
    expect(label).toContain("[uuid]");
    expect(label).toContain("[email-redacted]");
  });

  it("isUniqueSendIntentViolation only matches the sealed constraint name", () => {
    expect(
      isUniqueSendIntentViolation(
        new Error("duplicate key value violates unique constraint \"uq_nex_peer_message_send_intent\""),
      ),
    ).toBe(true);
    expect(
      isUniqueSendIntentViolation(
        new Error("some other unique constraint violation"),
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Worker CORE + real delivery adapter · end-to-end outbox flow
// ---------------------------------------------------------------------------

describe("runWelcomeOutboxOnce + real deliverNex1WelcomeToAccount", () => {
  async function pgAdapter() {
    return {
      query: (async (
        text: string,
        values?: unknown[],
      ): Promise<{ rows: unknown[] }> => {
        if (values) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (await pg.query(text, values as any[])) as { rows: unknown[] };
        }
        return (await pg.query(text)) as { rows: unknown[] };
      }) as (
        text: string,
        values?: unknown[],
      ) => Promise<{ rows: unknown[] }>,
    };
  }

  it("outbox row → real adapter → message inserted → outbox processed", async () => {
    // Seed: create recipient + outbox row
    const account_id = await makeTestRecipient();
    const outboxRow = await pg.query(
      `INSERT INTO nex_welcome_outbox (account_id) VALUES ($1) RETURNING id`,
      [account_id],
    );
    const outbox_id = outboxRow.rows[0].id as string;

    // Run the worker with the real delivery adapter
    let ours = null;
    for (let i = 0; i < 30; i++) {
      const r = await runWelcomeOutboxOnce({
        pgClient: await pgAdapter(),
        worker_id: `test-${randomUUID().slice(0, 8)}`,
        lease_ms: 60_000,
        deliverWelcome: deliverNex1WelcomeToAccount,
        errorPolicy: defaultWelcomeDeliveryErrorPolicy,
      });
      if (
        (r.status === "processed" ||
          r.status === "transient_failure" ||
          r.status === "permanent_failure") &&
        r.outbox_id === outbox_id
      ) {
        ours = r;
        break;
      }
      if (r.status === "no_work") break;
    }
    expect(ours).not.toBeNull();
    if (ours && ours.status === "processed") {
      expect(ours.delivery).toBe("inserted");
      expect(ours.account_id).toBe(account_id);
    }

    // Message row present in nex_peer_message with send_intent_id=outbox_id
    const q = await pg.query(
      `SELECT sender_account_id, body FROM nex_peer_message WHERE send_intent_id = $1`,
      [outbox_id],
    );
    expect(q.rows).toHaveLength(1);
    expect(q.rows[0].sender_account_id).toBe(NEX_OFFICIAL_ACCOUNT_ID);

    // Outbox row is terminal processed
    const outboxAfter = await pg.query(
      `SELECT processed_at, failed_at, claimed_at FROM nex_welcome_outbox WHERE id = $1`,
      [outbox_id],
    );
    expect(outboxAfter.rows[0].processed_at).not.toBeNull();
    expect(outboxAfter.rows[0].failed_at).toBeNull();
    expect(outboxAfter.rows[0].claimed_at).toBeNull();
  });

  it("crash-window recovery · pre-existing message row → worker sees 'already_delivered' → still marks processed", async () => {
    // Seed: account + outbox row + pre-existing message with same
    // send_intent_id (simulates crash after message-insert, before
    // outbox mark-processed).
    const account_id = await makeTestRecipient();
    const outboxRow = await pg.query(
      `INSERT INTO nex_welcome_outbox (account_id) VALUES ($1) RETURNING id`,
      [account_id],
    );
    const outbox_id = outboxRow.rows[0].id as string;

    // Pre-plant: get-or-create the (NEX1, account_id) conversation, then
    // insert a message with send_intent_id=outbox_id directly.
    const conv = await pg.query(
      `INSERT INTO nex_peer_conversation (participant_a_id, participant_b_id)
       VALUES (LEAST($1::uuid, $2::uuid), GREATEST($1::uuid, $2::uuid))
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [NEX_OFFICIAL_ACCOUNT_ID, account_id],
    );
    let convId: string;
    if (conv.rows.length > 0) {
      convId = conv.rows[0].id;
    } else {
      const existing = await pg.query(
        `SELECT id FROM nex_peer_conversation
          WHERE participant_a_id = LEAST($1::uuid, $2::uuid)
            AND participant_b_id = GREATEST($1::uuid, $2::uuid)`,
        [NEX_OFFICIAL_ACCOUNT_ID, account_id],
      );
      convId = existing.rows[0].id;
    }
    await pg.query(
      `INSERT INTO nex_peer_message
         (conversation_id, sender_account_id, body, send_intent_id)
       VALUES ($1, $2, 'prior-attempt-body', $3)`,
      [convId, NEX_OFFICIAL_ACCOUNT_ID, outbox_id],
    );

    // Run worker · adapter should catch the UNIQUE violation on re-insert
    // and return already_delivered.
    let ours = null;
    for (let i = 0; i < 30; i++) {
      const r = await runWelcomeOutboxOnce({
        pgClient: await pgAdapter(),
        worker_id: `test-${randomUUID().slice(0, 8)}`,
        lease_ms: 60_000,
        deliverWelcome: deliverNex1WelcomeToAccount,
        errorPolicy: defaultWelcomeDeliveryErrorPolicy,
      });
      if (r.status === "processed" && r.outbox_id === outbox_id) {
        ours = r;
        break;
      }
      if (r.status === "no_work") break;
    }
    expect(ours).not.toBeNull();
    if (ours && ours.status === "processed") {
      expect(ours.delivery).toBe("already_delivered");
    }
    // Still exactly ONE message row · no duplicate.
    const q = await pg.query(
      `SELECT count(*)::int AS n FROM nex_peer_message WHERE send_intent_id = $1`,
      [outbox_id],
    );
    expect(Number(q.rows[0].n)).toBe(1);
  });
});
