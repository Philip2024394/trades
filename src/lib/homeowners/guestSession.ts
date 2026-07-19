// Guest SiteBook session — the "let them into the workspace before
// they sign up" pattern.
//
// When a visitor types their SiteBook nickname on the landing and
// clicks "Create my SiteBook", we DON'T force them into a signup
// form. Instead:
//   1. Store the nickname in an httpOnly cookie (`tn_guest_sitebook`)
//   2. Land them at /sitebook — they see the workspace shell with
//      their name at the top, empty state
//   3. The moment they try to do something that requires storage
//      (create project, upload photo, invite a trade), open the
//      "Activate my storage" modal
//   4. Modal collects name/email/password/postcode → creates the real
//      account → migrates the guest cookie into a real session
//
// Cookie lifetime: 24h. If they don't activate within a day, they're
// treated as a new visitor.

import { cookies } from "next/headers";

const COOKIE_NAME = "tn_guest_sitebook";
const TTL_MS      = 24 * 60 * 60 * 1000;   // 24 hours

export type GuestSession = {
  nickname: string;   // The SiteBook name they typed on the landing
  createdAt: number;  // ms epoch — for TTL checks
};

/**
 * Read the guest session from the cookie. Returns null if none or
 * if the cookie has expired (24h TTL — clock is authoritative on
 * the client side since the cookie is decoded server-side).
 */
export async function getGuestSession(): Promise<GuestSession | null> {
  const c   = await cookies();
  const raw = c.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const decoded = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as GuestSession;
    if (typeof decoded.nickname !== "string" || typeof decoded.createdAt !== "number") return null;
    if (Date.now() - decoded.createdAt > TTL_MS) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function setGuestSession(nickname: string): Promise<void> {
  const c        = await cookies();
  const cleaned  = nickname.trim().slice(0, 48);
  if (!cleaned) return;
  const payload  = { nickname: cleaned, createdAt: Date.now() };
  const encoded  = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  c.set(COOKIE_NAME, encoded, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   Math.floor(TTL_MS / 1000)
  });
}

export async function clearGuestSession(): Promise<void> {
  const c = await cookies();
  c.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}
