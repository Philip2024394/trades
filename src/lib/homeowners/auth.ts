// SiteBook — homeowner auth helpers.
//
// Simple email+password model with rotating session tokens stored in
// httpOnly cookies. Same shape as merchant auth to keep the mental
// model consistent. Not a full OIDC — deliberate: reduces friction
// and stays within the platform's existing pattern.
//
// Session lifecycle:
//   signup / login → generate 32-char token → store on homeowner row
//     + set httpOnly cookie 'tn_homeowner_sid' (SameSite=Lax, 30d)
//   getHomeownerFromCookie() reads cookie + looks up homeowner
//   logout() clears cookie + nulls session_token on row
//
// Passwords: hashed with bcryptjs (already in the project — used by
// merchant auth). See migration 20260628110000_xrated_password_auth.sql
// for the equivalent merchant flow.

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Homeowner } from "./types";
import { baseSlugFromNickname, reserveHomeownerSlug } from "./slug";

const COOKIE_NAME     = "tn_homeowner_sid";
const SESSION_TTL_MS  = 30 * 24 * 60 * 60 * 1000;   // 30 days
const BCRYPT_ROUNDS   = 10;

export type SignupInput = {
  email:          string;
  password:       string;
  firstName:      string;
  postcode?:      string;
  city?:          string;
  whatsappNumber?: string;
  houseNickname?: string;
};

export type LoginInput = {
  email:    string;
  password: string;
};

function generateSessionToken(): string {
  const rand = () => Math.random().toString(36).slice(2);
  return `hs_${(rand() + rand() + rand()).slice(0, 40)}`;
}

async function setSessionCookie(token: string) {
  const c = await cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   Math.floor(SESSION_TTL_MS / 1000)
  });
}

async function clearSessionCookie() {
  const c = await cookies();
  c.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function signupHomeowner(input: SignupInput): Promise<{ ok: true; homeowner: Homeowner } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "invalid-email" };
  }
  if (!input.password || input.password.length < 8) {
    return { ok: false, error: "password-too-short" };
  }
  if (!input.firstName?.trim()) {
    return { ok: false, error: "missing-first-name" };
  }

  // House nickname is now REQUIRED — becomes the SiteBook URL slug
  const nickname = input.houseNickname?.trim().slice(0, 48);
  if (!nickname) {
    return { ok: false, error: "missing-nickname" };
  }

  // Uniqueness check
  const existing = await supabaseAdmin
    .from("hammerex_homeowners")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing.data) return { ok: false, error: "email-in-use" };

  // Generate a URL-safe slug from the nickname
  const baseSlug = baseSlugFromNickname(nickname);
  const slug     = await reserveHomeownerSlug(baseSlug);

  const passwordHash  = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const sessionToken  = generateSessionToken();
  const sessionExpiry = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const ins = await supabaseAdmin
    .from("hammerex_homeowners")
    .insert({
      email,
      password_hash:      passwordHash,
      first_name:         input.firstName.trim(),
      whatsapp_number:    input.whatsappNumber?.trim() || null,
      postcode:           input.postcode?.trim().toUpperCase() || null,
      city:               input.city?.trim() || null,
      house_nickname:     nickname,
      slug,
      session_token:      sessionToken,
      session_expires_at: sessionExpiry
    })
    .select("*")
    .single();

  if (ins.error || !ins.data) {
    return { ok: false, error: "signup-failed" };
  }

  await setSessionCookie(sessionToken);
  return { ok: true, homeowner: ins.data as Homeowner };
}

export async function loginHomeowner(input: LoginInput): Promise<{ ok: true; homeowner: Homeowner } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) return { ok: false, error: "missing-credentials" };

  const res = await supabaseAdmin
    .from("hammerex_homeowners")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (!res.data) return { ok: false, error: "invalid-credentials" };

  const homeowner = res.data as Homeowner;
  if (!homeowner.password_hash) return { ok: false, error: "invalid-credentials" };

  const valid = await bcrypt.compare(input.password, homeowner.password_hash);
  if (!valid) return { ok: false, error: "invalid-credentials" };

  const sessionToken  = generateSessionToken();
  const sessionExpiry = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  await supabaseAdmin
    .from("hammerex_homeowners")
    .update({
      session_token:      sessionToken,
      session_expires_at: sessionExpiry
    })
    .eq("id", homeowner.id);

  await setSessionCookie(sessionToken);
  return { ok: true, homeowner: { ...homeowner, session_token: sessionToken } as Homeowner };
}

export async function logoutHomeowner(): Promise<void> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (token) {
    await supabaseAdmin
      .from("hammerex_homeowners")
      .update({ session_token: null, session_expires_at: null })
      .eq("session_token", token);
  }
  await clearSessionCookie();
}

/**
 * Read the current homeowner from the cookie. Returns null if:
 *   - no cookie
 *   - cookie doesn't match a row
 *   - session expired
 */
export async function getHomeownerFromCookie(): Promise<Homeowner | null> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const res = await supabaseAdmin
    .from("hammerex_homeowners")
    .select("*")
    .eq("session_token", token)
    .maybeSingle();

  if (!res.data) return null;
  const h = res.data as Homeowner;
  if (h.session_expires_at && new Date(h.session_expires_at).getTime() < Date.now()) {
    return null;
  }
  return h;
}

export async function isHomeownerAuthed(): Promise<boolean> {
  return (await getHomeownerFromCookie()) !== null;
}
