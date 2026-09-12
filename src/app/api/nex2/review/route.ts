// POST /api/nex2/review
// Advisory-only. Read-only w.r.t. repository. Never executes, never merges.

import { NextResponse, type NextRequest } from "next/server";
import { performReview } from "@/lib/nex2-review/review";
import type { ReviewInput } from "@/lib/nex2-review/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as ReviewInput;
    if (!body || typeof body !== "object" || !body.work_order_id || !body.baseline_candidate_id || !body.nex1_candidate_id) {
      return NextResponse.json({ error: "work_order_id, baseline_candidate_id, nex1_candidate_id are required" }, { status: 400 });
    }
    const review = performReview(body);
    return NextResponse.json(review, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: "review_failed", detail: (e as Error).message }, { status: 500 });
  }
}
