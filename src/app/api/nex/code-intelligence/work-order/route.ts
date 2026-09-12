// POST /api/nex/code-intelligence/work-order
// body: { originating_request: string, files?: { path: string, content: string }[], explicit_target_language?: string }
// CI-7 · deterministic Work Order compilation from user request + file context.

import { NextResponse } from "next/server";
import { detectFile } from "@/lib/nex-code-intelligence/file-detector";
import { compileWorkOrder } from "@/lib/nex-code-intelligence/work-order";
import type { FileIntelligence } from "@/lib/nex-code-intelligence/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const request = typeof body?.originating_request === "string" ? body.originating_request : "";
  const filesIn: { path: string; content: string }[] = Array.isArray(body?.files) ? body.files : [];
  const explicit = typeof body?.explicit_target_language === "string" ? body.explicit_target_language : undefined;
  if (!request) return NextResponse.json({ error: "missing_originating_request" }, { status: 400 });
  const fis: FileIntelligence[] = filesIn.map((f) => detectFile({ path: f.path, content: f.content }));
  const wo = compileWorkOrder({ originating_request: request, file_intelligences: fis, explicit_target_language: explicit });
  return NextResponse.json({ file_intelligences: fis, work_order: wo }, { headers: { "Cache-Control": "no-store" } });
}
