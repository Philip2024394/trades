// src/lib/nex/marketing/deliverability/webhook-verifiers.ts
//
// NEX Deliverability · Provider Webhook Signature Verifiers
// Founder-authorised programme · Session-8 · Part 11e · 2026-09-21.
//
// Pure signature-verification functions for the five web-facing providers:
//   * Resend         (svix-style HMAC-SHA256 over id + timestamp + payload)
//   * SendGrid       (Ed25519 public-key signature over timestamp + payload)
//   * Amazon SES     (SNS message signing · certificate-based · verified externally)
//   * Mailgun        (HMAC-SHA256 over timestamp + token · classic scheme)
//   * Postmark       (HMAC-SHA256 over payload · plus Basic-Auth on some setups)
//
// GOVERNANCE HARD-LOCKS:
//   * Pure functions · zero network · zero endpoint activation
//   * Module exports NO route handler · NO endpoint · NO listener · NO webhook receiver
//   * Every verifier fails closed on missing secret / missing headers / signature mismatch
//   * Constant-time comparison for HMAC digests (defeats timing side-channels)
//   * The Founder-controlled activation gate (webhook endpoints) is unchanged by this file

import { createHmac, timingSafeEqual } from "node:crypto";

export type WebhookProvider = "resend" | "sendgrid" | "ses_sns" | "mailgun" | "postmark";

export type VerifyOutcome =
  | { kind: "verified"; provider: WebhookProvider; matched_scheme: string }
  | { kind: "signature_mismatch"; provider: WebhookProvider; reason: string }
  | { kind: "missing_secret"; provider: WebhookProvider }
  | { kind: "missing_headers"; provider: WebhookProvider; missing: readonly string[] }
  | { kind: "stale_timestamp"; provider: WebhookProvider; skew_seconds: number }
  | { kind: "malformed"; provider: WebhookProvider; reason: string };

export interface VerifyInput {
  readonly raw_body: string;                         // exact byte-preserving payload
  readonly headers: Record<string, string | undefined>; // lowercased header map
  readonly secret: string | null | undefined;
  readonly now_seconds?: number;                     // for deterministic tests
  readonly max_skew_seconds?: number;                // default 300 (5 min)
}

const DEFAULT_MAX_SKEW = 300;

// ─── Header helpers (case-insensitive lookup) ──────────────────────
function h(headers: Record<string, string | undefined>, key: string): string | null {
  const v = headers[key.toLowerCase()];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length === 0 || ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function safeEqualBase64(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "base64");
    const bb = Buffer.from(b, "base64");
    if (ba.length === 0 || ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

// ─── Resend (svix scheme) ──────────────────────────────────────────
/** Resend uses Svix for webhooks. Signature format:
 *  header `svix-signature: v1,<base64-hmac-sha256>` (space-separated multiple)
 *  digest = HMAC-SHA256(secret, `${svix-id}.${svix-timestamp}.${raw_body}`)
 *  secret is `whsec_<base64>` → decode base64 after prefix.
 */
export function verifyResend(input: VerifyInput): VerifyOutcome {
  if (!input.secret) return { kind: "missing_secret", provider: "resend" };
  const id = h(input.headers, "svix-id");
  const ts = h(input.headers, "svix-timestamp");
  const sig = h(input.headers, "svix-signature");
  const missing: string[] = [];
  if (!id) missing.push("svix-id");
  if (!ts) missing.push("svix-timestamp");
  if (!sig) missing.push("svix-signature");
  if (missing.length > 0) return { kind: "missing_headers", provider: "resend", missing };

  // Timestamp skew check
  const ts_num = Number(ts);
  if (!Number.isFinite(ts_num)) return { kind: "malformed", provider: "resend", reason: "svix-timestamp_not_numeric" };
  const now = input.now_seconds ?? Math.floor(Date.now() / 1000);
  const max = input.max_skew_seconds ?? DEFAULT_MAX_SKEW;
  if (Math.abs(now - ts_num) > max) return { kind: "stale_timestamp", provider: "resend", skew_seconds: Math.abs(now - ts_num) };

  // Decode svix secret (whsec_<base64>)
  const secret_material = String(input.secret).startsWith("whsec_")
    ? Buffer.from(String(input.secret).slice("whsec_".length), "base64")
    : Buffer.from(String(input.secret), "utf8");

  const to_sign = `${id}.${ts}.${input.raw_body}`;
  const expected = createHmac("sha256", secret_material).update(to_sign).digest("base64");

  // Header format: "v1,<b64> v1,<b64>" (space-separated) · match any
  const parts = String(sig!).split(/\s+/).filter(Boolean);
  for (const p of parts) {
    const [ver, b64] = p.split(",", 2);
    if (ver !== "v1" || !b64) continue;
    if (safeEqualBase64(expected, b64)) {
      return { kind: "verified", provider: "resend", matched_scheme: "svix_v1_hmac_sha256_base64" };
    }
  }
  return { kind: "signature_mismatch", provider: "resend", reason: "no_v1_signature_matched" };
}

// ─── SendGrid (Ed25519 public-key) ─────────────────────────────────
/** SendGrid uses Ed25519 asymmetric signatures. Header:
 *    x-twilio-email-event-webhook-signature      = base64(ed25519_sig(timestamp || payload))
 *    x-twilio-email-event-webhook-timestamp      = unix seconds
 *  Secret is a PEM public key (starts with -----BEGIN PUBLIC KEY-----).
 *
 *  This verifier requires `node:crypto` verify with 'ed25519' · we don't
 *  attempt fallback (fail closed if crypto.verify isn't available).
 */
export function verifySendGrid(input: VerifyInput): VerifyOutcome {
  if (!input.secret) return { kind: "missing_secret", provider: "sendgrid" };
  const sig = h(input.headers, "x-twilio-email-event-webhook-signature");
  const ts = h(input.headers, "x-twilio-email-event-webhook-timestamp");
  const missing: string[] = [];
  if (!sig) missing.push("x-twilio-email-event-webhook-signature");
  if (!ts) missing.push("x-twilio-email-event-webhook-timestamp");
  if (missing.length > 0) return { kind: "missing_headers", provider: "sendgrid", missing };

  // Timestamp skew (SendGrid uses unix seconds)
  const ts_num = Number(ts);
  if (!Number.isFinite(ts_num)) return { kind: "malformed", provider: "sendgrid", reason: "timestamp_not_numeric" };
  const now = input.now_seconds ?? Math.floor(Date.now() / 1000);
  const max = input.max_skew_seconds ?? DEFAULT_MAX_SKEW;
  if (Math.abs(now - ts_num) > max) return { kind: "stale_timestamp", provider: "sendgrid", skew_seconds: Math.abs(now - ts_num) };

  // Verify with node:crypto (fail closed on any error)
  try {
    // Lazy-import to keep pure surface (avoid pulling KeyObject at module load)
    const { createPublicKey, verify } = require("node:crypto") as typeof import("node:crypto");
    const key = createPublicKey(String(input.secret));
    const payload = Buffer.from(`${ts}${input.raw_body}`, "utf8");
    const signature = Buffer.from(sig!, "base64");
    const ok = verify(null, payload, key, signature);
    if (ok) return { kind: "verified", provider: "sendgrid", matched_scheme: "ed25519_over_ts_and_body" };
    return { kind: "signature_mismatch", provider: "sendgrid", reason: "ed25519_verify_failed" };
  } catch (e) {
    return { kind: "malformed", provider: "sendgrid", reason: `key_or_signature_error: ${(e as Error).message}` };
  }
}

// ─── Amazon SES via SNS ─────────────────────────────────────────────
/** SNS message signing uses X.509 certificates fetched from
 *  SigningCertURL (an AWS-signed URL under sns.<region>.amazonaws.com).
 *
 *  A full verifier would need to fetch the cert · that is a NETWORK call
 *  which this pure module deliberately refuses to make. Instead we verify
 *  the structural properties that CAN be checked offline · the caller
 *  supplies the trusted signing certificate as `secret` (PEM string).
 *
 *  If the caller has not supplied a cert → missing_secret · never network-fetched here.
 */
export function verifySesSns(input: VerifyInput): VerifyOutcome {
  if (!input.secret) return { kind: "missing_secret", provider: "ses_sns" };
  let msg: any;
  try { msg = JSON.parse(input.raw_body); }
  catch { return { kind: "malformed", provider: "ses_sns", reason: "body_not_json" }; }

  const required = ["Signature", "SigningCertURL", "SignatureVersion", "Type", "MessageId", "Timestamp"];
  const missing = required.filter(k => typeof msg[k] !== "string" || !msg[k]);
  if (missing.length > 0) return { kind: "missing_headers", provider: "ses_sns", missing };

  // Only signature versions 1 and 2 are ever used by SNS
  const version = msg.SignatureVersion;
  if (version !== "1" && version !== "2") {
    return { kind: "malformed", provider: "ses_sns", reason: `unsupported_signature_version:${version}` };
  }

  // Structural: SigningCertURL must be under sns.*.amazonaws.com or sns.*.amazonaws.com.cn
  const url = String(msg.SigningCertURL);
  if (!/^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com(?:\.cn)?\/[a-zA-Z0-9._/-]+\.pem$/i.test(url)) {
    return { kind: "signature_mismatch", provider: "ses_sns", reason: `signing_cert_url_not_aws_sns: ${url.slice(0, 100)}` };
  }

  // Compose canonical string per AWS SNS spec (Notification variant)
  const fields =
    msg.Type === "Notification"
      ? ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"]
      : ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"];
  const parts: string[] = [];
  for (const f of fields) {
    if (typeof msg[f] === "string") {
      parts.push(f);
      parts.push(String(msg[f]));
    }
  }
  const canonical = parts.join("\n") + "\n";

  try {
    const hashAlgo = version === "2" ? "sha256" : "sha1";
    const { createVerify } = require("node:crypto") as typeof import("node:crypto");
    const verifier = createVerify(`RSA-${hashAlgo.toUpperCase()}`);
    verifier.update(canonical, "utf8");
    const ok = verifier.verify(String(input.secret), msg.Signature, "base64");
    if (ok) return { kind: "verified", provider: "ses_sns", matched_scheme: `sns_signature_v${version}_${hashAlgo}` };
    return { kind: "signature_mismatch", provider: "ses_sns", reason: `sns_v${version}_verify_failed` };
  } catch (e) {
    return { kind: "malformed", provider: "ses_sns", reason: `verify_error: ${(e as Error).message}` };
  }
}

// ─── Mailgun (classic HMAC-SHA256 scheme) ───────────────────────────
/** Mailgun payload (JSON) contains `signature: { timestamp, token, signature }`.
 *  Verify: signature == HMAC-SHA256(secret, `${timestamp}${token}`)
 *  Header-based variant also exists · we support both.
 */
export function verifyMailgun(input: VerifyInput): VerifyOutcome {
  if (!input.secret) return { kind: "missing_secret", provider: "mailgun" };

  let ts: string | null = null;
  let token: string | null = null;
  let signature: string | null = null;

  // JSON body variant (post-2020 default)
  try {
    const body = JSON.parse(input.raw_body);
    if (body && body.signature) {
      ts = String(body.signature.timestamp ?? "");
      token = String(body.signature.token ?? "");
      signature = String(body.signature.signature ?? "");
    }
  } catch {
    // Fall through to header variant
  }

  // Header variant fallback
  if (!signature) {
    ts = h(input.headers, "x-mailgun-timestamp");
    token = h(input.headers, "x-mailgun-token");
    signature = h(input.headers, "x-mailgun-signature");
  }

  const missing: string[] = [];
  if (!ts) missing.push("timestamp");
  if (!token) missing.push("token");
  if (!signature) missing.push("signature");
  if (missing.length > 0) return { kind: "missing_headers", provider: "mailgun", missing };

  const ts_num = Number(ts);
  if (!Number.isFinite(ts_num)) return { kind: "malformed", provider: "mailgun", reason: "timestamp_not_numeric" };
  const now = input.now_seconds ?? Math.floor(Date.now() / 1000);
  const max = input.max_skew_seconds ?? DEFAULT_MAX_SKEW;
  if (Math.abs(now - ts_num) > max) return { kind: "stale_timestamp", provider: "mailgun", skew_seconds: Math.abs(now - ts_num) };

  const expected = createHmac("sha256", String(input.secret)).update(`${ts}${token}`).digest("hex");
  if (safeEqualHex(expected, signature!)) {
    return { kind: "verified", provider: "mailgun", matched_scheme: "hmac_sha256_over_timestamp_token" };
  }
  return { kind: "signature_mismatch", provider: "mailgun", reason: "hmac_mismatch" };
}

// ─── Postmark (HMAC-SHA256 over body) ───────────────────────────────
/** Postmark's supported verification: HMAC-SHA256 of the raw body, base64.
 *  Header: `x-postmark-signature`. Some tenants also use HTTP Basic-Auth ·
 *  that is enforced at the endpoint layer · not here. */
export function verifyPostmark(input: VerifyInput): VerifyOutcome {
  if (!input.secret) return { kind: "missing_secret", provider: "postmark" };
  const sig = h(input.headers, "x-postmark-signature");
  if (!sig) return { kind: "missing_headers", provider: "postmark", missing: ["x-postmark-signature"] };
  const expected = createHmac("sha256", String(input.secret)).update(input.raw_body).digest("base64");
  if (safeEqualBase64(expected, sig)) {
    return { kind: "verified", provider: "postmark", matched_scheme: "hmac_sha256_over_body_base64" };
  }
  return { kind: "signature_mismatch", provider: "postmark", reason: "hmac_mismatch" };
}

// ─── Dispatcher (chooses verifier by provider name) ─────────────────
export function verifyProviderWebhook(provider: WebhookProvider, input: VerifyInput): VerifyOutcome {
  switch (provider) {
    case "resend":   return verifyResend(input);
    case "sendgrid": return verifySendGrid(input);
    case "ses_sns":  return verifySesSns(input);
    case "mailgun":  return verifyMailgun(input);
    case "postmark": return verifyPostmark(input);
    default:         return { kind: "malformed", provider, reason: "unknown_provider" };
  }
}

// ─── Structural boundary markers ────────────────────────────────────
export const _VERIFIER_MODULE_HAS_NO_ROUTE_HANDLER = "verifiers_are_pure_functions_no_endpoint_no_listener_exported";
export const _VERIFIER_FAILS_CLOSED_ON_MISSING_SECRET = "no_default_secret_no_bypass_no_test_mode";
export const _VERIFIER_NEVER_NETWORK_FETCHES = "aws_signing_cert_supplied_by_caller_never_fetched_from_url";
export const _VERIFIER_USES_CONSTANT_TIME_COMPARE = "timingSafeEqual_for_all_hmac_digests";
