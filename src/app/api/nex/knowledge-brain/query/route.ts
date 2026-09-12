// src/app/api/nex/knowledge-brain/query/route.ts
//
// Founder Path A · Phase A3 · Knowledge Brain query endpoint.
//
// Observation-only surface for the Knowledge Brain facade. Used by
// smoke-knowledge-brain.mjs to exercise BM25 + dense + rerank fusion
// without going through the chat route. Also useful as a debugging /
// health surface for the Observatory Brain to hit.
//
// POST /api/nex/knowledge-brain/query
// body: { query, top_k?, domain_hint?, entity_hint?, intent_slug?, budget_ms? }

import { NextResponse } from "next/server";
import { makeKnowledgeBrain } from "@/lib/nex/knowledge-brain";

const brain = makeKnowledgeBrain();

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }
  const query = typeof body.query === "string" ? body.query : "";
  if (!query || query.length < 2) {
    return NextResponse.json({ error: "query must be a string with length >= 2" }, { status: 400 });
  }
  try {
    const answer = await brain.answer({
      query,
      top_k: typeof body.top_k === "number" ? Math.floor(body.top_k) : 10,
      language: body.language === "id" ? "id" : "en",
      domain_hint: typeof body.domain_hint === "string" ? body.domain_hint : undefined,
      entity_hint: typeof body.entity_hint === "string" ? body.entity_hint : undefined,
      intent_slug: typeof body.intent_slug === "string" ? body.intent_slug : undefined,
      budget_ms: typeof body.budget_ms === "number" ? Math.floor(body.budget_ms) : 3000,
    });
    const evidenceItems = brain.answerToEvidenceItems(answer);
    return NextResponse.json({ answer, evidence_items: evidenceItems });
  } catch (e) {
    return NextResponse.json({
      error: "knowledge_brain_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    }, { status: 500 });
  }
}
