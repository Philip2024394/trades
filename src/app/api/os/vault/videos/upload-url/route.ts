// POST /api/os/vault/videos/upload-url
//
// Issues a Supabase signed upload URL for a homeowner to upload a
// video directly to Storage. Checks quota + entitlement first —
// fail-closed if video not enabled or quota would be exceeded.
//
// After the client upload completes it must POST /register to insert
// the os_project_videos metadata row.

import { NextResponse } from "next/server";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  loadStorageUsage,
  loadVaultEntitlements
} from "@/lib/os/vault/entitlements";
import { partyOwnsProject } from "@/lib/os/vault/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "product-images";
const PATH_PREFIX = "vault-videos";
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB per upload — hard cap
const ALLOWED_MIME = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/x-msvideo"
]);

type UploadRequest = {
  projectId?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
};

export async function POST(request: Request) {
  const party = await loadHomeownerSession();
  if (!party) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 }
    );
  }

  let body: UploadRequest;
  try {
    body = (await request.json()) as UploadRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (
    !body.projectId ||
    !body.fileName ||
    !body.mimeType ||
    typeof body.sizeBytes !== "number"
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "projectId, fileName, mimeType, sizeBytes required."
      },
      { status: 400 }
    );
  }

  if (body.sizeBytes <= 0 || body.sizeBytes > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: "file_too_large",
        message: `Videos must be under ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB per upload.`
      },
      { status: 413 }
    );
  }

  if (!ALLOWED_MIME.has(body.mimeType)) {
    return NextResponse.json(
      {
        ok: false,
        error: "unsupported_mime",
        message: "Video format not supported."
      },
      { status: 415 }
    );
  }

  const owns = await partyOwnsProject(party.id, body.projectId);
  if (!owns) {
    return NextResponse.json(
      { ok: false, error: "Project not found or not owned by you." },
      { status: 404 }
    );
  }

  const entitlements = await loadVaultEntitlements(party.id);
  if (!entitlements.videoEnabled) {
    return NextResponse.json(
      {
        ok: false,
        error: "video_not_enabled",
        message: "Add video storage to your Vault to record and share videos.",
        upgradeHref: "/home/vault/upgrade"
      },
      { status: 402 }
    );
  }

  const usage = await loadStorageUsage(party.id, entitlements);
  const projected = usage.totalBytes + body.sizeBytes;
  if (projected > entitlements.storageTotalBytes) {
    return NextResponse.json(
      {
        ok: false,
        error: "quota_exceeded",
        message: `This upload would exceed your storage quota by ${Math.max(
          0,
          projected - entitlements.storageTotalBytes
        )} bytes.`,
        upgradeHref: "/home/vault/upgrade"
      },
      { status: 413 }
    );
  }

  const safeExt = (body.fileName.match(/\.[A-Za-z0-9]{1,8}$/)?.[0] ?? "").toLowerCase();
  const objectId = crypto.randomUUID();
  const storagePath = `${PATH_PREFIX}/${party.id}/${body.projectId}/${objectId}${safeExt}`;

  const { data: signed, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !signed) {
    return NextResponse.json(
      {
        ok: false,
        error: "sign_failed",
        message: error?.message ?? "Could not sign upload URL."
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    uploadUrl: signed.signedUrl,
    uploadToken: signed.token,
    storagePath,
    objectId,
    bucket: BUCKET
  });
}
