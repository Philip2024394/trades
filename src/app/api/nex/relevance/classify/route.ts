// POST /api/nex/relevance/classify
// body: { utterance: string }
//
// Runs the Relevance Classifier + composes the semantic response plan.
// Deterministic · never fabricates · Lab-internal until AUTHORISE.

import { NextResponse } from "next/server";
import { classifyRelevance } from "@/lib/nex-relevance/relevance-classifier";
import { composeRelevanceResponse } from "@/lib/nex-relevance/relevance-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const utterance = typeof body.utterance === "string" ? body.utterance : "";
  if (!utterance) return NextResponse.json({ error: "missing_utterance" }, { status: 400 });

  const verdict = classifyRelevance(utterance);
  const response_plan = composeRelevanceResponse(verdict);
  return NextResponse.json({
    utterance,
    verdict,
    response_plan,
    taught_by: "master_ai_engineer",
    at: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
