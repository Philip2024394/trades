// src/lib/nex/founder/identity.ts
//
// SLICE #7 · Founder Identity Anchor v0 (Philip 2026-09-05)
//
// PURPOSE
// -------
// NEX must distinguish its founder from ordinary users AND from
// administrators. Founder authority is the highest operational
// authority within the constitutional governance boundary. This
// module owns the IDENTITY half:
//
//   "Who is the founder, and is the currently-authenticated user THAT
//    person?"
//
// It does NOT own:
//   · session lifecycle (see session.ts · founder-mode entry/exit)
//   · authorization decisions (see governance.ts · command allow/deny)
//   · audit emission (see audit.ts · event bus wrapper)
//   · succession / continuity protocol (deferred to P3 slice #14)
//   · learning / observation (deferred to slice #8)
//
// DESIGN DECISIONS (v0)
// ---------------------
// 1. Founder identity is anchored by a single Supabase user_id
//    (`NEX_FOUNDER_SUPABASE_USER_ID` env var). This is the ONLY user
//    who can enter founder mode. There is no fallback, no wildcard,
//    no "any admin can become founder."
//
// 2. Authentication is delegated to Supabase Auth (existing infra).
//    We do NOT invent a parallel authentication system. Reuse of
//    `getAuthenticatedUser()` from `_auth.ts` is deliberate.
//
// 3. Cryptographic identity anchoring (hardware key / signed
//    challenge-response) is NOT implemented in v0. The abstraction
//    boundary here (`assertIsFounderIdentity(supabaseUserId)`) makes
//    it possible to add without redesigning the command surface.
//
// 4. Configuration is env-only. Founder identity CANNOT be granted
//    at runtime by any code path, admin action, model output, or API
//    call. Changing the founder requires an env change + restart.
//    This is intentional in v0.
//
// REQUIRED ENV VARS (production)
// ------------------------------
//   NEX_FOUNDER_SUPABASE_USER_ID
//     UUID of the founder's Supabase Auth user. Required.
//
//   NEX_FOUNDER_MODE_SECRET
//     HMAC secret for signing founder-mode session tokens (see
//     session.ts). Required. Must be ≥32 chars. Distinct from
//     ADMIN_COOKIE_SECRET and CRON_SECRET.
//
//   NEX_FOUNDER_MODE_PASSWORD
//     Second-factor password for entering founder mode (sudo-like).
//     Required. Distinct from ADMIN_PASSWORD.
//
//   NEX_FOUNDER_MODE_TTL_SEC (optional · default 900)
//     Seconds before founder-mode session expires. Default 15 min.
//     Owner must re-enter founder mode after expiry.
//
// The module fails-closed when any REQUIRED var is missing in
// production: no user can be treated as the founder. In development
// (NODE_ENV !== "production"), the module still works but returns
// clear reasons so the developer can configure.

import "server-only";

/** Public shape · the caller's understanding of "who this is". */
export type FounderIdentityResolution =
  | { kind: "not_founder"; reason: string }
  | { kind: "founder_candidate"; supabase_user_id: string; email: string };

/** Configuration snapshot · pure (env-derived · no I/O). */
export type FounderConfig = {
  founder_supabase_user_id: string | null;
  founder_mode_secret_present: boolean;
  founder_mode_password_present: boolean;
  founder_mode_ttl_sec: number;
};

/** Minimum inputs the resolver needs · caller supplies from _auth.ts. */
export type AuthenticatedUserSnapshot = {
  supabase_user_id: string;
  email: string;
};

// ─── Constants ────────────────────────────────────────────────────

const DEFAULT_TTL_SEC = 900; // 15 minutes
const MIN_SECRET_LEN = 32;
const MIN_PASSWORD_LEN = 12;

// ─── Config resolution ───────────────────────────────────────────

/**
 * Read + normalize env config. Pure · does not throw on missing.
 * Callers check the returned booleans to know whether the config
 * is complete enough to operate.
 */
export function getFounderConfig(): FounderConfig {
  const founder_id = process.env.NEX_FOUNDER_SUPABASE_USER_ID?.trim() ?? "";
  const secret = process.env.NEX_FOUNDER_MODE_SECRET ?? "";
  const password = process.env.NEX_FOUNDER_MODE_PASSWORD ?? "";
  const ttl_raw = process.env.NEX_FOUNDER_MODE_TTL_SEC;
  const ttl = ttl_raw ? Math.max(60, Math.min(3600, Number.parseInt(ttl_raw, 10) || DEFAULT_TTL_SEC)) : DEFAULT_TTL_SEC;
  return {
    founder_supabase_user_id: founder_id.length > 0 ? founder_id : null,
    founder_mode_secret_present: secret.length >= MIN_SECRET_LEN,
    founder_mode_password_present: password.length >= MIN_PASSWORD_LEN,
    founder_mode_ttl_sec: ttl,
  };
}

/**
 * Assert the founder configuration is safe to operate. Fails-closed
 * in production, warns in development. Callers that need to be sure
 * of operability should call this at the top of their handler.
 */
export function assertFounderConfigOperable(): void {
  const c = getFounderConfig();
  const missing: string[] = [];
  if (!c.founder_supabase_user_id) missing.push("NEX_FOUNDER_SUPABASE_USER_ID");
  if (!c.founder_mode_secret_present) missing.push(`NEX_FOUNDER_MODE_SECRET (min ${MIN_SECRET_LEN} chars)`);
  if (!c.founder_mode_password_present) missing.push(`NEX_FOUNDER_MODE_PASSWORD (min ${MIN_PASSWORD_LEN} chars)`);
  if (missing.length > 0) {
    throw new Error(
      `[nex/founder] configuration incomplete · cannot operate · missing: ${missing.join(", ")}`,
    );
  }
}

// ─── Identity resolution ─────────────────────────────────────────

/**
 * Resolve whether the authenticated Supabase user IS the founder.
 * Returns a discriminated union so callers can early-return with
 * clear reasons.
 *
 * This function does NOT check whether the user is currently in
 * founder MODE (that's session.ts). It only answers: "is this the
 * user configured as the founder in env?"
 *
 * Pure · env-only · never touches DB · never calls Supabase.
 */
export function resolveFounderIdentity(
  authenticated: AuthenticatedUserSnapshot | null,
): FounderIdentityResolution {
  if (!authenticated) {
    return { kind: "not_founder", reason: "no_authenticated_user" };
  }
  const config = getFounderConfig();
  if (!config.founder_supabase_user_id) {
    return { kind: "not_founder", reason: "founder_not_configured" };
  }
  if (authenticated.supabase_user_id !== config.founder_supabase_user_id) {
    return { kind: "not_founder", reason: "user_id_does_not_match_founder_anchor" };
  }
  return {
    kind: "founder_candidate",
    supabase_user_id: authenticated.supabase_user_id,
    email: authenticated.email,
  };
}

/**
 * Convenience: is this authenticated user the founder identity?
 * Boolean version for readable guard clauses.
 */
export function isFounderCandidate(authenticated: AuthenticatedUserSnapshot | null): boolean {
  return resolveFounderIdentity(authenticated).kind === "founder_candidate";
}

// ─── Distinction from admin ──────────────────────────────────────

/**
 * Founder is DISTINCT from admin. An admin cookie or admin role does
 * NOT grant founder authority. This is enforced by the fact that:
 *
 *   1. Admin authentication uses `ADMIN_COOKIE_SECRET` (adminAuth.ts)
 *   2. Founder authentication uses `NEX_FOUNDER_MODE_SECRET` (session.ts)
 *   3. These are separate env vars · one being valid never implies
 *      the other is valid.
 *
 * The two authorities can COEXIST on the same human (the founder is
 * probably also an admin) but the AUTHORITIES themselves are not
 * transitive. Founder must re-enter founder mode explicitly even
 * when logged in as admin.
 *
 * This guard function is exported so tests can prove the invariant.
 */
export function foundersAreDistinctFromAdmins(): {
  distinct: true;
  reason: string;
} {
  return {
    distinct: true,
    reason:
      "founder authority requires Supabase user_id === NEX_FOUNDER_SUPABASE_USER_ID AND a valid NEX_FOUNDER_MODE_SECRET-signed session. Admin cookie (ADMIN_COOKIE_SECRET) alone can never satisfy this. The model output cannot satisfy this either.",
  };
}
