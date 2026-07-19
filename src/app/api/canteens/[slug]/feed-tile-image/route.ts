// POST /api/canteens/[slug]/feed-tile-image
//
// Multipart image upload for the Live Feed tile background.
// Stores the file in the shared `product-images` Supabase Storage
// bucket under `canteen-feed-tiles/<slug>.<ext>` (upsert=true so
// re-upload overwrites), stamps the public URL onto
// hammerex_canteens.feed_tile_image_url, and returns { ok, url }.
//
// Auth: disabled pre-launch (matches /api/canteens/[slug]/theme).
// Re-enable when merchant sign-in is stable.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const BUCKET = "product-images";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

function extFromMime(mime: string): string {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png")  return "png";
  if (mime === "image/webp") return "webp";
  return "bin";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ ok: false, error: "missing-slug" }, { status: 400 });
  }

  // Handle DELETE-style clear via ?clear=1 query param OR JSON body
  const url = new URL(req.url);
  if (url.searchParams.get("clear") === "1") {
    const upd = await supabaseAdmin
      .from("hammerex_canteens")
      .update({ feed_tile_image_url: null, updated_at: new Date().toISOString() })
      .eq("slug", slug);
    if (upd.error) {
      return NextResponse.json({ ok: false, error: upd.error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, url: null });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-form-body" }, { status: 400 });
  }

  const raw = form.get("file");
  if (!(raw instanceof File) || raw.size === 0) {
    return NextResponse.json({ ok: false, error: "no-file" }, { status: 400 });
  }
  if (!ALLOWED.has(raw.type)) {
    return NextResponse.json({ ok: false, error: "type-not-allowed", detail: "PNG, JPEG, or WEBP only." }, { status: 400 });
  }
  if (raw.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "too-large", detail: "5 MB max." }, { status: 400 });
  }

  const ext = extFromMime(raw.type);
  const path = `canteen-feed-tiles/${slug}.${ext}`;
  const bytes = Buffer.from(await raw.arrayBuffer());

  const up = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: raw.type, upsert: true });
  if (up.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens/feed-tile-image] upload failed:", up.error);
    return NextResponse.json({ ok: false, error: "upload-failed", detail: up.error.message }, { status: 500 });
  }
  const pub = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  // Cache-buster so a re-upload isn't served from CDN cache.
  const publicUrl = `${pub.data.publicUrl}?v=${Date.now()}`;

  const upd = await supabaseAdmin
    .from("hammerex_canteens")
    .update({ feed_tile_image_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("slug", slug);
  if (upd.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens/feed-tile-image] db update failed:", upd.error);
    return NextResponse.json({ ok: false, error: "db-update-failed", detail: upd.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: publicUrl });
}
