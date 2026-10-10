// src/lib/nex/marketing/deliverability/__tests__/webhook-verifiers.test.ts
//
// NEX Deliverability · Webhook signature verifier acceptance
// Founder-authorised programme · Session-8 · Part 11e · 2026-09-21.

import { describe, it, expect } from "vitest";
import { createHmac, generateKeyPairSync, sign as edSign, createSign, generateKeyPairSync as _kp } from "node:crypto";
import {
  verifyResend, verifySendGrid, verifySesSns, verifyMailgun, verifyPostmark,
  verifyProviderWebhook,
  _VERIFIER_MODULE_HAS_NO_ROUTE_HANDLER,
  _VERIFIER_FAILS_CLOSED_ON_MISSING_SECRET,
  _VERIFIER_NEVER_NETWORK_FETCHES,
  _VERIFIER_USES_CONSTANT_TIME_COMPARE,
} from "..";

const NOW = 1_726_920_000; // fixed clock for deterministic tests · 2024-09-21ish

// ═══════════════════════════════════════════════════════════════════
// A · Resend (Svix scheme)
// ═══════════════════════════════════════════════════════════════════
describe("Webhook verifiers · (A) Resend / Svix", () => {
  function makeResendSig(secret_raw: string, id: string, ts: string, body: string) {
    const secret_material = Buffer.from(secret_raw, "utf8");
    return createHmac("sha256", secret_material).update(`${id}.${ts}.${body}`).digest("base64");
  }

  it("(A1) valid signature verifies · plain-utf8 secret", () => {
    const body = '{"event":"email.bounced"}';
    const id = "msg_1";
    const ts = String(NOW);
    const secret = "supersecret";
    const b64 = makeResendSig(secret, id, ts, body);
    const r = verifyResend({
      raw_body: body,
      headers: { "svix-id": id, "svix-timestamp": ts, "svix-signature": `v1,${b64}` },
      secret,
      now_seconds: NOW,
    });
    expect(r.kind).toBe("verified");
  });
  it("(A2) tampered payload → signature_mismatch", () => {
    const body = '{"event":"email.bounced"}';
    const id = "msg_1"; const ts = String(NOW); const secret = "supersecret";
    const b64 = makeResendSig(secret, id, ts, body);
    const r = verifyResend({
      raw_body: '{"event":"email.delivered"}', // tampered
      headers: { "svix-id": id, "svix-timestamp": ts, "svix-signature": `v1,${b64}` },
      secret, now_seconds: NOW,
    });
    expect(r.kind).toBe("signature_mismatch");
  });
  it("(A3) missing secret → missing_secret · fails closed", () => {
    const r = verifyResend({ raw_body: "{}", headers: {}, secret: null, now_seconds: NOW });
    expect(r.kind).toBe("missing_secret");
  });
  it("(A4) missing headers → missing_headers", () => {
    const r = verifyResend({ raw_body: "{}", headers: {}, secret: "s", now_seconds: NOW });
    expect(r.kind).toBe("missing_headers");
    if (r.kind === "missing_headers") {
      expect(r.missing).toContain("svix-id");
      expect(r.missing).toContain("svix-timestamp");
      expect(r.missing).toContain("svix-signature");
    }
  });
  it("(A5) stale timestamp (>5min skew) → stale_timestamp", () => {
    const body = "{}"; const id = "m"; const ts = String(NOW - 3600); const secret = "s";
    const b64 = makeResendSig(secret, id, ts, body);
    const r = verifyResend({
      raw_body: body,
      headers: { "svix-id": id, "svix-timestamp": ts, "svix-signature": `v1,${b64}` },
      secret, now_seconds: NOW,
    });
    expect(r.kind).toBe("stale_timestamp");
  });
  it("(A6) multiple v1 signatures (rotated secret) · one matches → verified", () => {
    const body = "{}"; const id = "m"; const ts = String(NOW);
    const b64 = makeResendSig("current_secret", id, ts, body);
    const r = verifyResend({
      raw_body: body,
      headers: { "svix-id": id, "svix-timestamp": ts, "svix-signature": `v1,badbadbad v1,${b64}` },
      secret: "current_secret", now_seconds: NOW,
    });
    expect(r.kind).toBe("verified");
  });
});

// ═══════════════════════════════════════════════════════════════════
// B · SendGrid (Ed25519)
// ═══════════════════════════════════════════════════════════════════
describe("Webhook verifiers · (B) SendGrid / Ed25519", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pub_pem = publicKey.export({ format: "pem", type: "spki" }).toString();

  function sg_sign(body: string, ts: string): string {
    const payload = Buffer.from(`${ts}${body}`, "utf8");
    return edSign(null, payload, privateKey).toString("base64");
  }

  it("(B1) valid Ed25519 signature → verified", () => {
    const body = '{"event":"bounce"}'; const ts = String(NOW);
    const sig = sg_sign(body, ts);
    const r = verifySendGrid({
      raw_body: body,
      headers: {
        "x-twilio-email-event-webhook-signature": sig,
        "x-twilio-email-event-webhook-timestamp": ts,
      },
      secret: pub_pem, now_seconds: NOW,
    });
    expect(r.kind).toBe("verified");
  });
  it("(B2) tampered body → signature_mismatch", () => {
    const ts = String(NOW);
    const sig = sg_sign('{"event":"bounce"}', ts);
    const r = verifySendGrid({
      raw_body: '{"event":"delivered"}', // tampered
      headers: {
        "x-twilio-email-event-webhook-signature": sig,
        "x-twilio-email-event-webhook-timestamp": ts,
      },
      secret: pub_pem, now_seconds: NOW,
    });
    expect(r.kind).toBe("signature_mismatch");
  });
  it("(B3) missing secret → missing_secret", () => {
    const r = verifySendGrid({ raw_body: "{}", headers: {}, secret: null, now_seconds: NOW });
    expect(r.kind).toBe("missing_secret");
  });
  it("(B4) missing headers → missing_headers", () => {
    const r = verifySendGrid({ raw_body: "{}", headers: {}, secret: pub_pem, now_seconds: NOW });
    expect(r.kind).toBe("missing_headers");
  });
  it("(B5) stale timestamp → stale_timestamp", () => {
    const ts = String(NOW - 3600);
    const sig = sg_sign('{"event":"bounce"}', ts);
    const r = verifySendGrid({
      raw_body: '{"event":"bounce"}',
      headers: {
        "x-twilio-email-event-webhook-signature": sig,
        "x-twilio-email-event-webhook-timestamp": ts,
      },
      secret: pub_pem, now_seconds: NOW,
    });
    expect(r.kind).toBe("stale_timestamp");
  });
});

// ═══════════════════════════════════════════════════════════════════
// C · Amazon SES via SNS
// ═══════════════════════════════════════════════════════════════════
describe("Webhook verifiers · (C) Amazon SES via SNS", () => {
  // Generate an RSA keypair to fake an SNS-style signing cert
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const cert_pem = publicKey.export({ format: "pem", type: "spki" }).toString();

  function snsSign(msg: any, algo: "sha1" | "sha256"): string {
    const fields = msg.Type === "Notification"
      ? ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"]
      : ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"];
    const parts: string[] = [];
    for (const f of fields) if (typeof msg[f] === "string") { parts.push(f); parts.push(String(msg[f])); }
    const canonical = parts.join("\n") + "\n";
    const s = createSign(`RSA-${algo.toUpperCase()}`);
    s.update(canonical, "utf8");
    return s.sign(privateKey, "base64");
  }

  it("(C1) valid v1 (sha1) notification → verified", () => {
    const msg: any = {
      Type: "Notification",
      MessageId: "abc",
      TopicArn: "arn:aws:sns:us-east-1:123:x",
      Subject: "s",
      Message: '{"eventType":"Bounce"}',
      Timestamp: "2026-09-21T00:00:00Z",
      SignatureVersion: "1",
      SigningCertURL: "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc.pem",
    };
    msg.Signature = snsSign(msg, "sha1");
    const r = verifySesSns({ raw_body: JSON.stringify(msg), headers: {}, secret: cert_pem, now_seconds: NOW });
    expect(r.kind).toBe("verified");
  });
  it("(C2) valid v2 (sha256) notification → verified", () => {
    const msg: any = {
      Type: "Notification",
      MessageId: "abc",
      TopicArn: "arn:aws:sns:us-east-1:123:x",
      Message: '{"eventType":"Complaint"}',
      Timestamp: "2026-09-21T00:00:00Z",
      SignatureVersion: "2",
      SigningCertURL: "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc.pem",
    };
    msg.Signature = snsSign(msg, "sha256");
    const r = verifySesSns({ raw_body: JSON.stringify(msg), headers: {}, secret: cert_pem, now_seconds: NOW });
    expect(r.kind).toBe("verified");
  });
  it("(C3) SigningCertURL not under sns.*.amazonaws.com → signature_mismatch (defense in depth)", () => {
    const msg: any = {
      Type: "Notification", MessageId: "abc", TopicArn: "arn", Message: "{}",
      Timestamp: "t", SignatureVersion: "1",
      SigningCertURL: "https://evil.example.com/cert.pem",
      Signature: "not-checked-because-we-fail-earlier",
    };
    const r = verifySesSns({ raw_body: JSON.stringify(msg), headers: {}, secret: cert_pem });
    expect(r.kind).toBe("signature_mismatch");
    if (r.kind === "signature_mismatch") {
      expect(r.reason).toMatch(/signing_cert_url_not_aws_sns/);
    }
  });
  it("(C4) unsupported SignatureVersion → malformed", () => {
    const msg: any = {
      Type: "Notification", MessageId: "abc", TopicArn: "arn", Message: "{}",
      Timestamp: "t", SignatureVersion: "9",
      SigningCertURL: "https://sns.us-east-1.amazonaws.com/x.pem",
      Signature: "x",
    };
    const r = verifySesSns({ raw_body: JSON.stringify(msg), headers: {}, secret: cert_pem });
    expect(r.kind).toBe("malformed");
  });
  it("(C5) tampered Message → signature_mismatch", () => {
    const msg: any = {
      Type: "Notification", MessageId: "abc", TopicArn: "arn",
      Message: '{"eventType":"Bounce"}', Timestamp: "t", SignatureVersion: "1",
      SigningCertURL: "https://sns.us-east-1.amazonaws.com/x.pem",
    };
    msg.Signature = snsSign(msg, "sha1");
    // Tamper after signing
    msg.Message = '{"eventType":"Delivery"}';
    const r = verifySesSns({ raw_body: JSON.stringify(msg), headers: {}, secret: cert_pem });
    expect(r.kind).toBe("signature_mismatch");
  });
  it("(C6) body not JSON → malformed", () => {
    const r = verifySesSns({ raw_body: "not-json", headers: {}, secret: cert_pem });
    expect(r.kind).toBe("malformed");
  });
  it("(C7) missing signing cert → missing_secret · never network-fetched", () => {
    const r = verifySesSns({ raw_body: "{}", headers: {}, secret: null });
    expect(r.kind).toBe("missing_secret");
  });
});

// ═══════════════════════════════════════════════════════════════════
// D · Mailgun
// ═══════════════════════════════════════════════════════════════════
describe("Webhook verifiers · (D) Mailgun", () => {
  const secret = "mailgun-signing-key";
  function mgHmac(ts: string, token: string) {
    return createHmac("sha256", secret).update(`${ts}${token}`).digest("hex");
  }

  it("(D1) valid JSON body signature → verified", () => {
    const ts = String(NOW); const token = "abc";
    const body = JSON.stringify({ signature: { timestamp: ts, token, signature: mgHmac(ts, token) } });
    const r = verifyMailgun({ raw_body: body, headers: {}, secret, now_seconds: NOW });
    expect(r.kind).toBe("verified");
  });
  it("(D2) valid header-variant signature → verified", () => {
    const ts = String(NOW); const token = "abc";
    const r = verifyMailgun({
      raw_body: "{}",
      headers: { "x-mailgun-timestamp": ts, "x-mailgun-token": token, "x-mailgun-signature": mgHmac(ts, token) },
      secret, now_seconds: NOW,
    });
    expect(r.kind).toBe("verified");
  });
  it("(D3) tampered signature → signature_mismatch", () => {
    const ts = String(NOW); const token = "abc";
    const body = JSON.stringify({ signature: { timestamp: ts, token, signature: "deadbeef" } });
    const r = verifyMailgun({ raw_body: body, headers: {}, secret, now_seconds: NOW });
    expect(r.kind).toBe("signature_mismatch");
  });
  it("(D4) missing secret → missing_secret", () => {
    const r = verifyMailgun({ raw_body: "{}", headers: {}, secret: null, now_seconds: NOW });
    expect(r.kind).toBe("missing_secret");
  });
  it("(D5) stale timestamp → stale_timestamp", () => {
    const ts = String(NOW - 3600); const token = "abc";
    const body = JSON.stringify({ signature: { timestamp: ts, token, signature: mgHmac(ts, token) } });
    const r = verifyMailgun({ raw_body: body, headers: {}, secret, now_seconds: NOW });
    expect(r.kind).toBe("stale_timestamp");
  });
});

// ═══════════════════════════════════════════════════════════════════
// E · Postmark
// ═══════════════════════════════════════════════════════════════════
describe("Webhook verifiers · (E) Postmark", () => {
  const secret = "postmark-token";
  it("(E1) valid HMAC over body → verified", () => {
    const body = '{"RecordType":"Bounce"}';
    const sig = createHmac("sha256", secret).update(body).digest("base64");
    const r = verifyPostmark({ raw_body: body, headers: { "x-postmark-signature": sig }, secret });
    expect(r.kind).toBe("verified");
  });
  it("(E2) tampered body → signature_mismatch", () => {
    const body = '{"RecordType":"Bounce"}';
    const sig = createHmac("sha256", secret).update(body).digest("base64");
    const r = verifyPostmark({ raw_body: '{"RecordType":"Delivery"}', headers: { "x-postmark-signature": sig }, secret });
    expect(r.kind).toBe("signature_mismatch");
  });
  it("(E3) missing secret → missing_secret", () => {
    const r = verifyPostmark({ raw_body: "{}", headers: {}, secret: null });
    expect(r.kind).toBe("missing_secret");
  });
  it("(E4) missing signature header → missing_headers", () => {
    const r = verifyPostmark({ raw_body: "{}", headers: {}, secret });
    expect(r.kind).toBe("missing_headers");
  });
});

// ═══════════════════════════════════════════════════════════════════
// F · Dispatcher
// ═══════════════════════════════════════════════════════════════════
describe("Webhook verifiers · (F) provider dispatcher", () => {
  it("(F1) dispatches by provider name", () => {
    const r = verifyProviderWebhook("postmark", { raw_body: "{}", headers: {}, secret: null });
    expect(r.kind).toBe("missing_secret");
    expect(r.provider).toBe("postmark");
  });
  it("(F2) unknown provider name → malformed", () => {
    const r = verifyProviderWebhook("nope" as any, { raw_body: "{}", headers: {}, secret: "s" });
    expect(r.kind).toBe("malformed");
  });
});

// ═══════════════════════════════════════════════════════════════════
// G · Governance canaries
// ═══════════════════════════════════════════════════════════════════
describe("Webhook verifiers · (G) governance canaries", () => {
  it("(G1) boundary markers exported", () => {
    expect(_VERIFIER_MODULE_HAS_NO_ROUTE_HANDLER).toContain("no_endpoint");
    expect(_VERIFIER_FAILS_CLOSED_ON_MISSING_SECRET).toContain("no_bypass");
    expect(_VERIFIER_NEVER_NETWORK_FETCHES).toContain("supplied_by_caller");
    expect(_VERIFIER_USES_CONSTANT_TIME_COMPARE).toContain("timingSafeEqual");
  });
  it("(G2) module exports NO route handler · endpoint · listener · POST · GET", async () => {
    const mod = await import("..");
    expect((mod as any).POST).toBeUndefined();
    expect((mod as any).GET).toBeUndefined();
    expect((mod as any).default).toBeUndefined();
    expect((mod as any).handler).toBeUndefined();
    expect((mod as any).webhookRoute).toBeUndefined();
    expect((mod as any).receiveWebhook).toBeUndefined();
    expect((mod as any).createEndpoint).toBeUndefined();
    expect((mod as any).activateWebhooks).toBeUndefined();
  });
  it("(G3) no defaults · every verifier requires an explicit secret", () => {
    const providers = ["resend", "sendgrid", "ses_sns", "mailgun", "postmark"] as const;
    for (const p of providers) {
      const r = verifyProviderWebhook(p, { raw_body: "{}", headers: {}, secret: null });
      expect(r.kind).toBe("missing_secret");
    }
  });
  it("(G4) module source does NOT reference fetch/http/https/network", async () => {
    // Structural check: read the source and prove zero network primitives
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/nex/marketing/deliverability/webhook-verifiers.ts", "utf8");
    // Strip line/block comments so doctrine language ("network-fetched", etc) doesn't false-positive
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toMatch(/\bfetch\(/);
    expect(code).not.toMatch(/require\(["']node:http["']\)/);
    expect(code).not.toMatch(/require\(["']node:https["']\)/);
    expect(code).not.toMatch(/from ["']node:http["']/);
    expect(code).not.toMatch(/from ["']node:https["']/);
    expect(code).not.toMatch(/\bXMLHttpRequest\b/);
    expect(code).not.toMatch(/\baxios\b/);
  });
});
