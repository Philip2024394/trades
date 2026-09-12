// src/app/api/nex/auth/oauth/[provider]/callback/route.ts
//
// Founder Phase 24 · P24-3 · OAuth callback.
//
// Flow:
//   1. Verify state (single-use, TTL 10 min · consumeState)
//   2. Exchange code for tokens (uses PKCE code_verifier)
//   3. Fetch userinfo
//   4. Resolve existing account by email_hash_16 OR create new one
//   5. Issue session cookie
//   6. Redirect to state.redirect_after (typically /nex/settings)
//
// Every failure path is honest: returns JSON with { error, ... }
// rather than fabricating a login.

import { NextResponse } from "next/server";
import { createAccount, issueSession, sessionCookieName, sha16 } from "@/lib/nex/identity-auth";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";
import { getProvider, isConfigured } from "@/lib/nex/oauth/providers";
import { consumeState } from "@/lib/nex/oauth/state";

export const runtime = "nodejs";

interface TokenResponse { access_token?: string; id_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string; }
interface UserInfo { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string; }

async function findAccountByEmailHash(email_hash_16: string): Promise<{ user_id: string } | null> {
  try {
    const pool = getKnowledgeFactoryDbPool();
    const r = await pool.query(
      `SELECT user_id::text FROM nex.user_account WHERE email_hash_16 = $1 AND deleted_at IS NULL LIMIT 1`,
      [email_hash_16],
    );
    return (r.rows[0] as { user_id: string } | undefined) ?? null;
  } catch { return null; }
}

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const p = getProvider(provider);
  if (!p) return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  if (!isConfigured(p)) return NextResponse.json({ error: "oauth_not_configured" }, { status: 503 });

  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const providerError = url.searchParams.get("error");

  if (providerError) {
    return NextResponse.json({ error: "provider_error", detail: providerError }, { status: 400 });
  }
  if (!state || !code) {
    return NextResponse.json({ error: "missing_state_or_code" }, { status: 400 });
  }

  // 1. Verify state (single-use)
  const entry = consumeState(state);
  if (!entry || entry.provider_id !== p.id) {
    return NextResponse.json({ error: "invalid_or_expired_state" }, { status: 400 });
  }

  const host = req.headers.get("host") ?? "localhost:3008";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const redirect_uri = `${proto}://${host}/api/nex/auth/oauth/${p.id}/callback`;

  // 2. Token exchange
  let tokens: TokenResponse;
  try {
    const tokenRes = await fetch(p.token_url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri,
        client_id: p.client_id,
        client_secret: p.client_secret,
        code_verifier: entry.code_verifier,
      }).toString(),
    });
    tokens = (await tokenRes.json().catch(() => ({}))) as TokenResponse;
    if (!tokenRes.ok || !tokens.access_token) {
      return NextResponse.json({
        error: "token_exchange_failed",
        provider_error: tokens.error ?? null,
        provider_error_description: tokens.error_description ?? null,
      }, { status: 502 });
    }
  } catch (e) {
    return NextResponse.json({ error: "token_exchange_error", detail: e instanceof Error ? e.message.slice(0, 200) : "unknown" }, { status: 502 });
  }

  // 3. Userinfo
  let user: UserInfo;
  try {
    const uRes = await fetch(p.userinfo_url, {
      headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/json" },
    });
    user = (await uRes.json().catch(() => ({}))) as UserInfo;
    if (!uRes.ok || !user.email) {
      return NextResponse.json({ error: "userinfo_failed" }, { status: 502 });
    }
  } catch (e) {
    return NextResponse.json({ error: "userinfo_error", detail: e instanceof Error ? e.message.slice(0, 200) : "unknown" }, { status: 502 });
  }

  // 4. Resolve or create account by email_hash
  const email_hash_16 = sha16(user.email.trim().toLowerCase());
  const existing = await findAccountByEmailHash(email_hash_16);
  let user_id: string;
  if (existing) {
    user_id = existing.user_id;
  } else {
    const acct = await createAccount({
      display_name: user.name ?? null,
      email_hash_16,
    });
    user_id = acct.user_id;
  }

  // 5. Issue session cookie
  const session = await issueSession(user_id, {});
  const cookieName = sessionCookieName();

  // 6. Redirect to intended landing
  const redirect_after = entry.redirect_after && entry.redirect_after.startsWith("/") ? entry.redirect_after : "/nex/settings";
  const res = NextResponse.redirect(`${proto}://${host}${redirect_after}`, { status: 302 });
  res.cookies.set(cookieName, session.cookie_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: proto === "https",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
