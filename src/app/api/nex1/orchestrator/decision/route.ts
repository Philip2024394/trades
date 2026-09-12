import { NextResponse, type NextRequest } from "next/server";
import { applyFounderDecision } from "@/lib/nex1-orchestrator/orchestrator";
import type { DecisionInput } from "@/lib/nex1-orchestrator/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as DecisionInput;
    if (!body || typeof body.trace_id !== "string" || !body.decision) return NextResponse.json({ error: "trace_id and decision are required" }, { status: 400 });
    const result = applyFounderDecision(body);
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: "decision_failed", detail: (e as Error).message }, { status: 500 });
  }
}
