// src/lib/nex-native/first-conversation/__tests__/first-message-orchestrator.test.ts
//
// Bridge 99 · Stage 6 · first-message-orchestrator tests.
// Live-DB integration against ijvqdvsvwtwxzcqmoqit.

import "./_load-env";

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "node:crypto";
import pkg from "pg";
const { Client } = pkg;

import {
  orchestrateFirstMessage,
  type OrchestrateFirstMessageInput,
} from "../first-message-orchestrator";
import type {
  NexResolvedSession,
  NexResolvedProvisional,
} from "../provisional-session";
import type { CiphertextRowInput } from "../provisional-account-service";
import type { NexSessionCryptoConfig } from "../session-crypto";
import { verifySessionToken } from "../session-crypto";
import { checkSessionValidity } from "../session-registry-service";

vi.setConfig({ testTimeout: 30_000 });

const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";
const KEY_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const cryptoCfg: NexSessionCryptoConfig = {
  activeKey: KEY_A,
  acceptedKeys: [KEY_A],
};

let pg: InstanceType<typeof Client>;
let ownerAccountId: string;
const createdProvisionalIds: string[] = [];

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes(EXPECTED_PROJECT_REF)) {
    throw new Error(`refuses to run: not ${EXPECTED_PROJECT_REF}`);
  }
  pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  const rand = Math.random().toString(36).slice(2, 10);
  const r = await pg.query(
    `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
    [`_bridge99_stage6b_owner_${rand}`],
  );
  ownerAccountId = r.rows[0].id;
});

afterAll(async () => {
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

function ciphertext(id: string): CiphertextRowInput {
  return {
    recipient_device_id: id,
    ciphertext_b64: Buffer.from(`ct-${id}`).toString("base64"),
    nonce_b64: Buffer.from(`nonce-${id}-24byte-pad`).toString("base64"),
  };
}

function baseInput(
  overrides: Partial<OrchestrateFirstMessageInput> = {},
): OrchestrateFirstMessageInput {
  return {
    session: { kind: "none", reason: "cookie_missing" } as NexResolvedSession,
    message_length: 20,
    send_intent_id: randomUUID(),
    message_group_id: randomUUID(),
    ciphertext_rows: [ciphertext("owner-device-1")],
    device_id: `dev-${randomUUID().slice(0, 12)}`,
    device_public_key_b64: "A".repeat(43),
    fingerprint: `_test_fp_${randomUUID().slice(0, 8)}`,
    owner_account_id: ownerAccountId,
    owner_business_id: null,
    owner_bisnis_tier: "gratis",
    crypto_cfg: cryptoCfg,
    now_ms: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// session=none · pass path · full atomic create + cookie
// ---------------------------------------------------------------------------

describe("orchestrateFirstMessage · session=none + risk pass → create", () => {
  it("creates account + conversation + message + issues session cookie", async () => {
    const r = await orchestrateFirstMessage(baseInput());
    expect(r.status).toBe("created");
    if (r.status !== "created") return; // narrow
    createdProvisionalIds.push(r.account_id);

    expect(r.account_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(r.conversation_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(r.first_message_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(r.session.session_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(r.session.signed_cookie_token.split(".")).toHaveLength(2);
    expect(r.session.expires_at_ms).toBeGreaterThan(Date.now());
    expect(r.redirect_to).toBe(`/nex-native/chat/peer/${ownerAccountId}?born=1`);

    // Cookie verifies + payload matches
    const verify = verifySessionToken(r.session.signed_cookie_token, cryptoCfg);
    expect(verify.ok).toBe(true);
    if (verify.ok) {
      expect(verify.payload.account_id).toBe(r.account_id);
      expect(verify.payload.session_id).toBe(r.session.session_id);
    }

    // Session registry row exists + is valid
    const reg = await checkSessionValidity(r.session.session_id);
    expect(reg.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// session=none · risk block → NO writes
// ---------------------------------------------------------------------------

describe("orchestrateFirstMessage · session=none + risk block → NO writes", () => {
  it("blocks on message_length < 3 · returns blocked · does not create anything", async () => {
    const fp = `_test_fp_block_${randomUUID().slice(0, 8)}`;
    const r = await orchestrateFirstMessage(
      baseInput({ message_length: 0, fingerprint: fp }),
    );
    expect(r).toEqual({ status: "blocked", reason: "message_too_short" });

    // No nex_account with the risk-signal fingerprint
    const q = await pg.query(
      `SELECT count(*)::int AS n FROM nex_account_risk_signal WHERE provisional_fingerprint = $1`,
      [fp],
    );
    expect(Number(q.rows[0].n)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// session=authenticated · short-circuit to redirect
// ---------------------------------------------------------------------------

describe("orchestrateFirstMessage · session=authenticated → existing_session redirect", () => {
  it("returns existing_session directive without touching the DB", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseFake: any = {
      supabaseUserId: "aa",
      email: "x",
      account: { id: "11111111-1111-4111-8111-111111111111" },
    };
    const input = baseInput({
      session: { kind: "authenticated", supabase: supabaseFake },
    });

    const before = await pg.query(`SELECT count(*)::int AS n FROM nex_account`);
    const r = await orchestrateFirstMessage(input);
    const after = await pg.query(`SELECT count(*)::int AS n FROM nex_account`);

    expect(r.status).toBe("existing_session");
    if (r.status === "existing_session") {
      expect(r.redirect_to).toBe(`/nex-native/chat/peer/${ownerAccountId}`);
      expect(r.account_id).toBe(supabaseFake.account.id);
    }
    expect(Number(after.rows[0].n)).toBe(Number(before.rows[0].n));
  });
});

// ---------------------------------------------------------------------------
// session=provisional · short-circuit
// ---------------------------------------------------------------------------

describe("orchestrateFirstMessage · session=provisional → existing_session redirect", () => {
  it("returns existing_session directive without touching the DB", async () => {
    const provisionalSession: NexResolvedProvisional = {
      kind: "provisional",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      account: { id: "22222222-2222-4222-8222-222222222222" } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      session_row: {} as any,
    };
    const input = baseInput({ session: provisionalSession });

    const before = await pg.query(`SELECT count(*)::int AS n FROM nex_account`);
    const r = await orchestrateFirstMessage(input);
    const after = await pg.query(`SELECT count(*)::int AS n FROM nex_account`);

    expect(r.status).toBe("existing_session");
    if (r.status === "existing_session") {
      expect(r.account_id).toBe(provisionalSession.account.id);
    }
    expect(Number(after.rows[0].n)).toBe(Number(before.rows[0].n));
  });
});

// ---------------------------------------------------------------------------
// Structural boundaries
// ---------------------------------------------------------------------------

describe("first-message-orchestrator · doctrinal isolation", () => {
  it("only writes via the provisional-account-service RPC + createSession (no direct .insert of provisional-create rows)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/lib/nex-native/first-conversation/first-message-orchestrator.ts",
      ),
      "utf-8",
    );
    // No direct .from().insert() targeting the six sealed tables
    expect(src).not.toMatch(/\.from\(["']nex_account["']\)\.insert/);
    expect(src).not.toMatch(/\.from\(["']nex_account_device_key["']\)\.insert/);
    expect(src).not.toMatch(/\.from\(["']nex_peer_conversation["']\)\.insert/);
    expect(src).not.toMatch(/\.from\(["']nex_peer_message["']\)\.insert/);
    expect(src).not.toMatch(/\.from\(["']nex_welcome_outbox["']\)\.insert/);
    // Risk-signal write is delegated to risk-service.recordProvisionalFingerprint
    expect(src).not.toMatch(/\.from\(["']nex_account_risk_signal["']\)/);
  });

  it("public input surface never exposes plaintext fields (only ciphertext_rows + message_length)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/lib/nex-native/first-conversation/first-message-orchestrator.ts",
      ),
      "utf-8",
    );
    // Extract the EXPORTED interface only · internal use of message_body
    // as a synthesised placeholder for buildRiskInput is not identity-
    // relevant. This test protects the public API surface.
    const iface = src.match(
      /export interface OrchestrateFirstMessageInput \{([\s\S]*?)\n\}/,
    );
    expect(iface).not.toBeNull();
    const ifaceBody = iface![1];

    // Split into declared fields (roughly · lines with a colon at top level)
    // and check no field name contains plaintext / message_body / body /
    // plaintext_body.
    const fieldLines = ifaceBody
      .split("\n")
      .filter((l) => /^\s+\w+\??\s*:/.test(l));
    for (const line of fieldLines) {
      const nameMatch = line.match(/^\s+(\w+)\??\s*:/);
      if (!nameMatch) continue;
      const name = nameMatch[1];
      expect(name).not.toMatch(/plaintext/i);
      expect(name).not.toMatch(/^body$/);
      expect(name).not.toMatch(/^message_body$/);
    }
  });
});
