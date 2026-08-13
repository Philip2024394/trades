// Universal Intent API endpoint · POST { input: string } → IntentClassification.
//
// Runtime for the 10-verb Master Intent Library. Every user message from the
// chat surface can hit this endpoint to obtain a Layer 1 (verb) + Layer 2
// (domain) + Layer 3 (capability) classification BEFORE the composer routes
// to a specialist brain.
//
// Composes with:
//   src/lib/nex/intent-router.ts   (kind: navigation/database/brain/ai/messenger)
//   src/lib/nex/universal-intent/  (verb: Create/Communicate/Decide/etc.)
//
// Doctrine: docs/brains/nex-master-intent-library-v1-philip-2026-08-03.md
// Corpus:   data/nex-intent-phrasings.jsonl

import { NextResponse } from "next/server";
import { classifyUniversalIntent } from "@/lib/nex/universal-intent";

type ClassifyRequest = { input?: unknown };

export async function POST(req: Request): Promise<Response> {
  let body: ClassifyRequest = {};
  try {
    body = (await req.json()) as ClassifyRequest;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const input = typeof body.input === "string" ? body.input : "";
  if (!input.trim()) {
    return NextResponse.json({ error: "input required" }, { status: 400 });
  }

  const classification = classifyUniversalIntent(input);

  return NextResponse.json({
    layer1_verb: classification.layer1_verb,
    layer2_domain: classification.layer2_domain,
    layer3_capability: classification.layer3_capability,
    confidence: Math.round(classification.confidence * 100) / 100,
    matched_phrasing: classification.matched_phrasing,
    reason: classification.reason,
    /** If confidence <0.7, Brain 14 (Never-Guess) requires the caller to ask
     *  a clarifying question rather than routing on this classification. */
    needs_clarification: classification.confidence < 0.7,
  });
}
