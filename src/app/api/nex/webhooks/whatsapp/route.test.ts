// src/app/api/nex/webhooks/whatsapp/route.test.ts
//
// Stage 3.39 · Webhook route doctrine tests.
//
// W1 · GET verify · correct token → 200 with challenge echoed
// W2 · GET verify · wrong token → 403 · never echoes
// W3 · GET · missing config → 403 (never silently accepts)
// W4 · POST · missing config → 401
// W5 · POST · valid HMAC signature → 200 · body parsed · reconciled
// W6 · POST · bad HMAC → 401 · reconciliation never runs
// W7 · POST · body with unknown wamid → 200 · no_matching_entry recorded
// W8 · POST · body with delivered event → outbox CONFIRMED

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { GET, POST } from "./route";
import {
  recordAttempt,
  markOutcome,
  getOutboxEntry,
  _resetOutboxForTests,
} from "@/lib/nex/brain/adapters/whatsapp-outbox";

const KEYS = [
  "NEX_META_APP_SECRET",
  "NEX_WHATSAPP_WEBHOOK_VERIFY_TOKEN",
  "NEX_META_PHONE_NUMBER_ID",
  "NEX_META_ACCESS_TOKEN",
  "NEX_WHATSAPP_OUTBOX_DRIVER",
] as const;
const backup: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) { backup[k] = process.env[k]; delete process.env[k]; }
  _resetOutboxForTests();
});
afterEach(() => {
  for (const k of KEYS) { if (backup[k] === undefined) delete process.env[k]; else process.env[k] = backup[k]; }
});

const NOW = () => "2026-08-31T10:00:00.000Z";

function signBody(secret: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

// ─── W1-W3 · GET verification ─────────────────────────────────────

describe("W1-W3 · GET subscription verification", () => {
  it("W1 · correct token → 200 with challenge in body", async () => {
    process.env.NEX_WHATSAPP_WEBHOOK_VERIFY_TOKEN = "VT_TEST";
    const req = new Request("http://x/api/nex/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=VT_TEST&hub.challenge=CH123");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("CH123");
  });

  it("W2 · wrong verify token → 403 · challenge never echoed", async () => {
    process.env.NEX_WHATSAPP_WEBHOOK_VERIFY_TOKEN = "VT_TEST";
    const req = new Request("http://x/api/nex/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=WRONG&hub.challenge=CH123");
    const res = await GET(req);
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain("CH123");
  });

  it("W3 · verify token not configured → 403 (never silently accepts)", async () => {
    // NEX_WHATSAPP_WEBHOOK_VERIFY_TOKEN unset
    const req = new Request("http://x/api/nex/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=any&hub.challenge=CH123");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });
});

// ─── W4-W6 · POST auth + HMAC ─────────────────────────────────────

describe("W4-W6 · POST authentication", () => {
  it("W4 · receiver not configured (missing app secret) → 401", async () => {
    const req = new Request("http://x/api/nex/webhooks/whatsapp", {
      method: "POST", body: "{}",
      headers: { "x-hub-signature-256": "sha256=deadbeef" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("W5 · valid HMAC + valid body → 200", async () => {
    process.env.NEX_META_APP_SECRET = "SEC_TEST";
    process.env.NEX_WHATSAPP_WEBHOOK_VERIFY_TOKEN = "V";
    const body = JSON.stringify({ entry: [] });
    const req = new Request("http://x/api/nex/webhooks/whatsapp", {
      method: "POST", body,
      headers: { "x-hub-signature-256": signBody("SEC_TEST", body) },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("W6 · bad HMAC → 401 · reconciliation never runs (outbox unchanged)", async () => {
    process.env.NEX_META_APP_SECRET = "SEC_TEST";
    process.env.NEX_WHATSAPP_WEBHOOK_VERIFY_TOKEN = "V";
    // Seed an outbox row so we can detect if it was touched
    await recordAttempt({ correlationId: "c1", providerId: "meta_cloud", targetCanonical: "X", toE164: "+62", bodyHash: "abc", now: NOW });
    await markOutcome("c1", { status: "ACCEPTED", providerMessageId: "wamid.probe", now: NOW });
    const body = JSON.stringify({
      entry: [{ changes: [{ value: { statuses: [{ id: "wamid.probe", status: "delivered", timestamp: "0" }] } }] }],
    });
    const req = new Request("http://x/api/nex/webhooks/whatsapp", {
      method: "POST", body,
      headers: { "x-hub-signature-256": "sha256=wrongwrongwrongwrongwrongwrongwrongwrongwrongwrongwrongwrongwrong" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    // Outbox row untouched
    expect((await getOutboxEntry("c1"))?.status).toBe("ACCEPTED");
  });
});

// ─── W7-W8 · reconciliation via webhook ───────────────────────────

describe("W7-W8 · reconciliation via webhook", () => {
  it("W7 · unknown wamid → 200 with no_matching_entry result · outbox unchanged", async () => {
    process.env.NEX_META_APP_SECRET = "SEC";
    process.env.NEX_WHATSAPP_WEBHOOK_VERIFY_TOKEN = "V";
    const body = JSON.stringify({
      entry: [{ changes: [{ value: { statuses: [{ id: "wamid.unknown", status: "delivered", timestamp: "0" }] } }] }],
    });
    const req = new Request("http://x/api/nex/webhooks/whatsapp", {
      method: "POST", body,
      headers: { "x-hub-signature-256": signBody("SEC", body) },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.results[0].outcome).toBe("no_matching_entry");
  });

  it("W8 · delivered event for known wamid → outbox CONFIRMED · 200 with resolved outcome", async () => {
    process.env.NEX_META_APP_SECRET = "SEC";
    process.env.NEX_WHATSAPP_WEBHOOK_VERIFY_TOKEN = "V";
    // Seed
    await recordAttempt({ correlationId: "c1", providerId: "meta_cloud", targetCanonical: "X", toE164: "+62", bodyHash: "a", now: NOW });
    await markOutcome("c1", { status: "ACCEPTED", providerMessageId: "wamid.real", now: NOW });
    const body = JSON.stringify({
      entry: [{ changes: [{ value: { statuses: [{ id: "wamid.real", status: "delivered", timestamp: "2026-08-31T10:00:05Z" }] } }] }],
    });
    const req = new Request("http://x/api/nex/webhooks/whatsapp", {
      method: "POST", body,
      headers: { "x-hub-signature-256": signBody("SEC", body) },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.results[0].outcome).toBe("resolved");
    expect((await getOutboxEntry("c1"))?.status).toBe("CONFIRMED");
  });
});
