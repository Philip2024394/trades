// DELETE /api/site-boards/[id]/items/[itemId] — remove a saved image

import { NextResponse } from "next/server";
import { removeBoardItem } from "@/lib/siteBoards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;
  if (!id || !itemId) {
    return NextResponse.json({ ok: false, error: "missing-ids" }, { status: 400 });
  }
  const ok = await removeBoardItem({ boardId: id, itemId });
  if (!ok) {
    return NextResponse.json({ ok: false, error: "remove-failed" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
