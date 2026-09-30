// src/lib/nex-native/gallery-image-service.ts
//
// Bridge Gallery-B · sealed 2026-09-30 · server-side CRUD for the
// nex_gallery_image table (Migration 111). Powers the Personal Brand
// Images tab on Templates 10 / 13 / 14 by giving sellers an editor
// that swaps the placeholder tiles for real photography.
//
// All mutations run under the service role (nexSupabaseAdmin). The
// underlying RLS DENIES every client-side write · Gallery-C's server
// actions are the only path to modify these rows.
//
// Files upload to the shared nex-business-assets bucket under
// gallery/<business_id>/<timestamp>.<ext>. Public-read is inherited
// from Migration 110's storage policy · no per-file ACL needed.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";

export const NEX_GALLERY_CAPTION_MAX = 200;
export const NEX_GALLERY_LONG_DESCRIPTION_MAX = 2000;
export const NEX_GALLERY_IMAGE_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const NEX_GALLERY_ALLOWED_MIMES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

export interface NexGalleryImageRow {
  id: NexUuid;
  business_id: NexUuid;
  image_url: string;
  caption: string;
  long_description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** List every gallery image for a business, ordered by sort_order asc
 *  then created_at asc so ties render in insertion order. Public data
 *  · safe to call from any server context. */
export async function listGalleryImages(
  businessId: NexUuid,
): Promise<NexGalleryImageRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_gallery_image")
    .select(
      "id, business_id, image_url, caption, long_description, sort_order, created_at, updated_at",
    )
    .eq("business_id", businessId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(
      `gallery-image-service.listGalleryImages(${businessId}): ${error.message}`,
    );
  }
  return (data ?? []) as NexGalleryImageRow[];
}

/** Insert a new gallery row for a pre-uploaded image URL. Returns the
 *  full row so the caller can update UI state without a re-fetch. */
export async function insertGalleryImage(input: {
  businessId: NexUuid;
  imageUrl: string;
  caption?: string;
  longDescription?: string;
  sortOrder?: number;
}): Promise<NexGalleryImageRow> {
  const caption = clampCaption(input.caption ?? "");
  const longDescription = clampLongDescription(input.longDescription ?? "");
  const sortOrder =
    typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)
      ? Math.max(0, Math.min(9999, Math.floor(input.sortOrder)))
      : await nextSortOrder(input.businessId);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_gallery_image")
    .insert({
      business_id: input.businessId,
      image_url: input.imageUrl,
      caption,
      long_description: longDescription,
      sort_order: sortOrder,
    })
    .select(
      "id, business_id, image_url, caption, long_description, sort_order, created_at, updated_at",
    )
    .single();
  if (error || !data) {
    throw new Error(
      `gallery-image-service.insertGalleryImage: ${error?.message ?? "no data returned"}`,
    );
  }
  return data as NexGalleryImageRow;
}

/** Partial update · pass only the fields you want to change. */
export async function updateGalleryImage(
  id: NexUuid,
  patch: {
    caption?: string;
    longDescription?: string;
    sortOrder?: number;
  },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (typeof patch.caption === "string") {
    update.caption = clampCaption(patch.caption);
  }
  if (typeof patch.longDescription === "string") {
    update.long_description = clampLongDescription(patch.longDescription);
  }
  if (typeof patch.sortOrder === "number" && Number.isFinite(patch.sortOrder)) {
    update.sort_order = Math.max(0, Math.min(9999, Math.floor(patch.sortOrder)));
  }
  if (Object.keys(update).length === 0) return;
  const { error } = await nexSupabaseAdmin
    .from("nex_gallery_image")
    .update(update)
    .eq("id", id);
  if (error) {
    throw new Error(
      `gallery-image-service.updateGalleryImage(${id}): ${error.message}`,
    );
  }
}

/** Delete a row AND the underlying storage object. Best-effort on the
 *  storage side · a missing object should not block the row delete. */
export async function deleteGalleryImage(id: NexUuid): Promise<void> {
  const { data: row, error: readErr } = await nexSupabaseAdmin
    .from("nex_gallery_image")
    .select("image_url")
    .eq("id", id)
    .maybeSingle();
  if (readErr) {
    throw new Error(
      `gallery-image-service.deleteGalleryImage(${id}): ${readErr.message}`,
    );
  }
  if (row?.image_url) {
    const path = extractStoragePath(row.image_url);
    if (path) {
      const bucket = nexSupabaseAdmin.storage.from("nex-business-assets");
      await bucket.remove([path]).catch(() => {
        // Silent · storage GC will pick it up eventually.
      });
    }
  }
  const { error } = await nexSupabaseAdmin
    .from("nex_gallery_image")
    .delete()
    .eq("id", id);
  if (error) {
    throw new Error(
      `gallery-image-service.deleteGalleryImage(${id}): ${error.message}`,
    );
  }
}

/** Reorder in one shot · caller passes the ordered id array, we write
 *  sort_order = index for each. Uses a single UPDATE per row (no
 *  transaction primitive on supabase-js) · order matters, run
 *  sequentially so the last write wins on races. */
export async function reorderGalleryImages(
  businessId: NexUuid,
  orderedIds: NexUuid[],
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i];
    const { error } = await nexSupabaseAdmin
      .from("nex_gallery_image")
      .update({ sort_order: i })
      .eq("id", id)
      .eq("business_id", businessId);
    if (error) {
      throw new Error(
        `gallery-image-service.reorderGalleryImages(${id}@${i}): ${error.message}`,
      );
    }
  }
}

/** Upload a raw file to the bucket, then insert a matching gallery
 *  row. Returns the persisted row so the caller can render it
 *  immediately without a separate list-refresh round-trip. */
export async function uploadGalleryImage(input: {
  businessId: NexUuid;
  file: File;
  caption?: string;
  longDescription?: string;
}): Promise<NexGalleryImageRow> {
  const { businessId, file } = input;
  if (file.size > NEX_GALLERY_IMAGE_MAX_BYTES) {
    throw new Error(
      `Image exceeds ${NEX_GALLERY_IMAGE_MAX_BYTES / (1024 * 1024)}MB cap`,
    );
  }
  const mime = (file.type || "").toLowerCase();
  const ext = NEX_GALLERY_ALLOWED_MIMES[mime];
  if (!ext) {
    throw new Error(
      `Image must be png / jpg / webp · got ${file.type || "unknown"}`,
    );
  }
  const objectPath = `gallery/${businessId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;
  const bucket = nexSupabaseAdmin.storage.from("nex-business-assets");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await bucket.upload(objectPath, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) {
    throw new Error(`gallery-image-service.uploadGalleryImage: ${upErr.message}`);
  }
  const { data: pub } = bucket.getPublicUrl(objectPath);
  return insertGalleryImage({
    businessId,
    imageUrl: pub.publicUrl,
    caption: input.caption,
    longDescription: input.longDescription,
  });
}

// ─── Helpers ────────────────────────────────────────────────────────

function clampCaption(v: string): string {
  return String(v).trim().slice(0, NEX_GALLERY_CAPTION_MAX);
}

function clampLongDescription(v: string): string {
  return String(v).trim().slice(0, NEX_GALLERY_LONG_DESCRIPTION_MAX);
}

async function nextSortOrder(businessId: NexUuid): Promise<number> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_gallery_image")
    .select("sort_order")
    .eq("business_id", businessId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (error) {
    throw new Error(
      `gallery-image-service.nextSortOrder(${businessId}): ${error.message}`,
    );
  }
  const max = data?.[0]?.sort_order;
  return typeof max === "number" ? max + 1 : 0;
}

/** Extract the bucket path from a public URL like
 *  https://…/storage/v1/object/public/nex-business-assets/gallery/…/x.png
 *  Returns null if the URL doesn't look like one of our storage URLs. */
function extractStoragePath(url: string): string | null {
  const marker = "/nex-business-assets/";
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  return url.slice(idx + marker.length);
}
