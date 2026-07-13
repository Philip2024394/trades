// POST /api/trade-off/nearby-installers/pair
//   { anchor_product_id, installer_service_id, buyer_contact? }
//
// Logs one row in hammerex_xrated_install_leads so both the merchant
// and the installer can see the pairing later. Returns a pre-composed
// WhatsApp deep-link so the client can hand the shopper straight off
// to the installer without a second round-trip.
//
// Public — no sign-in required. Rate-limiting + spam control are left
// to a follow-up (Phase Bb) since the write path costs nothing until
// the volume warrants it.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 }
    );
  }

  const anchorId = s(body.anchor_product_id);
  const serviceId = s(body.installer_service_id);
  const buyerContact = s(body.buyer_contact);
  const sourceRaw = s(body.source) || "pdp";
  const source =
    sourceRaw === "cart" || sourceRaw === "checkout" || sourceRaw === "other"
      ? sourceRaw
      : "pdp";

  if (!UUID_RE.test(anchorId) || !UUID_RE.test(serviceId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_ids" },
      { status: 400 }
    );
  }
  if (anchorId === serviceId) {
    return NextResponse.json(
      { ok: false, error: "anchor_is_service" },
      { status: 400 }
    );
  }
  if (buyerContact && buyerContact.length > 100) {
    return NextResponse.json(
      { ok: false, error: "invalid_buyer_contact" },
      { status: 400 }
    );
  }

  // Resolve both rows in one round-trip; verify anchor is a product
  // and service is a live kind='service' with the matching category.
  const rows = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select(
      "id, name, kind, price_pence, status, listing_id, service_category, install_service_category"
    )
    .in("id", [anchorId, serviceId]);
  const anchor = (rows.data ?? []).find((r) => r.id === anchorId);
  const service = (rows.data ?? []).find((r) => r.id === serviceId);
  if (!anchor || anchor.status !== "live") {
    return NextResponse.json(
      { ok: false, error: "anchor_not_available" },
      { status: 404 }
    );
  }
  if (!service || service.status !== "live" || service.kind !== "service") {
    return NextResponse.json(
      { ok: false, error: "installer_not_available" },
      { status: 404 }
    );
  }
  if (!anchor.install_service_category) {
    return NextResponse.json(
      { ok: false, error: "anchor_has_no_install_category" },
      { status: 400 }
    );
  }
  if (service.service_category !== anchor.install_service_category) {
    return NextResponse.json(
      { ok: false, error: "install_category_mismatch" },
      { status: 400 }
    );
  }

  // Grab the installer's whatsapp so we can hand back a ready-to-open
  // wa.me URL. Cheap second query — installer_service_id → listing_id
  // was already joined-out above, we just need whatsapp + names.
  const installerListingRes = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, display_name, trading_name, whatsapp, status")
    .eq("id", service.listing_id)
    .maybeSingle();
  const installerListing = installerListingRes.data;
  if (!installerListing || installerListing.status !== "live") {
    return NextResponse.json(
      { ok: false, error: "installer_listing_offline" },
      { status: 404 }
    );
  }

  // Merchant name — for the WhatsApp message ("I'm ordering XYZ from
  // <merchant>"). Second cheap query.
  const merchantListingRes = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("display_name, trading_name")
    .eq("id", anchor.listing_id)
    .maybeSingle();
  const merchantListing = merchantListingRes.data;
  const merchantName =
    (merchantListing?.trading_name as string | null)?.trim() ||
    (merchantListing?.display_name as string | null) ||
    "the merchant";

  const insertRes = await supabaseAdmin
    .from("hammerex_xrated_install_leads")
    .insert({
      anchor_product_id: anchorId,
      installer_service_id: serviceId,
      buyer_contact: buyerContact.length > 0 ? buyerContact : null,
      source
    })
    .select("id, created_at")
    .single();

  if (insertRes.error || !insertRes.data) {
    return NextResponse.json(
      {
        ok: false,
        error: "insert_failed",
        detail: insertRes.error?.message
      },
      { status: 500 }
    );
  }

  // Build the WhatsApp handoff URL. Message intentionally names BOTH
  // parties — the installer knows the source product + merchant, the
  // shopper's action reads clearly on both sides of the thread.
  const installerFirstName =
    (installerListing.display_name as string | null)?.split(/\s+/)[0] ||
    "there";
  const installerDigits = ((installerListing.whatsapp as string | null) ?? "")
    .replace(/\D/g, "");
  const priceLabel = `£${((service.price_pence ?? 0) / 100).toFixed(2)}`;
  const message =
    `Hi ${installerFirstName} — I'm ordering "${anchor.name}" from ${merchantName} ` +
    `and I'd like you to fit it. Your listed rate is ${priceLabel}. ` +
    `When could you do it? (Lead ref: ${insertRes.data.id.slice(0, 8)})`;
  const whatsappUrl = installerDigits
    ? `https://wa.me/${installerDigits}?text=${encodeURIComponent(message)}`
    : null;

  return NextResponse.json({
    ok: true,
    leadId: insertRes.data.id,
    createdAt: insertRes.data.created_at,
    whatsappUrl
  });
}
