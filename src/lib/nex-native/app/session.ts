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
  return await resolveFromUser(data.user.id, data.user.email ?? null);
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
  return await resolveFromUser(data.user.id, data.user.email ?? null);
}

async function resolveFromUser(supabaseUserId: string, email: string | null): Promise<NexAppSession> {
  let account = await accountService.getAccountBySupabaseUserId(supabaseUserId);
  if (!account) {
    const displayName = email ? (email.split("@")[0] || email) : `nex-user-${supabaseUserId.slice(0, 8)}`;
    account = await accountService.createAccount({
      supabase_user_id: supabaseUserId,
      display_name: displayName,
    });
  }
  // Guarantee the public nex_handle is allocated · historical accounts
  // provisioned before migration 013 will not have one yet. Idempotent.
  if (!account.nex_handle) {
    account = await accountService.ensureNexHandle(account.id);
  }
  return { supabaseUserId, email, account };
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
