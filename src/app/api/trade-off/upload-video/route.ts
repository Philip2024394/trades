// POST /api/trade-off/upload-video
// Multipart video upload for plant hire (and any future add-on that
// needs short videos). Drops the bytes into the `product-images` bucket
// under trade-off-video/<uuid>.<ext> and returns the public URL.
//
// Constraints:
//   - video/* MIME only
//   - 30 MB size cap — 60s of 1080p H.264 ≈ 15-25 MB at reasonable bitrate
//   - Duration must be checked client-side before upload (browser reads
//     video.duration). Server can't ffprobe without extra tooling.

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const BUCKET = "product-images";
const MAX_BYTES = 30 * 1024 * 1024;

function extFromMime(mime: string): string {
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/quicktime") return "mov";
  if (mime === "video/webm") return "webm";
  if (mime === "video/x-matroska") return "mkv";
  if (mime === "video/x-msvideo") return "avi";
  return "bin";
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid form body" }, { status: 400 });
  }

  const raw = form.get("file");
  if (!(raw instanceof File) || raw.size === 0) {
    return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
  }
  if (!raw.type.startsWith("video/")) {
    return NextResponse.json({ ok: false, error: "File must be a video." }, { status: 400 });
  }
  if (raw.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "File exceeds 30 MB — reduce quality or trim to under a minute." },
      { status: 400 }
    );
  }

  const ext = extFromMime(raw.type);
  const path = `trade-off-video/${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await raw.arrayBuffer());
  const up = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: raw.type, upsert: false });
  if (up.error) {
    console.error("[trade-off/upload-video] upload failed:", up.error);
    return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  }
  const pub = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: pub.data.publicUrl });
}
