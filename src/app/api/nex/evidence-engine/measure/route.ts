// POST /api/nex/evidence-engine/measure
// body: { dimension, work_order_id, project_id, candidate_id, source_files, baseline_files?, requested_by, extra? }

import { NextResponse } from "next/server";
import { measure, supportedDimensions } from "@/lib/nex-evidence-engine/engine";
import type { EvidenceDimension } from "@/lib/nex-evidence-engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const dimension = body?.dimension as EvidenceDimension;
  if (!supportedDimensions().includes(dimension)) {
    return NextResponse.json({ error: "unsupported_dimension", supported: supportedDimensions() }, { status: 400 });
  }
  const source_files = Array.isArray(body?.source_files) ? body.source_files : [];
  const baseline_files = Array.isArray(body?.baseline_files) ? body.baseline_files : undefined;
  const input = {
    work_order_id: String(body?.work_order_id ?? "WO-adhoc"),
    project_id: String(body?.project_id ?? "adhoc"),
    candidate_id: String(body?.candidate_id ?? "cand_nex1"),
    source_files,
    baseline_files,
    requested_by: String(body?.requested_by ?? "founder-lab"),
  };
  const record = measure(dimension, input, body?.extra);
  return NextResponse.json(record, { headers: { "Cache-Control": "no-store" } });
}
