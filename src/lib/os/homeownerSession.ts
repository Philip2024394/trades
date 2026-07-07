// OS Foundation — Homeowner session.
//
// Homeowners log in via magic link. We look them up by email in the
// os_parties table (they'll have been auto-created if they've used
// AI Visualiser). A signed HMAC cookie carries their party_id + issue
// time. Sessions expire after 30 days.
//
// Not merchant auth — merchants use loadStudioSession() elsewhere.
// This is specifically the identity for people using /home.
import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getPartyById } from "@/lib/os/parties";
import type { PartyRecord } from "@/lib/os/parties";

export const HOMEOWNER_COOKIE = "xrated_home_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const MAGIC_LINK_TTL_SECONDS = 60 * 30; // 30 minutes

function secret(): string {
  const s = process.env.HOMEOWNER_COOKIE_SECRET;
  if (!s || s.length < 24) {
    throw new Error(
      "HOMEOWNER_COOKIE_SECRET must be at least 24 chars"
    );
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

// -------------------------------------------------------------------
// Session cookie (long-lived, HMAC-signed)
//   value = partyId.issuedAt.sig
// -------------------------------------------------------------------
export function buildSessionCookie(partyId: string): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `${partyId}.${issuedAt}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifySessionCookie(
  value: string | undefined | null
): { partyId: string } | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [partyId, issuedAtStr, sig] = parts;
  if (!partyId || !issuedAtStr || !sig) return null;
  const payload = `${partyId}.${issuedAtStr}`;
  const expected = sign(payload);
  if (!safeEqual(sig, expected)) return null;
  const issuedAt = parseInt(issuedAtStr, 10);
  if (!Number.isFinite(issuedAt)) return null;
  const ageSeconds = Math.floor(Date.now() / 1000) - issuedAt;
  if (ageSeconds > COOKIE_MAX_AGE_SECONDS) return null;
  return { partyId };
}

export const HOMEOWNER_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: COOKIE_MAX_AGE_SECONDS
};

// -------------------------------------------------------------------
// Magic link — short-lived, single-use-ish (TTL-bound, no server store)
//   token = partyId.expiresAt.nonce.sig
// -------------------------------------------------------------------
export function buildMagicLinkToken(partyId: string): string {
  const expiresAt =
    Math.floor(Date.now() / 1000) + MAGIC_LINK_TTL_SECONDS;
  const nonce = randomBytes(8).toString("hex");
  const payload = `${partyId}.${expiresAt}.${nonce}`;
  const sig = sign(`ml:${payload}`);
  return `${payload}.${sig}`;
}

export function verifyMagicLinkToken(
  token: string
): { partyId: string } | { error: string } {
  const parts = token.split(".");
  if (parts.length !== 4) return { error: "invalid" };
  const [partyId, expiresAtStr, nonce, sig] = parts;
  if (!partyId || !expiresAtStr || !nonce || !sig)
    return { error: "invalid" };
  const payload = `${partyId}.${expiresAtStr}.${nonce}`;
  if (!safeEqual(sig, sign(`ml:${payload}`))) return { error: "bad-signature" };
  const expiresAt = parseInt(expiresAtStr, 10);
  if (!Number.isFinite(expiresAt)) return { error: "invalid" };
  if (Math.floor(Date.now() / 1000) > expiresAt) return { error: "expired" };
  return { partyId };
}

// -------------------------------------------------------------------
// Session resolution helpers for server components
// -------------------------------------------------------------------
export async function loadHomeownerSession(): Promise<PartyRecord | null> {
  const jar = await cookies();
  const raw = jar.get(HOMEOWNER_COOKIE)?.value;
  const verified = verifySessionCookie(raw);
  if (!verified) return null;
  return getPartyById(verified.partyId);
}

export async function requireHomeownerSession(): Promise<PartyRecord> {
  const session = await loadHomeownerSession();
  if (!session) {
    throw new Error("Not authenticated");
  }
  return session;
}
