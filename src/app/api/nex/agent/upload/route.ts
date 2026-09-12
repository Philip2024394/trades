// src/app/api/nex/agent/upload/route.ts
//
// Founder-uploaded attachments for NEX1 tasks (images · documents · logs).
// Stored under data/nex-agent-uploads/{yyyy-mm-dd}/{id}-{safeName}
// Metadata indexed in data/nex-agent-uploads/index.json for later lookup.
//
// POST (multipart) → { ok, id, filename, mimeType, size, previewUrl, uploadedAt }
// GET  ?id=X       → serves the raw bytes with correct content-type
//
// NEX1 image understanding:
//   - For images, the stored file plus its metadata become part of the task's
//     attachment list at submit time. If the underlying orchestrator LLM is
//     vision-capable (Claude 3+), passing image_url or base64 content block
//     lets NEX1 see and describe the image.
//   - For documents (.txt / .md / .json / .log), the file content is UTF-8-
//     decoded and can be inlined into NEX1's prompt as an evidence block.

import { NextResponse } from "next/server";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SIZE_BYTES_DEFAULT = 25 * 1024 * 1024;     // 25 MB · text · code · images · docs
const MAX_SIZE_BYTES_MEDIA = 200 * 1024 * 1024;      // 200 MB · video · audio · design files
const ALLOWED_MIME = new Set([
  // Images (including animated GIF)
  "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/svg+xml",
  "image/heic", "image/heif", "image/avif", "image/bmp", "image/tiff", "image/x-icon",
  // Video · world-class app research
  "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo",
  "video/x-matroska", "video/mpeg", "video/x-flv", "video/ogg", "video/3gpp", "video/3gpp2",
  // Audio · voice-over · mp3 · recordings
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/x-wav",
  "audio/webm", "audio/ogg", "audio/mp4", "audio/x-m4a", "audio/m4a",
  "audio/flac", "audio/x-flac", "audio/aac", "audio/x-aac", "audio/opus",
  // Documents
  "application/pdf", "application/rtf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Text · code · configs · docs
  "text/plain", "text/markdown", "text/html", "text/csv", "text/tab-separated-values",
  "text/css", "text/xml", "text/javascript", "application/javascript",
  "application/typescript", "application/x-typescript",
  "application/json", "application/x-yaml", "text/yaml", "text/x-yaml",
  "application/toml", "text/toml",
  "application/sql", "text/x-sql", "text/x-python", "text/x-ruby",
  "text/x-go", "text/x-rust", "text/x-java", "text/x-c", "text/x-c++",
  "text/x-swift", "text/x-kotlin", "text/x-shellscript",
  // Fonts (custom typography research)
  "font/woff", "font/woff2", "font/ttf", "font/otf", "font/collection",
  "application/x-font-ttf", "application/x-font-otf", "application/font-woff",
  // Design files (concept references)
  "application/postscript", "image/vnd.adobe.photoshop", "application/illustrator",
  "application/x-sketch", "application/x-figma", "application/vnd.figma",
  // 3D · AR references
  "model/gltf-binary", "model/gltf+json", "model/obj", "model/mtl",
  // Archives (project imports)
  "application/zip", "application/x-tar", "application/gzip", "application/x-gzip",
  "application/x-7z-compressed", "application/x-bzip2", "application/x-rar-compressed",
  // Fall-back · browsers commonly attach octet-stream for unknown text
  "application/octet-stream",
]);

/** Choose max-size threshold based on MIME family. Media types get 200MB · everything else 25MB. */
function maxSizeFor(mimeType: string): number {
  if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) return MAX_SIZE_BYTES_MEDIA;
  if (mimeType === "application/vnd.adobe.photoshop" || mimeType === "application/postscript") return MAX_SIZE_BYTES_MEDIA;
  if (mimeType.startsWith("model/")) return MAX_SIZE_BYTES_MEDIA;
  return MAX_SIZE_BYTES_DEFAULT;
}

interface Attachment {
  readonly id: string;
  readonly filename: string;
  readonly safeName: string;
  readonly mimeType: string;
  readonly size: number;
  readonly diskPath: string;
  readonly uploadedAt: string;
  readonly uploadedBy: string;
  readonly isImage: boolean;
  readonly isText: boolean;
  readonly isVideo: boolean;
  readonly isAudio: boolean;
  readonly isFont: boolean;
  readonly isModel: boolean;
}

function uploadsRoot(): string {
  return resolve(process.cwd(), "data/nex-agent-uploads");
}

function indexPath(): string {
  return join(uploadsRoot(), "index.json");
}

function loadIndex(): Record<string, Attachment> {
  const p = indexPath();
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, "utf8")) as Record<string, Attachment>; }
  catch { return {}; }
}

function saveIndex(idx: Record<string, Attachment>): void {
  mkdirSync(uploadsRoot(), { recursive: true });
  writeFileSync(indexPath(), JSON.stringify(idx, null, 2), "utf8");
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
}

function todayFolder(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json({ ok: false, error: "multipart_required" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const uploadedBy = String(form.get("uploaded_by") ?? "founder").trim() || "founder";

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "file_field_missing" }, { status: 400 });
  }
  const size = file.size;
  if (size <= 0) return NextResponse.json({ ok: false, error: "empty_file" }, { status: 400 });
  const mimeType = (file.type || "application/octet-stream").toLowerCase();
  const maxAllowed = maxSizeFor(mimeType);
  if (size > maxAllowed) {
    return NextResponse.json({ ok: false, error: "file_too_large", detail: `max ${maxAllowed} bytes for ${mimeType}` }, { status: 413 });
  }
  if (
    !ALLOWED_MIME.has(mimeType) &&
    !mimeType.startsWith("image/") &&
    !mimeType.startsWith("text/") &&
    !mimeType.startsWith("video/") &&
    !mimeType.startsWith("audio/") &&
    !mimeType.startsWith("font/") &&
    !mimeType.startsWith("model/")
  ) {
    return NextResponse.json({ ok: false, error: "mime_not_allowed", detail: mimeType }, { status: 415 });
  }

  const id = randomUUID();
  const originalName = file.name || "upload";
  const safeName = sanitizeFilename(originalName);
  const day = todayFolder();
  const dir = join(uploadsRoot(), day);
  mkdirSync(dir, { recursive: true });

  const diskPath = join(dir, `${id}-${safeName}`);
  const buf = Buffer.from(await file.arrayBuffer());
  writeFileSync(diskPath, buf);

  const attachment: Attachment = {
    id,
    filename: originalName,
    safeName,
    mimeType,
    size,
    diskPath,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
    isImage: mimeType.startsWith("image/"),
    isText: mimeType.startsWith("text/") || mimeType === "application/json",
    isVideo: mimeType.startsWith("video/"),
    isAudio: mimeType.startsWith("audio/"),
    isFont: mimeType.startsWith("font/") || /application\/(x-font|font)-/.test(mimeType),
    isModel: mimeType.startsWith("model/"),
  };
  const idx = loadIndex();
  idx[id] = attachment;
  saveIndex(idx);

  return NextResponse.json({
    ok: true,
    id: attachment.id,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    size: attachment.size,
    isImage: attachment.isImage,
    isText: attachment.isText,
    isVideo: attachment.isVideo,
    isAudio: attachment.isAudio,
    isFont: attachment.isFont,
    isModel: attachment.isModel,
    previewUrl: `/api/nex/agent/upload?id=${attachment.id}`,
    uploadedAt: attachment.uploadedAt,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id_required" }, { status: 400 });

  const idx = loadIndex();
  const att = idx[id];
  if (!att) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (!existsSync(att.diskPath)) {
    return NextResponse.json({ ok: false, error: "file_missing_from_disk" }, { status: 410 });
  }
  const bytes = readFileSync(att.diskPath);
  const stat = statSync(att.diskPath);
  return new NextResponse(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": att.mimeType,
      "Content-Length": String(stat.size),
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": `inline; filename="${att.safeName}"`,
      "X-Attachment-Id": att.id,
      "X-Uploaded-By": att.uploadedBy,
      "X-Uploaded-At": att.uploadedAt,
    },
  });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id_required" }, { status: 400 });
  const idx = loadIndex();
  if (!idx[id]) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  delete idx[id];
  saveIndex(idx);
  return NextResponse.json({ ok: true, id, note: "index entry removed · disk file preserved for audit" });
}
