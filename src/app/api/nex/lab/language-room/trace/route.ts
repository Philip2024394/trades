// src/app/api/nex/lab/language-room/trace/route.ts
//
// GET  /api/nex/lab/language-room/trace?utterance=…
// POST /api/nex/lab/language-room/trace  { utterance: string }
//
// Returns a stage-by-stage provenance trace of the language pipeline.
// Deterministic · no LLM · read-only. Feeds the Agent Room's trace panel.

import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { tracePipeline } from "@/lib/nex-language-brain/pipeline-trace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function loadPatternRegistry() {
  return JSON.parse(readFileSync(resolve(process.cwd(), "data/nex1-language-brain/pattern-registry-v0.json"), "utf8"));
}

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const utterance = url.searchParams.get("utterance") ?? "";
  if (!utterance) return NextResponse.json({ error: "missing_utterance" }, { status: 400 });
  const registry = loadPatternRegistry();
  const trace = tracePipeline(utterance, registry);
  return NextResponse.json(trace, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const utterance = typeof body.utterance === "string" ? body.utterance : "";
  if (!utterance) return NextResponse.json({ error: "missing_utterance" }, { status: 400 });
  const registry = loadPatternRegistry();
  const trace = tracePipeline(utterance, registry);
  return NextResponse.json(trace, { headers: { "Cache-Control": "no-store" } });
}
