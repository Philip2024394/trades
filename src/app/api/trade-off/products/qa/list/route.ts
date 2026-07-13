// GET /api/trade-off/products/qa/list?slug=&edit_token=&product_id=
//
// Merchant-side Q&A list. Returns every question on the product
// (including moderation-hidden — trades want to know when something
// was flagged) with all attached answers stitched. Auth via
// slug + edit_token constant-time compare.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = s(url.searchParams.get("slug"));
  const editToken = s(url.searchParams.get("edit_token"));
  const productId = s(url.searchParams.get("product_id"));

  if (!slug || !editToken) {
    return NextResponse.json(
      { ok: false, error: "missing_auth" },
      { status: 400 }
    );
  }
  if (!UUID_RE.test(productId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_product_id" },
      { status: 400 }
    );
  }

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

  const product = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select("id, listing_id")
    .eq("id", productId)
    .maybeSingle();
  if (!product.data || product.data.listing_id !== listing.data.id) {
    return NextResponse.json(
      { ok: false, error: "product_not_yours" },
      { status: 404 }
    );
  }

  const questionsRes = await supabaseAdmin
    .from("hammerex_xrated_questions")
    .select(
      "id, product_id, asked_by, body, flag_count, moderation_status, moderated_at, deleted_at, created_at"
    )
    .eq("product_id", productId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  const qRows = questionsRes.data ?? [];

  let answersByQ = new Map<
    string,
    Array<{
      id: string;
      body: string;
      by_vendor: boolean;
      by_name: string | null;
      created_at: string;
    }>
  >();
  if (qRows.length > 0) {
    const aRes = await supabaseAdmin
      .from("hammerex_xrated_answers")
      .select("id, question_id, body, by_vendor, by_name, moderation_status, deleted_at, created_at")
      .in(
        "question_id",
        qRows.map((q) => q.id as string)
      )
      .is("deleted_at", null);
    for (const a of aRes.data ?? []) {
      const arr = answersByQ.get(a.question_id as string) ?? [];
      arr.push({
        id: a.id as string,
        body: a.body as string,
        by_vendor: a.by_vendor as boolean,
        by_name: (a.by_name as string | null) ?? null,
        created_at: a.created_at as string
      });
      answersByQ.set(a.question_id as string, arr);
    }
  }

  const shaped = qRows.map((q) => ({
    id: q.id as string,
    asked_by: (q.asked_by as string | null) ?? null,
    body: q.body as string,
    moderation_status: q.moderation_status as "live" | "hidden" | "spam",
    flag_count: q.flag_count as number,
    created_at: q.created_at as string,
    answers: answersByQ.get(q.id as string) ?? []
  }));

  return NextResponse.json({ ok: true, questions: shaped });
}
