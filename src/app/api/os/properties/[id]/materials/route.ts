// GET /api/os/properties/[id]/materials
//
// Materials Passport lookup — public v1. Returns every yard post +
// beacon response tagged to this property_id, with buyer/seller
// identity so the trail reads as an audit chain.
//
// Auth: v1 is knowledge-gated (property_id is a UUID, effectively
// unlisted unless someone shares the URL). v2 will layer a signed
// short-token so a QR sticker on the property gates access.
//
// Returns:
//   { ok, property: { id, address_lookup }, materials: [ ...trail rows ] }

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: propertyId } = await ctx.params;
  if (!propertyId) {
    return NextResponse.json(
      { ok: false, error: "missing_id" },
      { status: 400 }
    );
  }

  // Property row (light — no PII beyond postcode/address_hash).
  const { data: property } = await supabaseAdmin
    .from("os_properties")
    .select("id, address_hash, postcode_prefix, created_at")
    .eq("id", propertyId)
    .maybeSingle();
  if (!property) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 }
    );
  }

  // Yard posts tagged to this property — could be beacons, tools-sell,
  // materials-surplus, etc. Ordered newest first.
  const { data: postRows } = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select(
      "id, listing_id, kind, title, body, image_urls, product_price_pence, price_currency, condition, created_at"
    )
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(200);

  // Beacon responses tagged to this property — records specifically
  // "which trade fulfilled which beacon on this property".
  const { data: respRows } = await supabaseAdmin
    .from("hammerex_yard_beacon_responses")
    .select(
      "id, beacon_post_id, responder_listing_id, message, availability_text, price_pence, is_accepted, created_at"
    )
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(200);

  // Batch-load actor identities so the trail carries names.
  const actorIds = Array.from(
    new Set(
      [
        ...(postRows ?? []).map((r) => r.listing_id),
        ...(respRows ?? []).map((r) => r.responder_listing_id)
      ].filter(Boolean)
    )
  );
  const actors: Record<
    string,
    {
      slug: string;
      display_name: string;
      trading_name: string | null;
      primary_trade: string;
      city: string | null;
    }
  > = {};
  if (actorIds.length > 0) {
    const { data: aRows } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, slug, display_name, trading_name, primary_trade, city")
      .in("id", actorIds);
    for (const a of aRows ?? []) {
      actors[a.id] = {
        slug: a.slug,
        display_name: a.display_name,
        trading_name: a.trading_name,
        primary_trade: a.primary_trade,
        city: a.city
      };
    }
  }

  // Fold into a single time-sorted trail so surveyors read one story,
  // not two lists.
  type TrailRow =
    | {
        kind: "post";
        id: string;
        postKind: string;
        title: string;
        body: string;
        imageUrls: string[];
        pricePence: number | null;
        currency: string | null;
        condition: string | null;
        createdAt: string;
        actor: (typeof actors)[string] | null;
      }
    | {
        kind: "response";
        id: string;
        message: string;
        availability: string | null;
        pricePence: number | null;
        isAccepted: boolean;
        createdAt: string;
        actor: (typeof actors)[string] | null;
      };
  const trail: TrailRow[] = [];
  for (const p of postRows ?? []) {
    trail.push({
      kind: "post",
      id: p.id,
      postKind: p.kind,
      title: p.title,
      body: p.body,
      imageUrls: (p.image_urls ?? []) as string[],
      pricePence: p.product_price_pence,
      currency: p.price_currency ?? null,
      condition: p.condition ?? null,
      createdAt: p.created_at,
      actor: actors[p.listing_id] ?? null
    });
  }
  for (const r of respRows ?? []) {
    trail.push({
      kind: "response",
      id: r.id,
      message: r.message,
      availability: r.availability_text ?? null,
      pricePence: r.price_pence ?? null,
      isAccepted: r.is_accepted,
      createdAt: r.created_at,
      actor: actors[r.responder_listing_id] ?? null
    });
  }
  trail.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  // Aggregate totals for the summary card.
  const totalPence = trail.reduce(
    (acc, row) =>
      "pricePence" in row && row.pricePence !== null
        ? acc + row.pricePence
        : acc,
    0
  );
  const distinctTrades = new Set(
    trail.map((r) => r.actor?.slug).filter(Boolean)
  ).size;

  return NextResponse.json({
    ok: true,
    property: {
      id: property.id,
      postcodePrefix: property.postcode_prefix,
      createdAt: property.created_at
    },
    stats: {
      totalRows: trail.length,
      totalPence,
      distinctTrades
    },
    trail
  });
}
