// OS Foundation — Media upload primitive.
//
// Every app that uploads a file calls uploadImage(). Zero hard-coded
// buckets. Zero re-implemented MIME/size checks. Path convention +
// validation live in storage.ts; this module composes them into a
// safe upload flow.
//
// Contract:
//   uploadImage({actor, category, scopeId?, file}) →
//     { ok: true, url, path } |
//     { ok: false, error: 'unsupported-mime' | 'file-too-large' | ... }
//
// The ACTOR parameter is required — every upload attaches to a caller
// identity so we never store an anonymous file with no audit trail.
// Actor is either merchant (business id) or homeowner (party id via a
// signed upload grant — enforced at the route layer, not here).
import "server-only";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  OS_STORAGE_BUCKETS,
  buildMediaPath,
  extFromMime,
  validateImageUpload,
  type OsMediaCategory
} from "./storage";

export type MediaActor =
  | { kind: "merchant"; merchantId: string }
  | { kind: "homeowner"; merchantId: string; partyId: string };

export type UploadImageInput = {
  actor: MediaActor;
  category: OsMediaCategory;
  scopeId?: string; // homeownerId / jobId / requestId / projectId
  file: File;
};

export type UploadImageOk = {
  ok: true;
  url: string;
  path: string;
  bucket: string;
  bytes: number;
  mime: string;
};

export type UploadImageErr = {
  ok: false;
  code:
    | "unsupported-mime"
    | "file-too-large"
    | "missing-file"
    | "unknown-category"
    | "storage-error";
  message: string;
  maxBytes?: number;
};

export async function uploadImage(
  input: UploadImageInput
): Promise<UploadImageOk | UploadImageErr> {
  if (!input.file || !(input.file instanceof File)) {
    return { ok: false, code: "missing-file", message: "No file provided." };
  }

  const validation = validateImageUpload({
    mime: input.file.type,
    sizeBytes: input.file.size,
    category: input.category
  });
  if (!validation.ok) {
    return {
      ok: false,
      code: validation.code,
      message: validationMessage(validation.code, validation.maxBytes),
      maxBytes: validation.maxBytes
    };
  }

  const merchantId = input.actor.merchantId;
  const uuid = randomUUID();
  const ext = extFromMime(input.file.type);
  const fileName = `${uuid}.${ext}`;
  const path = buildMediaPath({
    category: input.category,
    merchantId,
    scopeId: input.scopeId,
    fileName
  });

  const bucket = OS_STORAGE_BUCKETS.MEDIA;
  const buffer = Buffer.from(await input.file.arrayBuffer());

  const upload = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: input.file.type,
      upsert: false
    });
  if (upload.error) {
    return {
      ok: false,
      code: "storage-error",
      message: `storage: ${upload.error.message}`
    };
  }
  const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return {
    ok: true,
    url: pub.publicUrl,
    path,
    bucket,
    bytes: input.file.size,
    mime: input.file.type
  };
}

function validationMessage(
  code: string,
  maxBytes?: number
): string {
  switch (code) {
    case "unsupported-mime":
      return "That file type isn't supported. Please upload a JPEG, PNG, WebP, or HEIC image.";
    case "file-too-large":
      return maxBytes
        ? `File too large. Max ${Math.round(maxBytes / 1024 / 1024)} MB.`
        : "File too large.";
    case "unknown-category":
      return "Unknown upload category.";
    default:
      return "Upload failed.";
  }
}
