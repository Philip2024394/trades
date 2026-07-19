// storeMemberSession — Site Interest membership cookie helpers.
//
// After a successful subscription checkout, /store/membership-success
// issues a signed cookie carrying the buyer email. Every store
// download endpoint checks the cookie → looks up the membership by
// email → allows free download if status = 'active' and not past
// current_period_end.
//
// Uses HMAC-SHA256 with STORE_MEMBER_COOKIE_SECRET (fallback to a
// dev default in local — not for prod). Cookie is httpOnly, 30-day.

import "server-only";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabaseAdmin";

const COOKIE     = "si-member";
const MAX_AGE_S  = 30 * 24 * 60 * 60;
const SECRET     = () => process.env.STORE_MEMBER_COOKIE_SECRET
  ?? process.env.HMAC_SECRET
  ?? "dev-only-fallback-secret-do-not-use-in-prod";

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET()).update(payload).digest("hex").slice(0, 32);
}
function pack(email: string, issuedAt: number): string {
  const payload = `${email}:${issuedAt}`;
  return `${payload}:${sign(payload)}`;
}
function unpack(raw: string): { email: string; issuedAt: number } | null {
  const parts = raw.split(":");
  if (parts.length !== 3) return null;
  const [email, iat, sig] = parts;
  const expected = sign(`${email}:${iat}`);
  if (sig !== expected) return null;
  const issuedAt = Number(iat);
  if (!Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > MAX_AGE_S * 1000) return null;
  return { email, issuedAt };
}

/** Server action helper — set the cookie on a Response. Callers
 *  route through the App-Router cookies() API to do this. */
export async function setMemberCookie(email: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, pack(email.toLowerCase().trim(), Date.now()), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   MAX_AGE_S,
    path:     "/"
  });
}

export async function clearMemberCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Read the current member email from the cookie (server-side).
 *  Returns null if cookie missing / invalid / stale. */
export async function currentMemberEmail(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const parsed = unpack(raw);
  return parsed?.email ?? null;
}

/** Read from a NextRequest (for API route handlers). */
export function memberEmailFromRequest(req: NextRequest | Request): string | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${COOKIE}=`));
  if (!match) return null;
  const raw = decodeURIComponent(match.slice(COOKIE.length + 1));
  return unpack(raw)?.email ?? null;
}

/** Is this email an active member right now? Checks status='active'
 *  AND current_period_end in the future. */
export async function isActiveMember(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const res = await supabaseAdmin
    .from("hammerex_store_memberships")
    .select("id, current_period_end")
    .eq("email",  email.toLowerCase().trim())
    .eq("status", "active")
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (res.error || !res.data) return false;
  const end = res.data.current_period_end ? new Date(res.data.current_period_end as string) : null;
  if (!end) return true; // active without an end date = valid
  return end.getTime() > Date.now();
}
