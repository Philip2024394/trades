// POST /api/studio/apps/submit
//   Body: { description: string }
//
// Captures a merchant's App idea into app_submissions with status
// awaiting_review. Fired by StudioAppRecommendModal when the AI
// recommender finds no fit OR the merchant explicitly rejects all
// matches.
//
// Idempotency: we accept duplicates by design — a merchant might
// refine their idea and submit twice. Admins de-dup during review.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type SubmitBody = { description?: string };

export async function POST(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  let body: SubmitBody = {};
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }

  const description = (body.description ?? "").trim().slice(0, 2000);
  if (description.length < 10) {
    return NextResponse.json(
      { ok: false, error: "description-too-short" },
      { status: 400 }
    );
  }

  const ins = await supabaseAdmin
    .from("app_submissions")
    .insert({
      merchant_id: session.merchant.id,
      brand_id: session.brand.id,
      description,
      status: "awaiting_review"
    })
    .select("id")
    .maybeSingle();

  if (ins.error || !ins.data) {
    return NextResponse.json(
      { ok: false, error: ins.error?.message ?? "insert-failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    submissionId: ins.data.id
  });
}
