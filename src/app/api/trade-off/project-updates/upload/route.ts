// POST /api/trade-off/project-updates/upload
// Multipart upload for Job Diary update images. 5 MB hard cap (lower
// than Downloads' 10 MB because we expect up to 4 images per post).
//
// Allowed: JPG / PNG / WEBP / HEIC / HEIF. HARD-BLOCKS executables,
// macro Office, HTML/JS/SVG. Server-side MIME sniff cross-checks the
// declared content-type against the file extension.
//
// Storage: bucket `product-images`, key `job-diary/<uuid>.<ext>`. We
// reuse the existing public bucket so no new storage policy is
// required.
//
// The route validates the magic-link edit_token before writing —
// timingSafeEqual to keep the comparison constant-time.

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const BUCKET = "product-images";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED: Record<string, { mime: string[] }> = {
  jpg:  { mime: ["image/jpeg", "image/jpg"] },
  jpeg: { mime: ["image/jpeg", "image/jpg"] },
  png:  { mime: ["image/png"] },
  webp: { mime: ["image/webp"] },
  heic: { mime: ["image/heic", "image/heif", ""] },
  heif: { mime: ["image/heif", "image/heic", ""] }
};

const BLOCKED_EXTS = new Set([
  "exe", "bat", "sh", "cmd", "scr", "com", "msi", "app", "dmg",
  "docm", "xlsm", "pptm",
  "html", "htm", "js", "mjs", "svg", "xml", "xhtml"
]);

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

function extOf(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx < 0) return "";
  return name.slice(idx + 1).toLowerCase();
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid form body" }, { status: 400 });
  }

  const slug = s(form.get("slug"));
  const token = s(form.get("edit_token"));
  if (!slug || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or edit_token." },
      { status: 400 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (!constantTimeEq(listing.data.edit_token, token)) {
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 403 });
  }

  const raw = form.get("file");
  if (!(raw instanceof File) || raw.size === 0) {
    return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
  }
  if (raw.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Image exceeds 5 MB. Compress before uploading." },
      { status: 400 }
    );
  }

  const ext = extOf(raw.name || "");
  if (!ext) {
    return NextResponse.json(
      { ok: false, error: "File needs an extension." },
      { status: 400 }
    );
  }
  if (BLOCKED_EXTS.has(ext)) {
    return NextResponse.json(
      { ok: false, error: "This file type is not allowed." },
      { status: 400 }
    );
  }
  const rule = ALLOWED[ext];
  if (!rule) {
    return NextResponse.json(
      { ok: false, error: "Allowed: JPG, PNG, WEBP, HEIC, HEIF." },
      { status: 400 }
    );
  }
  const mime = (raw.type || "").toLowerCase();
  if (mime && !rule.mime.includes(mime)) {
    return NextResponse.json(
      { ok: false, error: "File contents do not match the file extension." },
      { status: 400 }
    );
  }

  const path = `job-diary/${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await raw.arrayBuffer());
  const contentType = rule.mime[0] || "image/jpeg";
  const up = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (up.error) {
    console.error("[trade-off/project-updates/upload] upload failed:", up.error);
    return NextResponse.json(
      { ok: false, error: up.error.message },
      { status: 500 }
    );
  }
  const pub = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({
    ok: true,
    url: pub.data.publicUrl,
    size_bytes: raw.size
  });
}
