// POST /api/nex/hq/heartbeat/tick
//
// Runs one heartbeat cycle. No GET (observation goes through
// /api/nex/hq/agents). No auth-modifying methods.

import { NextResponse } from "next/server";
import { runHeartbeatTick } from "@/lib/nex-hq-heartbeat/monitor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const schedulerExamined = url.searchParams.get("scheduler_examined_workload") === "1";
  try {
    const result = await runHeartbeatTick({ scheduler_examined_workload: schedulerExamined });
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(): Promise<Response> { return methodNotAllowed(); }
export async function PUT(): Promise<Response> { return methodNotAllowed(); }
export async function PATCH(): Promise<Response> { return methodNotAllowed(); }
export async function DELETE(): Promise<Response> { return methodNotAllowed(); }
function methodNotAllowed(): Response {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
