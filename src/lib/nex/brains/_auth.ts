// src/lib/nex/brains/_auth.ts
//
// D1 · Server-side auth helper for admin mutation routes (Philip 2026-07-28)
//
// Flow:
//   1. Read Supabase Auth session from request cookies (@supabase/ssr)
//   2. Look up NexUser by supabase_user_id in hammerex_nex_users
//   3. Validate status='active'
//   4. Return validated identity for mutation routes
//
// This module owns the AUTHENTICATION half (identity: who is this?).
// The AUTHORIZATION half (what are they allowed to do?) lives on the
// NexUser row and is enforced by the caller (mutation routes, F6
// separation of duties, publish acceptance test).
//
// The Phase 1 env-allowlist path is retained only for
// NEX_DEV_AUTH_BYPASS=1 (local iteration). Production runs against
// real Supabase Auth sessions.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NexUserRow } from "./_living_types";
import { brainSupabase } from "./_supabase";

export type AuthenticatedUser = {
  supabase_user_id: string;
  email: string;
  nex_user: NexUserRow;
  session_id: string | null;
  aal: "aal1" | "aal2" | null;      // Supabase Auth authenticator assurance level
  session_used_mfa: boolean;         // true iff aal === 'aal2'
};

export type AuthResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; error: string; status: number };

/**
 * Read the current authenticated user from cookies + resolve to NexUser.
 *
 * Returns a tagged union so callers can early-return the right HTTP
 * status without exception handling. Never throws for a merely-missing
 * session — that's just `ok: false, status: 401`.
 */
export async function getAuthenticatedUser(): Promise<AuthResult> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      ok: false,
      status: 500,
      error: "server_misconfigured · SUPABASE_URL / SUPABASE_ANON_KEY not set",
    };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Route handlers cannot set cookies via this path — refresh
        // rotation happens on the client + middleware. This is a no-op
        // by design; do NOT throw.
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Silently ignore — route handlers may be called in contexts
          // where cookie mutation is not allowed.
        }
      },
    },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, status: 401, error: "no_active_session" };
  }

  // Pull the session for aal (MFA-completion) status. getUser() re-verifies
  // the JWT against Supabase; getSession() returns the raw session for
  // aal claim extraction.
  const { data: { session } } = await supabase.auth.getSession();
  let aal: "aal1" | "aal2" | null = null;
  if (session?.access_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(session.access_token.split(".")[1], "base64").toString()
      );
      aal = (payload.aal === "aal2" ? "aal2" : "aal1");
    } catch {
      // Malformed JWT · leave aal null → treated as no-MFA
    }
  }

  // Look up NexUser via service-role client
  const sb = brainSupabase();
  if (!sb) {
    return {
      ok: false,
      status: 500,
      error: "server_misconfigured · service role client unavailable for NexUser lookup",
    };
  }

  const { data: nexUser, error: nexError } = await sb
    .from("hammerex_nex_users")
    .select("*")
    .eq("supabase_user_id", user.id)
    .maybeSingle();

  if (nexError) {
    return {
      ok: false,
      status: 500,
      error: `nex_user_lookup_failed: ${nexError.message}`,
    };
  }

  if (!nexUser) {
    return {
      ok: false,
      status: 403,
      error: "authenticated_but_no_nex_user · your Supabase account is not authorised for the Living Brain platform · contact an admin to add a hammerex_nex_users row",
    };
  }

  const typed = nexUser as NexUserRow;

  if (typed.status !== "active") {
    return {
      ok: false,
      status: 403,
      error: `user_status_${typed.status} · account not currently permitted to perform this action`,
    };
  }

  return {
    ok: true,
    user: {
      supabase_user_id: user.id,
      email: user.email ?? typed.email,
      nex_user: typed,
      session_id: null,
      aal,
      session_used_mfa: aal === "aal2",
    },
  };
}

/**
 * Convenience helper for mutation routes: `await requireAuth()` returns
 * either the user or throws with a specific HTTP response.
 * Prefer `getAuthenticatedUser()` for explicit tagged-union handling.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const result = await getAuthenticatedUser();
  if (!result.ok) {
    const err = new Error(result.error) as Error & { status: number };
    err.status = result.status;
    throw err;
  }
  return result.user;
}
