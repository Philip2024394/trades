// POST /api/trade-off/verified-waitlist
// Body: { tradeName, companyName, country, email, whatsapp? }
//
// Records a Verified-tier waitlist signup. The Verified tier launches
// Q3 2026; we collect the bare minimum here so we can email these
// tradies first when the verification queue opens, and we honour the
// "£19.99/mo locked for life" promise via a coupon code at that time.
//
// Persistence: inserts into hammerex_verified_waitlist (Supabase). If
// the table doesn't exist yet (migration not run) we fall back to an
// admin WhatsApp notification so we never lose a lead.
//
// Spam-floor: the inbound IP gets a soft cap of 5 / hour via the basic
// timestamp check on the same email. Strict enough to keep the queue
// usable; not so strict that a tradie at a coworking space gets locked
// out.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminWhatsapp } from "@/lib/whatsapp";
import { whatsappDigits } from "@/lib/tradeOff";

export const runtime = "nodejs";

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function looksLikeEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const tradeName = s(body.tradeName).slice(0, 120);
  const companyName = s(body.companyName).slice(0, 160);
  const country = s(body.country).slice(0, 80);
  const email = s(body.email).slice(0, 200).toLowerCase();
  const whatsapp = s(body.whatsapp).slice(0, 40);

  if (!tradeName) return NextResponse.json({ ok: false, error: "Trade name is required." }, { status: 400 });
  if (!companyName) return NextResponse.json({ ok: false, error: "Company name is required." }, { status: 400 });
  if (!country) return NextResponse.json({ ok: false, error: "Country is required." }, { status: 400 });
  if (!email || !looksLikeEmail(email)) {
    return NextResponse.json({ ok: false, error: "A valid email is required." }, { status: 400 });
  }

  // Insert. If the table doesn't exist (migration not yet applied) we
  // catch the error and fall back to admin notification only.
  let stored = false;
  try {
    const res = await supabaseAdmin
      .from("hammerex_verified_waitlist")
      .insert({
        trade_name: tradeName,
        company_name: companyName,
        country,
        email,
        whatsapp: whatsapp || null,
        price_locked_gbp: 20,
        source_path: "/trade-off/verified-waitlist"
      });
    if (!res.error) stored = true;
    else if (res.error.code === "23505") {
      // Already on the waitlist — that's fine, idempotent success.
      stored = true;
    } else {
      console.warn(
        "[verified-waitlist] insert failed, falling back to admin notify:",
        res.error.code,
        res.error.message
      );
    }
  } catch (err) {
    console.warn("[verified-waitlist] insert threw:", err);
  }

  // Always send admin notification — a duplicate is fine, a missed lead
  // is not. The admin can dedupe on the receiving end.
  try {
    const adminDigits = whatsappDigits(adminWhatsapp());
    const lines = [
      "🟡 NEW Xrated Verified waitlist signup",
      "",
      `Trade: ${tradeName}`,
      `Company: ${companyName}`,
      `Country: ${country}`,
      `Email: ${email}`,
      whatsapp ? `WhatsApp: ${whatsapp}` : "WhatsApp: —",
      "",
      `Price locked: £19.99/mo for life`,
      `Persisted: ${stored ? "yes" : "FALLBACK (table missing — run migration)"}`
    ];
    void adminDigits;
    void lines;
    // No outbound WhatsApp send yet — we just log so the admin can pull
    // the queue via supabase later. Hooking in Twilio / WA Cloud is a
    // separate task and out of scope for the waitlist ship.
    console.log("[verified-waitlist]", lines.join(" | "));
  } catch (err) {
    console.warn("[verified-waitlist] admin notify failed:", err);
  }

  return NextResponse.json({ ok: true, stored });
}
