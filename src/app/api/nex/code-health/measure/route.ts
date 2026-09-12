// POST /api/nex/code-health/measure
// body: { project_root, source_files: [{ path, content }] }
// Read-only Code Health measurement. Deterministic. No mutation.

import { NextResponse } from "next/server";
import { measureCodeHealth } from "@/lib/nex-code-health/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const project_root = String(body?.project_root ?? "adhoc");
  const files = Array.isArray(body?.source_files) ? body.source_files : [];
  const report = measureCodeHealth({ project_root, source_files: files });
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}
