// src/lib/nex-native/theme-sticker-service.ts
//
// Bridge ThemeSticker-A · sealed 2026-10-01 · server-side CRUD for
// nex_theme_sticker (Migration 118). Backs the PeerComposer Stickers
// tab. Stickers are a SEPARATE content type from theme emojis · they
// render ~140px tall in bubbles via attachment_type='sticker', never
// as inline chips.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";

export const NEX_THEME_STICKER_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const NEX_THEME_STICKER_ALLOWED_MIMES: Record<string, string> = {
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Phase 1 ships 'static' only. 'animated' is reserved for future NEX
 *  character reaction stickers (3–5s APNG / animated WebP / Lottie).
 *  The renderer MUST branch on this field so animated playback can
 *  land as a drop-in later. */
export type NexThemeStickerType = "static" | "animated";

export interface NexThemeStickerRow {
  id: string;
  theme_id: string;
  slug: string;
  image_url: string;
  label: string;
  sort_order: number;
  sticker_type: NexThemeStickerType;
  aspect_ratio: number;
  created_at: string;
  updated_at: string;
}

/** List every sticker for a theme (sorted). Returns empty array when
 *  the theme has no sticker set · caller shows an empty-state hint. */
export async function listThemeStickers(
  themeId: string,
): Promise<NexThemeStickerRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_theme_sticker")
    .select(
      "id, theme_id, slug, image_url, label, sort_order, sticker_type, aspect_ratio, created_at, updated_at",
    )
    .eq("theme_id", themeId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    // Fail soft · never break the composer over a picker fetch.
    console.error(
      `theme-sticker-service.listThemeStickers(${themeId}): ${error.message}`,
    );
    return [];
  }
  return (data ?? []) as NexThemeStickerRow[];
}

/** Upload a raw sticker file to the nex-theme-sticker bucket then
 *  insert a matching row. Returns the persisted row so admin UI can
 *  render it immediately without a re-fetch. */
export async function uploadThemeSticker(input: {
  themeId: string;
  slug: string;
  file: File;
  label?: string;
  sortOrder?: number;
  stickerType?: NexThemeStickerType;
  aspectRatio?: number;
}): Promise<NexThemeStickerRow> {
  const { themeId, file } = input;
  if (file.size > NEX_THEME_STICKER_MAX_BYTES) {
    throw new Error(
      `Sticker exceeds ${NEX_THEME_STICKER_MAX_BYTES / 1024 / 1024}MB cap`,
    );
  }
  const mime = (file.type || "").toLowerCase();
  const ext = NEX_THEME_STICKER_ALLOWED_MIMES[mime];
  if (!ext) {
    throw new Error(
      `Sticker must be png / webp / gif · got ${file.type || "unknown"}`,
    );
  }
  const slug = String(input.slug).toLowerCase().trim();
  if (!/^[a-z0-9][a-z0-9_-]{0,60}$/.test(slug)) {
    throw new Error(
      "Sticker slug must be 1-61 chars · alphanumeric + dash + underscore",
    );
  }
  const stickerType: NexThemeStickerType = input.stickerType ?? "static";
  const aspectRatio =
    typeof input.aspectRatio === "number" &&
    Number.isFinite(input.aspectRatio) &&
    input.aspectRatio > 0
      ? input.aspectRatio
      : 1;
  const objectPath = `${themeId}/${slug}.${ext}`;
  const bucket = nexSupabaseAdmin.storage.from("nex-theme-sticker");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await bucket.upload(objectPath, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (upErr) {
    throw new Error(
      `theme-sticker-service.uploadThemeSticker: ${upErr.message}`,
    );
  }
  const { data: pub } = bucket.getPublicUrl(objectPath);
  const label = String(input.label ?? "").trim().slice(0, 40);
  const sortOrder =
    typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)
      ? Math.max(0, Math.min(9999, Math.floor(input.sortOrder)))
      : await nextSortOrder(themeId);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_theme_sticker")
    .upsert(
      {
        theme_id: themeId,
        slug,
        image_url: pub.publicUrl,
        label,
        sort_order: sortOrder,
        sticker_type: stickerType,
        aspect_ratio: aspectRatio,
      },
      { onConflict: "theme_id,slug" },
    )
    .select(
      "id, theme_id, slug, image_url, label, sort_order, sticker_type, aspect_ratio, created_at, updated_at",
    )
    .single();
  if (error || !data) {
    throw new Error(
      `theme-sticker-service.uploadThemeSticker insert: ${error?.message ?? "no data"}`,
    );
  }
  return data as NexThemeStickerRow;
}

/** Authoritative lookup for a single sticker scoped to a theme.
 *  Returns `null` if the slug doesn't exist in that theme (prevents
 *  cross-theme smuggling via a crafted slug). The live
 *  `sendPeerStickerAction` MUST route all sticker sends through this
 *  helper so the browser never supplies the URL / label / type /
 *  aspect — only the slug — and the server resolves the rest. */
export async function getThemeStickerBySlug(input: {
  themeId: string;
  slug: string;
}): Promise<NexThemeStickerRow | null> {
  const slug = String(input.slug).toLowerCase().trim();
  // Shape-check first so an obviously invalid slug never hits the DB.
  if (!/^[a-z0-9][a-z0-9_-]{0,60}$/.test(slug)) return null;
  const { data, error } = await nexSupabaseAdmin
    .from("nex_theme_sticker")
    .select(
      "id, theme_id, slug, image_url, label, sort_order, sticker_type, aspect_ratio, created_at, updated_at",
    )
    .eq("theme_id", input.themeId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error(
      `theme-sticker-service.getThemeStickerBySlug(${input.themeId}, ${slug}): ${error.message}`,
    );
    return null;
  }
  return (data as NexThemeStickerRow | null) ?? null;
}

async function nextSortOrder(themeId: string): Promise<number> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_theme_sticker")
    .select("sort_order")
    .eq("theme_id", themeId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (error) return 0;
  const max = data?.[0]?.sort_order;
  return typeof max === "number" ? max + 1 : 0;
}
