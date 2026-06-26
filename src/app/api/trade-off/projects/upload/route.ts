// POST /api/trade-off/projects/upload
// Single-file multipart upload used by the project manager for before /
// during / after photos. Same shape as /api/trade-off/upload-photo but
// drops bytes under trade-off/projects/<uuid>.<ext>.
//
// 5 MB cap, image/* only. Returns { ok, url }.

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const BUCKET = "product-images";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function extFromMime(mime: string): string {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/heic") return "heic";
  if (mime === "image/heif") return "heif";
  if (mime === "image/gif") return "gif";
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
  if (!raw.type.startsWith("image/")) {
    return NextResponse.json({ ok: false, error: "File must be an image." }, { status: 400 });
  }
  if (raw.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "File exceeds 5 MB." },
      { status: 400 }
    );
  }

  const ext = extFromMime(raw.type);
  const path = `trade-off/projects/${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await raw.arrayBuffer());
  const up = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: raw.type, upsert: false });
  if (up.error) {
    console.error("[trade-off/projects/upload] upload failed:", up.error);
    return NextResponse.json(
      { ok: false, error: up.error.message },
      { status: 500 }
    );
  }
  const pub = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: pub.data.publicUrl });
}
