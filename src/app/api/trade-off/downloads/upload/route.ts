// POST /api/trade-off/downloads/upload
// Multipart upload for the Downloads add-on. 10 MB cap, allows PDFs,
// Word/Excel docs, and JPG/PNG images. HARD-BLOCKS executables,
// macro-enabled Office and HTML/JS/SVG — XSS / malware vectors.
//
// Storage: bucket `product-images`, key `downloads/<uuid>.<ext>`. We
// reuse the existing public bucket so no new policy is required; the
// path prefix `downloads/` lets us bulk-clean files in future.
//
// The route validates the magic-link edit_token before writing — same
// auth pattern as products/upsert. Returns the public URL plus the
// detected file size + file_type slug (matches the table CHECK
// constraint) so the client can persist them in one upsert.

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const BUCKET = "product-images";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Explicit allow-list — extension + matching MIME pairs. Anything else
// gets rejected outright. The order here defines the file_type slug we
// persist in the table, which the public surface uses to pick the
// rendered icon.
const ALLOWED: Record<string, { mime: string[]; file_type: string }> = {
  pdf:  { mime: ["application/pdf"], file_type: "pdf" },
  doc:  { mime: ["application/msword"], file_type: "doc" },
  docx: { mime: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"], file_type: "docx" },
  xls:  { mime: ["application/vnd.ms-excel"], file_type: "xls" },
  xlsx: { mime: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], file_type: "xlsx" },
  jpg:  { mime: ["image/jpeg", "image/jpg"], file_type: "jpg" },
  jpeg: { mime: ["image/jpeg", "image/jpg"], file_type: "jpeg" },
  png:  { mime: ["image/png"], file_type: "png" }
};

// Hard-block list — anything matching these extensions is rejected
// even if the MIME claims something innocuous. Belt-and-braces on top
// of the allow-list above.
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
      { ok: false, error: "File exceeds 10 MB." },
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
      { ok: false, error: "Allowed: PDF, Word, Excel, JPG, PNG." },
      { status: 400 }
    );
  }
  // MIME sniff — must match one of the allowed values for that
  // extension. We accept an empty MIME (some browsers send "") only when
  // the extension is in our allow-list; the storage upload below stamps
  // a sane contentType regardless.
  const mime = (raw.type || "").toLowerCase();
  if (mime && !rule.mime.includes(mime)) {
    return NextResponse.json(
      { ok: false, error: "File contents do not match the file extension." },
      { status: 400 }
    );
  }

  const path = `downloads/${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await raw.arrayBuffer());
  const contentType = rule.mime[0];
  const up = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (up.error) {
    console.error("[trade-off/downloads/upload] upload failed:", up.error);
    return NextResponse.json(
      { ok: false, error: up.error.message },
      { status: 500 }
    );
  }
  const pub = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({
    ok: true,
    url: pub.data.publicUrl,
    size_bytes: raw.size,
    file_type: rule.file_type
  });
}
