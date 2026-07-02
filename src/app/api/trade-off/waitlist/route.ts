// POST /api/trade-off/waitlist
// Body: { tier: "starter" | "business", tradeName, email, companyName?, country?, whatsapp? }
//
// Captures a waitlist signup for STARTER (£9.99/mo) or BUSINESS
// (£24.99/mo). Both tiers are marketing-visible on the pricing page
// but not yet actionable — this route stores the intent so we can
// email them when the tier goes live.
//
// Persistence: inserts into hammerex_plan_waitlist (Supabase). If the
// table doesn't exist yet (migration not run) we fall back to an admin
// console log so we never lose a lead.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminWhatsapp } from "@/lib/whatsapp";
import { whatsappDigits } from "@/lib/tradeOff";

export const runtime = "nodejs";

const ALLOWED_TIERS = new Set(["starter", "business"]);

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
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const tier = s(body.tier).toLowerCase();
  const tradeName = s(body.tradeName).slice(0, 120);
  const companyName = s(body.companyName).slice(0, 160);
  const country = s(body.country).slice(0, 80);
  const email = s(body.email).slice(0, 200).toLowerCase();
  const whatsapp = s(body.whatsapp).slice(0, 40);

  if (!ALLOWED_TIERS.has(tier)) {
    return NextResponse.json(
      { ok: false, error: "Choose a valid tier (starter or business)." },
      { status: 400 }
    );
  }
  if (!tradeName) {
    return NextResponse.json(
      { ok: false, error: "Trade name is required." },
      { status: 400 }
    );
  }
  if (!email || !looksLikeEmail(email)) {
    return NextResponse.json(
      { ok: false, error: "A valid email is required." },
      { status: 400 }
    );
  }

  // Insert. If the table doesn't exist (migration not yet applied) or
  // the row is a duplicate, we still return success so the merchant's
  // UX is idempotent and never lost.
  let stored = false;
  try {
    const res = await supabaseAdmin.from("hammerex_plan_waitlist").insert({
      tier,
      trade_name: tradeName,
      company_name: companyName || null,
      country: country || null,
      email,
      whatsapp: whatsapp || null,
      source_path: `/trade-off/waitlist?tier=${tier}`
    });
    if (!res.error) {
      stored = true;
    } else if (res.error.code === "23505") {
      // Already on the waitlist for this tier — idempotent success.
      stored = true;
    } else {
      console.warn(
        "[plan-waitlist] insert failed, falling back to admin notify:",
        res.error.code,
        res.error.message
      );
    }
  } catch (err) {
    console.warn("[plan-waitlist] insert threw:", err);
  }

  // Always log for admin visibility so a missing migration never
  // costs us a lead.
  try {
    const adminDigits = whatsappDigits(adminWhatsapp());
    const priceLabel = tier === "starter" ? "£9.99/mo" : "£24.99/mo";
    const lines = [
      `🟡 NEW Xrated ${tier.toUpperCase()} waitlist signup (${priceLabel})`,
      "",
      `Trade: ${tradeName}`,
      companyName ? `Company: ${companyName}` : "Company: —",
      country ? `Country: ${country}` : "Country: —",
      `Email: ${email}`,
      whatsapp ? `WhatsApp: ${whatsapp}` : "WhatsApp: —",
      "",
      `Persisted: ${stored ? "yes" : "FALLBACK (table missing — run migration)"}`
    ];
    void adminDigits;
    console.log("[plan-waitlist]", lines.join(" | "));
  } catch (err) {
    console.warn("[plan-waitlist] admin notify failed:", err);
  }

  return NextResponse.json({ ok: true, stored, tier });
}
