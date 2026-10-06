// src/lib/nex-native/app/session.ts
//
// NEX-native application session helper (server-only).
// ====================================================
//
// Wave 4/5 · application-consumer session boundary.
//
// This helper is the ONLY authorised way for a Route Handler, Server
// Component, or Server Action to know "who is the current NEX user?"
// against the authoritative NEX Supabase project (ijvqdvsvwtwxzcqmoqit).
//
// Three entry points · same underlying token-verification path:
//   · resolveNexAppSession(req)               · Route Handlers (Request object)
//   · resolveNexAppSessionFromContext()       · RSC + Server Actions (cookies())
//   · resolveNexAppSessionByAccessToken(jwt)  · scripts / tests with a raw JWT
//
// All three:
//   · verify the JWT via Supabase Auth (never trust the client)
//   · auto-provision a nex_account on first sign-in (real UUID FK)
//   · never throw for "unauthenticated" · return null so callers can 401
//
// Doctrine references:
//   · Wave 3 §7 · service-role stays server-only · client never sees it
//   · Wave 3.1 §5 · authenticated per-user isolation model
//   · Wave 5 §9   · security preserved · no RLS weakened
//   · Identity Doctrine · nex_account.id UUID is the anchor · never phone/email

import "server-only";
import { createHash } from "node:crypto";
import { cookies as nextCookies, headers as nextHeaders } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { nexSupabaseAdmin } from "../supabase-admin";
import * as accountService from "../account-service";
import type { NexAccountRow } from "../types";

const url = process.env.NEX_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "nex-native/app/session: missing NEX_SUPABASE_URL or NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY"
  );
}

export interface NexAppSession {
  supabaseUserId: string;
  email: string | null;
  account: NexAccountRow;
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

/** Route-Handler entry · same behaviour as Wave 4 · unchanged. */
export async function resolveNexAppSession(req: Request): Promise<NexAppSession | null> {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  let accessToken: string | null = null;
  if (auth && /^Bearer\s+/i.test(auth)) {
    accessToken = auth.replace(/^Bearer\s+/i, "").trim();
  }
  if (!accessToken) {
    const cookieHeader = req.headers.get("cookie") ?? "";
    accessToken = extractAccessTokenFromCookieHeader(cookieHeader);
  }
  if (!accessToken) return null;
  return await resolveByAccessTokenInternal(accessToken);
}

/**
 * RSC + Server-Action entry · reads cookies via next/headers so
 * `@supabase/ssr`'s cookie envelope is honoured and can be refreshed
 * transparently. Also accepts an `Authorization: Bearer` header
 * (useful for the Wave 5 Reality Check which drives the RSC path
 * from a script).
 *
 * Note: RSCs cannot set cookies, so token refresh writes are silently
 * dropped by @supabase/ssr in a Server Component context. Server
 * Actions CAN set cookies, which is why sign-in must live in a
 * Server Action rather than an RSC.
 */
export async function resolveNexAppSessionFromContext(): Promise<NexAppSession | null> {
  // Try Authorization: Bearer first (script/test convenience)
  try {
    const h = await nextHeaders();
    const auth = h.get("authorization") ?? h.get("Authorization");
    if (auth && /^Bearer\s+/i.test(auth)) {
      const token = auth.replace(/^Bearer\s+/i, "").trim();
      return await resolveByAccessTokenInternal(token);
    }
  } catch {
    /* not in an RSC/Server Action context; ignore */
  }

  // Cookie path via @supabase/ssr
  const cookieStore = await nextCookies();
  const supabase = createServerClient(url!, anonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(list) {
        try {
          for (const c of list) cookieStore.set(c.name, c.value, c.options);
        } catch {
          /* in RSC we cannot set cookies · silently drop */
        }
      },
    },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  // Phase 1.0 Security · derive the raw access token from the cookie
  // envelope so we can key `nex_session` by sha256(access_token) and
  // read the JWT iat for the sessions_invalidated_at check inside
  // resolveFromUser. Falls back to null when the token can't be
  // extracted; the resolver treats null as "no session enforcement"
  // (fail-open; the account still loads so Bridge 2b is unaffected).
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const accessToken = extractAccessTokenFromCookieHeader(cookieHeader);
  return await resolveFromUser(data.user.id, data.user.email ?? null, accessToken);
}

/** Script/test entry · pass the raw JWT (e.g. after signInWithPassword). */
export async function resolveNexAppSessionByAccessToken(
  accessToken: string
): Promise<NexAppSession | null> {
  if (!accessToken) return null;
  return await resolveByAccessTokenInternal(accessToken);
}

/** Helper · pages that need the admin handle AFTER auth. */
export function nexAppAdmin() {
  return nexSupabaseAdmin;
}

/**
 * Build an @supabase/ssr server client bound to the current context's
 * cookies. Server Actions use this to call `.auth.signInWithPassword`
 * so Supabase writes fresh cookies onto the response.
 */
export async function nexAppSsrServerClient() {
  const cookieStore = await nextCookies();
  return createServerClient(url!, anonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll(list) {
        try {
          for (const c of list) cookieStore.set(c.name, c.value, c.options);
        } catch {
          /* noop */
        }
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function resolveByAccessTokenInternal(accessToken: string): Promise<NexAppSession | null> {
  const verifier = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data, error } = await verifier.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return await resolveFromUser(data.user.id, data.user.email ?? null, accessToken);
}

async function resolveFromUser(
  supabaseUserId: string,
  email: string | null,
  accessToken: string | null,
): Promise<NexAppSession | null> {
  let account = await accountService.getAccountBySupabaseUserId(supabaseUserId);
  if (!account) {
    const displayName = email ? (email.split("@")[0] || email) : `nex-user-${supabaseUserId.slice(0, 8)}`;
    account = await accountService.createAccount({
      supabase_user_id: supabaseUserId,
      display_name: displayName,
    });
  }

  // Phase 1.0 Security · session invalidation enforcement.
  // When the account has a `sessions_invalidated_at` timestamp and the
  // current session's JWT was issued BEFORE that moment, reject the
  // session. This is how "sign out all other sessions" propagates
  // across requests · the resolver is the single enforcement point
  // (221 callsites inherit the check with zero change on their side).
  //
  // Fail-open semantics: if we cannot read the JWT iat (e.g. the test
  // entry point passes null, or the token is malformed), we skip the
  // check. This is intentional · Bridge 2b's existing flows that call
  // the resolver without a token must keep working.
  // Phase 1.0 Security · reject sessions when:
  //   (a) this specific session's nex_session row has been marked
  //       revoked (per-session revoke · "sign out all other sessions"
  //       works via this path · the current session's row stays
  //       non-revoked so the device that triggered the action keeps
  //       its session), OR
  //   (b) the account's `sessions_invalidated_at` is newer than this
  //       session's JWT iat (mass invalidation path · reserved for
  //       future flows like "revoke on password change · including
  //       this device"). Phase 1.0 does NOT bump sessions_invalidated_at
  //       from any user-triggered action · the column is wired but
  //       only (a) is user-reachable today.
  if (accessToken) {
    const sessionKey = sha256Hex(accessToken);
    const sessRow = await nexSupabaseAdmin
      .from("nex_session")
      .select("revoked_at")
      .eq("account_id", account.id)
      .eq("supabase_session_key", sessionKey)
      .maybeSingle();
    if (sessRow.data?.revoked_at) {
      return null;
    }
    if (account.sessions_invalidated_at) {
      const issuedAtSec = extractJwtIssuedAt(accessToken);
      if (issuedAtSec !== null) {
        const invalidatedAtMs = Date.parse(account.sessions_invalidated_at);
        if (Number.isFinite(invalidatedAtMs) && issuedAtSec * 1000 < invalidatedAtMs) {
          return null;
        }
      }
    }
  }

  // Guarantee the public nex_handle is allocated · historical accounts
  // provisioned before migration 013 will not have one yet. Idempotent.
  if (!account.nex_handle) {
    account = await accountService.ensureNexHandle(account.id);
  }

  // Phase 1.0 Security · write-through session touch.
  // Fire-and-forget UPSERT into nex_session so the Security devices page
  // sees every live session and its last-seen timestamp. The write is
  // keyed by sha256(access_token); it rotates on every Supabase token
  // refresh (which is desirable · each refresh is a new row with a
  // fresh last_seen baseline). We never block the request on this
  // write; failures are logged and swallowed.
  if (accessToken) {
    const sessionKey = sha256Hex(accessToken);
    void touchNexSession(account.id, sessionKey).catch((err) => {
      console.warn(
        `[nex-session] touch failed for account ${account.id}:`,
        err instanceof Error ? err.message : err,
      );
    });
  }

  return { supabaseUserId, email, account };
}

// ---------------------------------------------------------------------------
// Phase 1.0 Security helpers
// ---------------------------------------------------------------------------

/** sha256 of the input as lowercase hex (64 chars). */
function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Extract the `iat` (issued-at, seconds since epoch) claim from a JWT.
 *  Returns null when the token is malformed · never throws. */
function extractJwtIssuedAt(jwt: string): number | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    // JWT payload is base64url-encoded. Convert to base64 then decode.
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (b64.length % 4)) % 4;
    const padded = b64 + "=".repeat(padLen);
    const json = Buffer.from(padded, "base64").toString("utf8");
    const obj = JSON.parse(json);
    const iat = obj?.iat;
    return typeof iat === "number" && Number.isFinite(iat) ? iat : null;
  } catch {
    return null;
  }
}

/** Upsert the nex_session row for this (account, session key) pair.
 *  Insert path creates a minimal row (no device_label · the sign-in
 *  action logs that separately). Update path bumps last_seen_at.
 *  Service-role write (bypasses RLS). */
async function touchNexSession(accountId: string, sessionKey: string): Promise<void> {
  const now = new Date().toISOString();
  // Try UPDATE first (hot path · existing session being touched).
  const upd = await nexSupabaseAdmin
    .from("nex_session")
    .update({ last_seen_at: now })
    .eq("account_id", accountId)
    .eq("supabase_session_key", sessionKey)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (upd.data?.id) return;
  // Cold path · insert a minimal row. ON CONFLICT via unique(account_id,
  // supabase_session_key) swallows races between concurrent requests.
  await nexSupabaseAdmin
    .from("nex_session")
    .upsert(
      {
        account_id: accountId,
        supabase_session_key: sessionKey,
        created_at: now,
        last_seen_at: now,
        trusted: false,
      },
      { onConflict: "account_id,supabase_session_key" },
    );
}

function extractAccessTokenFromCookieHeader(cookieHeader: string): string | null {
  if (!cookieHeader) return null;
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((p) => {
      const idx = p.indexOf("=");
      if (idx < 0) return [p.trim(), ""];
      return [p.slice(0, idx).trim(), decodeURIComponent(p.slice(idx + 1).trim())];
    })
  );
  for (const [k, v] of Object.entries(cookies)) {
    if (!/^sb-.*-auth-token$/.test(k)) continue;
    const parsed = tryParseSupabaseCookie(v);
    if (parsed) return parsed;
  }
  const chunkKeys = Object.keys(cookies)
    .filter((k) => /^sb-.*-auth-token\.\d+$/.test(k))
    .sort();
  if (chunkKeys.length > 0) {
    const joined = chunkKeys.map((k) => cookies[k]!).join("");
    const parsed = tryParseSupabaseCookie(joined);
    if (parsed) return parsed;
  }
  return null;
}

function tryParseSupabaseCookie(raw: string): string | null {
  if (!raw) return null;
  let payload = raw;
  if (payload.startsWith("base64-")) payload = payload.slice(7);
  try {
    const decoded = Buffer.from(payload, "base64").toString("utf8");
    const obj = JSON.parse(decoded);
    if (obj && typeof obj === "object" && typeof obj.access_token === "string") return obj.access_token;
  } catch {
    /* fall through */
  }
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object" && typeof obj.access_token === "string") return obj.access_token;
  } catch {
    /* fall through */
  }
  return null;
}
