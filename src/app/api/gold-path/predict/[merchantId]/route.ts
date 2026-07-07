// POST /api/gold-path/predict/[merchantId]
//
// Runs the predictive Gold Path pass for a merchant. Intended to be
// called on a weekly cron. Returns the tasks created + reasons.

import { NextResponse } from "next/server";
import { runPredictiveGoldPath } from "@/lib/gold-path/predictive";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ merchantId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { merchantId } = await context.params;
  const outcome = await runPredictiveGoldPath(merchantId);
  return NextResponse.json(outcome);
}
