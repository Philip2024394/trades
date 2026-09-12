// src/app/api/nex/idea-lab/submit/route.ts
//
// Submit a new idea from the founder. Master AI evaluates each of 11
// dimensions with visible reasoning. Score is advice · not authority.

import { NextRequest, NextResponse } from "next/server";
import { ideaLabStore } from "@/lib/nex/idea-lab/idea-lab-store";
import { computeCompositeScore, validateEvaluation, DIMENSION_WEIGHTS } from "@/lib/nex/idea-lab";
import type { DimensionScore, IdeaDimension, IdeaEvaluation } from "@/lib/nex/idea-lab";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Master-AI-lite evaluation: pattern-heuristic dimension scoring with visible
 * reasoning. NEVER autonomously changes constitutional policy · always presents
 * the score as advisory. Real Master AI evaluation replaces this when authorised.
 */
function evaluateAllDimensions(title: string, summary: string): DimensionScore[] {
  const combined = `${title} ${summary}`.toLowerCase();
  const has = (patterns: string[]) => patterns.some((p) => combined.includes(p));

  const scores: DimensionScore[] = [];
  const dims = Object.keys(DIMENSION_WEIGHTS) as IdeaDimension[];

  for (const dim of dims) {
    let score = 50;
    let reasoning = `No specific evidence for or against · neutral 50 default.`;
    const evidence: string[] = [];

    switch (dim) {
      case "user_value":
        if (has(["founder", "user", "customer", "review", "queue"])) { score = 70; reasoning = "Idea references user-facing surface · likely delivers observable value."; evidence.push("mentions user/founder-facing surface"); }
        break;
      case "strategic_fit":
        if (has(["nex1", "master ai", "guardian", "truth engine", "lab", "hq"])) { score = 75; reasoning = "Aligned with core NEX pillars (NEX1 · Master AI · Guardian · Lab · HQ)."; evidence.push("references core NEX subsystem"); }
        break;
      case "technical_feasibility":
        if (has(["existing", "wire", "connect", "reuse"])) { score = 80; reasoning = "Leverages existing infrastructure · high feasibility."; evidence.push("reuses existing infra"); }
        else if (has(["new provider", "novel", "unproven"])) { score = 40; reasoning = "Introduces new/unproven technology · lower feasibility until de-risked."; }
        break;
      case "boundary_safety":
        if (has(["production", "live deploy", "migration"])) { score = 30; reasoning = "Touches production boundary · high safety scrutiny needed before build."; evidence.push("hits production boundary"); }
        else { score = 75; reasoning = "Stays within isolated preview / non-production boundaries."; }
        break;
      case "integration_cost":
        if (has(["small", "single page", "one endpoint"])) { score = 80; reasoning = "Narrow scope · low integration cost."; }
        else if (has(["cross-cutting", "everywhere", "all sections"])) { score = 30; reasoning = "Cross-cutting · high integration cost."; }
        break;
      case "measurability":
        if (has(["metric", "count", "measure", "verify", "test"])) { score = 80; reasoning = "Explicitly measurable outcomes named."; evidence.push("measurable outcome referenced"); }
        break;
      case "reversibility":
        if (has(["delete", "drop", "migration", "irreversible"])) { score = 25; reasoning = "Irreversibility risk · rollback path unclear."; }
        else { score = 75; reasoning = "Change appears reversible via intervention (DISABLE / ROLLBACK / REMOVE FROM LIVE)."; }
        break;
      case "constitutional_alignment":
        if (has(["adr", "doctrine", "founder-locked", "authorised"])) { score = 80; reasoning = "References existing constitutional layer · high alignment."; }
        break;
      case "founder_effort":
        if (has(["autonomous", "no approval", "continuous"])) { score = 80; reasoning = "Low founder overhead · runs autonomously under existing authority."; }
        else if (has(["per-section approval", "manual approve"])) { score = 30; reasoning = "High founder effort · needs per-item approval."; }
        break;
      case "differentiation":
        if (has(["world-class", "unique", "innovative", "first"])) { score = 70; reasoning = "Positioned as differentiating capability."; }
        break;
      case "urgency":
        if (has(["blocked", "blocker", "critical", "immediate"])) { score = 80; reasoning = "Idea addresses current blocker · higher urgency."; }
        break;
    }

    scores.push({ dimension: dim, score, reasoning, evidence });
  }
  return scores;
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "sec.idea_bad_body", reason: "Invalid JSON" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  const summary = String(body.summary ?? "").trim();
  if (!title || !summary) {
    return NextResponse.json({ ok: false, code: "sec.idea_missing_fields", reason: "title + summary required" }, { status: 400 });
  }

  const ideaId = `idea-${Date.now()}`;
  const dimensionScores = evaluateAllDimensions(title, summary);
  const composite = computeCompositeScore(dimensionScores);
  const validation = validateEvaluation({ ideaId, title, summary, dimensionScores });
  if (!validation.ok) {
    return NextResponse.json({ ok: false, code: validation.code, reason: validation.reason }, { status: 400 });
  }

  const evaluation: IdeaEvaluation = {
    ideaId,
    title,
    summary,
    dimensionScores,
    compositeScore: composite,
    enhancedConcept: null,
    evaluatedAt: new Date().toISOString(),
    evaluatedBy: "master-ai-lite",
  };
  ideaLabStore.saveEvaluation(evaluation);
  return NextResponse.json({ ok: true, ideaId, compositeScore: composite, evaluation }, { headers: { "Cache-Control": "no-store" } });
}
