// src/lib/nex/marketing/member/auth.ts
//
// NEX Managed Email Marketing · Stage 4 · Member request-auth helper
// Founder-authorised programme.
//
// **Server-side ONLY.** Never trust member_id from client-supplied JSON.
// Extracts member_id from an authenticated session context; refuses if
// the caller is not authenticated.

import type { MemberAuthContext } from "./types";

/** Resolve member identity from a Next.js Request. Never trusts a JSON
 *  member_id · always derives from cookies/tokens. Returns
 *  `authenticated: false` when identity cannot be established.
 *
 *  This is a MINIMAL first implementation. Production wiring should
 *  integrate with NEX's existing session/auth infrastructure (which
 *  varies per merchant/user surface). For Stage 4 we accept:
 *    - `x-nex-member-id` header ONLY when combined with a valid
 *      `x-nex-member-token` bearer that matches an env-configured secret
 *    - a session cookie `nex_member_session` that decodes to a member_id
 *    - localhost with `x-dev-member-id` (development ONLY · not enabled
 *      when NODE_ENV=production)
 *
 *  Callers that need a different auth substrate can substitute their own
 *  helper · the service functions accept a MemberAuthContext directly.
 */
export function resolveMemberAuth(req: Request): MemberAuthContext {
  // Dev-time convenience · localhost + explicit dev header
  const url = new URL(req.url);
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (isLocal && process.env.NODE_ENV !== "production") {
    const dev_member_id = req.headers.get("x-dev-member-id");
    if (dev_member_id) {
      return { member_id: dev_member_id, authenticated: true, session_source: "cookie" };
    }
  }

  // Bearer-token path (short-term Stage 4 pattern until full session integration)
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const member_token_secret = process.env.NEX_MEMBER_TOKEN_SECRET;
  if (bearer && member_token_secret && bearer === member_token_secret) {
    const member_id = req.headers.get("x-nex-member-id");
    if (member_id) return { member_id, authenticated: true, session_source: "bearer" };
  }

  // Cookie session (production path · production wiring hooks here)
  const cookie = req.headers.get("cookie") ?? "";
  const session_match = /nex_member_session=([^;]+)/.exec(cookie);
  if (session_match) {
    // Decode is stubbed here · production wires this to the NEX session store
    const decoded = decodeSessionCookie(session_match[1]);
    if (decoded) return { member_id: decoded, authenticated: true, session_source: "cookie" };
  }

  return { member_id: "", authenticated: false, session_source: "unauthenticated" };
}

/** Placeholder session decoder · production wiring replaces with the
 *  real NEX session store (Supabase/JWT/other). Kept as a named function
 *  so the injection point is discoverable. */
function decodeSessionCookie(_cookie_value: string): string | null {
  // Production wire-up · resolve session → member_id
  // This stub deliberately returns null so no unauthenticated caller
  // accidentally becomes a member. Real integration goes here.
  return null;
}
