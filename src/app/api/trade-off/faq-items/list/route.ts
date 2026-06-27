// GET/POST /api/trade-off/faq-items/list
// Returns the listing's FAQ items (live + archived) ordered with live
// first, then by sort_order. Each row carries its attached images.
// Used by the dashboard editor.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  HammerexXratedFaqItem,
  HammerexXratedFaqImage
} from "@/lib/supabase";

export const runtime = "nodejs";

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

async function handle(slug: string, token: string) {
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

  const faqsRes = await supabaseAdmin
    .from("hammerex_xrated_faq_items")
    .select("*")
    .eq("listing_id", listing.data.id)
    .order("status", { ascending: true })
    .order("sort_order", { ascending: true });

  if (faqsRes.error) {
    console.error("[trade-off/faq-items/list] select failed:", faqsRes.error);
    return NextResponse.json(
      { ok: false, error: faqsRes.error.message },
      { status: 500 }
    );
  }

  const faqs = (faqsRes.data ?? []) as HammerexXratedFaqItem[];
  const faqIds = faqs.map((f) => f.id);

  let imagesByFaq: Record<string, HammerexXratedFaqImage[]> = {};
  if (faqIds.length > 0) {
    const imgRes = await supabaseAdmin
      .from("hammerex_xrated_faq_images")
      .select("*")
      .in("faq_id", faqIds)
      .order("sort_order", { ascending: true });
    if (imgRes.error) {
      console.error("[trade-off/faq-items/list] image select failed:", imgRes.error);
      return NextResponse.json(
        { ok: false, error: imgRes.error.message },
        { status: 500 }
      );
    }
    imagesByFaq = ((imgRes.data ?? []) as HammerexXratedFaqImage[]).reduce<
      Record<string, HammerexXratedFaqImage[]>
    >((acc, img) => {
      (acc[img.faq_id] = acc[img.faq_id] ?? []).push(img);
      return acc;
    }, {});
  }

  const faqsWithImages = faqs.map((f) => ({
    ...f,
    images: imagesByFaq[f.id] ?? []
  }));

  return NextResponse.json({ ok: true, faqs: faqsWithImages });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  return handle(
    s(url.searchParams.get("slug")),
    s(url.searchParams.get("edit_token"))
  );
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  return handle(s(body.slug), s(body.edit_token));
}
