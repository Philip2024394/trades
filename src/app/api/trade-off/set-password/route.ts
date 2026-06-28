// POST /api/trade-off/set-password
//
// First-time password set for legacy users (rows whose password_hash is
// still null). The tradesperson proves ownership with their existing
// edit_token (delivered originally by the magic-link email). On success
// we hash the new password, store it, mint a fresh session cookie, and
// hand back the slug so the client can route to /trade-off/edit/<slug>.
//
// This route refuses to overwrite an existing password (`password_hash
// IS NULL` is checked AFTER token verification). If a tradesperson with
// an existing password forgets it, they go through /forgot-password,
// which is a separate human-in-the-loop process.
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
  let body: { whatsapp?: unknown; edit_token?: unknown; password?: unknown };
  try {
    body = (await req.json()) as {
      whatsapp?: unknown;
      edit_token?: unknown;
      password?: unknown;
    };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const whatsappDigits = digits(body.whatsapp);
  const editToken = typeof body.edit_token === "string" ? body.edit_token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (whatsappDigits.length < 7) {
    return NextResponse.json(
      { ok: false, error: "WhatsApp number looks too short." },
      { status: 400 }
    );
  }
  if (!editToken) {
    return NextResponse.json(
      { ok: false, error: "Edit token is required." },
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
  // and then verify the digits match exactly + the edit_token matches
  // constant-time. We do NOT filter on edit_token in the SQL — that
  // would side-channel the existence of the token via timing.
  const lookup = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, whatsapp, edit_token, password_hash, updated_at")
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
    updated_at: string | null;
  };
  const candidates = ((lookup.data ?? []) as Row[]).filter(
    (r) => digits(r.whatsapp) === whatsappDigits
  );

  const listing = candidates.find(
    (r) =>
      typeof r.edit_token === "string" && constantTimeEqual(r.edit_token, editToken)
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

  const passwordHash = await bcrypt.hash(password, 10);

  const update = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({ password_hash: passwordHash })
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
