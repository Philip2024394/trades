// src/lib/nex-native/first-conversation/reset-cover-continuity.ts
//
// Bridge 99 · Stage 4e · "Start fresh on Covers" continuity reset.
// -----------------------------------------------------------------------------
// Sealed doctrine reference:
//   docs/doctrine/bridge-99-first-conversation-principle-plan-2026-09-30.md
//   §7 Cookie contract · server-side revocation MUST operate on session_id
//   (not on account). Founder-sealed 2026-09-30 · baseline 6566ace3.
//
// User-facing label: "Start fresh on Covers"
// Internal route path: /api/nex-native/session/reset-cover-continuity
//
// Scope (Stage 4e):
//   · Explicit user-requested reset of the current nex_session cookie.
//   · Revokes ONLY the presented session_id in nex_session_registry.
//   · Clears the client-side cookie with matching Domain/Path so the
//     browser drops it.
//   · Idempotent: safe to call when there is no cookie, when the cookie
//     is malformed, expired, or already revoked. Never throws for those
//     states · they are all legitimate outcomes of the reset intent.
//
// Founder-mandated invariants:
//   · Revocation is session-specific (never account-wide). A different
//     session belonging to the same account MUST remain valid after
//     reset — proved by an integration test.
//   · The 'none' outcome (no cookie, invalid cookie, already-revoked
//     session) is NOT an error. The route returns success with
//     reset:false and a descriptive reason. Callers can treat any
//     success response as "the browser now has no valid nex_session."
//   · This module does NOT touch nex_account, nex_peer_conversation,
//     nex_peer_message, nex_welcome_outbox, or nex_account_risk_signal.
//     Structural test enforces this.
//   · Bridge 62 inline welcome path is unrelated · unchanged.

import "server-only";
import {
  readAndVerifyNexSessionCookie,
  clearNexSessionCookie,
  type NexCookieAdapter,
  type NexSessionCookieConfig,
} from "./session-cookie";
import {
  checkSessionValidity,
  revokeSession,
} from "./session-registry-service";
import type { NexSessionCryptoConfig } from "./session-crypto";

// ---------------------------------------------------------------------------
// Result union
// ---------------------------------------------------------------------------

export type ResetCoverContinuityResult =
  | {
      reset: true;
      session_id: string;
      account_id: string;
    }
  | {
      reset: false;
      reason: "no_session_to_reset" | "invalid_cookie_cleared";
    };

// ---------------------------------------------------------------------------
// Dependencies (deterministic, injectable for tests)
// ---------------------------------------------------------------------------

export interface ResetCoverContinuityDeps {
  cookieAdapter: NexCookieAdapter;
  cookieCfg: NexSessionCookieConfig;
  cryptoCfg: NexSessionCryptoConfig;
  now_ms?: number;
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Perform the reset. Sequence:
 *
 *   1. If no cookie is present → clear cookie (defensive no-op) and
 *      return { reset: false, reason: 'no_session_to_reset' }.
 *   2. If cookie is present but malformed/bad-signature/expired at the
 *      crypto layer → clear cookie and return
 *      { reset: false, reason: 'invalid_cookie_cleared' }.
 *   3. If cookie signature + expiry are valid but the registry says the
 *      session is not_found/revoked/expired/past_cap → clear cookie and
 *      return { reset: false, reason: 'invalid_cookie_cleared' }.
 *   4. Otherwise · revoke the session_id with reason
 *      'user_reset_cover_continuity', clear cookie, and return
 *      { reset: true, session_id, account_id }.
 *
 * All branches are non-throwing. `none` is not failure.
 *
 * Race safety:
 *   · The revoke path is idempotent (session-registry.revokeSession
 *     is a no-op on already-revoked rows via the .is('revoked_at', null)
 *     filter). Two concurrent reset calls on the same session end with
 *     the earliest caller's revoked_at + reason recorded.
 */
export async function resetCoverContinuityWith(
  deps: ResetCoverContinuityDeps,
): Promise<ResetCoverContinuityResult> {
  const cookieResult = readAndVerifyNexSessionCookie(
    deps.cookieAdapter,
    deps.cryptoCfg,
    deps.now_ms,
  );

  // Case 1 · no cookie
  if (!cookieResult) {
    clearNexSessionCookie(deps.cookieAdapter, deps.cookieCfg);
    return { reset: false, reason: "no_session_to_reset" };
  }

  // Case 2 · cookie present but crypto-invalid
  if (!cookieResult.verify.ok) {
    clearNexSessionCookie(deps.cookieAdapter, deps.cookieCfg);
    return { reset: false, reason: "invalid_cookie_cleared" };
  }

  // Case 3 · cookie crypto-valid but registry says not usable
  const payload = cookieResult.verify.payload;
  const validity = await checkSessionValidity(payload.session_id, deps.now_ms);
  if (!validity.valid) {
    clearNexSessionCookie(deps.cookieAdapter, deps.cookieCfg);
    return { reset: false, reason: "invalid_cookie_cleared" };
  }

  // Case 4 · genuine reset · revoke this specific session_id only
  await revokeSession(
    payload.session_id,
    "user_reset_cover_continuity",
    deps.now_ms,
  );
  clearNexSessionCookie(deps.cookieAdapter, deps.cookieCfg);
  return {
    reset: true,
    session_id: payload.session_id,
    account_id: validity.row.account_id,
  };
}
