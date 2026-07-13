// POST /api/canteens/[slug]/products/create
//
// Host-only. Adds a product to a canteen the caller runs. The
// authorization gate matches on hammerex_canteens.host_slug =
// merchant-session.slug — that's the only role we allow product
// writes for right now (moderators later, once we introduce a
// canteen-scoped permissions column).
//
// Contract:
//   POST { name, blurb?, description?, imageUrl?, priceGbp,
//          specs?, tradeCenterListingId?, featured? }
//   → 200 { ok: true, id }

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdentity } from "@/lib/merchantSession";

type ProductPayload = {
  name: string;
  blurb?: string;
  description?: string;
  imageUrl?: string;
  priceGbp: number;
  specs?: string[];
  tradeCenterListingId?: string;
  featured?: boolean;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const identity = await getMerchantIdentity();
  if (!identity) {
    return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
  }

  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ ok: false, error: "missing-slug" }, { status: 400 });
  }

  let payload: ProductPayload;
  try {
    payload = (await req.json()) as ProductPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const name = String(payload.name ?? "").trim();
  const priceGbp = Number(payload.priceGbp);
  if (!name || name.length < 3 || name.length > 160) {
    return NextResponse.json({ ok: false, error: "invalid-name" }, { status: 400 });
  }
  if (!Number.isFinite(priceGbp) || priceGbp < 0 || priceGbp > 100000) {
    return NextResponse.json({ ok: false, error: "invalid-price" }, { status: 400 });
  }

  // Ownership gate — canteen must exist and its host_slug must match
  // the signed-in merchant.
  const canteen = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, host_slug")
    .eq("slug", slug)
    .maybeSingle();

  if (canteen.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.products.create] canteen lookup", canteen.error);
    return NextResponse.json({ ok: false, error: "db-lookup-failed" }, { status: 500 });
  }
  if (!canteen.data) {
    return NextResponse.json({ ok: false, error: "canteen-not-found" }, { status: 404 });
  }
  if (canteen.data.host_slug !== identity.slug) {
    return NextResponse.json({ ok: false, error: "not-host" }, { status: 403 });
  }

  const insert = await supabaseAdmin
    .from("hammerex_canteen_products")
    .insert({
      canteen_id: canteen.data.id,
      host_slug: identity.slug,
      name,
      blurb: payload.blurb?.trim() ?? null,
      description: payload.description?.trim() ?? null,
      image_url: payload.imageUrl?.trim() ?? null,
      price_gbp: Math.round(priceGbp),
      specs: payload.specs ?? null,
      trade_center_listing_id: payload.tradeCenterListingId?.trim() ?? null,
      featured: payload.featured === true
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    // eslint-disable-next-line no-console
    console.error("[canteens.products.create] insert failed", insert.error);
    return NextResponse.json(
      { ok: false, error: "db-insert-failed", detail: insert.error?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: insert.data.id });
}
