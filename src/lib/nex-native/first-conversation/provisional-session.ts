// src/lib/nex-native/first-conversation/provisional-session.ts
//
// Bridge 99 · Stage 4d · NexAppSession | ProvisionalSession resolver.
// -----------------------------------------------------------------------------
// Sealed doctrine reference:
//   docs/doctrine/bridge-99-first-conversation-principle-plan-2026-09-30.md
//   §7 identity resolver precedence · Founder-sealed 2026-09-30.
//   Baseline: git commit 6566ace3.
//
// Sealed §7 identity resolver (verbatim):
//   1. Authenticated Supabase session → existing nex_account.supabase_user_id.
//      Highest trust. Skip provisional path entirely.
//   2. Signed nex_session cookie → existing nex_account.id (via registry).
//   3. No match → NO account created here; the resolver returns { kind:'none' }.
//      Account creation belongs to the first-message orchestrator's Send
//      transaction (Stage 6), NOT this module.
//
// Founder-sealed exclusions this module MUST NOT violate:
//   · Fingerprint / risk signals never appear in the resolver. This module
//     does NOT import risk-service.ts. Adding such an import is a doctrinal
//     violation and must be blocked in review.
//   · This module does NOT create nex_account rows, nex_peer_conversation
//     rows, nex_peer_message rows, or nex_welcome_outbox rows. Read-only.
//   · This module does NOT modify nex_session_registry. Rolling extension
//     and revocation are separate calls made elsewhere.
//   · Bridge 62 code path is untouched.
//
// Full sealed §7 validity for the nex_session path (three conditions ALL required):
//     signature_matches AND now < expires_at AND session_id NOT IN revoked
//   → the first two are checked by session-crypto (Stage 4a/4c)
//   → the third is checked here via session-registry-service.checkSessionValidity
//     (Stage 4b)
// A cryptographically valid cookie is NOT sufficient · the DB check is what
// enforces server-side revocation.

import "server-only";
import {
  resolveNexAppSessionFromContext,
  type NexAppSession,
} from "../app/session";
import * as accountService from "../account-service";
import type { NexAccountRow } from "../types";
import {
  readAndVerifyNexSessionCookie,
  nextCookieAdapter,
  loadNexSessionCryptoConfigFromEnv,
  type NexCookieAdapter,
} from "./session-cookie";
import { checkSessionValidity } from "./session-registry-service";
import type { NexSessionRegistryRow } from "./session-registry-service";
import type { NexSessionCryptoConfig } from "./session-crypto";

// ---------------------------------------------------------------------------
// Result union
// ---------------------------------------------------------------------------

export interface NexResolvedAuthenticated {
  kind: "authenticated";
  supabase: NexAppSession;
}

export interface NexResolvedProvisional {
  kind: "provisional";
  account: NexAccountRow;
  session_row: NexSessionRegistryRow;
}

export type NexResolverSkipReason =
  | "cookie_missing"
  | "cookie_malformed"
  | "cookie_bad_signature"
  | "cookie_expired"
  | "cookie_invalid_payload"
  | "session_not_found"
  | "session_revoked"
  | "session_expired"
  | "session_past_absolute_cap"
  | "account_missing";

export interface NexResolvedNone {
  kind: "none";
  reason: NexResolverSkipReason;
}

export type NexResolvedSession =
  | NexResolvedAuthenticated
  | NexResolvedProvisional
  | NexResolvedNone;

// ---------------------------------------------------------------------------
// Deterministic core resolver (testable · no Next.js context, no env reads)
// ---------------------------------------------------------------------------

export interface ResolveNexSessionDeps {
  /** Cookie adapter (fake in tests, Next.js adapter in production). */
  cookieAdapter: NexCookieAdapter;
  /** Session-crypto config. Tests pass explicit keys; prod loads from env. */
  cryptoCfg: NexSessionCryptoConfig;
  /**
   * Pre-resolved Supabase session (production wrapper resolves this from
   * Next.js context first, then delegates here). Pass null if not
   * authenticated. Never resolved inside this function to keep it pure
   * with respect to Next.js.
   */
  supabaseSession: NexAppSession | null;
  /** Injectable clock for tests. Defaults to Date.now(). */
  now_ms?: number;
}

/**
 * Deterministic resolver. Priority per sealed §7:
 *
 *   1. supabaseSession truthy      → { kind: 'authenticated' }
 *   2. nex_session cookie valid    → { kind: 'provisional' }
 *                                    (fully checked via crypto + registry)
 *   3. otherwise                   → { kind: 'none', reason }
 *
 * Fingerprint is NEVER consulted. This function does not import
 * risk-service.
 *
 * No writes occur. This function does not create accounts, conversations,
 * messages, or session rows. Callers that want to establish a new
 * provisional identity must go through the first-message orchestrator
 * (Stage 6), whose contract explicitly includes the Send-triggered
 * account creation.
 */
export async function resolveNexAppOrProvisionalSessionWith(
  deps: ResolveNexSessionDeps,
): Promise<NexResolvedSession> {
  // Priority 1 · authenticated Supabase session wins outright.
  if (deps.supabaseSession) {
    return { kind: "authenticated", supabase: deps.supabaseSession };
  }

  // Priority 2 · nex_session cookie.
  const cookieResult = readAndVerifyNexSessionCookie(
    deps.cookieAdapter,
    deps.cryptoCfg,
    deps.now_ms,
  );
  if (!cookieResult) {
    return { kind: "none", reason: "cookie_missing" };
  }
  if (!cookieResult.verify.ok) {
    // Map crypto layer failure reason to resolver skip reason. One-to-one
    // prefix so callers can distinguish cookie failures from registry
    // failures without ambiguity.
    const cryptoReason = cookieResult.verify.reason;
    const reason: NexResolverSkipReason =
      cryptoReason === "malformed"
        ? "cookie_malformed"
        : cryptoReason === "bad_signature"
          ? "cookie_bad_signature"
          : cryptoReason === "expired"
            ? "cookie_expired"
            : "cookie_invalid_payload";
    return { kind: "none", reason };
  }

  const payload = cookieResult.verify.payload;

  // Sealed §7 third validity condition · DB revocation + registry-side expiry.
  const registry = await checkSessionValidity(payload.session_id, deps.now_ms);
  if (!registry.valid) {
    const reason: NexResolverSkipReason =
      registry.reason === "not_found"
        ? "session_not_found"
        : registry.reason === "revoked"
          ? "session_revoked"
          : registry.reason === "expired"
            ? "session_expired"
            : "session_past_absolute_cap";
    return { kind: "none", reason };
  }

  // Defensive · payload.account_id should always equal registry.row.account_id
  // because the signed payload was minted at the same time as the registry
  // row (both by createSession → cookie-set flow). A mismatch indicates
  // either cookie tampering that somehow passed HMAC (shouldn't be
  // possible) or a manual data-corruption incident. Treat as not-found.
  if (payload.account_id !== registry.row.account_id) {
    return { kind: "none", reason: "session_not_found" };
  }

  const account = await accountService.getAccountById(registry.row.account_id);
  if (!account) {
    // Should be unreachable under normal operation because the FK from
    // nex_session_registry.account_id to nex_account.id is ON DELETE
    // CASCADE — deleting the account removes its sessions. Defensive
    // check retained.
    return { kind: "none", reason: "account_missing" };
  }

  return {
    kind: "provisional",
    account,
    session_row: registry.row,
  };
}

// ---------------------------------------------------------------------------
// Production wrapper · pulls Next.js cookies() + env config
// ---------------------------------------------------------------------------

/**
 * Production entry point. Resolves the Supabase session from Next.js
 * context (RSC/Server Action) first per sealed §7 priority 1, then
 * delegates to the deterministic core with the Next.js cookie adapter
 * and env-derived crypto config.
 *
 * Callable from RSC, Server Actions, and Route Handlers. Writes may
 * fail silently in RSC context (per Next.js semantics) — that is
 * acceptable because this function performs no writes.
 */
export async function resolveNexAppOrProvisionalSession(): Promise<NexResolvedSession> {
  const supabase = await resolveNexAppSessionFromContext();
  if (supabase) {
    return { kind: "authenticated", supabase };
  }
  const cookieAdapter = await nextCookieAdapter();
  const cryptoCfg = loadNexSessionCryptoConfigFromEnv();
  return resolveNexAppOrProvisionalSessionWith({
    cookieAdapter,
    cryptoCfg,
    supabaseSession: null,
  });
}
