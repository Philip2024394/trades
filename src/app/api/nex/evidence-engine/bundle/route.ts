// POST /api/nex/evidence-engine/bundle
// body: { records: EvidenceRecord[], work_order_id, project_id, candidate_id, source_files, requested_by }

import { NextResponse } from "next/server";
import { composeBundle, rejectDeclarationMasquerade } from "@/lib/nex-evidence-engine/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const records = Array.isArray(body?.records) ? body.records : [];
  // Constitutional rejection · any NEX1_DECLARATION masquerading as evidence is thrown out.
  const rejected: any[] = [];
  const accepted: any[] = [];
  for (const r of records) {
    const check = rejectDeclarationMasquerade(r);
    if (check.ok) accepted.push(r); else rejected.push({ record_type: r?.record_type ?? "(unknown)", reason: check.reason });
  }
  const input = {
    work_order_id: String(body?.work_order_id ?? "WO-adhoc"),
    project_id: String(body?.project_id ?? "adhoc"),
    candidate_id: String(body?.candidate_id ?? "cand_nex1"),
    source_files: Array.isArray(body?.source_files) ? body.source_files : [],
    requested_by: String(body?.requested_by ?? "founder-lab"),
  };
  const bundle = composeBundle(accepted, input);
  return NextResponse.json({
    bundle,
    accepted_count: accepted.length,
    rejected_count: rejected.length,
    rejections: rejected,
  }, { headers: { "Cache-Control": "no-store" } });
}
