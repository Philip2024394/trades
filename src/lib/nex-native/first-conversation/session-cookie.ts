// src/lib/nex-native/first-conversation/session-cookie.ts
//
// Bridge 99 · Stage 4c · nex_session cookie boundary.
// -----------------------------------------------------------------------------
// Sealed doctrine reference:
//   docs/doctrine/bridge-99-first-conversation-principle-plan-2026-09-30.md
//   §7 Cookie contract · Founder-sealed 2026-09-30 · doctrine baseline 6566ace3.
//
// Scope of this module (Stage 4c):
//   · Serialise a NexSessionPayload into a signed cookie value via
//     session-crypto (Stage 4a).
//   · Set the cookie with the exact sealed §7 attributes:
//       Secure · HttpOnly · SameSite=Lax · signed · explicit Max-Age ·
//       explicit Domain/Path scope.
//   · Read the raw cookie token back out.
//   · Verify the cookie (signature + expiry only · pure). DB revocation
//     check is out of scope · that is Stage 4d's job.
//   · Clear the cookie with matching Domain/Path so the browser deletes.
//
// Explicitly OUT of scope for Stage 4c:
//   · NexAppSession | ProvisionalSession resolver (Stage 4d).
//   · POST /api/nex-native/session/reset-cover-continuity (Stage 4e).
//   · Any DB access · this module does not touch nex_session_registry.
//
// Testability discipline:
//   · Pure functions operate on a `NexCookieAdapter` interface (a thin
//     shim over Next.js cookies() returning `.read/.write/.clear`).
//   · A Next.js-specific adapter is provided but not required by tests;
//     tests use an in-memory fake adapter.

import "server-only";
import {
  signSessionToken,
  verifySessionToken,
  type NexSessionCryptoConfig,
  type NexSessionPayload,
  type NexSessionVerifyResult,
} from "./session-crypto";

// ---------------------------------------------------------------------------
// Sealed constants
// ---------------------------------------------------------------------------

/** Fixed cookie name per sealed §7 · never renamed without founder review. */
export const NEX_SESSION_COOKIE_NAME = "nex_session";

// ---------------------------------------------------------------------------
// Cookie adapter interface
// ---------------------------------------------------------------------------

/**
 * Minimal read/write shim over the Next.js cookies() API. Kept narrow so
 * pure functions in this module can be exercised with an in-memory fake
 * in tests, and swapped for the real Next.js binding in production.
 */
export interface NexCookieAdapter {
  read(name: string): string | undefined;
  write(name: string, value: string, options: NexCookieWriteOptions): void;
  clear(name: string, scope: NexCookieScope): void;
}

/** Attributes we set at write time. Sealed §7 mandates every one. */
export interface NexCookieWriteOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  domain?: string;
  path: string;
  maxAge: number; // seconds
}

/** Just the identifying scope for clear() so the browser matches the original set. */
export interface NexCookieScope {
  domain?: string;
  path: string;
}

// ---------------------------------------------------------------------------
// Cookie config (env-derived at runtime; pass explicitly in tests)
// ---------------------------------------------------------------------------

export interface NexSessionCookieConfig {
  /** Secure attribute · true in production, false only for localhost dev. */
  secure: boolean;
  /** Cookie Domain · undefined = host-only. Any shared-subdomain value
   *  (e.g. ".nex.com") is a sealed §7 security trust boundary. */
  domain?: string;
  /** Cookie Path · default "/". */
  path: string;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Sign the payload via session-crypto and write it to the adapter using
 * the sealed §7 attribute set. Max-Age is computed from
 * expires_at_ms - now_ms so the browser drops the cookie in sync with
 * the server-side expiry recorded in nex_session_registry.
 *
 * If expires_at_ms <= now_ms the cookie is written with maxAge=0
 * (deletion equivalent) rather than a negative value. Callers should
 * not normally reach this state · getSessionValidity would already have
 * failed.
 */
export function writeNexSessionCookie(
  adapter: NexCookieAdapter,
  payload: NexSessionPayload,
  cryptoCfg: NexSessionCryptoConfig,
  cookieCfg: NexSessionCookieConfig,
  now_ms: number = Date.now(),
): void {
  const token = signSessionToken(payload, cryptoCfg);
  const remainingMs = payload.expires_at_ms - now_ms;
  const maxAge = remainingMs > 0 ? Math.floor(remainingMs / 1000) : 0;

  adapter.write(NEX_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: cookieCfg.secure,
    sameSite: "lax",
    domain: cookieCfg.domain,
    path: cookieCfg.path,
    maxAge,
  });
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Return the raw cookie token if present · null otherwise. */
export function readNexSessionCookieToken(
  adapter: NexCookieAdapter,
): string | null {
  const v = adapter.read(NEX_SESSION_COOKIE_NAME);
  if (!v) return null;
  return v;
}

/**
 * Read the cookie, verify signature + expiry via session-crypto, return
 * both the raw token and the verification result.
 *
 * Returns null if the cookie is missing entirely. If the cookie is
 * present but malformed / bad-signature / expired, returns the token
 * alongside the failure reason so callers can log the failure without
 * running the crypto check twice.
 *
 * This function does NOT check DB revocation. Callers that need the
 * full sealed §7 validity contract must combine this with a
 * session-registry-service.checkSessionValidity(...) call.
 */
export function readAndVerifyNexSessionCookie(
  adapter: NexCookieAdapter,
  cryptoCfg: NexSessionCryptoConfig,
  now_ms: number = Date.now(),
): { token: string; verify: NexSessionVerifyResult } | null {
  const token = readNexSessionCookieToken(adapter);
  if (!token) return null;
  const verify = verifySessionToken(token, cryptoCfg, now_ms);
  return { token, verify };
}

// ---------------------------------------------------------------------------
// Clear
// ---------------------------------------------------------------------------

/**
 * Delete the cookie. Domain/Path scope MUST match the original set-time
 * scope for the browser to actually delete · we route through the
 * adapter's clear() which is responsible for issuing the correct
 * expired/Max-Age=0 attribute set.
 */
export function clearNexSessionCookie(
  adapter: NexCookieAdapter,
  cookieCfg: NexSessionCookieConfig,
): void {
  adapter.clear(NEX_SESSION_COOKIE_NAME, {
    domain: cookieCfg.domain,
    path: cookieCfg.path,
  });
}

// ---------------------------------------------------------------------------
// Env loaders (production runtime · tests pass config directly)
// ---------------------------------------------------------------------------

/**
 * Load the cookie transport config from environment. Throws if the
 * required variables are absent or unsafe · fail-fast at boot rather
 * than silently issuing insecure cookies.
 *
 * Required env vars:
 *   NEX_SESSION_COOKIE_PATH    · default "/" if unset
 *   NEX_SESSION_COOKIE_DOMAIN  · optional; if set, must start with "."
 *                                (shared-subdomain scope · sealed §7
 *                                trust boundary)
 *
 * Secure is true in production, false only when NODE_ENV !== 'production'.
 * Callers on non-HTTPS localhost during dev get a non-Secure cookie so
 * the browser accepts it; every other environment gets Secure=true.
 */
export function loadNexSessionCookieConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): NexSessionCookieConfig {
  const path = env.NEX_SESSION_COOKIE_PATH || "/";
  const rawDomain = env.NEX_SESSION_COOKIE_DOMAIN;
  let domain: string | undefined;
  if (rawDomain && rawDomain.trim().length > 0) {
    domain = rawDomain.trim();
    if (!domain.startsWith(".")) {
      throw new Error(
        `session-cookie.loadNexSessionCookieConfigFromEnv: NEX_SESSION_COOKIE_DOMAIN must start with "." for shared-subdomain scope (got: ${domain})`,
      );
    }
  }
  const secure = env.NODE_ENV === "production";
  return { secure, domain, path };
}

/**
 * Load the signing-key config from environment. Throws on missing or
 * unsafe values so production cannot boot with a fallback key.
 *
 * Required env vars:
 *   NEX_SESSION_SIGNING_KEY_ACTIVE    · signs new tokens
 *   NEX_SESSION_SIGNING_KEY_ACCEPTED  · comma-separated list; active key
 *                                       MUST be in the list
 */
export function loadNexSessionCryptoConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): NexSessionCryptoConfig {
  const activeKey = env.NEX_SESSION_SIGNING_KEY_ACTIVE;
  const acceptedRaw = env.NEX_SESSION_SIGNING_KEY_ACCEPTED;
  if (!activeKey) {
    throw new Error(
      "session-cookie: NEX_SESSION_SIGNING_KEY_ACTIVE is required",
    );
  }
  if (!acceptedRaw) {
    throw new Error(
      "session-cookie: NEX_SESSION_SIGNING_KEY_ACCEPTED is required (comma-separated · include ACTIVE)",
    );
  }
  const acceptedKeys = acceptedRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return { activeKey, acceptedKeys };
}

// ---------------------------------------------------------------------------
// Next.js adapter
// ---------------------------------------------------------------------------

/**
 * Bind to Next.js cookies() from `next/headers`. Returns an adapter
 * usable by every function in this module. Read is always available;
 * write/clear only work in a Server Action or Route Handler context.
 *
 * Uses dynamic import so this module remains importable in a plain
 * Node/vitest context (where "next/headers" would blow up at
 * module-eval time).
 */
export async function nextCookieAdapter(): Promise<NexCookieAdapter> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return {
    read(name) {
      return store.get(name)?.value;
    },
    write(name, value, options) {
      // Next.js cookies() .set accepts { name, value, ...options } or
      // (name, value, options). We use the latter for clarity.
      store.set(name, value, {
        httpOnly: options.httpOnly,
        secure: options.secure,
        sameSite: options.sameSite,
        domain: options.domain,
        path: options.path,
        maxAge: options.maxAge,
      });
    },
    clear(name, scope) {
      // Delete by setting Max-Age=0 with matching Domain/Path. The
      // browser only deletes when scope matches the original set.
      store.set(name, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        domain: scope.domain,
        path: scope.path,
        maxAge: 0,
      });
    },
  };
}
