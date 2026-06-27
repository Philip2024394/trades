// POST /api/trade-off/faq-images/upsert
// Magic-link authenticated. Body: { slug, edit_token, image: { id?, faq_id, image_url, title, alt_text?, sort_order? } }.
// When id is present, UPDATE WHERE the parent FAQ belongs to this
// listing. INSERTs are capped at 3 per FAQ — the DB trigger enforces the
// hard limit; we double-check here for a friendlier error.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;
const MAX_IMAGES_PER_FAQ = 3;

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function nonNegInt(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
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
  const imgIn = (body.image && typeof body.image === "object"
    ? body.image
    : {}) as Record<string, unknown>;

  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or edit_token." },
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

  const faqId = s(imgIn.faq_id);
  if (!UUID_RE.test(faqId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid faq_id." },
      { status: 400 }
    );
  }

  // Verify the FAQ belongs to this listing.
  const faq = await supabaseAdmin
    .from("hammerex_xrated_faq_items")
    .select("id")
    .eq("id", faqId)
    .eq("listing_id", listing.data.id)
    .maybeSingle();
  if (!faq.data) {
    return NextResponse.json(
      { ok: false, error: "FAQ not found for this listing." },
      { status: 404 }
    );
  }

  const title = s(imgIn.title);
  if (title.length < 1 || title.length > 80) {
    return NextResponse.json(
      { ok: false, error: "Title must be 1-80 characters." },
      { status: 400 }
    );
  }

  const altRaw = s(imgIn.alt_text);
  const alt_text = altRaw.length > 0 ? altRaw.slice(0, 200) : null;

  const image_url = s(imgIn.image_url).slice(0, 600);
  if (!image_url) {
    return NextResponse.json(
      { ok: false, error: "Upload an image first." },
      { status: 400 }
    );
  }

  const sort_order = nonNegInt(imgIn.sort_order);

  const idRaw = s(imgIn.id);
  if (idRaw) {
    if (!UUID_RE.test(idRaw)) {
      return NextResponse.json(
        { ok: false, error: "Invalid image id." },
        { status: 400 }
      );
    }
    const upd = await supabaseAdmin
      .from("hammerex_xrated_faq_images")
      .update({ image_url, title, alt_text, sort_order })
      .eq("id", idRaw)
      .eq("faq_id", faqId)
      .select("*")
      .maybeSingle();
    if (upd.error) {
      console.error("[trade-off/faq-images/upsert] update failed:", upd.error);
      return NextResponse.json(
        { ok: false, error: upd.error.message },
        { status: 500 }
      );
    }
    if (!upd.data) {
      return NextResponse.json(
        { ok: false, error: "Image not found." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, image: upd.data });
  }

  // Friendlier cap check before the trigger fires.
  const countRes = await supabaseAdmin
    .from("hammerex_xrated_faq_images")
    .select("id", { count: "exact", head: true })
    .eq("faq_id", faqId);
  if (countRes.error) {
    console.error("[trade-off/faq-images/upsert] count failed:", countRes.error);
    return NextResponse.json(
      { ok: false, error: countRes.error.message },
      { status: 500 }
    );
  }
  if ((countRes.count ?? 0) >= MAX_IMAGES_PER_FAQ) {
    return NextResponse.json(
      {
        ok: false,
        error: `Max ${MAX_IMAGES_PER_FAQ} images per FAQ. Remove one first.`
      },
      { status: 400 }
    );
  }

  const ins = await supabaseAdmin
    .from("hammerex_xrated_faq_images")
    .insert({
      faq_id: faqId,
      image_url,
      title,
      alt_text,
      sort_order
    })
    .select("*")
    .maybeSingle();
  if (ins.error || !ins.data) {
    console.error("[trade-off/faq-images/upsert] insert failed:", ins.error);
    return NextResponse.json(
      { ok: false, error: ins.error?.message ?? "Insert failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, image: ins.data });
}
