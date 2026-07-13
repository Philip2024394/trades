// POST /api/trade-off/install-leads/status
//   { slug, edit_token, lead_id, lead_status, note? }
//
// Merchant / installer marks a lead as follow_up / won / lost / open
// with an optional note. Ownership check accepts either side — a lead
// row is owned by BOTH the merchant selling the anchor product AND
// the installer offering the service, and either can update it.
//
// The `open` transition is a legitimate reopen path — the trade might
// have marked a lead lost then heard back from the shopper. No
// audit trail today; status_updated_at just holds the latest write.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_STATUSES = new Set(["open", "follow_up", "won", "lost"]);

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

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

  const slug = s(body.slug);
  const editToken = s(body.edit_token);
  const leadId = s(body.lead_id);
  const status = s(body.lead_status);
  const noteRaw = s(body.note);

  if (!slug || !editToken) {
    return NextResponse.json(
      { ok: false, error: "missing_auth" },
      { status: 400 }
    );
  }
  if (!UUID_RE.test(leadId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_lead_id" },
      { status: 400 }
    );
  }
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json(
      { ok: false, error: "invalid_status" },
      { status: 400 }
    );
  }
  if (noteRaw && noteRaw.length > 500) {
    return NextResponse.json(
      { ok: false, error: "note_too_long" },
      { status: 400 }
    );
  }
  const note = noteRaw.length > 0 ? noteRaw : null;

  // Auth: slug + edit_token → listing_id
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing.data || !constantTimeEq(listing.data.edit_token, editToken)) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401 }
    );
  }

  // Ownership: lead's anchor OR installer product must belong to
  // this listing.
  const leadRes = await supabaseAdmin
    .from("hammerex_xrated_install_leads")
    .select("id, anchor_product_id, installer_service_id")
    .eq("id", leadId)
    .maybeSingle();
  if (!leadRes.data) {
    return NextResponse.json(
      { ok: false, error: "lead_not_found" },
      { status: 404 }
    );
  }

  const productsRes = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select("id, listing_id")
    .in("id", [leadRes.data.anchor_product_id, leadRes.data.installer_service_id]);
  const owns = (productsRes.data ?? []).some(
    (p) => p.listing_id === listing.data.id
  );
  if (!owns) {
    return NextResponse.json(
      { ok: false, error: "not_your_lead" },
      { status: 403 }
    );
  }

  const updateRes = await supabaseAdmin
    .from("hammerex_xrated_install_leads")
    .update({
      lead_status: status,
      status_note: note,
      status_updated_at: new Date().toISOString()
    })
    .eq("id", leadId)
    .select("id, lead_status, status_updated_at")
    .single();

  if (updateRes.error || !updateRes.data) {
    return NextResponse.json(
      {
        ok: false,
        error: "update_failed",
        detail: updateRes.error?.message
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    leadId: updateRes.data.id,
    status: updateRes.data.lead_status,
    updatedAt: updateRes.data.status_updated_at
  });
}
