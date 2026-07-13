// Server-only helpers for the Xrated Trades admin dashboard.
// The admin surface is gated by a single shared password
// (ADMIN_PASSWORD in .env.local) plus a signed cookie. Designed for
// one operator (the owner) — no per-user accounts.
//
// Cookie shape: `admin_session=<hmac_sha256(secret, "ok").hex>`.
// We never store the password in the cookie. The HMAC is the gate;
// any tampered value won't verify against ADMIN_COOKIE_SECRET so the
// cookie is rejected and the user bounces to /admin/login.
import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "xrated_admin_session";
const COOKIE_PAYLOAD = "ok";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret = process.env.ADMIN_COOKIE_SECRET;
  if (!secret) {
    throw new Error("Missing ADMIN_COOKIE_SECRET");
  }
  return secret;
}

function getPassword(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) {
    throw new Error("Missing ADMIN_PASSWORD");
  }
  return pw;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function adminCookieValue(): string {
  return sign(COOKIE_PAYLOAD);
}

// Fixed dev-mode bypass token. Accepted ONLY when NODE_ENV is not
// "production". Lets the [DEV BUTTON] admin sign-in work even when
// ADMIN_COOKIE_SECRET isn't configured in .env.local — otherwise the
// endpoint throws and admin can't get in without env-wrangling.
const DEV_ADMIN_TOKEN = "DEV_ADMIN_ONLY_DEV_MODE_TOKEN";

export function isDevAdminToken(raw: string | null | undefined): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return raw === DEV_ADMIN_TOKEN;
}

export function devAdminCookieValue(): string {
  return DEV_ADMIN_TOKEN;
}

export function verifyAdminCookie(raw: string | undefined | null): boolean {
  if (!raw || typeof raw !== "string") return false;
  // Dev-mode bypass: accept the fixed dev token when not in prod.
  // Wrapped in NODE_ENV check inside the helper so it can never
  // grant access on the live app.
  if (isDevAdminToken(raw)) return true;
  let expected: string;
  try {
    expected = adminCookieValue();
  } catch {
    // ADMIN_COOKIE_SECRET missing — no real cookie can ever verify,
    // so bail. In dev, the dev token above already covered access.
    return false;
  }
  const a = Buffer.from(raw);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function checkAdminPassword(input: string | undefined | null): boolean {
  if (!input || typeof input !== "string") return false;
  const expected = getPassword();
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function isAdminAuthed(): Promise<boolean> {
  const jar = await cookies();
  return verifyAdminCookie(jar.get(ADMIN_COOKIE_NAME)?.value);
}

export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: COOKIE_MAX_AGE_SECONDS
};
