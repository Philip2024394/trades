// storeMagicLink — HMAC-signed re-entry token for members who've
// cleared their cookies / are on a new device.
//
// Token shape:  <email-base64>.<issuedAtMs>.<hmac16>
// Verification: recompute hmac + ensure age <= 15 min.
// No DB row — the token is fully self-contained.

import "server-only";
import crypto from "node:crypto";

const MAX_AGE_MS = 15 * 60 * 1000;
const SECRET = () =>
  process.env.STORE_MAGIC_LINK_SECRET
  ?? process.env.STORE_MEMBER_COOKIE_SECRET
  ?? process.env.HMAC_SECRET
  ?? "dev-only-fallback-secret-do-not-use-in-prod";

function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}
function unb64url(s: string): string {
  try { return Buffer.from(s, "base64url").toString("utf8"); }
  catch { return ""; }
}
function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET()).update(payload).digest("hex").slice(0, 16);
}

export function mintMagicToken(email: string): string {
  const clean = email.toLowerCase().trim();
  const issued = Date.now();
  const payload = `${b64url(clean)}.${issued}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyMagicToken(token: string): { email: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encEmail, iat, sig] = parts;
  const expected = sign(`${encEmail}.${iat}`);
  if (sig !== expected) return null;
  const email = unb64url(encEmail);
  const issuedAt = Number(iat);
  if (!email || !Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > MAX_AGE_MS) return null;
  return { email };
}
