// src/lib/nex/brain/adapters/whatsapp-outbox-db.test.ts
//
// Contract tests for the WhatsApp outbox DB adapter. Proves:
//   · Reads ONLY NEX_WHATSAPP_OUTBOX_POSTGRES_URL · NEVER NEX_POSTGRES_URL.
//   · Missing var → withClient returns null (graceful degradation for
//     dev/test) so the Postgres outbox driver's loud throw fires only
//     when postgres is explicitly selected.
//   · Malformed var → throws with code=invalid-whatsapp-outbox-url.
//
// No real DB required · we don't call `withWhatsAppOutboxClient(fn)` with
// a URL set (that would open a socket). Instead we prove the CONFIG
// contract, which is what the whole separation exists to enforce.

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { withWhatsAppOutboxClient, _resetWhatsAppOutboxPoolForTests } from "./whatsapp-outbox-db";

const OUTBOX_ENV = "NEX_WHATSAPP_OUTBOX_POSTGRES_URL";
const NEX_ENV    = "NEX_POSTGRES_URL";

describe("whatsapp-outbox-db · env-var isolation", () => {
  let originalOutbox: string | undefined;
  let originalNex:    string | undefined;

  beforeEach(() => {
    originalOutbox = process.env[OUTBOX_ENV];
    originalNex    = process.env[NEX_ENV];
    _resetWhatsAppOutboxPoolForTests();
  });

  afterEach(() => {
    if (originalOutbox === undefined) delete process.env[OUTBOX_ENV]; else process.env[OUTBOX_ENV] = originalOutbox;
    if (originalNex    === undefined) delete process.env[NEX_ENV];    else process.env[NEX_ENV]    = originalNex;
    _resetWhatsAppOutboxPoolForTests();
  });

  it("returns null when NEX_WHATSAPP_OUTBOX_POSTGRES_URL is unset · even if NEX_POSTGRES_URL is set", async () => {
    delete process.env[OUTBOX_ENV];
    // NEX_POSTGRES_URL DELIBERATELY set to something real-looking · this
    // is the exact scenario the separation prevents · adapter must NOT
    // fall back to it.
    process.env[NEX_ENV] = "postgresql://postgres.abc:secret@aws-0-eu-west-1.pooler.supabase.com:5432/postgres";

    const result = await withWhatsAppOutboxClient(async () => "should-not-run");
    expect(result).toBeNull();
  });

  it("returns null when NEX_WHATSAPP_OUTBOX_POSTGRES_URL is whitespace-only", async () => {
    process.env[OUTBOX_ENV] = "   ";
    const result = await withWhatsAppOutboxClient(async () => "should-not-run");
    expect(result).toBeNull();
  });

  it("throws code=invalid-whatsapp-outbox-url when the var is set to a non-postgres URL", async () => {
    process.env[OUTBOX_ENV] = "not-a-url";
    await expect(withWhatsAppOutboxClient(async () => "x")).rejects.toMatchObject({
      code: "invalid-whatsapp-outbox-url",
    });
  });

  it("throws with a redacted URL in the message (no password leak)", async () => {
    process.env[OUTBOX_ENV] = "http-not-postgres://supersecret";
    try {
      await withWhatsAppOutboxClient(async () => "x");
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as Error).message).not.toMatch(/supersecret/);
    }
  });
});
