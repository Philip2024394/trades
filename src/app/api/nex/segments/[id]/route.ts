// GET/PUT/DELETE /api/nex/segments/{id}
import { NextResponse } from "next/server";
import { archiveSegment, getSegment, updateSegment } from "@/lib/nex/segments/registry";
import type { SegmentInput } from "@/lib/nex/segments/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = await getSegment(id);
  if (!s) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, segment: s });
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: Partial<SegmentInput>;
  try { body = await request.json() as Partial<SegmentInput>; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const s = await updateSegment(id, body);
  if (!s) return NextResponse.json({ ok: false, error: "not_found_or_no_change" }, { status: 404 });
  return NextResponse.json({ ok: true, segment: s });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ok = await archiveSegment(id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
