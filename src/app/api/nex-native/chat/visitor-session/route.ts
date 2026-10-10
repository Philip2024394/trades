// src/app/api/nex-native/chat/visitor-session/route.ts
//
// Wave 4N deep · #262 · anonymous visitor bootstrap · 2026-09-25.
// -------------------------------------------------------------------------
// Founder directive: "Do not put authentication in front of basic Chat
// access." The visitor lands on a public NEX Address, taps Chat, and
// starts talking. This endpoint provisions the visitor's identity so
// the FIRST message succeeds without a login screen.
//
// Design constraints (Founder-sealed):
//   · Use the existing NEX identity/session architecture (auth.users →
//     nex_account) · no phone as identity · no exposed internal ids ·
//     no second chat system · no weakened authorization.
//
// Implementation:
//   1 · Server generates a placeholder `visitor+<random>@visitor.nex-native.local`
//       email + a random password so we have a real auth.users row. The
//       address is documented internal-only; we NEVER surface it to the
//       visitor. Metadata { is_nex_visitor: true } marks the row.
//   2 · admin.auth.admin.createUser(...) creates the auth.users row.
//   3 · nexAppSsrServerClient() signs the client in via password so the
//       Supabase SSR cookie is written onto THIS response's Set-Cookie.
//   4 · nex_account is auto-provisioned on first API call
//       (resolveNexAppSession → createAccount).
//   5 · Client returns and immediately POSTs to /api/nex-native/chat/message.
//
// Promotion path (visitor → full account):
//   · Client calls supabase.auth.updateUser({ email, password }).
//   · auth.users.id is preserved · every nex_account / nex_conversation /
//     nex_message row remains valid without migration.

import { NextResponse } from "next/server";
import { nexAppSsrServerClient } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function randomToken(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: Request) {
  // If the caller already has a session, do nothing · idempotent.
  const ssr = await nexAppSsrServerClient();
  const existing = await ssr.auth.getUser();
  if (existing.data.user) {
    return NextResponse.json({
      ok: true,
      status: "already_signed_in",
      is_visitor: Boolean(
        (existing.data.user.user_metadata as { is_nex_visitor?: boolean } | null | undefined)?.is_nex_visitor,
      ),
    });
  }

  // Parse the optional businessSlug so we can annotate the visitor's
  // metadata with the acquisition origin. Never trusted downstream — the
  // real check is server-side on the message POST.
  let body: Record<string, unknown> = {};
  try {
    body = ((await req.json()) as Record<string, unknown>) ?? {};
  } catch {
    body = {};
  }
  const businessSlug = typeof body.businessSlug === "string" ? body.businessSlug.trim().slice(0, 64) : "";

  const token = randomToken(16);
  const placeholderEmail = `visitor-${token}@visitor.nex-native.local`;
  const placeholderPassword = `Vp!${randomToken(24)}`;

  const created = await nexSupabaseAdmin.auth.admin.createUser({
    email: placeholderEmail,
    password: placeholderPassword,
    email_confirm: true,
    user_metadata: {
      is_nex_visitor: true,
      arrived_via_business_slug: businessSlug || null,
      created_at_iso: new Date().toISOString(),
    },
  });
  if (created.error || !created.data.user) {
    return NextResponse.json(
      { ok: false, error: created.error?.message ?? "visitor_create_failed" },
      { status: 500 },
    );
  }

  // Sign the new user in via the SSR client so Set-Cookie lands on
  // THIS response. Any downstream fetch on the same domain (including
  // /api/nex-native/chat/message the client sends next) will carry it.
  const signIn = await ssr.auth.signInWithPassword({
    email: placeholderEmail,
    password: placeholderPassword,
  });
  if (signIn.error || !signIn.data.session) {
    // best-effort cleanup so we don't leave a dangling auth row.
    try {
      await nexSupabaseAdmin.auth.admin.deleteUser(created.data.user.id);
    } catch {
      /* swallow */
    }
    return NextResponse.json(
      { ok: false, error: signIn.error?.message ?? "visitor_signin_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    status: "visitor_provisioned",
    is_visitor: true,
    session: {
      access_token: signIn.data.session.access_token,
      refresh_token: signIn.data.session.refresh_token,
    },
  });
}
