// DELETE /api/admin/featured-placements/[id] — cancel a placement

import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { cancelPlacement } from "@/lib/featuredPlacements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });
  }
  const url = new URL(req.url);
  const note = url.searchParams.get("note") ?? undefined;
  const ok = await cancelPlacement(id, note);
  return NextResponse.json({ ok });
}
