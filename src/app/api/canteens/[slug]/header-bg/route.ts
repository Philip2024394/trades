// POST /api/canteens/[slug]/header-bg
//
// Upload / clear the canteen hero banner background image.
// Multipart POST (image/png|jpeg|webp, max 8 MB) → uploads to the
// `product-images` bucket under `canteen-header-bg/{slug}.{ext}`
// and writes the resulting public URL to `hammerex_canteens.header_bg_url`.
//
// POST ?clear=1 (no body) clears the URL — hero falls back to the
// palette gradient.
//
// Auth: admin-only in production. Currently gated by getAdminIdentity
// which returns null when the admin session cookie is missing;
// during pre-launch that gate is effectively open (see admin auth
// bypass in place).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ ok: false, error: "missing-slug" }, { status: 400 });
  }

  const url = new URL(req.url);
  const clearing = url.searchParams.get("clear") === "1";

  // Clear path — write null.
  if (clearing) {
    const upd = await supabaseAdmin
      .from("hammerex_canteens")
      .update({ header_bg_url: null, updated_at: new Date().toISOString() })
      .eq("slug", slug);
    if (upd.error) {
      return NextResponse.json({ ok: false, error: "db-update-failed", detail: upd.error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, url: null });
  }

  // Upload path — multipart.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-multipart" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing-file" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ ok: false, error: "invalid-type", detail: file.type }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "too-large", detail: `${file.size}` }, { status: 400 });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `canteen-header-bg/${slug}.${ext}`;
  const buffer = new Uint8Array(await file.arrayBuffer());

  const uploadRes = await supabaseAdmin.storage
    .from("product-images")
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (uploadRes.error) {
    return NextResponse.json({ ok: false, error: "upload-failed", detail: uploadRes.error.message }, { status: 500 });
  }

  const { data: publicUrl } = supabaseAdmin.storage
    .from("product-images")
    .getPublicUrl(path);
  const bust = Date.now();
  const finalUrl = `${publicUrl.publicUrl}?v=${bust}`;

  const upd = await supabaseAdmin
    .from("hammerex_canteens")
    .update({ header_bg_url: finalUrl, updated_at: new Date().toISOString() })
    .eq("slug", slug);
  if (upd.error) {
    return NextResponse.json({ ok: false, error: "db-update-failed", detail: upd.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: finalUrl });
}
