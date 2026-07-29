// POST /api/auth/login
//
// D1 Turn 2 · Email + password login (Philip 2026-07-28)
//
// Flow:
//   1. Body: { email, password }
//   2. supabase.auth.signInWithPassword sets the auth cookie
//   3. Look up NexUser by supabase_user_id
//   4. If user not found in hammerex_nex_users → 403 (Supabase user exists but not authorised for NEX)
//   5. If user.status !== 'active' → 403
//   6. Write hammerex_nex_sessions audit row (IP, user-agent, MFA flag)
//   7. Return { ok, user: { email, role, display_name, mfa_required } }
//
// This endpoint intentionally does NOT enforce MFA. The password flow
// yields an aal1 session; MFA verification happens as a follow-up call
// (Supabase Auth's TOTP challenge). Route routes that require MFA
// check the session's aal claim.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { brainSupabase } from "@/lib/nex/brains/_supabase";
import type { NexUserRow } from "@/lib/nex/brains/_living_types";
import { recordLogin, deriveDeviceName } from "@/lib/nex/brains/_session_audit";
import { mfaRequired } from "@/lib/nex/brains/_permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { email: string; password: string };

export async function POST(req: NextRequest) {
  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  if (!body.email || !body.password) {
    return NextResponse.json({ ok: false, error: "email_and_password_required" }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch { /* route handler cookie mutation limit — safe to ignore */ }
      },
    },
  });

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });

  if (authError || !authData.user || !authData.session) {
    return NextResponse.json({
      ok: false,
      error: "invalid_credentials",
      detail: authError?.message,
    }, { status: 401 });
  }

  // Look up NexUser via service-role client
  const sb = brainSupabase();
  if (!sb) {
    return NextResponse.json({ ok: false, error: "server_misconfigured · service role client unavailable" }, { status: 500 });
  }

  const { data: nexUser, error: nexError } = await sb
    .from("hammerex_nex_users")
    .select("*")
    .eq("supabase_user_id", authData.user.id)
    .maybeSingle();

  if (nexError) {
    return NextResponse.json({ ok: false, error: `nex_user_lookup_failed: ${nexError.message}` }, { status: 500 });
  }

  if (!nexUser) {
    // Sign out the Supabase session too — no dangling auth without authorisation
    await supabase.auth.signOut();
    return NextResponse.json({
      ok: false,
      error: "no_nex_user_row",
      detail: "Your Supabase account exists but has no hammerex_nex_users row. Contact an admin to grant platform access.",
    }, { status: 403 });
  }

  const user = nexUser as NexUserRow;

  if (user.status !== "active") {
    await supabase.auth.signOut();
    return NextResponse.json({
      ok: false,
      error: `user_status_${user.status}`,
      detail: `Account status is '${user.status}' — cannot authenticate.`,
    }, { status: 403 });
  }

  // Session audit — best-effort, never blocks login
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? null;
  const userAgent = req.headers.get("user-agent");
  const sessionAaal = (authData.session as unknown as { aal?: string })?.aal ?? "aal1";
  const mfaUsed = sessionAaal === "aal2";

  const sessionId = await recordLogin({
    user_id: user.id,
    supabase_session_id: authData.session.access_token.slice(0, 32),
    ip,
    user_agent: userAgent,
    device_name: deriveDeviceName(userAgent),
    mfa_used: mfaUsed,
    metadata: { aal: sessionAaal },
  });

  return NextResponse.json({
    ok: true,
    user: {
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      mfa_required: mfaRequired(user.role),
      mfa_used: mfaUsed,
      mfa_next_step: mfaRequired(user.role) && !mfaUsed
        ? "verify_totp_at_/api/auth/mfa/challenge"
        : null,
    },
    session_id: sessionId,
  });
}
