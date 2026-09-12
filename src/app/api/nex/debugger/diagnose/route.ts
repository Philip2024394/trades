// POST /api/nex/debugger/diagnose
// Advisory-only. Read-only w.r.t. repository. Never executes.

import { NextResponse, type NextRequest } from "next/server";
import { performDiagnosis } from "@/lib/nex-debugger/debugger";
import type { DiagnosisInput } from "@/lib/nex-debugger/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as DiagnosisInput;
    if (!body || typeof body !== "object" || !body.reproduction_fixture_id) {
      return NextResponse.json({ error: "reproduction_fixture_id is required" }, { status: 400 });
    }
    const rec = performDiagnosis(body);
    return NextResponse.json(rec, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: "diagnose_failed", detail: (e as Error).message }, { status: 500 });
  }
}
