// src/app/api/nex/idea-lab/list/route.ts

import { NextResponse } from "next/server";
import { ideaLabStore } from "@/lib/nex/idea-lab/idea-lab-store";
import { scoreBand } from "@/lib/nex/idea-lab";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const evals = ideaLabStore.listEvaluations();
  const decisions = ideaLabStore.listDecisions();
  const rows = evals.map((e) => ({
    ideaId: e.ideaId,
    title: e.title,
    summary: e.summary,
    compositeScore: e.compositeScore,
    band: scoreBand(e.compositeScore),
    enhancedConcept: e.enhancedConcept,
    evaluatedAt: e.evaluatedAt,
    dimensionScores: e.dimensionScores,
    decision: decisions.get(e.ideaId) ?? null,
  }));
  return NextResponse.json({ ok: true, rows, generated_at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
