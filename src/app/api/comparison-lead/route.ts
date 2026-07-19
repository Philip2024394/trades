// POST /api/comparison-lead   { email, trade_slug?, city? }
//
// Lead capture from the "Networkers vs top 100 trade platforms"
// comparison section. Homeowner or (more commonly) prospective
// trade enters their email to receive the full comparison report.
//
// UPSERT keyed on (email, source) — resubmits update the record
// silently rather than error, so a merchant hitting "send me the
// report" twice doesn't get a scary error.
//
// Reply email delivery deferred to a follow-up job (admin can send
// manually from /admin/comparison-leads for now).

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export async function POST(req: Request) {
  let body: { email?: unknown; trade_slug?: unknown; city?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid-email" }, { status: 400 });
  }

  const tradeSlug = typeof body.trade_slug === "string" ? body.trade_slug.trim().slice(0, 64) : null;
  const city      = typeof body.city       === "string" ? body.city.trim().slice(0, 64)       : null;
  const ip        = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash    = createHash("sha256").update(ip + "|comparison").digest("hex").slice(0, 32);

  const res = await supabaseAdmin
    .from("hammerex_comparison_leads")
    .upsert(
      {
        email,
        trade_slug: tradeSlug,
        city,
        ip_hash:    ipHash,
        source:     "trade-off-compare"
      },
      { onConflict: "email,source" }
    );

  if (res.error) {
    console.error("[comparison-lead] insert failed:", res.error);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }

  return NextResponse.json({
    ok:      true,
    message: "Thanks — we'll email you the full 100-platform comparison shortly."
  });
}
