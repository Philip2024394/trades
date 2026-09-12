// POST /api/nex/code-intelligence/detect
// body: { path: string, content: string, explicit_language?: string }
// Deterministic file detection · CI-2..CI-4.

import { NextResponse } from "next/server";
import { detectFile } from "@/lib/nex-code-intelligence/file-detector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const path = typeof body?.path === "string" ? body.path : "";
  const content = typeof body?.content === "string" ? body.content : "";
  const explicit = typeof body?.explicit_language === "string" ? body.explicit_language : undefined;
  if (!path) return NextResponse.json({ error: "missing_path" }, { status: 400 });
  const fi = detectFile({ path, content, explicit_language: explicit });
  return NextResponse.json(fi, { headers: { "Cache-Control": "no-store" } });
}
