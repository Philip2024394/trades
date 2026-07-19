// POST /api/homeowner/costs/documents — upload a document (quote /
// invoice / receipt / spreadsheet / photo) tied to a project +
// optionally to a specific cost row + the post it came from.
//
// Multipart form:
//   - file        (required, Blob)
//   - projectId   (required, string)  — which project the doc belongs to
//   - costId      (optional)          — attach to an existing cost row
//   - postId      (optional)          — the post that spawned this doc
//   - kind        (optional)          — quote|invoice|receipt|spreadsheet|photo|other
//   - note        (optional)
//
// Auth: homeowner cookie ONLY. Trades never upload here — this is
// the homeowner's private cost paper trail.

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CostDocumentKind } from "@/lib/homeowners/costDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "sitebook-cost-documents";
const MAX_BYTES = 20 * 1024 * 1024;   // 20 MB per upload
const ALLOWED_KINDS: CostDocumentKind[] = ["quote", "invoice", "receipt", "spreadsheet", "photo", "other"];
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"
]);

function extensionFor(mimeType: string, filename?: string): string {
  const map: Record<string, string> = {
    "application/pdf": ".pdf",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "text/csv": ".csv",
    "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png",
    "image/webp": ".webp", "image/heic": ".heic", "image/heif": ".heif"
  };
  if (map[mimeType]) return map[mimeType];
  const guess = filename?.match(/\.(pdf|xls|xlsx|csv|jpg|jpeg|png|webp|heic|heif)$/i)?.[0];
  return guess ? guess.toLowerCase() : "";
}

function kindFor(mimeType: string): CostDocumentKind {
  if (mimeType === "application/pdf") return "quote";
  if (mimeType.startsWith("image/"))  return "photo";
  return "spreadsheet";
}

export async function POST(req: Request) {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-multipart" }, { status: 400 });
  }
  const file      = form.get("file");
  const projectId = String(form.get("projectId") ?? "");
  const costId    = String(form.get("costId")    ?? "") || null;
  const postId    = String(form.get("postId")    ?? "") || null;
  const kindRaw   = String(form.get("kind")      ?? "");
  const note      = String(form.get("note")      ?? "").slice(0, 300) || null;

  if (!projectId)                    return NextResponse.json({ ok: false, error: "missing-project" }, { status: 400 });
  if (!(file instanceof Blob))       return NextResponse.json({ ok: false, error: "missing-file" }, { status: 400 });
  if (file.size === 0)               return NextResponse.json({ ok: false, error: "empty-file" }, { status: 400 });
  if (file.size > MAX_BYTES)         return NextResponse.json({ ok: false, error: "file-too-large" }, { status: 413 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ ok: false, error: "invalid-type" }, { status: 415 });

  // Verify homeowner owns the project (never surface cross-owner existence)
  const proj = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("id")
    .eq("id", projectId)
    .eq("homeowner_id", homeowner.id)
    .maybeSingle();
  if (!proj.data) return NextResponse.json({ ok: false, error: "project-not-found" }, { status: 404 });

  // If costId provided, verify it also belongs to this homeowner + project
  if (costId) {
    const cost = await supabaseAdmin
      .from("hammerex_sitebook_costs")
      .select("id")
      .eq("id", costId)
      .eq("project_id", projectId)
      .eq("homeowner_id", homeowner.id)
      .maybeSingle();
    if (!cost.data) return NextResponse.json({ ok: false, error: "cost-not-found" }, { status: 404 });
  }

  const kind: CostDocumentKind = ALLOWED_KINDS.includes(kindRaw as CostDocumentKind)
    ? (kindRaw as CostDocumentKind)
    : kindFor(file.type);

  const ext      = extensionFor(file.type, (file as File).name);
  const filename = `${crypto.randomUUID()}${ext}`;
  const path     = `${homeowner.id}/${projectId}/${filename}`;

  const upload = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType:  file.type,
      cacheControl: "31536000",
      upsert:       false
    });
  if (upload.error) {
    console.error("[cost-documents] upload failed", upload.error);
    return NextResponse.json({ ok: false, error: "storage-failed", detail: upload.error.message }, { status: 500 });
  }
  const publicUrl = supabaseAdmin.storage.from(BUCKET).getPublicUrl(upload.data.path).data.publicUrl;

  const ins = await supabaseAdmin
    .from("hammerex_sitebook_cost_documents")
    .insert({
      homeowner_id: homeowner.id,
      project_id:   projectId,
      cost_id:      costId,
      post_id:      postId,
      kind,
      file_name:    (file as File).name || `document${ext}`,
      storage_path: upload.data.path,
      storage_url:  publicUrl,
      mime_type:    file.type,
      size_bytes:   file.size,
      note
    })
    .select("*")
    .maybeSingle();
  if (ins.error || !ins.data) {
    console.error("[cost-documents] db insert failed", ins.error);
    return NextResponse.json({ ok: false, error: "db-failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, document: ins.data });
}
