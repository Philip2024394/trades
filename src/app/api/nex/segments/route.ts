// GET/POST /api/nex/segments — list + create audience segments
import { NextResponse } from "next/server";
import { createSegment, listSegments } from "@/lib/nex/segments/registry";
import type { SegmentInput } from "@/lib/nex/segments/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, segments: await listSegments() });
}

export async function POST(request: Request) {
  let body: Partial<SegmentInput>;
  try { body = await request.json() as Partial<SegmentInput>; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (!body.name || !body.filter) {
    return NextResponse.json({ ok: false, error: "name and filter required" }, { status: 400 });
  }
  const segment = await createSegment(body as SegmentInput);
  if (!segment) return NextResponse.json({ ok: false, error: "create_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, segment });
}
