// GET  /api/site/editor/overlays          — list overlays for the caller
//                                            (their own + globals)
// POST /api/site/editor/overlays          — upload a new overlay
//                                            multipart form: file + label + category
//
// Overlays live in the `social-media` bucket:
//   user-overlays/<merchant-slug>/<uuid>.<ext>   — merchant-owned
//   overlays/<slug>.<ext>                        — admin-published globals
//
// The DB row (hammerex_site_editor_overlays) carries the public URL +
// category so the drawer only makes one request to render.

import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET       = "social-media";
const USER_PREFIX  = "user-overlays";
const MAX_BYTES    = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const ALLOWED_CATS = new Set(["promo","cta","trust","status","job","price","banner","custom"]);

export async function GET(): Promise<NextResponse> {
  const merchantSlug = await getMerchantSlug();

  // Globals + this merchant's own. RLS is enabled but we're using
  // the service-role client, so filter here.
  const q = supabaseAdmin
    .from("hammerex_site_editor_overlays")
    .select("id, label, category, url, aspect_ratio, owner_merchant_slug")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(200);

  const filtered = merchantSlug
    ? q.or(`owner_merchant_slug.is.null,owner_merchant_slug.eq.${merchantSlug}`)
    : q.is("owner_merchant_slug", null);

  const res = await filtered;
  if (res.error) {
    console.error("[editor/overlays] list failed:", res.error.message);
    return NextResponse.json({ overlays: [] });
  }

  const overlays = (res.data ?? []).map((r) => ({
    id:          r.id           as string,
    label:       r.label        as string,
    group:       r.category     as string,
    url:         r.url          as string,
    aspectRatio: r.aspect_ratio as number | null,
    isMine:      r.owner_merchant_slug === merchantSlug
  }));
  return NextResponse.json({ overlays });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const merchantSlug = await getMerchantSlug();
  if (!merchantSlug) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }

  const file  = form.get("file");
  const label = String(form.get("label") ?? "").trim().slice(0, 80);
  const category = String(form.get("category") ?? "custom").trim().toLowerCase();
  const aspectRaw = Number(form.get("aspect_ratio") ?? "0");

  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "file_required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "too_large", limit: MAX_BYTES }, { status: 413 });
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ ok: false, error: "unsupported_type", allowed: Array.from(ALLOWED_MIME) }, { status: 400 });
  }
  if (!label) {
    return NextResponse.json({ ok: false, error: "label_required" }, { status: 400 });
  }
  const cat = ALLOWED_CATS.has(category) ? category : "custom";

  const ext = mime === "image/png"  ? "png"
            : mime === "image/jpeg" ? "jpg"
            : mime === "image/webp" ? "webp"
            : "svg";
  const storagePath = `${USER_PREFIX}/${merchantSlug}/${randomBytes(16).toString("hex")}.${ext}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  const up = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: mime,
    upsert: false
  });
  if (up.error) {
    console.error("[editor/overlays] storage upload:", up.error.message);
    return NextResponse.json({ ok: false, error: "upload_failed" }, { status: 500 });
  }
  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);

  const ins = await supabaseAdmin
    .from("hammerex_site_editor_overlays")
    .insert({
      owner_merchant_slug: merchantSlug,
      label,
      category:            cat,
      url:                 pub.publicUrl,
      aspect_ratio:        aspectRaw > 0 && Number.isFinite(aspectRaw) ? aspectRaw : null,
      storage_path:        storagePath,
      active:              true
    })
    .select("id, label, category, url, aspect_ratio")
    .single();
  if (ins.error || !ins.data) {
    // Rollback the storage upload so we don't leak orphaned files.
    await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
    console.error("[editor/overlays] insert failed:", ins.error?.message);
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok:      true,
    overlay: {
      id:          ins.data.id           as string,
      label:       ins.data.label        as string,
      group:       ins.data.category     as string,
      url:         ins.data.url          as string,
      aspectRatio: ins.data.aspect_ratio as number | null,
      isMine:      true
    }
  });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const merchantSlug = await getMerchantSlug();
  if (!merchantSlug) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }
  const id = (req.nextUrl.searchParams.get("id") ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "id_required" }, { status: 400 });

  const row = await supabaseAdmin
    .from("hammerex_site_editor_overlays")
    .select("id, storage_path, owner_merchant_slug")
    .eq("id", id)
    .maybeSingle();
  if (row.error || !row.data) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (row.data.owner_merchant_slug !== merchantSlug) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  if (row.data.storage_path) {
    await supabaseAdmin.storage.from(BUCKET).remove([row.data.storage_path as string]);
  }
  await supabaseAdmin
    .from("hammerex_site_editor_overlays")
    .delete()
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
