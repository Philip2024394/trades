// GET /auth/callback?code=…&next=/tc/notebook
//
// OAuth + magic-link return leg. Exchanges the code for a session,
// upserts the trade profile row on first sign-in, then bounces to
// the requested `next`. If the profile isn't complete, we route
// through /tc/complete-identity first.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseServer } from "@/lib/tradeAuth";
// Per-trade canteen provisioning removed 2026-07-12 — the /canteen/*
// system was consolidated into /trade-off/yard/canteens/* (community
// canteens). Individual trade profiles live at /trade/[slug].

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/tc/notebook";
  // Role param carried through from the OAuth start routes. Only
  // applied on first-provision — for returning users the existing
  // viewer_role must not be overwritten.
  const roleParam = url.searchParams.get("role");
  const role = roleParam === "diy" ? "diy" : "trade";

  if (!code) {
    return NextResponse.redirect(new URL("/tc/sign-in?error=missing_code", url.origin));
  }

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data?.user) {
    return NextResponse.redirect(new URL(`/tc/sign-in?error=${encodeURIComponent(error?.message ?? "exchange_failed")}`, url.origin));
  }

  const user = data.user;
  // Provision profile on first login
  const { data: profile } = await supabaseAdmin
    .from("app_trade_profiles")
    .select("id, identity_complete")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    const displayName = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "New Trade";
    await supabaseAdmin.from("app_trade_profiles").insert({
      id:                user.id,
      email:             user.email ?? null,
      phone_e164:        user.phone ? "+" + user.phone : null,
      display_name:      displayName,
      identity_complete: false,
      // Persist the role selected on the two-card sign-up picker so
      // DIY OAuth signups don't silently default to trade.
      viewer_role:       role
    });
    return NextResponse.redirect(new URL(`/tc/complete-identity?next=${encodeURIComponent(next)}`, url.origin));
  }

  if (!profile.identity_complete) {
    return NextResponse.redirect(new URL(`/tc/complete-identity?next=${encodeURIComponent(next)}`, url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
