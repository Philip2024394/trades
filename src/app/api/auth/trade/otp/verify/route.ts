// POST /api/auth/trade/otp/verify
//
// Body: { channel, destination, code }
//
// Verifies the code against the stored hash, then either signs the
// trade in (if a Supabase auth user already exists) or provisions a
// new one. Sets the auth cookies via the SSR client so subsequent
// requests are authenticated. Returns { newUser, tradeId }.

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseServer } from "@/lib/tradeAuth";
// Per-trade canteen provisioning removed 2026-07-12 — the /canteen/*
// system was consolidated into /trade-off/yard/canteens/* (community
// canteens). Individual trade profiles live at /trade/[slug].

export const dynamic = "force-dynamic";

const OTP_SECRET = process.env.TRADE_OTP_SECRET ?? "tc-dev-otp-secret-CHANGE-ME";

function normalisePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("07") && digits.length === 11) return "+44" + digits.slice(1);
  if (digits.startsWith("447") && digits.length === 12) return "+" + digits;
  return "+" + digits;
}
function normaliseEmail(input: string): string {
  return input.trim().toLowerCase();
}
function hashCode(code: string, destination: string): string {
  return createHash("sha256")
    .update(code + ":" + destination + ":" + OTP_SECRET)
    .digest("hex");
}

export async function POST(req: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const channel = String(payload.channel ?? "");
  const code = String(payload.code ?? "").trim();
  const rawDest = String(payload.destination ?? "").trim();
  // Signup-only field. Ignored for existing users (their profile row
  // already carries a viewer_role that must not be overwritten).
  const requestedViewerRole =
    payload.viewerRole === "diy" ? "diy" : "trade";
  // Optional guest basket collected pre-auth. Merged additively into
  // the caller's server cart AFTER user provisioning. Belt + braces
  // with the client-side mergeGuestBasketToServer() call.
  const guestBasket: Array<Record<string, unknown>> = Array.isArray(payload.guestBasket)
    ? (payload.guestBasket as Array<Record<string, unknown>>)
    : [];
  if (!["whatsapp", "sms", "email"].includes(channel)) {
    return NextResponse.json({ error: "invalid_channel" }, { status: 400 });
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "invalid_code_format" }, { status: 400 });
  }
  const destination = channel === "email" ? normaliseEmail(rawDest) : normalisePhone(rawDest);

  // Find the latest un-expired OTP for this destination
  const { data: otpRow, error: otpError } = await supabaseAdmin
    .from("app_trade_otp_codes")
    .select("id, code_hash, expires_at, attempts")
    .eq("channel", channel)
    .eq("destination", destination)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (otpError) return NextResponse.json({ error: otpError.message }, { status: 500 });
  if (!otpRow) return NextResponse.json({ error: "code_expired_or_missing" }, { status: 401 });

  // Rate-limit brute force
  if (otpRow.attempts >= 5) {
    await supabaseAdmin.from("app_trade_otp_codes").delete().eq("id", otpRow.id);
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }
  if (otpRow.code_hash !== hashCode(code, destination)) {
    await supabaseAdmin
      .from("app_trade_otp_codes")
      .update({ attempts: otpRow.attempts + 1 })
      .eq("id", otpRow.id);
    return NextResponse.json({ error: "invalid_code" }, { status: 401 });
  }

  // Consume the code
  await supabaseAdmin.from("app_trade_otp_codes").delete().eq("id", otpRow.id);

  // Recovery path: if this (channel, destination) is a verified backup
  // channel for an existing trade, sign THEM in — don't create a new
  // account. Prevents a lost SIM from locking a trade out permanently.
  const { data: recoveryMatch } = await supabaseAdmin
    .from("app_trade_recovery_channels")
    .select("trade_id")
    .eq("channel", channel)
    .eq("destination", destination)
    .not("verified_at", "is", null)
    .limit(1)
    .maybeSingle();

  // Find or create a Supabase auth user for this destination
  let userId: string | null = recoveryMatch?.trade_id ?? null;
  let isNewUser = false;

  if (!userId) {
    if (channel === "email") {
      const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
      const found = existing?.users.find((u) => u.email === destination);
      if (found) {
        userId = found.id;
      } else {
        const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: destination,
          email_confirm: true,
          user_metadata: { display_name: destination.split("@")[0] }
        });
        if (createError || !created?.user) {
          return NextResponse.json({ error: createError?.message ?? "create_failed" }, { status: 500 });
        }
        userId = created.user.id;
        isNewUser = true;
      }
    } else {
      const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
      const found = existing?.users.find((u) => u.phone === destination.replace("+", ""));
      if (found) {
        userId = found.id;
      } else {
        const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
          phone: destination.replace("+", ""),
          phone_confirm: true,
          user_metadata: { display_name: destination }
        });
        if (createError || !created?.user) {
          return NextResponse.json({ error: createError?.message ?? "create_failed" }, { status: 500 });
        }
        userId = created.user.id;
        isNewUser = true;
      }
    }
  }

  // If the trade signed in via a NEW channel and they were already
  // authenticated (or this is a first-time verification of a backup
  // channel they registered while signed in), record it as verified
  // so future recovery works.
  if (!isNewUser && userId) {
    await supabaseAdmin
      .from("app_trade_recovery_channels")
      .upsert(
        {
          trade_id:    userId,
          channel,
          destination,
          verified_at: new Date().toISOString()
        },
        { onConflict: "trade_id,channel,destination" }
      );
  }

  if (!userId) return NextResponse.json({ error: "no_user" }, { status: 500 });

  // Provision the trade profile row on first sign-in. viewer_role is
  // only set on true first-provision — for existing users the upsert
  // must NOT overwrite whatever role they already carry.
  if (isNewUser) {
    const displayName = channel === "email" ? destination.split("@")[0] : destination;
    await supabaseAdmin
      .from("app_trade_profiles")
      .upsert(
        {
          id:                userId,
          phone_e164:        channel !== "email" ? destination : null,
          email:             channel === "email" ? destination : null,
          display_name:      displayName,
          identity_complete: false,
          viewer_role:       requestedViewerRole
        },
        { onConflict: "id", ignoreDuplicates: false }
      );
  } else {
    await supabaseAdmin
      .from("app_trade_profiles")
      .upsert(
        {
          id:                userId,
          phone_e164:        channel !== "email" ? destination : null,
          email:             channel === "email" ? destination : null,
          display_name:      channel === "email" ? destination.split("@")[0] : destination,
          identity_complete: false
        },
        { onConflict: "id", ignoreDuplicates: false }
      );
  }

  // Merge any pre-auth guest basket items the client sent. Additive
  // per (trade_id, product_id) — repeat items on repeat sign-ins are
  // safely aggregated. Silent no-op if the guestBasket array is empty
  // or the marketplace cart table doesn't exist yet (migration not
  // applied in dev).
  if (guestBasket.length > 0) {
    try {
      for (const raw of guestBasket) {
        const productId = typeof raw.productId === "string" ? raw.productId : null;
        if (!productId) continue;
        const productSlug = String(raw.productSlug ?? "");
        const productName = String(raw.productName ?? "");
        if (!productSlug || !productName) continue;
        const incomingQty = Math.max(1, Math.round(Number(raw.qty ?? 1)));
        const { data: existing } = await supabaseAdmin
          .from("app_tradecenter_cart_items")
          .select("qty")
          .eq("trade_id", userId)
          .eq("product_id", productId)
          .maybeSingle();
        const newQty = existing ? Number(existing.qty) + incomingQty : incomingQty;
        await supabaseAdmin
          .from("app_tradecenter_cart_items")
          .upsert(
            {
              trade_id:       userId,
              product_id:     productId,
              product_slug:   productSlug,
              product_name:   productName,
              image_url:      raw.imageUrl ? String(raw.imageUrl) : null,
              qty:            newQty,
              unit:           raw.unit ? String(raw.unit) : null,
              unit_price_gbp: Math.max(0, Number(raw.unitPriceGbp ?? 0)),
              merchant_slug:  String(raw.merchantSlug ?? ""),
              merchant_name:  String(raw.merchantName ?? ""),
              updated_at:     new Date().toISOString()
            },
            { onConflict: "trade_id,product_id" }
          );
      }
    } catch {
      // Table may not exist yet (migration not applied) or a row
      // conflicted — never block sign-in on cart merge failure.
    }
  }

  // Issue a session cookie via the SSR client using the magic-link
  // flow: generate a one-time recovery link for the user, then exchange
  // it in-process to write the auth cookies.
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: channel === "email" ? destination : `${userId}@phone.trade-center.local`
  });
  if (linkError) {
    // Fall back: return userId and let the client establish session via
    // an unauthenticated ping — the middleware will pick it up on next
    // navigation once we upgrade to the SSR-based session.
  }

  const supabase = await getSupabaseServer();
  // Sign in via password-less admin token exchange. Supabase's admin SDK
  // doesn't expose a direct "issue session" primitive, so we use
  // `signInWithOtp` under the hood by verifying the token from the link.
  if (linkData?.properties?.hashed_token) {
    await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: linkData.properties.hashed_token
    });
  }

  return NextResponse.json({
    ok: true,
    tradeId: userId,
    newUser: isNewUser
  });
}
