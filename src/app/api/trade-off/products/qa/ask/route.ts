// POST /api/trade-off/products/qa/ask
//   { product_id, body, asked_by? }
//
// Public — no sign-in required. Any visitor can ask a question about
// a product. The trade (via their editor) is responsible for answering
// or letting the question age out. Moderation is passive: rows default
// to 'live' and only flip to 'hidden' when a moderator acts (Phase 9b
// covers the flag endpoint).
//
// Rate-limit guardrails: enforce body length + optional asked_by
// length at both edges. Duplicate detection is left to moderation.

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

  const productId = s(body.product_id);
  const question = s(body.body);
  const askedBy = s(body.asked_by);

  if (!UUID_RE.test(productId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_product_id" },
      { status: 400 }
    );
  }
  if (question.length < 3 || question.length > 500) {
    return NextResponse.json(
      { ok: false, error: "invalid_body_length" },
      { status: 400 }
    );
  }
  if (askedBy && askedBy.length > 60) {
    return NextResponse.json(
      { ok: false, error: "invalid_asked_by" },
      { status: 400 }
    );
  }

  // Confirm the product exists + is live (don't accept questions on
  // archived products — no one is answering them).
  const productRes = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select("id, status")
    .eq("id", productId)
    .maybeSingle();
  if (!productRes.data || productRes.data.status !== "live") {
    return NextResponse.json(
      { ok: false, error: "product_not_available" },
      { status: 404 }
    );
  }

  const insertRes = await supabaseAdmin
    .from("hammerex_xrated_questions")
    .insert({
      product_id: productId,
      body: question,
      asked_by: askedBy.length > 0 ? askedBy : null
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
    questionId: insertRes.data.id,
    createdAt: insertRes.data.created_at
  });
}
