// NEX Delivery · webhook signature verification
//
// One verifier per provider · returns { ok: true } or { ok: false, reason }.
// Called by /api/nex/webhooks/{provider} BEFORE we translate + ingest.
// Never trusts a webhook that fails verification.

import { createHmac, createVerify, timingSafeEqual } from "crypto";

// ── Mailgun · HMAC-SHA256(timestamp + token, api_key) ─────────────
export function verifyMailgun(body: { signature?: { timestamp?: string; token?: string; signature?: string } }): { ok: true } | { ok: false; reason: string } {
  const sig = body?.signature;
  if (!sig?.timestamp || !sig?.token || !sig?.signature) return { ok: false, reason: "missing signature block" };
  const key = process.env.NEX_DELIVERY_MAILGUN_API_KEY;
  if (!key) return { ok: false, reason: "NEX_DELIVERY_MAILGUN_API_KEY not set" };
  // Reject stale payloads (>15 min drift)
  const age = Math.abs(Date.now() / 1000 - Number(sig.timestamp));
  if (!Number.isFinite(age) || age > 15 * 60) return { ok: false, reason: "timestamp drift > 15 min" };
  const expected = createHmac("sha256", key).update(String(sig.timestamp) + String(sig.token)).digest("hex");
  return safeEqualHex(expected, sig.signature) ? { ok: true } : { ok: false, reason: "signature mismatch" };
}

// ── Postmark · Basic Auth against configured user/pass ────────────
export function verifyPostmark(authorization: string | null): { ok: true } | { ok: false; reason: string } {
  const user = process.env.NEX_DELIVERY_POSTMARK_WEBHOOK_USER;
  const pass = process.env.NEX_DELIVERY_POSTMARK_WEBHOOK_PASS;
  if (!user || !pass) return { ok: false, reason: "NEX_DELIVERY_POSTMARK_WEBHOOK_USER/PASS not set" };
  if (!authorization?.toLowerCase().startsWith("basic ")) return { ok: false, reason: "missing basic auth header" };
  const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
  const idx = decoded.indexOf(":");
  if (idx < 0) return { ok: false, reason: "malformed basic auth" };
  const gotUser = decoded.slice(0, idx); const gotPass = decoded.slice(idx + 1);
  return (safeEqualStr(gotUser, user) && safeEqualStr(gotPass, pass)) ? { ok: true } : { ok: false, reason: "credentials mismatch" };
}

// ── SendGrid · ECDSA-P256 signature ───────────────────────────────
// Verifies `X-Twilio-Email-Event-Webhook-Signature` (base64 signature)
// against `X-Twilio-Email-Event-Webhook-Timestamp + rawBody` using the
// public key configured in the SendGrid Event Webhook UI.
export function verifySendGrid(rawBody: string, headers: { signature: string | null; timestamp: string | null }): { ok: true } | { ok: false; reason: string } {
  const pub = process.env.NEX_DELIVERY_SENDGRID_WEBHOOK_PUBLIC_KEY;
  if (!pub) return { ok: false, reason: "NEX_DELIVERY_SENDGRID_WEBHOOK_PUBLIC_KEY not set" };
  if (!headers.signature || !headers.timestamp) return { ok: false, reason: "missing signature or timestamp header" };
  // Public key is a base64-encoded DER OR a PEM · normalise to PEM
  const pemKey = pub.includes("BEGIN PUBLIC KEY") ? pub :
    `-----BEGIN PUBLIC KEY-----\n${pub.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n") ?? ""}\n-----END PUBLIC KEY-----`;
  try {
    const v = createVerify("SHA256");
    v.update(headers.timestamp + rawBody);
    const ok = v.verify(pemKey, headers.signature, "base64");
    return ok ? { ok: true } : { ok: false, reason: "signature verify failed" };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "verify exception" };
  }
}

// ── SES / SNS · verify SigningCertURL is AWS + verify signature ───
// MVP: verify SigningCertURL host + accept SubscriptionConfirmation
// bodies · full SNS message signing verification uses the cert PEM
// fetched from SigningCertURL. To keep this dep-free we implement the
// full standard v1/v2 verification here.
export async function verifySns(body: {
  Type?: string; SigningCertURL?: string; Signature?: string; SignatureVersion?: string;
  Message?: string; MessageId?: string; Timestamp?: string; TopicArn?: string; Subject?: string;
  Token?: string; SubscribeURL?: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const url = body?.SigningCertURL;
  if (!url) return { ok: false, reason: "missing SigningCertURL" };
  const parsed = new URL(url);
  if (!/\.amazonaws\.com$/i.test(parsed.hostname)) return { ok: false, reason: "SigningCertURL is not an AWS host" };
  if (!body?.Signature) return { ok: false, reason: "missing Signature" };

  // Fetch the certificate (cached in-process for the cert URL)
  const pem = await fetchSnsCert(url);
  if (!pem) return { ok: false, reason: "cert fetch failed" };

  const stringToSign = buildSnsStringToSign(body);
  if (!stringToSign) return { ok: false, reason: "unrecognised SNS message type" };

  try {
    const algo = body.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1";
    const v = createVerify(algo);
    v.update(stringToSign);
    const ok = v.verify(pem, body.Signature, "base64");
    return ok ? { ok: true } : { ok: false, reason: "SNS signature verify failed" };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "SNS verify exception" };
  }
}

function buildSnsStringToSign(m: Record<string, string | undefined>): string | null {
  // Per AWS SNS docs · construct in this exact order
  const notificationKeys  = ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"];
  const subscriptionKeys  = ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"];
  const isNotification = m.Type === "Notification";
  const isSubscription = m.Type === "SubscriptionConfirmation" || m.Type === "UnsubscribeConfirmation";
  const keys = isNotification ? notificationKeys : isSubscription ? subscriptionKeys : null;
  if (!keys) return null;
  const parts: string[] = [];
  for (const k of keys) {
    const v = m[k];
    if (v === undefined) { if (k === "Subject") continue; return null; }
    parts.push(k); parts.push(v);
  }
  return parts.join("\n") + "\n";
}

const certCache = new Map<string, string>();
async function fetchSnsCert(url: string): Promise<string | null> {
  const cached = certCache.get(url);
  if (cached) return cached;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const pem = await r.text();
    certCache.set(url, pem);
    return pem;
  } catch { return null; }
}

// ── Constant-time comparators ─────────────────────────────────────
function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex"); const bb = Buffer.from(b, "hex");
  if (ba.length === 0 || ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
function safeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a); const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
