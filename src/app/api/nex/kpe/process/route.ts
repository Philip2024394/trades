// POST /api/nex/kpe/process — Run the Knowledge Processing Engine on one document
//
// Body:
//   { source: string, title?: string, content: string, target_brains?: string[] }
//
// Returns full processing outcome including chunks created, decision
// distribution (how many went to each of the 5 tiers), and brain writes.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/nex/kpe/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const source = typeof body.source === "string" ? body.source.trim() : "";
  const content = typeof body.content === "string" ? body.content : "";
  const title = typeof body.title === "string" ? body.title : undefined;
  const target_brains = Array.isArray(body.target_brains)
    ? (body.target_brains as unknown[]).filter((b): b is string => typeof b === "string")
    : undefined;

  if (!source) return NextResponse.json({ ok: false, error: "source_required" }, { status: 400 });
  if (!content.trim()) return NextResponse.json({ ok: false, error: "content_required" }, { status: 400 });

  try {
    const result = await runPipeline({ source, title, content, target_brains });
    return NextResponse.json({ ok: true, backend: "filesystem", ...result });
  } catch (err) {
    console.error("[kpe.process] failed:", err);
    return NextResponse.json(
      { ok: false, error: "pipeline_failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
