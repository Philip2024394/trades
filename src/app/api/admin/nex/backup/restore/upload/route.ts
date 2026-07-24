// POST /api/admin/nex/backup/restore/upload
// Multipart form-data: file (the ZIP)
// Runs validate + preview. Returns the restore attempt row for confirmation.

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { validateAndPreview } from "@/lib/nex/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100MB hard cap

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
  if (file.size > MAX_SIZE_BYTES) return NextResponse.json({ ok: false, error: "file_too_large" }, { status: 413 });

  const zipBuffer = Buffer.from(await file.arrayBuffer());
  const result = await validateAndPreview({ zipBuffer, actor: "admin" });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error, attempt: result.attempt }, { status: 400 });
  return NextResponse.json({ ok: true, attempt: result.attempt });
}
