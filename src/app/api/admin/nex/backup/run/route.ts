// POST /api/admin/nex/backup/run
// Body: { kind: "full" | "incremental", notes?: string }

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { createBackup } from "@/lib/nex/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null) as { kind?: "full" | "incremental"; notes?: string } | null;
  const kind = body?.kind ?? "incremental";
  if (kind !== "full" && kind !== "incremental") {
    return NextResponse.json({ ok: false, error: "invalid_kind" }, { status: 400 });
  }

  const result = await createBackup({ kind, actor: "admin", notes: body?.notes });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error, run: result.run }, { status: 500 });
  return NextResponse.json({ ok: true, run: result.run });
}
