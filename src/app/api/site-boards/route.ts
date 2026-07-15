// GET  /api/site-boards       — list the caller's boards (cookie-scoped)
// POST /api/site-boards       — create a new board (issues cookie if none)

import { NextResponse } from "next/server";
import { boardsForOwner, createBoard } from "@/lib/siteBoards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const boards = await boardsForOwner();
  return NextResponse.json({ ok: true, boards });
}

export async function POST(req: Request) {
  let payload: { name?: unknown; description?: unknown; isPublic?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (name.length < 1) {
    return NextResponse.json({ ok: false, error: "name-required" }, { status: 400 });
  }
  const description = typeof payload.description === "string" ? payload.description.trim().slice(0, 500) : null;
  const isPublic = payload.isPublic !== false; // default true
  const board = await createBoard({ name, description, isPublic });
  if (!board) {
    return NextResponse.json({ ok: false, error: "create-failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, board });
}
