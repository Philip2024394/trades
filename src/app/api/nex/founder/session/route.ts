// src/app/api/nex/founder/session/route.ts
//
// SLICE #7 · Founder-Mode Session Endpoint v0 (Philip 2026-09-05)
//
// PURPOSE
// -------
// Enter, exit, and inspect founder-mode session. Analogous to `sudo`
// on a Unix system: the founder logs in via Supabase normally, then
// explicitly elevates privileges here to obtain a bounded-lifetime
// second-factor cookie required for the /command endpoint.
//
// ROUTES
// ------
//   POST   /api/nex/founder/session
//     Body: { password: string }
//     Preconditions:
//       · Valid Supabase Auth session
//       · Supabase user_id === NEX_FOUNDER_SUPABASE_USER_ID
//       · password === NEX_FOUNDER_MODE_PASSWORD
//     On success: sets NEX_FOUNDER_MODE_COOKIE with TTL, emits
//     founder.session.entered.
//     On failure: 401/403 with structured reason, emits
//     founder.identity.rejected.
//
//   DELETE /api/nex/founder/session
//     Preconditions: none (safe to call always)
//     Effect: clears NEX_FOUNDER_MODE_COOKIE, emits
//     founder.session.exited (if a valid cookie was present).
//
//   GET    /api/nex/founder/session
//     Returns: {
//       identity_configured: bool,
//       is_founder_identity: bool,          // Supabase user matches anchor
//       in_founder_mode: bool,              // valid founder-mode cookie
//       expires_at_iso?: string,
//       remaining_sec?: number
//     }
//     Safe read · never grants authority · used by the founder UI to
//     render the sudo-prompt vs. active-session indicator.

import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import {
  assertFounderConfigOperable,
  getFounderConfig,
  resolveFounderIdentity,
} from "@/lib/nex/founder/identity";
import {
  FOUNDER_MODE_COOKIE_NAME,
  checkFounderModePassword,
  founderModeCookieOptions,
  mintFounderModeToken,
  readFounderModeCookie,
  verifyFounderModeToken,
} from "@/lib/nex/founder/session";
import { emitFounderEvent } from "@/lib/nex/founder/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── POST · enter founder mode ────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    assertFounderConfigOperable();
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "server_misconfigured" },
      { status: 503 },
    );
  }

  // 1. Authenticate via Supabase (reuses existing infra · not a parallel auth)
  const auth = await getAuthenticatedUser();
  if (!auth.ok) {
    emitFounderEvent({
      kind: "founder.identity.rejected",
      actor_supabase_user_id: null,
      denial_gate: "auth",
      reason: `no_supabase_session · ${auth.error}`,
    });
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  // 2. Confirm founder identity anchor
  const identity = resolveFounderIdentity({
    supabase_user_id: auth.user.supabase_user_id,
    email: auth.user.email,
  });
  if (identity.kind !== "founder_candidate") {
    emitFounderEvent({
      kind: "founder.identity.rejected",
      actor_supabase_user_id: auth.user.supabase_user_id,
      denial_gate: "identity",
      reason: identity.reason,
    });
    return NextResponse.json(
      { ok: false, error: "not_founder_identity", reason: identity.reason },
      { status: 403 },
    );
  }

  // 3. Confirm founder-mode password (second factor · sudo-like)
  let body: { password?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // fall through to password check with undefined
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (!checkFounderModePassword(password)) {
    emitFounderEvent({
      kind: "founder.identity.rejected",
      actor_supabase_user_id: auth.user.supabase_user_id,
      denial_gate: "session",
      reason: "wrong_founder_mode_password",
    });
    // Uniform 401 · do not distinguish "wrong password" from "no
    // password" to reduce reconnaissance value.
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 4. Mint token + set cookie + emit success event
  const now = new Date();
  const token = mintFounderModeToken(auth.user.supabase_user_id, now);
  const config = getFounderConfig();
  const expiresAt = new Date(now.getTime() + config.founder_mode_ttl_sec * 1000);

  emitFounderEvent({
    kind: "founder.session.entered",
    actor_supabase_user_id: auth.user.supabase_user_id,
    extra: {
      issued_at_iso: now.toISOString(),
      expires_at_iso: expiresAt.toISOString(),
      ttl_sec: config.founder_mode_ttl_sec,
    },
  });

  const res = NextResponse.json(
    {
      ok: true,
      in_founder_mode: true,
      expires_at_iso: expiresAt.toISOString(),
      remaining_sec: config.founder_mode_ttl_sec,
    },
    { status: 200 },
  );
  res.cookies.set({
    name: FOUNDER_MODE_COOKIE_NAME,
    value: token,
    ...founderModeCookieOptions(),
  });
  return res;
}

// ─── DELETE · exit founder mode ───────────────────────────────────

export async function DELETE() {
  const cookie = await readFounderModeCookie();
  // If cookie present, attempt to identify the founder for the audit
  // record. Even an invalid cookie triggers a benign exit.
  const auth = await getAuthenticatedUser();
  const userId = auth.ok ? auth.user.supabase_user_id : null;

  if (cookie) {
    emitFounderEvent({
      kind: "founder.session.exited",
      actor_supabase_user_id: userId,
      reason: "explicit_exit",
    });
  }

  const res = NextResponse.json({ ok: true, in_founder_mode: false }, { status: 200 });
  res.cookies.set({
    name: FOUNDER_MODE_COOKIE_NAME,
    value: "",
    ...founderModeCookieOptions(),
    maxAge: 0,
  });
  return res;
}

// ─── GET · status ─────────────────────────────────────────────────

export async function GET() {
  const config = getFounderConfig();
  const identity_configured =
    !!config.founder_supabase_user_id &&
    config.founder_mode_secret_present &&
    config.founder_mode_password_present;

  const auth = await getAuthenticatedUser();
  if (!auth.ok) {
    return NextResponse.json(
      {
        ok: true,
        identity_configured,
        is_founder_identity: false,
        in_founder_mode: false,
        reason: auth.error,
      },
      { status: 200 },
    );
  }

  const identity = resolveFounderIdentity({
    supabase_user_id: auth.user.supabase_user_id,
    email: auth.user.email,
  });
  const is_founder_identity = identity.kind === "founder_candidate";

  const cookie = await readFounderModeCookie();
  const v = verifyFounderModeToken(cookie, auth.user.supabase_user_id);

  return NextResponse.json(
    {
      ok: true,
      identity_configured,
      is_founder_identity,
      in_founder_mode: v.valid,
      expires_at_iso: v.valid ? v.expires_at_iso : null,
      remaining_sec: v.valid ? v.remaining_sec : null,
    },
    { status: 200 },
  );
}
