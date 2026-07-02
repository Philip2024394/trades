// POST /api/trade-off/upload-document — PDF-only document uploader
// used by the careers application flow (CVs). 10 MB cap.

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const BUCKET = "product-images";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

function ext(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "application/msword") return "doc";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
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
  if (!ALLOWED.has(raw.type)) {
    return NextResponse.json(
      { ok: false, error: "File must be PDF, DOC or DOCX." },
      { status: 400 }
    );
  }
  if (raw.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "File exceeds 10 MB." }, { status: 400 });
  }

  const path = `trade-off/docs/${randomUUID()}.${ext(raw.type)}`;
  const bytes = Buffer.from(await raw.arrayBuffer());
  const up = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: raw.type, upsert: false });
  if (up.error) {
    console.error("[trade-off/upload-document] upload failed:", up.error);
    return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  }
  const pub = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({
    ok: true,
    url: pub.data.publicUrl,
    filename: raw.name,
    size: raw.size,
    mime: raw.type
  });
}
