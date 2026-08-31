// src/lib/nex/config/whatsapp.test.ts
//
// Stage 3.39 · Config loader honesty tests.

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { loadWhatsAppConfig, canSendWhatsApp, canReceiveWhatsAppWebhooks } from "./whatsapp";

const KEYS = [
  "NEX_META_PHONE_NUMBER_ID",
  "NEX_META_ACCESS_TOKEN",
  "NEX_META_APP_SECRET",
  "NEX_WHATSAPP_WEBHOOK_VERIFY_TOKEN",
  "NEX_WHATSAPP_OUTBOX_DRIVER",
  "NEX_META_API_VERSION",
] as const;

const backup: Record<string, string | undefined> = {};

beforeEach(() => { for (const k of KEYS) { backup[k] = process.env[k]; delete process.env[k]; } });
afterEach(()  => { for (const k of KEYS) { if (backup[k] === undefined) delete process.env[k]; else process.env[k] = backup[k]; } });

describe("loadWhatsAppConfig · defaults", () => {
  it("no env vars set → outboxDriver defaults to memory · apiVersion defaults to v20.0 · secrets undefined", () => {
    const c = loadWhatsAppConfig();
    expect(c.outboxDriver).toBe("memory");
    expect(c.metaApiVersion).toBe("v20.0");
    expect(c.metaPhoneNumberId).toBeUndefined();
    expect(c.metaAccessToken).toBeUndefined();
    expect(c.metaAppSecret).toBeUndefined();
    expect(c.webhookVerifyToken).toBeUndefined();
  });
});

describe("loadWhatsAppConfig · reads env", () => {
  it("full set of vars → config populated · driver=postgres honored", () => {
    process.env.NEX_META_PHONE_NUMBER_ID           = "PN123";
    process.env.NEX_META_ACCESS_TOKEN              = "TOK";
    process.env.NEX_META_APP_SECRET                = "SEC";
    process.env.NEX_WHATSAPP_WEBHOOK_VERIFY_TOKEN  = "VERIFY";
    process.env.NEX_WHATSAPP_OUTBOX_DRIVER         = "postgres";
    process.env.NEX_META_API_VERSION               = "v21.0";
    const c = loadWhatsAppConfig();
    expect(c.metaPhoneNumberId).toBe("PN123");
    expect(c.metaAccessToken).toBe("TOK");
    expect(c.metaAppSecret).toBe("SEC");
    expect(c.webhookVerifyToken).toBe("VERIFY");
    expect(c.outboxDriver).toBe("postgres");
    expect(c.metaApiVersion).toBe("v21.0");
  });

  it("blank strings treated as undefined (never blank config value)", () => {
    process.env.NEX_META_ACCESS_TOKEN = "   ";
    expect(loadWhatsAppConfig().metaAccessToken).toBeUndefined();
  });

  it("invalid driver value falls back to memory (never crashes)", () => {
    process.env.NEX_WHATSAPP_OUTBOX_DRIVER = "nonsense";
    expect(loadWhatsAppConfig().outboxDriver).toBe("memory");
  });
});

describe("canSendWhatsApp / canReceiveWhatsAppWebhooks", () => {
  it("canSend requires phoneNumberId AND accessToken · both must be set", () => {
    expect(canSendWhatsApp(loadWhatsAppConfig())).toBe(false);
    process.env.NEX_META_PHONE_NUMBER_ID = "PN";
    expect(canSendWhatsApp(loadWhatsAppConfig())).toBe(false);
    process.env.NEX_META_ACCESS_TOKEN = "TOK";
    expect(canSendWhatsApp(loadWhatsAppConfig())).toBe(true);
  });

  it("canReceive requires appSecret AND verifyToken", () => {
    expect(canReceiveWhatsAppWebhooks(loadWhatsAppConfig())).toBe(false);
    process.env.NEX_META_APP_SECRET = "SEC";
    expect(canReceiveWhatsAppWebhooks(loadWhatsAppConfig())).toBe(false);
    process.env.NEX_WHATSAPP_WEBHOOK_VERIFY_TOKEN = "V";
    expect(canReceiveWhatsAppWebhooks(loadWhatsAppConfig())).toBe(true);
  });
});
