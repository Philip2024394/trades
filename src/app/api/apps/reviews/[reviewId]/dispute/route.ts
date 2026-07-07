// POST /api/apps/reviews/[reviewId]/dispute — merchant flags for admin review.
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { reason?: unknown; evidenceUrls?: unknown };

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ reviewId: string }> }
) {
  const { reviewId } = await ctx.params;
  const merchantId = await getMerchantIdFromRequest(null);
  if (!merchantId) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 }
    );
  }
  const { data: review } = await supabaseAdmin
    .from("app_reviews_reviews")
    .select("id, merchant_id, visibility")
    .eq("id", reviewId)
    .maybeSingle();
  if (!review || review.merchant_id !== merchantId) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }
  const reason =
    typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : "";
  const evidenceUrls = Array.isArray(body.evidenceUrls)
    ? body.evidenceUrls.filter((v): v is string => typeof v === "string")
    : [];
  if (reason.length < 10) {
    return NextResponse.json(
      { ok: false, error: "Explain the dispute in a few sentences." },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin.from("app_reviews_disputes").insert({
    review_id: reviewId,
    merchant_id: merchantId,
    reason,
    evidence_urls: evidenceUrls
  });
  if (error) {
    return NextResponse.json(
      { ok: false, error: "Could not raise dispute." },
      { status: 500 }
    );
  }

  await supabaseAdmin
    .from("app_reviews_reviews")
    .update({ visibility: "disputed_pending" })
    .eq("id", reviewId);

  return NextResponse.json({ ok: true });
}
