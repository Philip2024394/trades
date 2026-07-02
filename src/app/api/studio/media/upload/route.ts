// POST /api/studio/media/upload — single-file image upload.
//
// Multipart form; field name = "file". Bytes go into the existing
// `product-images` Storage bucket under
// `studio/{merchant_id}/{uuid}.{ext}` — reusing the infrastructure the
// plant-hire / product editors already run on. A row lands in
// studio_media for fast listing.
//
// Cookie-authenticated. 5 MB cap, image/* only.

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  STUDIO_MEDIA_MAX_BYTES,
  extFromMime,
  isImageMime
} from "@/lib/studio/media";

export const runtime = "nodejs";

const BUCKET = "product-images";

export async function POST(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-form" },
      { status: 400 }
    );
  }
  const raw = form.get("file");
  if (!(raw instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "missing-file" },
      { status: 400 }
    );
  }
  const file = raw;

  if (file.size > STUDIO_MEDIA_MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "file-too-large", maxBytes: STUDIO_MEDIA_MAX_BYTES },
      { status: 413 }
    );
  }
  if (!isImageMime(file.type)) {
    return NextResponse.json(
      { ok: false, error: "unsupported-mime", mime: file.type },
      { status: 415 }
    );
  }

  const ext = extFromMime(file.type);
  const uuid = randomUUID();
  const path = `studio/${session.merchant.id}/${uuid}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const upload = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false
    });

  if (upload.error) {
    return NextResponse.json(
      { ok: false, error: `storage: ${upload.error.message}` },
      { status: 500 }
    );
  }

  const publicUrl = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(path).data.publicUrl;

  const insert = await supabaseAdmin
    .from("studio_media")
    .insert({
      merchant_id: session.merchant.id,
      brand_id: session.brand.id,
      url: publicUrl,
      filename: file.name || `${uuid}.${ext}`,
      size_bytes: file.size,
      mime_type: file.type
    })
    .select("id, url, filename, size_bytes, mime_type, width, height, created_at")
    .maybeSingle();

  if (insert.error || !insert.data) {
    // File is uploaded but the metadata write failed. Best-effort clean
    // up so we don't leak orphaned objects. Ignore delete errors.
    await supabaseAdmin.storage.from(BUCKET).remove([path]);
    return NextResponse.json(
      {
        ok: false,
        error: insert.error?.message ?? "insert-failed"
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    item: {
      id: insert.data.id,
      url: insert.data.url,
      filename: insert.data.filename,
      sizeBytes: insert.data.size_bytes ?? 0,
      mimeType: insert.data.mime_type ?? null,
      width: insert.data.width ?? null,
      height: insert.data.height ?? null,
      createdAt: insert.data.created_at
    }
  });
}
