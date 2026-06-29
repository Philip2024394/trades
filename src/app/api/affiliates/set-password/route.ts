// POST /api/affiliates/set-password
//
// Verifies the recovery code (constant-time, single-use, 24h expiry,
// queue-snooping guard: sent_at must be NOT NULL), hashes the new
// password with bcrypt and stores it. On success we mint a fresh
// session cookie so the affiliate lands straight in the dashboard.
import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { setAffiliateSessionCookie } from "@/lib/affiliateSession";

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
  let body: { whatsapp?: unknown; recovery_code?: unknown; password?: unknown };
  try {
    body = (await req.json()) as {
      whatsapp?: unknown;
      recovery_code?: unknown;
      password?: unknown;
    };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const waDigits = digits(body.whatsapp);
  const code =
    typeof body.recovery_code === "string" ? body.recovery_code.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (waDigits.length < 7) {
    return NextResponse.json(
      { ok: false, error: "WhatsApp number looks too short." },
      { status: 400 }
    );
  }
  if (!code) {
    return NextResponse.json(
      { ok: false, error: "Recovery code is required." },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  const lookup = await supabaseAdmin
    .from("hammerex_affiliates")
    .select(
      "affiliate_id, whatsapp, password_recovery_token, password_recovery_expires_at, password_recovery_sent_at"
    )
    .eq("whatsapp", waDigits)
    .maybeSingle();

  const aff = lookup.data;
  if (
    !aff ||
    typeof aff.password_recovery_token !== "string" ||
    !constantTimeEqual(aff.password_recovery_token, code) ||
    !aff.password_recovery_sent_at ||
    !aff.password_recovery_expires_at
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Recovery code is invalid, hasn't been sent yet, or has expired. Request a new one."
      },
      { status: 401 }
    );
  }
  const exp = new Date(aff.password_recovery_expires_at).getTime();
  if (!Number.isFinite(exp) || exp <= Date.now()) {
    return NextResponse.json(
      { ok: false, error: "Recovery code has expired. Request a new one." },
      { status: 401 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const update = await supabaseAdmin
    .from("hammerex_affiliates")
    .update({
      password_hash: passwordHash,
      password_recovery_token: null,
      password_recovery_expires_at: null,
      password_recovery_requested_at: null,
      password_recovery_sent_at: null,
      last_login_at: new Date().toISOString()
    })
    .eq("affiliate_id", aff.affiliate_id);
  if (update.error) {
    return NextResponse.json(
      { ok: false, error: "Could not save your password — try again." },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
    actor_type: "affiliate",
    actor_id: String(aff.affiliate_id),
    action: "password_recovery.completed",
    target_id: String(aff.affiliate_id)
  });

  const response = NextResponse.json({
    ok: true,
    affiliate_id: aff.affiliate_id
  });
  setAffiliateSessionCookie(response, aff.affiliate_id);
  return response;
}
