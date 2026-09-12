// POST /api/nex/provenance/resolve
// body: { claim_text?, evidence_id, measurements: HealthMeasurement[] }
// Resolves the provenance chain from evidence_id backwards to reproducibility.

import { NextResponse } from "next/server";
import { resolveProvenance } from "@/lib/nex-code-health/provenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const chain = resolveProvenance({
    claim_text: typeof body?.claim_text === "string" ? body.claim_text : undefined,
    evidence_id: String(body?.evidence_id ?? ""),
    measurements: Array.isArray(body?.measurements) ? body.measurements : [],
  });
  return NextResponse.json(chain, { headers: { "Cache-Control": "no-store" } });
}
