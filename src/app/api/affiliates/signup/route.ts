// POST /api/affiliates/signup
//
// Self-serve affiliate registration. Captures WhatsApp + password ONLY
// — all other profile fields (name, company, country, socials) are
// filled later from the dashboard. Mints a 30-day session cookie on
// success so the user lands straight in /affiliates/dashboard without
// a second login.
import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { setAffiliateSessionCookie } from "@/lib/affiliateSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function digits(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.replace(/\D/g, "");
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { whatsapp?: unknown; password?: unknown };
  try {
    body = (await req.json()) as { whatsapp?: unknown; password?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const whatsappDigits = digits(body.whatsapp);
  const password = typeof body.password === "string" ? body.password : "";

  if (whatsappDigits.length < 7) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid WhatsApp number (with country code)." },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  // Reject duplicates on the digits-only normalised form. The unique
  // index in the DB also covers this, but doing the check up front
  // gives a friendlier error.
  const existing = await supabaseAdmin
    .from("hammerex_affiliates")
    .select("affiliate_id")
    .eq("whatsapp", whatsappDigits)
    .maybeSingle();
  if (existing.data) {
    return NextResponse.json(
      {
        ok: false,
        error: "An affiliate account already exists with that WhatsApp number."
      },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const insert = await supabaseAdmin
    .from("hammerex_affiliates")
    .insert({
      whatsapp: whatsappDigits,
      password_hash: passwordHash,
      status: "active",
      last_login_at: new Date().toISOString()
    })
    .select("affiliate_id")
    .maybeSingle();

  if (insert.error || !insert.data) {
    console.error("[affiliates/signup] insert failed:", insert.error);
    return NextResponse.json(
      { ok: false, error: insert.error?.message ?? "Could not create account." },
      { status: 500 }
    );
  }

  // Audit log + best-effort welcome email.
  await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
    actor_type: "affiliate",
    actor_id: String(insert.data.affiliate_id),
    action: "signup",
    target_id: String(insert.data.affiliate_id)
  });

  try {
    const { sendWelcomeEmail } = await import("@/lib/affiliateEmails");
    await sendWelcomeEmail({
      affiliate_id: insert.data.affiliate_id,
      email: null
    });
  } catch {
    // best-effort
  }

  const response = NextResponse.json({
    ok: true,
    affiliate_id: insert.data.affiliate_id
  });
  setAffiliateSessionCookie(response, insert.data.affiliate_id);
  return response;
}
