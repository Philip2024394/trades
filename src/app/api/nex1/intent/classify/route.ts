// POST /api/nex1/intent/classify
//
// NEX1 · CAPABILITY A · Native Founder-Intent Classifier · HTTP surface.
//
// Deterministic · zero LLM · pure classification.
//
// Request:
//   { "founder_goal": "<string>" }
//
// Response (200):
//   { "ok": true, "result": Nex1IntentResult }
//
// This endpoint does NOT mutate any file, does NOT spawn any process, does NOT
// hit the network. It is a pure classifier over a controlled vocabulary.

import { NextResponse } from "next/server";
import { classifyFounderIntent } from "@/lib/nex-agent/code-engine/capability-a-founder-intent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RequestBody {
  founder_goal?: string;
}

export async function POST(req: Request) {
  let body: RequestBody = {};
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const goal = typeof body.founder_goal === "string" ? body.founder_goal : "";
  const result = classifyFounderIntent(goal);
  return NextResponse.json({ ok: true, result });
}
