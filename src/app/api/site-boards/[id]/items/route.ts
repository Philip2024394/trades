// POST /api/site-boards/[id]/items — save an image to a board

import { NextResponse } from "next/server";
import { addBoardItem } from "@/lib/siteBoards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing-board-id" }, { status: 400 });
  }
  let payload: {
    imageUrl?: unknown;
    subject?: unknown;
    sourceJson?: unknown;
    note?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  const imageUrl = typeof payload.imageUrl === "string" ? payload.imageUrl.trim() : "";
  if (!imageUrl || !/^https?:\/\//.test(imageUrl)) {
    return NextResponse.json({ ok: false, error: "invalid-image-url" }, { status: 400 });
  }
  const subject = typeof payload.subject === "string" ? payload.subject.trim().slice(0, 300) : null;
  const note = typeof payload.note === "string" ? payload.note.trim().slice(0, 500) : null;
  const sourceJson = (payload.sourceJson && typeof payload.sourceJson === "object" && !Array.isArray(payload.sourceJson))
    ? payload.sourceJson as Record<string, unknown>
    : {};
  const item = await addBoardItem({ boardId: id, imageUrl, subject, sourceJson, note });
  if (!item) {
    return NextResponse.json({ ok: false, error: "add-failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, item });
}
