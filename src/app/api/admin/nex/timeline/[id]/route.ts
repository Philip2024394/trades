// GET /api/admin/nex/timeline/[id]
// Version history for a specific knowledge entry. Powers the Timeline UI.

import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { readVersionHistory, readEntry } from "@/lib/nex/intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  if (!(await isAdminAuthed())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const [entry, versions] = await Promise.all([readEntry(id), readVersionHistory(id)]);
  if (!entry) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, entry, versions });
}
