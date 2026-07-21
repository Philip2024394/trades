// POST /api/admin/site-editor/template-thumbnail
//
// Takes a base64 data URL from the admin editor + a template slug,
// resizes to a 400px-wide preview via sharp, uploads to the
// public "template-thumbnails" bucket, returns the public URL.
//
// The admin save flow calls this BEFORE saving the template row so
// the returned URL lands in the thumbnail_url column in one go.
//
// Admin-only via isAdminAuthed().

import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminAuthed } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "template-thumbnails";
const THUMB_WIDTH = 400;

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "not_admin" }, { status: 401 });
  }

  let body: { data_url?: unknown; slug?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const dataUrl = typeof body.data_url === "string" ? body.data_url : "";
  const slug    = typeof body.slug     === "string" ? body.slug.trim().toLowerCase() : "";
  if (!dataUrl.startsWith("data:image/") || !slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx < 0) return NextResponse.json({ ok: false, error: "invalid_data_url" }, { status: 400 });
  const raw = Buffer.from(dataUrl.slice(commaIdx + 1), "base64");

  // Resize to a compact preview — 400px wide, PNG for transparency
  // fidelity, ~80KB typical. Big enough to look sharp in the drawer
  // 2× density; small enough that the drawer loads instantly.
  const png = await sharp(raw).resize({ width: THUMB_WIDTH, withoutEnlargement: true }).png({ quality: 90 }).toBuffer();

  // Upload — upsert so re-saving a template overwrites its preview.
  const path = `${slug}.png`;
  const up = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, png, { contentType: "image/png", upsert: true, cacheControl: "3600" });
  if (up.error) {
    console.error("[template-thumbnail] upload failed:", up.error.message);
    return NextResponse.json({ ok: false, error: "upload_failed" }, { status: 500 });
  }

  const pub = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: pub.data.publicUrl });
}
