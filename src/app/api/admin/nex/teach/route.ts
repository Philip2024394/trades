// POST /api/admin/nex/teach
// Body: { original_filename, mime_type, size_bytes?, trade_hint?, topic_hint?, notes? }
// Returns: { ok, upload_id, signed_upload_url, storage_path }

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { recordUpload } from "@/lib/nex/intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null) as {
    original_filename: string;
    mime_type:         string;
    size_bytes?:       number;
    trade_hint?:       string;
    topic_hint?:       string;
    notes?:            string;
  } | null;
  if (!body?.original_filename || !body.mime_type) {
    return NextResponse.json({ ok: false, error: "missing_filename_or_mime" }, { status: 400 });
  }

  try {
    const { upload, signedUploadUrl, storagePath } = await recordUpload({
      originalFilename: body.original_filename,
      mimeType:         body.mime_type,
      sizeBytes:        body.size_bytes,
      tradeHint:        body.trade_hint,
      topicHint:        body.topic_hint,
      notes:            body.notes,
      uploadedBy:       "admin",
      uploadedByKind:   "staff"
    });
    return NextResponse.json({
      ok:                true,
      upload_id:         upload.id,
      signed_upload_url: signedUploadUrl,
      storage_path:      storagePath
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "teach_failed" }, { status: 500 });
  }
}
