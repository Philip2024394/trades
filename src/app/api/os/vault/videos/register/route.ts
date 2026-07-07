// POST /api/os/vault/videos/register
//
// After the client completes the direct upload to Supabase Storage,
// this endpoint inserts the os_project_videos metadata row and logs
// the storage usage event (which bumps used_video_bytes).

import { NextResponse } from "next/server";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { partyOwnsProject } from "@/lib/os/vault/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "product-images";
const ALLOWED_CATEGORIES = [
  "walkthrough",
  "quote_supporting",
  "work_in_progress",
  "signoff_evidence",
  "defect_report",
  "warranty_claim",
  "general"
] as const;

type RegisterBody = {
  projectId?: string;
  storagePath?: string;
  title?: string;
  description?: string;
  mimeType?: string;
  sizeBytes?: number;
  durationSeconds?: number;
  category?: string;
};

export async function POST(request: Request) {
  const party = await loadHomeownerSession();
  if (!party) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 }
    );
  }

  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (
    !body.projectId ||
    !body.storagePath ||
    !body.title ||
    !body.mimeType ||
    typeof body.sizeBytes !== "number"
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "projectId, storagePath, title, mimeType, sizeBytes required."
      },
      { status: 400 }
    );
  }

  const owns = await partyOwnsProject(party.id, body.projectId);
  if (!owns) {
    return NextResponse.json(
      { ok: false, error: "Project not found or not owned by you." },
      { status: 404 }
    );
  }

  // Confirm the object actually exists at the reported path before
  // trusting the size.
  const parentPath = body.storagePath.substring(
    0,
    body.storagePath.lastIndexOf("/")
  );
  const objectName = body.storagePath.substring(
    body.storagePath.lastIndexOf("/") + 1
  );
  const { data: listing } = await supabaseAdmin.storage
    .from(BUCKET)
    .list(parentPath, { search: objectName });
  const foundObj = listing?.find((o) => o.name === objectName);
  if (!foundObj) {
    return NextResponse.json(
      { ok: false, error: "Uploaded object not found in storage." },
      { status: 404 }
    );
  }
  const authoritativeSize =
    (foundObj.metadata as { size?: number } | null)?.size ?? body.sizeBytes;

  // Fetch the project to derive the property_id linkage
  const { data: project } = await supabaseAdmin
    .from("os_projects")
    .select("property_id")
    .eq("id", body.projectId)
    .single();

  const { data: publicUrl } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(body.storagePath);

  const category =
    body.category && ALLOWED_CATEGORIES.includes(body.category as never)
      ? body.category
      : "general";

  const { data: inserted, error } = await supabaseAdmin
    .from("os_project_videos")
    .insert({
      project_id: body.projectId,
      property_id: project?.property_id ?? null,
      owning_party_id: party.id,
      uploaded_by_party_id: party.id,
      title: body.title,
      description: body.description ?? null,
      storage_path: body.storagePath,
      video_url: publicUrl?.publicUrl ?? "",
      mime_type: body.mimeType,
      size_bytes: authoritativeSize,
      duration_seconds: body.durationSeconds ?? null,
      video_category: category,
      visibility: "private"
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "insert_failed", message: error.message },
      { status: 500 }
    );
  }

  // Log usage event so nightly aggregation bumps the quota counter
  await supabaseAdmin.from("os_storage_usage_events").insert({
    party_id: party.id,
    property_id: project?.property_id ?? null,
    project_id: body.projectId,
    action: "upload",
    object_type: "video",
    object_id: inserted.id,
    storage_path: body.storagePath,
    bytes_delta: authoritativeSize,
    triggered_by: "user"
  });

  // Bump the denormalised quota row for immediate visibility. Nightly
  // aggregation from os_storage_usage_events is authoritative for
  // reconciliation — this is the fast path so the storage % updates
  // immediately in the UI.
  const { data: existingQuota } = await supabaseAdmin
    .from("os_storage_quotas")
    .select("used_video_bytes, used_total_bytes")
    .eq("party_id", party.id)
    .maybeSingle();
  if (existingQuota) {
    await supabaseAdmin
      .from("os_storage_quotas")
      .update({
        used_video_bytes:
          (Number(existingQuota.used_video_bytes) || 0) + authoritativeSize,
        used_total_bytes:
          (Number(existingQuota.used_total_bytes) || 0) + authoritativeSize,
        last_calculated_at: new Date().toISOString()
      })
      .eq("party_id", party.id);
  } else {
    await supabaseAdmin.from("os_storage_quotas").insert({
      party_id: party.id,
      used_video_bytes: authoritativeSize,
      used_total_bytes: authoritativeSize,
      last_calculated_at: new Date().toISOString()
    });
  }

  return NextResponse.json({
    ok: true,
    videoId: inserted.id,
    videoUrl: publicUrl?.publicUrl ?? ""
  });
}
