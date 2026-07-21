// POST /api/videos/[id]/ask-ai
// Networkers TV — Ask AI a question about a specific video.
//
// Cost: 1 washer per question (charged to the merchant session).
// Anonymous / homeowner sessions: free (initial UX — will gate
// homeowners behind sign-in when abuse becomes an issue).
//
// Uses the video's enriched metadata as context. Never fabricates
// specifics — if the answer isn't in the context, the LLM is
// instructed to say so honestly + suggest the trade profile as
// the next step.

import { NextResponse } from "next/server";
import { getMerchantSlug } from "@/lib/merchantSession";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { spendWashers } from "@/lib/washers";
import { askVideoAI } from "@/lib/videos/aiEnrich";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

const WASHERS_PER_QUERY = 1;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let body: { question?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  const question = (body.question ?? "").trim();
  if (question.length < 4) {
    return NextResponse.json({ ok: false, error: "question-too-short" }, { status: 400 });
  }
  if (question.length > 500) {
    return NextResponse.json({ ok: false, error: "question-too-long", max: 500 }, { status: 400 });
  }

  const { id: videoId } = await params;

  // Auth — merchant OR homeowner OR anonymous
  const merchantSlug = await getMerchantSlug();
  const homeowner    = merchantSlug ? null : await getHomeownerFromCookie();
  const actorKind: "trade" | "homeowner" | "anonymous" =
    merchantSlug ? "trade" : homeowner ? "homeowner" : "anonymous";
  const actorId = merchantSlug ?? homeowner?.id ?? null;

  // Washer gate — merchants pay 1 washer per query
  let washerSpend: { transactionId: string; balance: number } | null = null;
  if (merchantSlug) {
    const spend = await spendWashers({
      merchantSlug,
      amount: WASHERS_PER_QUERY,
      source: "networkers-tv-ai-query",
      detail: { video_id: videoId, question: question.slice(0, 120) }
    });
    if (!spend.ok) {
      return NextResponse.json({
        ok: false, error: spend.reason,
        balance: "balance" in spend ? spend.balance : undefined,
        cost:    WASHERS_PER_QUERY
      }, { status: spend.reason === "insufficient-balance" ? 402 : 500 });
    }
    washerSpend = { transactionId: spend.transactionId, balance: spend.balance };
  }

  // Call LLM
  const result = await askVideoAI(videoId, question);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  // Record the metric event
  await supabaseAdmin
    .from("hammerex_video_metrics")
    .insert({
      video_id:   videoId,
      event:      "ai_assistant_query",
      actor_kind: actorKind,
      actor_slug: actorId,
      metadata:   { question: question.slice(0, 200), answer_length: result.answer!.length }
    })
    .then(() => undefined)
    .catch(() => undefined);

  return NextResponse.json({
    ok:                  true,
    answer:              result.answer,
    sections:            result.sections ?? null,
    sources:             result.sources ?? [],
    knowledge_hit_count: result.knowledgeHitCount ?? 0,
    needs_specialist:    result.needsSpecialist ?? false,
    specialist_trade:    result.specialistTrade ?? null,
    merchant_categories: result.merchantCategories ?? [],
    trade_categories:    result.tradeCategories ?? [],
    cost:                merchantSlug ? WASHERS_PER_QUERY : 0,
    washer_spend:        washerSpend
  });
}
