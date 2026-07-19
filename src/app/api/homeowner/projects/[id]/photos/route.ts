// POST /api/homeowner/projects/[id]/photos — upload a photo to a
// SiteBook project.
//
// Multipart form:
//   - file (required, Blob) — image/jpeg | image/png | image/webp | image/heic
//   - caption (optional, string)
//   - stage (optional: 'before' | 'in-progress' | 'after')
//
// Auth: homeowner cookie (project owner) OR merchant cookie (trade
// member on the project). Both can add photos; UI marks who uploaded.
//
// Storage: bucket 'sitebook-photos' (created by migration).
// Path: sitebook-photos/{project_id}/{uuid}.{ext}
// Public URL returned + inserted into hammerex_sitebook_photos.

import { NextResponse } from "next/server";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { getMerchantSlug } from "@/lib/merchantSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PhotoStage } from "@/lib/homeowners/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "sitebook-photos";
const MAX_BYTES = 15 * 1024 * 1024;   // 15 MB per upload
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"
]);
const ALLOWED_STAGES: PhotoStage[] = ["before", "in-progress", "after"];

function extensionFor(mimeType: string, filename?: string): string {
  const m: Record<string, string> = {
    "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png",
    "image/webp": ".webp", "image/heic": ".heic", "image/heif": ".heif"
  };
  if (m[mimeType]) return m[mimeType];
  const guess = filename?.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)?.[0];
  return guess ? guess.toLowerCase() : "";
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  // Auth — either homeowner (owns project) OR merchant (project member)
  const homeowner    = await getHomeownerFromCookie();
  const merchantSlug = await getMerchantSlug();
  if (!homeowner && !merchantSlug) {
    return NextResponse.json({ ok: false, error: "not-authed" }, { status: 401 });
  }

  // Verify access to the project
  let uploaderType: "homeowner" | "trade";
  let uploaderId:   string | null = null;
  let uploaderName: string;

  if (homeowner) {
    const owns = await supabaseAdmin
      .from("hammerex_sitebook_projects")
      .select("id")
      .eq("id", projectId)
      .eq("homeowner_id", homeowner.id)
      .maybeSingle();
    if (!owns.data) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    uploaderType = "homeowner";
    uploaderId   = homeowner.id;
    uploaderName = homeowner.first_name || "Homeowner";
  } else {
    // Merchant — must be a member on this project
    const listingRes = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, business_name")
      .eq("slug", merchantSlug)
      .maybeSingle();
    if (!listingRes.data) return NextResponse.json({ ok: false, error: "no-listing" }, { status: 401 });
    const listing = listingRes.data as { id: string; business_name: string };

    const member = await supabaseAdmin
      .from("hammerex_sitebook_members")
      .select("id")
      .eq("project_id", projectId)
      .eq("listing_id", listing.id)
      .maybeSingle();
    if (!member.data) return NextResponse.json({ ok: false, error: "not-member" }, { status: 403 });

    uploaderType = "trade";
    uploaderId   = listing.id;
    uploaderName = listing.business_name;
  }

  // Parse form
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-multipart" }, { status: 400 });
  }
  const file    = form.get("file");
  const caption = String(form.get("caption") ?? "").slice(0, 300) || null;
  const stageRaw = String(form.get("stage") ?? "");
  const stage: PhotoStage | null =
    ALLOWED_STAGES.includes(stageRaw as PhotoStage) ? (stageRaw as PhotoStage) : null;

  if (!(file instanceof Blob))       return NextResponse.json({ ok: false, error: "missing-file" }, { status: 400 });
  if (file.size === 0)               return NextResponse.json({ ok: false, error: "empty-file" }, { status: 400 });
  if (file.size > MAX_BYTES)         return NextResponse.json({ ok: false, error: "file-too-large" }, { status: 413 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ ok: false, error: "invalid-type" }, { status: 415 });

  const ext      = extensionFor(file.type, (file as File).name);
  const filename = `${crypto.randomUUID()}${ext}`;
  const path     = `${projectId}/${filename}`;

  const upload = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType:  file.type,
      cacheControl: "31536000",
      upsert:       false
    });

  if (upload.error) {
    console.error("[sitebook-photos] upload failed", upload.error);
    return NextResponse.json({ ok: false, error: "storage-failed", detail: upload.error.message }, { status: 500 });
  }

  const publicUrl = supabaseAdmin.storage.from(BUCKET).getPublicUrl(upload.data.path).data.publicUrl;

  const ins = await supabaseAdmin
    .from("hammerex_sitebook_photos")
    .insert({
      project_id:        projectId,
      uploaded_by_type:  uploaderType,
      uploaded_by_id:    uploaderId,
      uploaded_by_name:  uploaderName,
      storage_url:       publicUrl,
      caption,
      stage
    })
    .select("id")
    .maybeSingle();

  if (ins.error) {
    console.error("[sitebook-photos] db insert failed", ins.error);
    return NextResponse.json({ ok: false, error: "db-failed" }, { status: 500 });
  }

  // Log the event
  await supabaseAdmin.from("hammerex_sitebook_events").insert({
    project_id:  projectId,
    event_type:  "photo_added",
    actor_type:  uploaderType === "homeowner" ? "homeowner" : "trade",
    actor_id:    uploaderId,
    actor_name:  uploaderName,
    metadata:    { photo_id: ins.data?.id, stage }
  });

  return NextResponse.json({ ok: true, url: publicUrl, id: ins.data?.id });
}
