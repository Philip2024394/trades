import { NextResponse, type NextRequest } from "next/server";
import { submitWorkflow } from "@/lib/nex1-orchestrator/orchestrator";
import type { SubmitInput } from "@/lib/nex1-orchestrator/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as SubmitInput;
    if (!body || typeof body.raw_request !== "string") return NextResponse.json({ error: "raw_request is required" }, { status: 400 });
    const trace = submitWorkflow(body);
    return NextResponse.json(trace, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: "orchestrator_submit_failed", detail: (e as Error).message }, { status: 500 });
  }
}
