// POST /api/admin/nex/backup/restore/execute
// Body: { attempt_id: string, confirm: true }
//
// Never runs without explicit `confirm: true`. Auto-takes a
// pre-restore snapshot before touching any table.

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { executeRestore } from "@/lib/nex/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null) as { attempt_id?: string; confirm?: boolean } | null;
  if (!body?.attempt_id)  return NextResponse.json({ ok: false, error: "missing_attempt_id" }, { status: 400 });
  if (body.confirm !== true) return NextResponse.json({ ok: false, error: "confirmation_required" }, { status: 400 });

  const result = await executeRestore({ restoreAttemptId: body.attempt_id, actor: "admin" });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error, attempt: result.attempt }, { status: 500 });
  return NextResponse.json({ ok: true, attempt: result.attempt });
}
