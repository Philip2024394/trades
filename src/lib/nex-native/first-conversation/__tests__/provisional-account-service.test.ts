// src/lib/nex-native/first-conversation/__tests__/provisional-account-service.test.ts
//
// Bridge 99 · Stage 6 · provisional-account-service tests.
// Live-DB integration against ijvqdvsvwtwxzcqmoqit.
// Exercises the Migration 104 atomic stored function via the wrapper
// and confirms the six sealed §7B mutations land atomically.

import "./_load-env";

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "node:crypto";
import pkg from "pg";
const { Client } = pkg;

import {
  createProvisionalAccountWithFirstMessage,
  type CiphertextRowInput,
  type CreateProvisionalAccountInput,
} from "../provisional-account-service";

// Bridge 99 DB-integration file · scoped 30s timeout per founder direction.
vi.setConfig({ testTimeout: 30_000 });

const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";

let pg: InstanceType<typeof Client>;
let ownerAccountId: string;
const createdProvisionalIds: string[] = [];

async function createOwnerAccount(): Promise<string> {
  const rand = Math.random().toString(36).slice(2, 10);
  const r = await pg.query(
    `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
    [`_bridge99_stage6a_owner_${rand}`],
  );
  return r.rows[0].id as string;
}

function ciphertextRow(recipient_device_id: string): CiphertextRowInput {
  return {
    recipient_device_id,
    ciphertext_b64: Buffer.from(`ct-${recipient_device_id}`).toString("base64"),
    nonce_b64: Buffer.from(`nonce-${recipient_device_id}-24byte`).toString("base64"),
  };
}

function baseInput(overrides: Partial<CreateProvisionalAccountInput> = {}): CreateProvisionalAccountInput {
  return {
    display_name: "New visitor",
    device_id: `dev-${randomUUID().slice(0, 12)}`,
    device_public_key_b64: "A".repeat(43),
    owner_account_id: ownerAccountId,
    owner_business_id: null,
    send_intent_id: randomUUID(),
    message_group_id: randomUUID(),
    ciphertext_rows: [ciphertextRow("owner-device-1")],
    provisional_fingerprint: `_test_fp_${randomUUID().slice(0, 8)}`,
    ...overrides,
  };
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes(EXPECTED_PROJECT_REF)) {
    throw new Error(
      `provisional-account-service test refuses to run: DATABASE_URL not ${EXPECTED_PROJECT_REF}`,
    );
  }
  pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  ownerAccountId = await createOwnerAccount();
});

afterAll(async () => {
  // Cascade-delete all provisional accounts created + the owner.
  if (createdProvisionalIds.length > 0) {
    await pg.query(
      `DELETE FROM nex_account WHERE id = ANY($1::uuid[])`,
      [createdProvisionalIds],
    );
  }
  if (ownerAccountId) {
    await pg.query(`DELETE FROM nex_account WHERE id = $1`, [ownerAccountId]);
  }
  await pg.end();
});

// ---------------------------------------------------------------------------
// Happy path · all six mutations land
// ---------------------------------------------------------------------------

describe("createProvisionalAccountWithFirstMessage · sealed §7B six-mutation atomicity", () => {
  it("returns account_id + conversation_id + first_message_id + writes to all six tables", async () => {
    const input = baseInput({
      ciphertext_rows: [
        ciphertextRow("owner-device-a"),
        ciphertextRow("owner-device-b"),
      ],
    });
    const r = await createProvisionalAccountWithFirstMessage(input);
    createdProvisionalIds.push(r.account_id);

    expect(r.account_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(r.conversation_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(r.first_message_id).toMatch(/^[0-9a-f-]{36}$/i);

    // All six mutations present:
    const acct = await pg.query(
      `SELECT display_name, claimed_at FROM nex_account WHERE id = $1`,
      [r.account_id],
    );
    expect(acct.rows).toHaveLength(1);
    expect(acct.rows[0].display_name).toBe("New visitor");
    expect(acct.rows[0].claimed_at).toBeNull();

    const dk = await pg.query(
      `SELECT device_id, public_key FROM nex_account_device_key WHERE account_id = $1`,
      [r.account_id],
    );
    expect(dk.rows).toHaveLength(1);
    expect(dk.rows[0].device_id).toBe(input.device_id);
    expect(dk.rows[0].public_key).toBe(input.device_public_key_b64);

    const conv = await pg.query(
      `SELECT participant_a_id, participant_b_id, origin_cover_business_id
         FROM nex_peer_conversation WHERE id = $1`,
      [r.conversation_id],
    );
    expect(conv.rows).toHaveLength(1);
    // Canonical (a < b) ordering
    expect(conv.rows[0].participant_a_id < conv.rows[0].participant_b_id).toBe(true);
    const participants = [conv.rows[0].participant_a_id, conv.rows[0].participant_b_id];
    expect(participants).toContain(r.account_id);
    expect(participants).toContain(ownerAccountId);
    expect(conv.rows[0].origin_cover_business_id).toBeNull();

    const msgs = await pg.query(
      `SELECT recipient_device_id, send_intent_id
         FROM nex_peer_message
        WHERE conversation_id = $1
        ORDER BY recipient_device_id`,
      [r.conversation_id],
    );
    expect(msgs.rows).toHaveLength(2);
    // Derived per-recipient send_intent_ids · distinct
    expect(msgs.rows[0].send_intent_id).not.toBe(msgs.rows[1].send_intent_id);
    expect(msgs.rows.map((x) => x.recipient_device_id).sort()).toEqual([
      "owner-device-a",
      "owner-device-b",
    ]);

    const risk = await pg.query(
      `SELECT provisional_fingerprint FROM nex_account_risk_signal WHERE account_id = $1`,
      [r.account_id],
    );
    expect(risk.rows).toHaveLength(1);
    expect(risk.rows[0].provisional_fingerprint).toBe(input.provisional_fingerprint);

    const outbox = await pg.query(
      `SELECT account_id FROM nex_welcome_outbox WHERE account_id = $1`,
      [r.account_id],
    );
    expect(outbox.rows).toHaveLength(1);
  });

  it("persists owner_business_id on the conversation when supplied", async () => {
    // Use owner's business_id · we don't create a real business, use a
    // stub uuid so we can prove the column receives the value.
    // Since origin_cover_business_id has FK to nex_business, we need
    // a real business row. Look one up.
    const biz = await pg.query(`SELECT id FROM nex_business LIMIT 1`);
    if (biz.rows.length === 0) {
      // No businesses in this DB · skip cleanly.
      return;
    }
    const businessId = biz.rows[0].id as string;
    const input = baseInput({ owner_business_id: businessId });
    const r = await createProvisionalAccountWithFirstMessage(input);
    createdProvisionalIds.push(r.account_id);

    const conv = await pg.query(
      `SELECT origin_cover_business_id FROM nex_peer_conversation WHERE id = $1`,
      [r.conversation_id],
    );
    expect(conv.rows[0].origin_cover_business_id).toBe(businessId);
  });
});

// ---------------------------------------------------------------------------
// Idempotency · retry with same send_intent_id
// ---------------------------------------------------------------------------

describe("createProvisionalAccountWithFirstMessage · sealed §7B idempotency semantics (post-M105/M106)", () => {
  it("second call with the SAME send_intent_id + SAME device returns the cached account (M105 dedup + M106 device scope)", async () => {
    const input = baseInput();
    const first = await createProvisionalAccountWithFirstMessage(input);
    createdProvisionalIds.push(first.account_id);
    expect(first.deduplicated).toBe(false);

    // M105 + M106 · same intent + same device -> same account · deduplicated=true
    const second = await createProvisionalAccountWithFirstMessage(input);
    expect(second.account_id).toBe(first.account_id);
    expect(second.conversation_id).toBe(first.conversation_id);
    expect(second.first_message_id).toBe(first.first_message_id);
    expect(second.deduplicated).toBe(true);

    // Only ONE account row · not two
    const acctCheck = await pg.query(
      `SELECT id FROM nex_account WHERE id = $1`,
      [first.account_id],
    );
    expect(acctCheck.rows).toHaveLength(1);
  });

  // Note: caller-level idempotency (deduplicating on send_intent_id BEFORE
  // reaching the stored function) is a route-handler concern (Stage 7).
  // The stored function's contract is atomic-per-call; not repeat-safe
  // across calls that create fresh accounts.
});

// ---------------------------------------------------------------------------
// Rollback semantics · atomic transaction proven
// ---------------------------------------------------------------------------

describe("createProvisionalAccountWithFirstMessage · rollback on invalid input", () => {
  it("empty ciphertext_rows rejected at the wrapper (before RPC) with no DB writes", async () => {
    // Count rows before via scoped query on a known-empty-fingerprint pattern
    const fp = `_test_fp_rollback_${randomUUID().slice(0, 8)}`;
    const before = await pg.query(
      `SELECT count(*)::int AS n FROM nex_account_risk_signal WHERE provisional_fingerprint = $1`,
      [fp],
    );
    expect(Number(before.rows[0].n)).toBe(0);

    await expect(
      createProvisionalAccountWithFirstMessage(
        baseInput({ ciphertext_rows: [], provisional_fingerprint: fp }),
      ),
    ).rejects.toThrow(/ciphertext_rows must be a non-empty/);

    const after = await pg.query(
      `SELECT count(*)::int AS n FROM nex_account_risk_signal WHERE provisional_fingerprint = $1`,
      [fp],
    );
    expect(Number(after.rows[0].n)).toBe(0);
  });

  it("empty ciphertext_rows passing the wrapper hits the stored function's guard", async () => {
    // Bypass the wrapper's own validation by using the RPC directly.
    // Confirms the DB-side guard is a real second line of defence.
    // (Requires direct pg access · not a supabase-admin call.)
    let raiseFromDb = false;
    try {
      await pg.query(
        `SELECT nex_bridge99_create_first_message(
           'x', 'device-8ch', $1, $2::uuid, NULL, $3::uuid, $4, '[]'::jsonb, 'fp'
         )`,
        ["A".repeat(43), ownerAccountId, randomUUID(), randomUUID()],
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      raiseFromDb = /non-empty JSON array/i.test(msg);
    }
    expect(raiseFromDb).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Wrapper input validation (fail-fast at the TypeScript boundary)
// ---------------------------------------------------------------------------

describe("createProvisionalAccountWithFirstMessage · wrapper input validation", () => {
  it("empty display_name → throws", async () => {
    await expect(
      createProvisionalAccountWithFirstMessage(baseInput({ display_name: "" })),
    ).rejects.toThrow(/display_name required/);
  });

  it("short device_id → throws", async () => {
    await expect(
      createProvisionalAccountWithFirstMessage(baseInput({ device_id: "abc" })),
    ).rejects.toThrow(/device_id must be at least/);
  });

  it("short device_public_key → throws", async () => {
    await expect(
      createProvisionalAccountWithFirstMessage(baseInput({ device_public_key_b64: "short" })),
    ).rejects.toThrow(/device_public_key/);
  });

  it("empty owner_account_id → throws", async () => {
    await expect(
      createProvisionalAccountWithFirstMessage(baseInput({ owner_account_id: "" })),
    ).rejects.toThrow(/owner_account_id required/);
  });

  it("missing send_intent_id → throws", async () => {
    await expect(
      createProvisionalAccountWithFirstMessage(baseInput({ send_intent_id: "" })),
    ).rejects.toThrow(/send_intent_id required/);
  });

  it("missing message_group_id → throws", async () => {
    await expect(
      createProvisionalAccountWithFirstMessage(baseInput({ message_group_id: "" })),
    ).rejects.toThrow(/message_group_id required/);
  });

  it("ciphertext row missing recipient_device_id → throws", async () => {
    await expect(
      createProvisionalAccountWithFirstMessage(
        baseInput({
          ciphertext_rows: [
            {
              recipient_device_id: "",
              ciphertext_b64: "abc",
              nonce_b64: "def",
            },
          ],
        }),
      ),
    ).rejects.toThrow(/every ciphertext row must have/);
  });

  it("empty provisional_fingerprint → throws", async () => {
    await expect(
      createProvisionalAccountWithFirstMessage(baseInput({ provisional_fingerprint: "" })),
    ).rejects.toThrow(/provisional_fingerprint required/);
  });
});

// ---------------------------------------------------------------------------
// Structural · wrapper does not reimplement the six-mutation transaction
// ---------------------------------------------------------------------------

describe("provisional-account-service · doctrinal isolation", () => {
  it("does NOT import identity/session/risk modules directly", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/lib/nex-native/first-conversation/provisional-account-service.ts",
      ),
      "utf-8",
    );
    expect(src).not.toMatch(/from ["'].*account-service["']/);
    expect(src).not.toMatch(/from ["'].*session-registry-service["']/);
    expect(src).not.toMatch(/from ["'].*provisional-session["']/);
    expect(src).not.toMatch(/from ["'].*risk-service["']/);
    expect(src).not.toMatch(/from ["'].*provisional-fingerprint["']/);
    expect(src).not.toMatch(/from ["'].*risk-signals["']/);
  });

  it("does NOT reimplement the atomic six-mutation transaction as separate .insert() calls", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/lib/nex-native/first-conversation/provisional-account-service.ts",
      ),
      "utf-8",
    );
    // Should have zero .from().insert() calls · the only DB write is via
    // the .rpc() invocation of the sealed Migration 104 primitive.
    expect(src).not.toMatch(/\.from\(["'][a-z_]+["']\)\.insert/);
    expect(src).not.toMatch(/\.from\(["'][a-z_]+["']\)\.upsert/);
    // Exactly one .rpc() call, targeting the sealed primitive.
    const rpcCalls = Array.from(src.matchAll(/\.rpc\(\s*["']([a-z_0-9]+)["']/g)).map(
      (m) => m[1],
    );
    expect(rpcCalls).toEqual(["nex_bridge99_create_first_message"]);
  });
});
