// POST /api/merchant/assets/generate
//
// Body: { kind, template_slug, headline }
//
// Creates (or refreshes) a merchant asset row. Enforces the
// 30-day free-refresh cooldown per kind unless the merchant paid
// £1.99 for instant refresh on the existing latest asset.
//
// Returns the new asset's id — the caller then hits
// /api/merchant/assets/download?id=... to grab the PDF.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { TEMPLATES, type AssetKind } from "@/lib/assetEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_KINDS: AssetKind[] = ["site_poster", "google_review", "business_card"];

export async function POST(req: NextRequest): Promise<NextResponse> {
  const slug = await getMerchantSlug();
  if (!slug) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    kind?: string; template_slug?: string; headline?: string
  } | null;
  const kind         = String(body?.kind ?? "") as AssetKind;
  const templateSlug = String(body?.template_slug ?? "");
  const headline     = (body?.headline ?? "").toString().slice(0, 60);

  if (!VALID_KINDS.includes(kind)) return NextResponse.json({ ok: false, error: "invalid_kind" }, { status: 400 });
  const template = TEMPLATES.find((t) => t.slug === templateSlug && t.kind === kind);
  if (!template) return NextResponse.json({ ok: false, error: "invalid_template" }, { status: 400 });

  // 30-day cooldown check — only for refreshes (not first-ever)
  const { data: latest } = await supabaseAdmin
    .from("hammerex_merchant_assets")
    .select("id, refresh_number, next_free_refresh_at, instant_refresh_paid_at")
    .eq("merchant_slug", slug)
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let refreshNumber = 1;
  if (latest) {
    refreshNumber = (latest.refresh_number ?? 0) + 1;
    const now = Date.now();
    const nextFree = latest.next_free_refresh_at ? Date.parse(latest.next_free_refresh_at) : 0;
    const paidInstant = !!latest.instant_refresh_paid_at;
    if (!paidInstant && now < nextFree) {
      return NextResponse.json({
        ok: false,
        error: "cooldown_active",
        next_free_refresh_at: latest.next_free_refresh_at,
        pay_to_skip: { priceGbp: 199, sku: "asset.instant_refresh" }
      }, { status: 402 });
    }
    // Consume the instant-refresh paid unlock if present
    if (paidInstant) {
      await supabaseAdmin
        .from("hammerex_merchant_assets")
        .update({ instant_refresh_paid_at: null })
        .eq("id", latest.id);
    }
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("hammerex_merchant_assets")
    .insert({
      merchant_slug:  slug,
      kind,
      template_slug:  template.slug,
      headline:       headline || null,
      refresh_number: refreshNumber
    })
    .select("id, kind, template_slug, headline, refresh_number, created_at, next_free_refresh_at")
    .single();

  if (insErr || !inserted) return NextResponse.json({ ok: false, error: insErr?.message ?? "insert_failed" }, { status: 500 });

  return NextResponse.json({ ok: true, asset: inserted });
}
