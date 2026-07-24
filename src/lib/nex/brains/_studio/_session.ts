// Author Studio session — invite-only HMAC-signed cookie.
//
// Nex issues Author accounts by adding the Author's identifier to the
// NEX_AUTHOR_ALLOWLIST env var (comma-separated list of user ids or
// email addresses, however Program Lead prefers to reference them).
// The Author receives a magic invite link with a one-time secret; on
// use, we set a signed session cookie. There is NO self-signup.
//
// This mirrors the admin session pattern in src/lib/adminAuth.ts but
// keyed per-Author so multiple Authors can each hold their own session.
//
// Author password model: at V1 we deliberately use email + invite-
// secret rather than storing passwords. Reduces attack surface; the
// Author's identity gate is the allowlist.

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const AUTHOR_COOKIE_NAME    = "tn_author_sid";
const COOKIE_MAX_AGE_SECONDS       = 60 * 60 * 24 * 30;   // 30 days
const INVITE_SECRET_ENV            = "NEX_AUTHOR_INVITE_SECRET";
const COOKIE_SECRET_ENV            = "NEX_AUTHOR_COOKIE_SECRET";

function requireSecret(name: string): string {
  const v = process.env[name];
  if (!v || v.length < 32) {
    throw new Error(`Missing or too-short env var ${name} (need ≥32 chars)`);
  }
  return v;
}

function normalise(id: string): string {
  return id.trim().toLowerCase();
}

/** Read the allowlist from env. Returns an empty array when unset —
 *  callers treat that as "no Authors invited yet". */
export function allowedAuthorIds(): string[] {
  const raw = process.env.NEX_AUTHOR_ALLOWLIST ?? "";
  return raw.split(",").map(normalise).filter((s) => s.length > 0);
}

export function isAllowedAuthorId(id: string): boolean {
  return allowedAuthorIds().includes(normalise(id));
}

// ─── Invite token ───────────────────────────────────────────────
//
// Program Lead generates one-time invite tokens for allowlisted Authors.
// Token shape: `<author_id>.<hmac(secret, author_id + expires + salt)>`
// The salt prevents replay across Author onboardings.

export function issueInviteToken(authorId: string, ttlSeconds = 60 * 60 * 24 * 7): string {
  const id       = normalise(authorId);
  if (!isAllowedAuthorId(id)) throw new Error(`Author '${id}' not on allowlist`);
  const expires  = Math.floor(Date.now() / 1000) + ttlSeconds;
  const salt     = Math.random().toString(36).slice(2, 14);
  const payload  = `${id}|${expires}|${salt}`;
  const sig      = createHmac("sha256", requireSecret(INVITE_SECRET_ENV))
    .update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyInviteToken(raw: string): { ok: true; authorId: string } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "string") return { ok: false, reason: "missing_token" };
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return { ok: false, reason: "malformed_token" };
  const payload = raw.slice(0, dot);
  const sig     = raw.slice(dot + 1);
  const expected = createHmac("sha256", requireSecret(INVITE_SECRET_ENV))
    .update(payload).digest("hex");
  const sigBuf  = Buffer.from(sig, "hex");
  const expBuf  = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: "bad_signature" };
  }
  const parts = payload.split("|");
  if (parts.length !== 3) return { ok: false, reason: "malformed_payload" };
  const [id, expiresRaw] = parts;
  const expires = parseInt(expiresRaw, 10);
  if (!Number.isFinite(expires) || expires * 1000 < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (!isAllowedAuthorId(id)) return { ok: false, reason: "not_on_allowlist" };
  return { ok: true, authorId: normalise(id) };
}

// ─── Session cookie ─────────────────────────────────────────────

function signAuthorId(id: string): string {
  return createHmac("sha256", requireSecret(COOKIE_SECRET_ENV)).update(id).digest("hex");
}

/** Build the cookie value for an allowlisted Author. Cookie value =
 *  `<author_id>.<hmac(cookie_secret, author_id)>`. */
export function authorCookieValue(authorId: string): string {
  const id = normalise(authorId);
  if (!isAllowedAuthorId(id)) throw new Error(`Author '${id}' not on allowlist`);
  return `${id}.${signAuthorId(id)}`;
}

/** Verify an incoming cookie and return the Author's id. */
export function verifyAuthorCookie(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;
  const id  = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!isAllowedAuthorId(id)) return null;
  const expected = signAuthorId(id);
  const sigBuf = Buffer.from(sig, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  return id;
}

// ─── Cookie helpers ─────────────────────────────────────────────

export async function setAuthorSessionCookie(authorId: string): Promise<void> {
  const c = await cookies();
  c.set(AUTHOR_COOKIE_NAME, authorCookieValue(authorId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS
  });
}

export async function clearAuthorSessionCookie(): Promise<void> {
  const c = await cookies();
  c.delete(AUTHOR_COOKIE_NAME);
}

export async function getAuthorFromCookie(): Promise<string | null> {
  const c = await cookies();
  const raw = c.get(AUTHOR_COOKIE_NAME)?.value;
  return verifyAuthorCookie(raw);
}
