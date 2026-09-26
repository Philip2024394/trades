// src/app/api/nex-native/auth/webauthn/assert-finish/route.ts
//
// Verify a WebAuthn assertion and, if valid, issue a Supabase session for
// the matching NEX account.
//
// Session bridging pattern:
//   1. Verify assertion via @simplewebauthn/server
//   2. Look up credential → nex_account → supabase auth user (with email)
//   3. Use admin.generateLink('magiclink') to obtain a hashed_token
//   4. Use the SSR-scoped Supabase client to verifyOtp({token_hash})
//      → this writes the sb- session cookie via the SSR cookie envelope
//   5. Return { ok: true, redirect: '/nex-native/conversations' }
//
// The client hits /api/nex-native/auth/webauthn/assert-finish, receives
// the ok, and navigates to the redirect target. The session cookie is
// already set on the response, so the destination renders authenticated.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import {
  nexAppSsrServerClient,
} from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { resolveWebauthnConfig } from "@/lib/nex-native/webauthn-config";
import {
  getCredentialById,
  markCredentialUsed,
} from "@/lib/nex-native/webauthn-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const cfg = resolveWebauthnConfig(req);

  const jar = await cookies();
  const challenge = jar.get("nex-webauthn-assert-challenge")?.value;
  if (!challenge) {
    return NextResponse.json(
      { error: "missing_challenge", detail: "assert-start was not called or cookie expired" },
      { status: 400 },
    );
  }

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const response = body.response as AuthenticationResponseJSON | undefined;
  if (!response) {
    return NextResponse.json({ error: "missing_response" }, { status: 400 });
  }

  // 1 · locate the credential (its id is base64url in response.id)
  const stored = await getCredentialById(response.id);
  if (!stored) {
    return NextResponse.json({ error: "unknown_credential" }, { status: 404 });
  }

  // 2 · verify the assertion against the stored public key
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: cfg.origin,
      expectedRPID: cfg.rpID,
      credential: {
        id: stored.credential_id,
        publicKey: Buffer.from(stored.credential_public_key, "base64url"),
        counter: Number(stored.counter),
        transports:
          (stored.transports ?? undefined) as
            | ("usb" | "nfc" | "ble" | "internal" | "hybrid")[]
            | undefined,
      },
      requireUserVerification: true,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "verification_failed", detail: (e as Error).message },
      { status: 400 },
    );
  }

  if (!verification.verified) {
    return NextResponse.json({ error: "not_verified" }, { status: 400 });
  }

  // 3 · bump counter + last_used_at
  const newCounter = verification.authenticationInfo?.newCounter ?? Number(stored.counter);
  try { await markCredentialUsed(stored.credential_id, newCounter); } catch { /* non-fatal */ }

  // 4 · look up account + supabase auth user for session issuance
  const acc = await nexSupabaseAdmin
    .from("nex_account")
    .select("supabase_user_id, display_name")
    .eq("id", stored.account_id)
    .maybeSingle();
  if (acc.error || !acc.data) {
    return NextResponse.json({ error: "account_missing" }, { status: 500 });
  }
  const supabaseUserId = (acc.data as { supabase_user_id: string | null }).supabase_user_id;
  if (!supabaseUserId) {
    return NextResponse.json({ error: "account_has_no_auth" }, { status: 500 });
  }

  const auth = await nexSupabaseAdmin.auth.admin.getUserById(supabaseUserId);
  if (auth.error || !auth.data.user?.email) {
    return NextResponse.json({ error: "auth_user_missing" }, { status: 500 });
  }
  const email = auth.data.user.email;

  // 5 · generate a magic link then convert its hashed token into an
  //     SSR-cookie session via verifyOtp on the server-side SSR client.
  const link = await nexSupabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (link.error || !link.data.properties?.hashed_token) {
    return NextResponse.json(
      { error: "session_link_failed", detail: link.error?.message ?? "no hashed_token" },
      { status: 500 },
    );
  }
  const hashedToken = link.data.properties.hashed_token;

  const ssr = await nexAppSsrServerClient();
  const verify = await ssr.auth.verifyOtp({
    token_hash: hashedToken,
    type: "magiclink",
  });
  if (verify.error || !verify.data.session) {
    return NextResponse.json(
      { error: "session_verify_failed", detail: verify.error?.message ?? "no session" },
      { status: 500 },
    );
  }

  const res = NextResponse.json({
    ok: true,
    redirect: "/nex-native/conversations",
    account_id: stored.account_id,
  });
  res.cookies.set({
    name: "nex-webauthn-assert-challenge",
    value: "",
    httpOnly: true,
    sameSite: "strict",
    path: "/api/nex-native/auth/webauthn",
    maxAge: 0,
    secure: cfg.origin.startsWith("https://"),
  });
  return res;
}
