// POST /api/nex1/native-loop/run
//
// Invoke NEX1's native programming loop against a founder goal + optional test target.
// Zero LLM. Composes existing deterministic capabilities only.

import { NextResponse } from "next/server";
import { runNativeProgrammingLoop, type NativeLoopInput } from "@/lib/nex-agent/code-engine/native-programming-loop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vitest spawn + wait may exceed default 60s serverless cap · request Node.js runtime and allow 300s.
export const maxDuration = 300;

interface RequestBody {
  founder_goal?: string;
  target_test_file?: string;
  target_line?: number;
  test_timeout_ms?: number;
  mode?: "vitest" | "tsc";
  tsc_project?: string;
}

export async function POST(req: Request) {
  let body: RequestBody = {};
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    /* empty body */
  }
  const goal = String(body.founder_goal ?? "").trim();
  if (goal.length === 0) return NextResponse.json({ ok: false, error: "founder_goal required" }, { status: 400 });
  if (goal.length > 4000) return NextResponse.json({ ok: false, error: "founder_goal exceeds 4000 chars" }, { status: 400 });

  const input: NativeLoopInput = {
    founder_goal: goal,
    target_test_file: body.target_test_file,
    target_line: body.target_line,
    test_timeout_ms: body.test_timeout_ms,
    mode: body.mode,
    tsc_project: body.tsc_project,
  };

  const result = await runNativeProgrammingLoop(input);
  return NextResponse.json({ ok: true, result });
}
