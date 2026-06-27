// POST /api/trade-off/faq-items/delete
// Magic-link authenticated. Body: { slug, edit_token, faq_id }.
// Soft delete — flips status to 'archived' so any external links to the
// FAQ anchor (#faq-001) keep resolving. Hard delete would break inbound
// links the tradesperson has already shared.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

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
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const slug = s(body.slug);
  const token = s(body.edit_token);
  const faqId = s(body.faq_id);

  if (!slug || !token || !faqId) {
    return NextResponse.json(
      { ok: false, error: "Missing slug, edit_token, or faq_id." },
      { status: 400 }
    );
  }
  if (!UUID_RE.test(faqId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid faq id." },
      { status: 400 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", slug)
    .maybeSingle();

  if (!listing.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (!constantTimeEq(listing.data.edit_token, token)) {
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 403 });
  }

  const upd = await supabaseAdmin
    .from("hammerex_xrated_faq_items")
    .update({ status: "archived" })
    .eq("id", faqId)
    .eq("listing_id", listing.data.id)
    .select("id")
    .maybeSingle();

  if (upd.error) {
    console.error("[trade-off/faq-items/delete] update failed:", upd.error);
    return NextResponse.json(
      { ok: false, error: upd.error.message },
      { status: 500 }
    );
  }
  if (!upd.data) {
    return NextResponse.json(
      { ok: false, error: "FAQ not found." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
