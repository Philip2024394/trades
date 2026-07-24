// GET /api/admin/nex/backup/[id]/download
// Returns a short-lived signed URL to the ZIP in Supabase Storage.
// Never streams the bytes through our API — signed URL sends the
// browser straight to Storage. Merchant grabs it, saves to USB, done.

import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { getBackup, signedDownloadUrl, audit } from "@/lib/nex/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  if (!(await isAdminAuthed())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const run = await getBackup(id);
  if (!run) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (run.status !== "complete") return NextResponse.json({ ok: false, error: `status_${run.status}` }, { status: 409 });
  const url = await signedDownloadUrl(run, 300);
  if (!url) return NextResponse.json({ ok: false, error: "sign_failed" }, { status: 500 });
  await audit({ actor: "admin", action: "backup.downloaded", backupRunId: id, details: {} });
  return NextResponse.json({ ok: true, signed_url: url, expires_in_seconds: 300 });
}
