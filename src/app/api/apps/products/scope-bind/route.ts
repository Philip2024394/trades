// POST /api/apps/products/scope-bind
//
// Merchant binds one or more Products offers to a specific AI
// Visualiser catalogue leaf they've ticked. The offers become the
// authoritative product options rendered in the design tree for that
// leaf — the Visualiser stops using generic taxonomy options and
// starts specifying real SKUs.
//
// This is the AI-Visualiser × Products handshake. It uses the extension
// column `bound_offer_ids` added by the Products migration; no direct
// app-to-app storage crossing.
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  requireMerchantSession,
  MerchantNotAuthenticatedError
} from "@/lib/os/merchantSession";
import { hasActiveEntitlement } from "@/lib/os/billing/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  leafSlug?: unknown;
  offerIds?: unknown;
};

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireMerchantSession();
  } catch (e) {
    if (e instanceof MerchantNotAuthenticatedError) {
      return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
    }
    throw e;
  }
  const [productsEntitled, visualiserEntitled] = await Promise.all([
    hasActiveEntitlement(session.merchantId, "products"),
    hasActiveEntitlement(session.merchantId, "ai-visualiser")
  ]);
  if (!productsEntitled || !visualiserEntitled) {
    return NextResponse.json(
      { ok: false, error: "Both Products and AI Visualiser plans required." },
      { status: 402 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const leafSlug = typeof body.leafSlug === "string" ? body.leafSlug.trim() : "";
  const offerIds = Array.isArray(body.offerIds)
    ? body.offerIds.filter((v): v is string => typeof v === "string")
    : [];
  if (!leafSlug) {
    return NextResponse.json({ ok: false, error: "leafSlug required." }, { status: 400 });
  }

  // Verify every offer belongs to this merchant.
  if (offerIds.length > 0) {
    const { data: ownedCount } = await supabaseAdmin
      .from("app_products_merchant_offers")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", session.merchantId)
      .in("id", offerIds);
    if ((ownedCount as unknown as { count: number } | null)?.count !== offerIds.length) {
      // Some offers not owned — reject the whole call.
      const { data: owned } = await supabaseAdmin
        .from("app_products_merchant_offers")
        .select("id")
        .eq("merchant_id", session.merchantId)
        .in("id", offerIds);
      const ownedSet = new Set((owned || []).map((r) => r.id as string));
      const missing = offerIds.filter((id) => !ownedSet.has(id));
      if (missing.length > 0) {
        return NextResponse.json(
          { ok: false, error: `Offers not owned: ${missing.join(",")}` },
          { status: 403 }
        );
      }
    }
  }

  await supabaseAdmin
    .from("app_ai_visualiser_catalogue_scope")
    .upsert(
      {
        merchant_id: session.merchantId,
        leaf_slug: leafSlug,
        bound_offer_ids: offerIds,
        is_enabled: true
      },
      { onConflict: "merchant_id,leaf_slug" }
    );

  return NextResponse.json({ ok: true, count: offerIds.length });
}
