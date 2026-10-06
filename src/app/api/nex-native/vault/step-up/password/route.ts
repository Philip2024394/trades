// POST /api/nex-native/vault/step-up/password
//
// Vault Phase A · Commit A.4 · password step-up.
//
// Re-verifies the authenticated owner's password WITHOUT changing it.
// On success calls markPasswordVerified so subsequent requireStepUp
// checks within the sealed 10-minute freshness window pass. Required
// prerequisite for /vault/device/authorise and /vault/device/revoke
// per design §H step-up matrix.
//
// Reuses the same verification technique as /security/password/change:
//   · fresh non-persistent Supabase anon client
//   · signInWithPassword(email, provided_password)
//   · the user's live session is UNAFFECTED
//
// Request:  { password: string }
// Response: { ok: true } on success · { ok: false, error } otherwise.
//
// Zero commercial code.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import {
  currentSessionKey,
  readClientIp,
  readUserAgent,
} from "@/lib/nex-native/app/security-request";
import { logSignInEvent } from "@/lib/nex-native/security-service";
import { lookupNexSessionId } from "@/lib/nex-native/vault/vault-status-service";
import { markPasswordVerified } from "@/lib/nex-native/vault/step-up-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const url = process.env.NEX_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY;

interface Body {
  password?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }
  if (!session.email) {
    return NextResponse.json(
      { ok: false, error: "no_email_on_account" },
      { status: 400 },
    );
  }
  if (!url || !anonKey) {
    return NextResponse.json(
      { ok: false, error: "server_misconfigured" },
      { status: 500 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    return NextResponse.json(
      { ok: false, error: "missing_password" },
      { status: 400 },
    );
  }

  const verifier = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verifyResult = await verifier.auth.signInWithPassword({
    email: session.email,
    password,
  });
  const ip = readClientIp(req);
  const ua = readUserAgent(req);
  if (verifyResult.error || !verifyResult.data.user) {
    await logSignInEvent({
      account_id: session.account.id,
      event_type: "failure",
      success: false,
      ip_address: ip,
      user_agent: ua,
    });
    return NextResponse.json(
      { ok: false, error: "wrong_password" },
      { status: 400 },
    );
  }

  // Mark fresh password verification on the current session row.
  const sessionKey = currentSessionKey(req);
  if (!sessionKey) {
    return NextResponse.json(
      { ok: false, error: "no_session_token" },
      { status: 401 },
    );
  }
  const nexSessionId = await lookupNexSessionId({
    accountId: session.account.id,
    supabaseSessionKey: sessionKey,
  });
  if (!nexSessionId) {
    return NextResponse.json(
      { ok: false, error: "session_touch_not_yet_landed" },
      { status: 409 },
    );
  }
  await markPasswordVerified({
    sessionId: nexSessionId,
    accountId: session.account.id,
  });

  // Audit · successful step-up (reuse 'password' event_type since this is
  // effectively re-authenticating via password; the enum does not
  // include a distinct 'password_step_up' value).
  await logSignInEvent({
    account_id: session.account.id,
    event_type: "password",
    success: true,
    ip_address: ip,
    user_agent: ua,
  });

  return NextResponse.json({ ok: true });
}
