// End-to-End Pipeline API endpoint (Phase D.5).
//
// POST /api/nex/pipeline
//   body: { input: string, session_id?: string, goal_id?: string, workspace_identity?: string, include_trace?: boolean }
//   → PipelineResponse (includes full 11-stage trace in dev · omitted in prod for cleaner payloads unless explicitly requested)
//
// This is the NEW pipeline endpoint (Phase D.5) — distinct from the existing
// /api/nex/converse route which handles merchant/homeowner/visitor conversation
// concerns with different auth + memory semantics.
//
// Doctrine: docs/brains/nex-end-to-end-pipeline-philip-2026-08-03.md
// Runtime:  src/lib/nex/pipeline/

import { NextResponse } from "next/server";
import { converse } from "@/lib/nex/pipeline";

type PipelineApiRequest = {
  input?: unknown;
  session_id?: unknown;
  goal_id?: unknown;
  workspace_identity?: unknown;
  include_trace?: unknown;
};

const IS_DEV = process.env.NODE_ENV !== "production";

export async function POST(req: Request): Promise<Response> {
  let body: PipelineApiRequest = {};
  try {
    body = (await req.json()) as PipelineApiRequest;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const input = typeof body.input === "string" ? body.input : "";
  if (!input.trim()) {
    return NextResponse.json({ error: "input required" }, { status: 400 });
  }

  const result = converse({
    input,
    session_id: typeof body.session_id === "string" ? body.session_id : undefined,
    goal_id: typeof body.goal_id === "string" ? body.goal_id : undefined,
    workspace_identity: typeof body.workspace_identity === "string" ? body.workspace_identity : undefined,
  });

  // Include the full Router Trace in dev · or when explicitly requested.
  const shouldIncludeTrace = IS_DEV || body.include_trace === true;

  return NextResponse.json({
    response_text: result.response_text,
    needs_clarification: result.needs_clarification,
    clarifying_question: result.clarifying_question,
    next_step: result.next_step,
    sources: result.sources,
    confidence: result.confidence,
    recommendations: result.recommendations,
    ...(shouldIncludeTrace ? { trace: result.trace } : {}),
  });
}
