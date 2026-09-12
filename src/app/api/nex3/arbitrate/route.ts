// POST /api/nex3/arbitrate
// Advisory-only. Read-only w.r.t. repository. Never executes, never merges, never approves.

import { NextResponse, type NextRequest } from "next/server";
import { performArbitration } from "@/lib/nex3-arbitration/arbiter";
import type { ArbitrationInput } from "@/lib/nex3-arbitration/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as ArbitrationInput;
    if (!body?.work_order?.work_order_id || !body?.baseline_candidate?.candidate_id || !body?.nex1_candidate?.candidate_id) {
      return NextResponse.json({ error: "work_order.work_order_id, baseline_candidate, nex1_candidate are required" }, { status: 400 });
    }
    const record = performArbitration(body);
    return NextResponse.json(record, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: "arbitration_failed", detail: (e as Error).message }, { status: 500 });
  }
}
