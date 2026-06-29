// POST /api/trade-off/set-password
//
// Two callers:
//
//   1. Legacy users (rows whose password_hash is still null) — proves
//      ownership with their existing edit_token (delivered originally by
//      the magic-link email). On success we hash the new password,
//      store it, mint a fresh session cookie, and hand back the slug.
//
//   2. Forgot-password flow — tradesperson lands here from the admin's
//      WhatsApp link with ?recovery_code=<8char>. We verify the code
//      against password_recovery_token (constant-time) AND require
//      password_recovery_sent_at IS NOT NULL (queue-snooping guard: the
//      link is only redeemable AFTER the admin has actually sent it).
//      On success we clear all four recovery columns (single-use).
//
// This route refuses to overwrite an existing password when called
// through path (1); the password_hash IS NULL check is enforced AFTER
// edit_token verification. Path (2) is the legitimate reset and DOES
// overwrite — that's the whole point.
import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { setTradeSessionCookie } from "@/lib/tradeSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function digits(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.replace(/\D/g, "");
}

function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  try {
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: {
    whatsapp?: unknown;
    edit_token?: unknown;
    recovery_code?: unknown;
    password?: unknown;
  };
  try {
    body = (await req.json()) as {
      whatsapp?: unknown;
      edit_token?: unknown;
      recovery_code?: unknown;
      password?: unknown;
    };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const whatsappDigits = digits(body.whatsapp);
  const editToken =
    typeof body.edit_token === "string" ? body.edit_token.trim() : "";
  const recoveryCode =
    typeof body.recovery_code === "string" ? body.recovery_code.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (whatsappDigits.length < 7) {
    return NextResponse.json(
      { ok: false, error: "WhatsApp number looks too short." },
      { status: 400 }
    );
  }
  if (!editToken && !recoveryCode) {
    return NextResponse.json(
      { ok: false, error: "Edit token or recovery code is required." },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  // Pull every listing whose whatsapp ends with the user-supplied tail
  // and then verify the digits match exactly + the auth primitive
  // matches constant-time. We do NOT filter on the token in SQL — that
  // would side-channel existence via timing.
  const lookup = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "id, slug, whatsapp, edit_token, password_hash, password_recovery_token, password_recovery_expires_at, password_recovery_sent_at, updated_at"
    )
    .ilike("whatsapp", `%${whatsappDigits.slice(-9)}%`)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (lookup.error) {
    console.error("[trade-off/set-password] lookup failed:", lookup.error);
    return NextResponse.json(
      { ok: false, error: "Could not verify your details." },
      { status: 500 }
    );
  }

  type Row = {
    id: string;
    slug: string;
    whatsapp: string | null;
    edit_token: string | null;
    password_hash: string | null;
    password_recovery_token: string | null;
    password_recovery_expires_at: string | null;
    password_recovery_sent_at: string | null;
    updated_at: string | null;
  };
  const candidates = ((lookup.data ?? []) as Row[]).filter(
    (r) => digits(r.whatsapp) === whatsappDigits
  );

  // Two-path verification. Recovery code takes priority if present —
  // it's the explicit reset flow.
  let listing: Row | undefined;
  let viaRecovery = false;

  if (recoveryCode) {
    listing = candidates.find((r) => {
      if (typeof r.password_recovery_token !== "string") return false;
      if (!constantTimeEqual(r.password_recovery_token, recoveryCode)) {
        return false;
      }
      // Queue-snooping guard: code is only usable AFTER admin sends it.
      if (!r.password_recovery_sent_at) return false;
      // Expiry guard.
      if (!r.password_recovery_expires_at) return false;
      const exp = new Date(r.password_recovery_expires_at).getTime();
      if (!Number.isFinite(exp) || exp <= Date.now()) return false;
      return true;
    });
    if (!listing) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Recovery code is invalid, hasn't been sent yet, or has expired. Request a new one."
        },
        { status: 401 }
      );
    }
    viaRecovery = true;
  } else {
    listing = candidates.find(
      (r) =>
        typeof r.edit_token === "string" &&
        constantTimeEqual(r.edit_token, editToken)
    );
    if (!listing) {
      return NextResponse.json(
        { ok: false, error: "Phone or edit token didn't match." },
        { status: 401 }
      );
    }
    if (listing.password_hash) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A password is already set for this account. Use 'Forgot password' to reset it."
        },
        { status: 409 }
      );
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // On the recovery path we clear ALL FOUR recovery columns so the code
  // is single-use. On the legacy path there's nothing to clear.
  const updatePayload: Record<string, unknown> = { password_hash: passwordHash };
  if (viaRecovery) {
    updatePayload.password_recovery_token = null;
    updatePayload.password_recovery_expires_at = null;
    updatePayload.password_recovery_requested_at = null;
    updatePayload.password_recovery_sent_at = null;
  }

  const update = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update(updatePayload)
    .eq("id", listing.id);

  if (update.error) {
    console.error("[trade-off/set-password] update failed:", update.error);
    return NextResponse.json(
      { ok: false, error: "Could not save your password — try again." },
      { status: 500 }
    );
  }

  const response = NextResponse.json({ ok: true, slug: listing.slug });
  setTradeSessionCookie(response, listing.id, listing.slug);
  return response;
}
