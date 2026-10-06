// POST /api/nex-native/security/password/change
//
// Phase 1.0 Security · owner changes their Supabase Auth password.
// Thin bridge to Supabase: we verify the current password by attempting
// a sign-in with it (via the service-role admin-side verification),
// then call `admin.updateUserById(userId, { password })` to set the
// new one. Logs a `password_change` audit event on success + failure.
//
// Request body: { current: string, new: string }
// Response: { ok: true } on success · { ok: false, error } otherwise.
//
// Password policy (minimum): 8 chars. Supabase enforces its own
// server-side policy on top of this · we keep the client-visible rule
// identical to Supabase's default to avoid confusing error messages.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { logSignInEvent } from "@/lib/nex-native/security-service";
import { readClientIp, readUserAgent } from "@/lib/nex-native/app/security-request";
import { clearAllStepUpForAccount } from "@/lib/nex-native/vault/step-up-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_PASSWORD_LENGTH = 8;

const url = process.env.NEX_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }
  if (!session.email) {
    return NextResponse.json(
      { ok: false, error: "no_email_on_account" },
      { status: 400 },
    );
  }
  let body: { current?: string; new?: string };
  try {
    body = (await req.json()) as { current?: string; new?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const current = typeof body.current === "string" ? body.current : "";
  const next = typeof body.new === "string" ? body.new : "";
  if (!current) {
    return NextResponse.json(
      { ok: false, error: "missing_current_password" },
      { status: 400 },
    );
  }
  if (next.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { ok: false, error: "weak_password" },
      { status: 400 },
    );
  }
  if (current === next) {
    return NextResponse.json(
      { ok: false, error: "same_password" },
      { status: 400 },
    );
  }

  if (!url || !anonKey) {
    return NextResponse.json(
      { ok: false, error: "server_misconfigured" },
      { status: 500 },
    );
  }

  // Verify the current password by attempting a sign-in. We use a fresh
  // non-persistent client so the user's live session is unaffected.
  const verifier = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verifyResult = await verifier.auth.signInWithPassword({
    email: session.email,
    password: current,
  });
  if (verifyResult.error || !verifyResult.data.user) {
    // Audit · failed verification.
    void logSignInEvent({
      account_id: session.account.id,
      event_type: "failure",
      success: false,
      ip_address: readClientIp(req),
      user_agent: readUserAgent(req),
    }).catch(() => undefined);
    return NextResponse.json(
      { ok: false, error: "wrong_current_password" },
      { status: 400 },
    );
  }

  // Set the new password via the admin API.
  const updateResult = await nexSupabaseAdmin.auth.admin.updateUserById(
    session.supabaseUserId,
    { password: next },
  );
  if (updateResult.error) {
    void logSignInEvent({
      account_id: session.account.id,
      event_type: "failure",
      success: false,
      ip_address: readClientIp(req),
      user_agent: readUserAgent(req),
    }).catch(() => undefined);
    return NextResponse.json(
      { ok: false, error: updateResult.error.message },
      { status: 400 },
    );
  }

  // Vault Phase A · design §G.1 password-reset lock sweep. Password
  // change is a high-risk security event; every active session for this
  // account must drop its Vault-unlock freshness (and the two step-up
  // factor timestamps) so sensitive Vault ops require re-authentication.
  // Keeps Vault envelopes / files / devices intact (per design) ·
  // password reset ≠ Vault destruction.
  await clearAllStepUpForAccount(session.account.id);

  // Audit · successful password change.
  await logSignInEvent({
    account_id: session.account.id,
    event_type: "password_change",
    success: true,
    ip_address: readClientIp(req),
    user_agent: readUserAgent(req),
  });

  return NextResponse.json({ ok: true });
}
