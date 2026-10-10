// GET /api/nex1/ambiguity-probe?prompt=…
//
// Diagnostic endpoint for Agent 10 · Ambiguity Resolver · 2026-09-17.
// Exposes classifyAmbiguity() + scoreAllIntents() directly so verification
// probes can inspect the resolver's behavior WITHOUT going through the full
// orchestrator (whose confidence heuristics can mask the resolver's zone).
//
// Zero LLM · read-only · no persistence · no side effects.

import { NextResponse } from "next/server";
import { classifyAmbiguity, scoreAllIntents } from "@/lib/nex-agent/language/capability-ambiguity-resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const prompt = url.searchParams.get("prompt") ?? "";
  if (!prompt) {
    return NextResponse.json({ ok: false, error: "prompt query param required" }, { status: 400 });
  }
  const decision = classifyAmbiguity(prompt);
  const top5 = scoreAllIntents(prompt).filter((s) => s.score > 0).slice(0, 5);
  return NextResponse.json({
    ok: true,
    source: "NEX1_NATIVE",
    zero_llm: true,
    prompt,
    decision: decision.decision,
    reason: decision.result.reason,
    should_clarify: decision.result.should_clarify,
    primary: decision.result.primary ? {
      slug: decision.result.primary.slug,
      score: decision.result.primary.score,
      matched_tokens: decision.result.primary.matched_tokens,
      matched_phrases: decision.result.primary.matched_phrases,
      is_chat_only: decision.result.primary.is_chat_only,
    } : null,
    alternates: decision.result.alternates.map((a) => ({
      slug: a.slug, score: a.score, matched_tokens: a.matched_tokens.length, matched_phrases: a.matched_phrases.length,
    })),
    options: decision.result.options,
    text: decision.result.text,
    top5_scored: top5.map((s) => ({ slug: s.slug, score: s.score, tokens_hit: s.matched_tokens.length, phrases_hit: s.matched_phrases.length })),
  });
}
