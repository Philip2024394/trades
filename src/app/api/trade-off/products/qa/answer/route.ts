// POST /api/trade-off/products/qa/answer
//   { slug, edit_token, question_id, body }
//
// Merchant-side answer flow. Trade uses their edit_token to post an
// official answer to a customer question on one of their own
// products. `by_vendor: true` is set server-side so a customer can't
// spoof the "Trade" badge by hitting a public answer route (we don't
// have one yet; when we do, that route will hard-code `by_vendor: false`).
//
// Guards:
//   • Constant-time slug + edit_token compare
//   • Question must belong to a product owned by this listing
//   • Body 3–1000 chars

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
  const questionId = s(body.question_id);
  const answerBody = s(body.body);

  if (!slug || !editToken) {
    return NextResponse.json(
      { ok: false, error: "missing_auth" },
      { status: 400 }
    );
  }
  if (!UUID_RE.test(questionId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_question_id" },
      { status: 400 }
    );
  }
  if (answerBody.length < 3 || answerBody.length > 1000) {
    return NextResponse.json(
      { ok: false, error: "invalid_body_length" },
      { status: 400 }
    );
  }

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

  // Ownership: question → product → listing_id must match
  const q = await supabaseAdmin
    .from("hammerex_xrated_questions")
    .select("id, product_id, moderation_status, deleted_at")
    .eq("id", questionId)
    .maybeSingle();
  if (!q.data || q.data.deleted_at || q.data.moderation_status !== "live") {
    return NextResponse.json(
      { ok: false, error: "question_not_found" },
      { status: 404 }
    );
  }
  const p = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select("id, listing_id")
    .eq("id", q.data.product_id)
    .maybeSingle();
  if (!p.data || p.data.listing_id !== listing.data.id) {
    return NextResponse.json(
      { ok: false, error: "question_not_yours" },
      { status: 403 }
    );
  }

  const insertRes = await supabaseAdmin
    .from("hammerex_xrated_answers")
    .insert({
      question_id: questionId,
      body: answerBody,
      by_vendor: true,
      by_name: null
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

  return NextResponse.json({
    ok: true,
    answerId: insertRes.data.id,
    createdAt: insertRes.data.created_at
  });
}
