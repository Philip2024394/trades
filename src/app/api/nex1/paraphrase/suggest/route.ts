// POST /api/nex1/paraphrase/suggest
//
// C2 Phase 4 · deterministic target-slug suggestion for a phrase the founder
// wants to teach. Zero LLM · zero randomness · one pass over a fixed keyword
// rule table. Returns null suggested_slug when no rule matched (honest abstain).
//
// Request:  { "phrase": "<string>" }
// Response: { ok, source_normalised, suggested_slug, confidence, matched_keywords, ranked_alternatives }

import { NextResponse } from "next/server";
import { suggestTargetSlug } from "@/lib/nex-agent/language/capability-paraphrase-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body { phrase?: string }

export async function POST(req: Request) {
  let body: Body = {};
  try { body = await req.json(); } catch { /* empty */ }
  const phrase = typeof body.phrase === "string" ? body.phrase : "";
  if (!phrase.trim()) {
    return NextResponse.json({ ok: false, error: "empty_phrase" }, { status: 400 });
  }
  const suggestion = suggestTargetSlug(phrase);
  return NextResponse.json({ ok: true, source: "NEX1_NATIVE", zero_llm: true, ...suggestion });
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q");
  if (!q) return NextResponse.json({ ok: false, error: "missing_q_param" }, { status: 400 });
  const suggestion = suggestTargetSlug(q);
  return NextResponse.json({ ok: true, source: "NEX1_NATIVE", zero_llm: true, ...suggestion });
}
