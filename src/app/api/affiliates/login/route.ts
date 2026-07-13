// POST /api/affiliates/login
//
// WhatsApp + password login for affiliates. Same uniform-error policy
// as the tradesperson login — wrong-password and unknown-phone return
// the same generic 401. Sets a 30-day session cookie on success.
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

  if (whatsappDigits.length < 7 || password.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Invalid phone or password" },
      { status: 401 }
    );
  }

  const lookup = await supabaseAdmin
    .from("hammerex_affiliates")
    .select("affiliate_id, password_hash, status")
    .eq("whatsapp", whatsappDigits)
    .maybeSingle();

  if (lookup.error) {
    console.error("[affiliates/login] lookup failed:", lookup.error);
    return NextResponse.json(
      { ok: false, error: "Invalid phone or password" },
      { status: 401 }
    );
  }
  if (!lookup.data) {
    return NextResponse.json(
      { ok: false, error: "Invalid phone or password" },
      { status: 401 }
    );
  }

  if (lookup.data.status !== "active") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "This affiliate account is not active. Contact support@thenetworkers.app"
      },
      { status: 403 }
    );
  }

  let match = false;
  try {
    match = await bcrypt.compare(password, lookup.data.password_hash);
  } catch (err) {
    console.error("[affiliates/login] bcrypt compare threw:", err);
  }

  if (!match) {
    return NextResponse.json(
      { ok: false, error: "Invalid phone or password" },
      { status: 401 }
    );
  }

  await supabaseAdmin
    .from("hammerex_affiliates")
    .update({ last_login_at: new Date().toISOString() })
    .eq("affiliate_id", lookup.data.affiliate_id);

  await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
    actor_type: "affiliate",
    actor_id: String(lookup.data.affiliate_id),
    action: "login",
    target_id: String(lookup.data.affiliate_id)
  });

  const response = NextResponse.json({
    ok: true,
    affiliate_id: lookup.data.affiliate_id
  });
  setAffiliateSessionCookie(response, lookup.data.affiliate_id);
  return response;
}
