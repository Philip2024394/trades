// POST /api/studio/discovery
// The merchant submits their 7 answers. Discovery Agent produces a
// BrandRecord v1 draft + fingerprint. Persisted to
// hammerex_brand_identity for downstream Studios to consume.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadStudioSession } from "@/lib/studio/session";
import { runDiscovery, type DiscoveryAnswers } from "@/lib/design/agents/discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await loadStudioSession();
  if (!session) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    trade?:  string;
    answers?: DiscoveryAnswers;
  } | null;

  if (!body?.answers || !body.trade) {
    return NextResponse.json({ ok: false, error: "missing_answers_or_trade" }, { status: 400 });
  }

  const result = await runDiscovery({
    merchant_slug: session.merchant.slug,
    trade:         body.trade,
    answers:       body.answers
  });

  // Upsert Brand Identity for this merchant. Master Rule — Brand DNA
  // is the source of truth for every downstream Studio.
  const { error } = await supabaseAdmin
    .from("hammerex_brand_identity")
    .upsert({
      merchant_slug: session.merchant.slug,
      fingerprint:   result.fingerprint,
      brand_json:    result.brand,
      created_via:   "discovery-agent"
    }, { onConflict: "merchant_slug" });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok:          true,
    brand:       result.brand,
    fingerprint: result.fingerprint,
    confidence:  result.confidence,
    reasoning:   result.reasoning,
    ai_used:     result.aiUsed
  });
}
