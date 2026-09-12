import { NextResponse, type NextRequest } from "next/server";
import { getTrace } from "@/lib/nex1-orchestrator/trace-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ trace_id: string }> }): Promise<NextResponse> {
  const { trace_id } = await params;
  const trace = getTrace(trace_id);
  if (!trace) return NextResponse.json({ error: "trace_not_found", trace_id }, { status: 404 });
  return NextResponse.json(trace, { headers: { "Cache-Control": "no-store" } });
}
