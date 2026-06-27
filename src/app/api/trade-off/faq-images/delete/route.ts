// POST /api/trade-off/faq-images/delete
// Magic-link authenticated. Body: { slug, edit_token, image_id }.
// Hard delete — images are local to a single FAQ row and don't carry
// inbound public URLs the way Downloads files do, so removing the row
// is safe. The Storage object remains in the bucket; we don't actively
// orphan-collect today.

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
  const imageId = s(body.image_id);

  if (!slug || !token || !imageId) {
    return NextResponse.json(
      { ok: false, error: "Missing slug, edit_token, or image_id." },
      { status: 400 }
    );
  }
  if (!UUID_RE.test(imageId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid image id." },
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

  // Confirm the image's parent FAQ belongs to this listing.
  const img = await supabaseAdmin
    .from("hammerex_xrated_faq_images")
    .select("id, faq_id")
    .eq("id", imageId)
    .maybeSingle();
  if (!img.data) {
    return NextResponse.json({ ok: false, error: "Image not found." }, { status: 404 });
  }
  const faq = await supabaseAdmin
    .from("hammerex_xrated_faq_items")
    .select("id")
    .eq("id", img.data.faq_id)
    .eq("listing_id", listing.data.id)
    .maybeSingle();
  if (!faq.data) {
    return NextResponse.json(
      { ok: false, error: "Image not found for this listing." },
      { status: 404 }
    );
  }

  const del = await supabaseAdmin
    .from("hammerex_xrated_faq_images")
    .delete()
    .eq("id", imageId);
  if (del.error) {
    console.error("[trade-off/faq-images/delete] delete failed:", del.error);
    return NextResponse.json(
      { ok: false, error: del.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
