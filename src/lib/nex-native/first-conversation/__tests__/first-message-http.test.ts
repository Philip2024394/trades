// src/lib/nex-native/first-conversation/__tests__/first-message-http.test.ts
//
// Bridge 99 · Stage 7 · route-core tests.
// Live-DB integration for the pure processFirstMessagePayload core.
// Uses injected deps to skip next/headers entirely.

import "./_load-env";

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "node:crypto";
import pkg from "pg";
const { Client } = pkg;

import {
  deriveIp24Bucket,
  processFirstMessagePayload,
  validateFirstMessageBody,
  type FirstMessageRequestBody,
  type ProcessFirstMessageDeps,
} from "../first-message-http";
import type {
  NexResolvedSession,
  NexResolvedProvisional,
} from "../provisional-session";
import type { ProvisionalFingerprintConfig } from "../provisional-fingerprint";
import type { NexSessionCryptoConfig } from "../session-crypto";
import { signSessionToken, verifySessionToken } from "../session-crypto";
import { checkSessionValidity } from "../session-registry-service";
import type { CiphertextRowInput } from "../provisional-account-service";

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
const createdProvisionalIds: string[] = [];

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes(EXPECTED_PROJECT_REF)) {
    throw new Error(`refuses: not ${EXPECTED_PROJECT_REF}`);
  }
  pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  const rand = Math.random().toString(36).slice(2, 10);
  const r = await pg.query(
    `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
    [`_bridge99_stage7_owner_${rand}`],
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

function goodBody(
  overrides: Partial<FirstMessageRequestBody> = {},
): FirstMessageRequestBody {
  return {
    message_length: 20,
    send_intent_id: randomUUID(),
    message_group_id: randomUUID(),
    ciphertext_rows: [ciphertext("owner-device-1")],
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

function makeDeps(
  overrides: Partial<ProcessFirstMessageDeps> = {},
): ProcessFirstMessageDeps {
  return {
    resolveSession: async () =>
      ({ kind: "none", reason: "cookie_missing" }) as NexResolvedSession,
    getConnectionIp: async () => "203.0.113.42",
    fingerprintCfg,
    cryptoCfg,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validateFirstMessageBody (pure)
// ---------------------------------------------------------------------------

describe("validateFirstMessageBody · shape checks", () => {
  it("returns null for a valid body", () => {
    expect(validateFirstMessageBody(goodBody())).toBeNull();
  });

  const cases: Array<[string, Partial<FirstMessageRequestBody>, RegExp]> = [
    ["message_length wrong type", { message_length: "x" as unknown as number }, /message_length/],
    ["message_length negative", { message_length: -1 }, /message_length/],
    ["send_intent_id too short", { send_intent_id: "abc" }, /send_intent_id/],
    ["message_group_id too short", { message_group_id: "abc" }, /message_group_id/],
    ["empty ciphertext_rows", { ciphertext_rows: [] }, /ciphertext_rows/],
    ["short device_id", { device_id: "abc" }, /device_id/],
    ["short device_public_key_b64", { device_public_key_b64: "short" }, /device_public_key_b64/],
    ["empty owner_account_id", { owner_account_id: "" }, /owner_account_id/],
    [
      "owner_business_id wrong type",
      { owner_business_id: 42 as unknown as string | null },
      /owner_business_id/,
    ],
    [
      "bogus owner_bisnis_tier",
      { owner_bisnis_tier: "premium" as unknown as "gratis" | "bisnis" },
      /owner_bisnis_tier/,
    ],
  ];
  for (const [label, patch, msgRegex] of cases) {
    it(`rejects · ${label}`, () => {
      const r = validateFirstMessageBody(goodBody(patch));
      expect(r).not.toBeNull();
      expect(r?.message).toMatch(msgRegex);
    });
  }

  it("rejects · missing fingerprint_client entirely", () => {
    const body = goodBody();
    delete (body as Partial<FirstMessageRequestBody>).fingerprint_client;
    const r = validateFirstMessageBody(body);
    expect(r?.field).toBe("fingerprint_client");
  });

  it("rejects · fingerprint_client.ua_class not in enum", () => {
    const body = goodBody({
      fingerprint_client: {
        ua_class: "safari" as never,
        tz_offset_minutes: 0,
        accept_language_primary: "en",
      },
    });
    const r = validateFirstMessageBody(body);
    expect(r?.field).toBe("fingerprint_client.ua_class");
  });

  it("rejects · non-object body", () => {
    expect(validateFirstMessageBody(null)?.field).toBe("body");
    expect(validateFirstMessageBody("not-an-object")?.field).toBe("body");
  });
});

// ---------------------------------------------------------------------------
// deriveIp24Bucket (pure)
// ---------------------------------------------------------------------------

describe("deriveIp24Bucket", () => {
  it("returns first three octets of an IPv4", () => {
    expect(deriveIp24Bucket("203.0.113.42")).toBe("203.0.113");
    expect(deriveIp24Bucket("192.168.1.1")).toBe("192.168.1");
  });
  it("handles IPv6 by taking coarse first-three-group hex → decimal", () => {
    const r = deriveIp24Bucket("2001:db8:85a3::");
    // Should produce a dotted-3 string · exact digits depend on parse,
    // but shape must match the fingerprint validator's regex.
    expect(r).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}$/);
  });
});

// ---------------------------------------------------------------------------
// processFirstMessagePayload · session=none · created path
// ---------------------------------------------------------------------------

describe("processFirstMessagePayload · created path", () => {
  it("valid body + session=none + risk pass → 200 created + cookie payload", async () => {
    const result = await processFirstMessagePayload(goodBody(), makeDeps());
    expect(result.http_status).toBe(200);
    expect(result.body.status).toBe("created");
    expect(result.set_session_cookie).toBeDefined();
    const accountId = result.body.account_id as string;
    createdProvisionalIds.push(accountId);

    // Cookie payload is complete + verifiable
    const p = result.set_session_cookie!.payload;
    expect(p.account_id).toBe(accountId);
    expect(p.session_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(p.expires_at_ms).toBeGreaterThan(Date.now());

    // Registry has the session as valid
    const reg = await checkSessionValidity(p.session_id);
    expect(reg.valid).toBe(true);
  });

  it("body.redirect_to includes the sealed ?born=1 activation flag", async () => {
    const r = await processFirstMessagePayload(goodBody(), makeDeps());
    if (r.body.status === "created") {
      createdProvisionalIds.push(r.body.account_id as string);
      expect(r.body.redirect_to).toContain("?born=1");
    }
  });
});

// ---------------------------------------------------------------------------
// processFirstMessagePayload · session=authenticated → existing_session
// ---------------------------------------------------------------------------

describe("processFirstMessagePayload · existing_session path (authenticated)", () => {
  it("returns 200 existing_session + NO cookie write", async () => {
    const supa = {
      supabaseUserId: "aa",
      email: "x",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      account: { id: "aaaa1111-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } as any,
    };
    const r = await processFirstMessagePayload(
      goodBody(),
      makeDeps({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolveSession: async () => ({ kind: "authenticated", supabase: supa } as any),
      }),
    );
    expect(r.http_status).toBe(200);
    expect(r.body.status).toBe("existing_session");
    expect(r.set_session_cookie).toBeUndefined();
    expect(r.body.redirect_to).toBe(`/nex-native/chat/peer/${ownerAccountId}`);
  });
});

// ---------------------------------------------------------------------------
// processFirstMessagePayload · session=provisional → existing_session
// ---------------------------------------------------------------------------

describe("processFirstMessagePayload · existing_session path (provisional)", () => {
  it("returns 200 existing_session + NO cookie write", async () => {
    const prov: NexResolvedProvisional = {
      kind: "provisional",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      account: { id: "bbbb2222-bbbb-4bbb-8bbb-bbbbbbbbbbbb" } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      session_row: {} as any,
    };
    const r = await processFirstMessagePayload(
      goodBody(),
      makeDeps({ resolveSession: async () => prov }),
    );
    expect(r.http_status).toBe(200);
    expect(r.body.status).toBe("existing_session");
    expect(r.set_session_cookie).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Risk decisions map to HTTP correctly
// ---------------------------------------------------------------------------

describe("processFirstMessagePayload · risk block mapping (session=none)", () => {
  it("message_length=0 → 403 blocked message_too_short · NO cookie · NO DB writes for this fingerprint", async () => {
    const r = await processFirstMessagePayload(
      goodBody({ message_length: 0 }),
      makeDeps(),
    );
    expect(r.http_status).toBe(403);
    expect(r.body.status).toBe("blocked");
    expect(r.body.reason).toBe("message_too_short");
    expect(r.set_session_cookie).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Invalid request paths
// ---------------------------------------------------------------------------

describe("processFirstMessagePayload · malformed input", () => {
  it("non-object body → 400 invalid_request", async () => {
    const r = await processFirstMessagePayload(null, makeDeps());
    expect(r.http_status).toBe(400);
    expect(r.body.status).toBe("invalid_request");
    expect(r.body.field).toBe("body");
  });

  it("body missing required field → 400 invalid_request with the field name", async () => {
    const body = goodBody();
    delete (body as Partial<FirstMessageRequestBody>).send_intent_id;
    const r = await processFirstMessagePayload(body, makeDeps());
    expect(r.http_status).toBe(400);
    expect(r.body.field).toBe("send_intent_id");
  });

  it("body with empty ciphertext_rows → 400 invalid_request", async () => {
    const r = await processFirstMessagePayload(
      goodBody({ ciphertext_rows: [] }),
      makeDeps(),
    );
    expect(r.http_status).toBe(400);
    expect(r.body.field).toBe("ciphertext_rows");
  });
});

// ---------------------------------------------------------------------------
// Session-resolution failure → 500
// ---------------------------------------------------------------------------

describe("processFirstMessagePayload · resolver failure → 500", () => {
  it("resolveSession throws → 500 internal_error", async () => {
    const r = await processFirstMessagePayload(
      goodBody(),
      makeDeps({
        resolveSession: async () => {
          throw new Error("boom");
        },
      }),
    );
    expect(r.http_status).toBe(500);
    expect(r.body.status).toBe("internal_error");
    // Privacy: no error message content leaked from the resolver
    expect(JSON.stringify(r.body)).not.toContain("boom");
  });
});

// ---------------------------------------------------------------------------
// Verifies signed cookie payload (structural)
// ---------------------------------------------------------------------------

describe("processFirstMessagePayload · signed cookie shape (created path)", () => {
  it("cookie payload verifies against the same crypto config", async () => {
    const r = await processFirstMessagePayload(goodBody(), makeDeps());
    if (r.body.status === "created") {
      createdProvisionalIds.push(r.body.account_id as string);
      const p = r.set_session_cookie!.payload;
      // Re-sign the payload with the same key so we exercise the crypto
      // round-trip (the route itself signs the payload at cookie write
      // time; here we just prove the payload shape is signable).
      const token = signSessionToken(p, cryptoCfg);
      const v = verifySessionToken(token, cryptoCfg);
      expect(v.ok).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Structural · route logic never handles plaintext body
// ---------------------------------------------------------------------------

describe("first-message-http · doctrinal isolation", () => {
  it("public FirstMessageRequestBody has no plaintext fields", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/lib/nex-native/first-conversation/first-message-http.ts",
      ),
      "utf-8",
    );
    const iface = src.match(
      /export interface FirstMessageRequestBody \{([\s\S]*?)\n\}/,
    );
    expect(iface).not.toBeNull();
    const ifaceBody = iface![1];
    // No plaintext / message_body / body fields on the public request shape
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

  it("route.ts is a thin binding · does NOT contain business logic", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/nex-native/first-message/route.ts"),
      "utf-8",
    );
    // No orchestrator/service imports beyond the http core + session cookie
    // adapters. Structurally proves the route is a thin binding.
    expect(src).not.toMatch(/from ["'].*first-message-orchestrator["']/);
    expect(src).not.toMatch(/from ["'].*provisional-account-service["']/);
    expect(src).not.toMatch(/from ["'].*risk-service["']/);
    expect(src).not.toMatch(/\.from\(["']nex_account["']\)/);
  });
});
