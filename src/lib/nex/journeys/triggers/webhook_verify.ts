// NEX Journey Engine · custom webhook signature verification
//
// Provider webhooks (SendGrid/Mailgun/etc) each have their own
// verification path. Custom journey webhooks use ONE of two schemes,
// chosen per journey_triggers.trigger_config:
//
//   { auth: "hmac"       · secret: "…" }   HMAC-SHA256(raw_body, secret) compared to X-NEX-Signature
//   { auth: "basic"      · user: "…" · pass: "…" }  HTTP Basic Auth
//
// If no auth is configured on a trigger we STILL record the inbound
// event (charter §11.5) but leave verified_signature=false and the
// evaluator will skip it.

import { createHmac, timingSafeEqual } from "crypto";

export type VerifyResult = { verified: boolean; algorithm: string | null; reason?: string };

export async function verifyCustomWebhook(headers: Headers, rawBody: string, cfg: { auth?: "hmac" | "basic"; secret?: string; user?: string; pass?: string }): Promise<VerifyResult> {
  if (!cfg.auth) return { verified: false, algorithm: null, reason: "no auth configured on trigger" };

  if (cfg.auth === "hmac") {
    if (!cfg.secret) return { verified: false, algorithm: "hmac-sha256", reason: "secret missing" };
    const sig = headers.get("x-nex-signature") ?? "";
    if (!sig) return { verified: false, algorithm: "hmac-sha256", reason: "X-NEX-Signature header missing" };
    const expected = createHmac("sha256", cfg.secret).update(rawBody).digest("hex");
    if (safeEqualHex(expected, sig)) return { verified: true, algorithm: "hmac-sha256" };
    return { verified: false, algorithm: "hmac-sha256", reason: "signature mismatch" };
  }

  if (cfg.auth === "basic") {
    if (!cfg.user || !cfg.pass) return { verified: false, algorithm: "basic-auth", reason: "user/pass missing" };
    const auth = headers.get("authorization") ?? "";
    if (!auth.toLowerCase().startsWith("basic ")) return { verified: false, algorithm: "basic-auth", reason: "no basic header" };
    const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return { verified: false, algorithm: "basic-auth", reason: "malformed header" };
    const gotUser = decoded.slice(0, idx); const gotPass = decoded.slice(idx + 1);
    if (safeEqualStr(gotUser, cfg.user) && safeEqualStr(gotPass, cfg.pass)) return { verified: true, algorithm: "basic-auth" };
    return { verified: false, algorithm: "basic-auth", reason: "credentials mismatch" };
  }

  return { verified: false, algorithm: null, reason: `unknown auth scheme ${cfg.auth}` };
}

function safeEqualHex(a: string, b: string): boolean {
  try { const ba = Buffer.from(a, "hex"); const bb = Buffer.from(b, "hex"); if (ba.length === 0 || ba.length !== bb.length) return false; return timingSafeEqual(ba, bb); }
  catch { return false; }
}
function safeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a); const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

// Redact sensitive headers before persisting to the audit table (charter §11.5).
export function redactHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === "authorization" || k === "cookie" || k === "x-nex-signature") {
      out[k] = "***redacted***";
    } else {
      out[k] = value;
    }
  });
  return out;
}
