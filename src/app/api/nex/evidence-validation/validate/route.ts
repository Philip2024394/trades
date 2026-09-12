// POST /api/nex/evidence-validation/validate
// Advisory-only. Read-only. Produces AuthoritativeEvidenceRecord.

import { NextResponse, type NextRequest } from "next/server";
import { validateEvidence } from "@/lib/nex-evidence-validation/validator";
import type { SpecialistRecordShape } from "@/lib/nex-evidence-validation/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as SpecialistRecordShape;
    if (!body || typeof body !== "object" || !body.record_type) {
      return NextResponse.json({ error: "specialist record required with at least record_type" }, { status: 400 });
    }
    const rec = validateEvidence(body);
    return NextResponse.json(rec, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: "validate_failed", detail: (e as Error).message }, { status: 500 });
  }
}
