// POST /api/admin/affiliates/marketing
// Multipart upload for the affiliate marketing pack. Admin-only.
//
// Body fields (multipart/form-data):
//   - file        (File)   — the asset; up to 50 MB
//   - kind        (string) — one of the allowed kinds
//   - title       (string)
//   - description (string, optional)
//   - featured    ("1" | undefined)
//
// On success the row is inserted into hammerex_affiliate_marketing_assets
// with the public Supabase Storage URL and we return { ok: true, id }.
//
// GET /api/admin/affiliates/marketing — list all assets (admin only).
//
// DELETE /api/admin/affiliates/marketing?id=<uuid> — delete + remove the
// storage file. Best-effort: we never abort the row delete just because
// the storage object is already gone.
//
// PATCH /api/admin/affiliates/marketing?id=<uuid> — update fields
// (title/description/featured/kind).
import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "product-images";
const MAX_BYTES = 50 * 1024 * 1024;

const ALLOWED_KINDS = new Set([
  "image",
  "video",
  "pdf",
  "logo",
  "qr",
  "banner",
  "story",
  "social_post"
]);

const ALLOWED_LEVELS = new Set(["bronze", "silver", "gold", "platinum"]);

// Extension → contentType lookup. Anything not in this map is rejected.
const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  pdf: "application/pdf"
};

function extOf(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx < 0) return "";
  return name.slice(idx + 1).toLowerCase();
}

function s(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function GET(): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const { data, error } = await supabaseAdmin
    .from("hammerex_affiliate_marketing_assets")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, assets: data ?? [] });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid form body" },
      { status: 400 }
    );
  }

  const kind = s(form.get("kind"));
  const title = s(form.get("title"));
  const description = s(form.get("description")) || null;
  const featured = s(form.get("featured")) === "1";
  const requiredLevelRaw = s(form.get("required_level"));
  const required_level = ALLOWED_LEVELS.has(requiredLevelRaw)
    ? requiredLevelRaw
    : "bronze";

  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json(
      { ok: false, error: "Invalid kind." },
      { status: 400 }
    );
  }
  if (!title) {
    return NextResponse.json(
      { ok: false, error: "Title is required." },
      { status: 400 }
    );
  }

  const raw = form.get("file");
  if (!(raw instanceof File) || raw.size === 0) {
    return NextResponse.json(
      { ok: false, error: "No file provided." },
      { status: 400 }
    );
  }
  if (raw.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "File exceeds 50 MB." },
      { status: 400 }
    );
  }
  const ext = extOf(raw.name || "");
  if (!ext || !EXT_MIME[ext]) {
    return NextResponse.json(
      { ok: false, error: "Allowed: png/jpg/webp/gif/svg/mp4/mov/webm/pdf." },
      { status: 400 }
    );
  }
  const contentType = EXT_MIME[ext];

  const path = `marketing-pack/${kind}/${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await raw.arrayBuffer());
  const up = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (up.error) {
    return NextResponse.json(
      { ok: false, error: up.error.message },
      { status: 500 }
    );
  }
  const pub = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

  const insert = await supabaseAdmin
    .from("hammerex_affiliate_marketing_assets")
    .insert({
      kind,
      title,
      description,
      file_url: pub.data.publicUrl,
      file_size_bytes: raw.size,
      featured,
      required_level
    })
    .select("id")
    .maybeSingle();

  if (insert.error || !insert.data) {
    // Roll back the storage upload on failure so we don't leak orphans.
    await supabaseAdmin.storage.from(BUCKET).remove([path]);
    return NextResponse.json(
      { ok: false, error: insert.error?.message ?? "Insert failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: insert.data.id, file_url: pub.data.publicUrl });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Missing id" },
      { status: 400 }
    );
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (typeof body.description === "string") patch.description = body.description.trim();
  if (typeof body.featured === "boolean") patch.featured = body.featured;
  if (typeof body.kind === "string" && ALLOWED_KINDS.has(body.kind)) {
    patch.kind = body.kind;
  }
  if (
    typeof body.required_level === "string" &&
    ALLOWED_LEVELS.has(body.required_level)
  ) {
    patch.required_level = body.required_level;
  }
  const upd = await supabaseAdmin
    .from("hammerex_affiliate_marketing_assets")
    .update(patch)
    .eq("id", id);
  if (upd.error) {
    return NextResponse.json(
      { ok: false, error: upd.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Missing id" },
      { status: 400 }
    );
  }
  // Fetch the row first so we can pull the storage path from file_url.
  const existing = await supabaseAdmin
    .from("hammerex_affiliate_marketing_assets")
    .select("file_url")
    .eq("id", id)
    .maybeSingle();
  if (existing.data?.file_url) {
    // Public URL shape:
    //   <supabase>/storage/v1/object/public/<bucket>/<path>
    try {
      const u = new URL(existing.data.file_url);
      const prefix = `/storage/v1/object/public/${BUCKET}/`;
      const i = u.pathname.indexOf(prefix);
      if (i >= 0) {
        const objectPath = decodeURIComponent(u.pathname.slice(i + prefix.length));
        await supabaseAdmin.storage.from(BUCKET).remove([objectPath]);
      }
    } catch {
      // best-effort
    }
  }
  const del = await supabaseAdmin
    .from("hammerex_affiliate_marketing_assets")
    .delete()
    .eq("id", id);
  if (del.error) {
    return NextResponse.json(
      { ok: false, error: del.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
