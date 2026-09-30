// src/lib/nex-native/theme-emoji-service.ts
//
// Bridge ThemeEmoji-B · sealed 2026-10-01 · server-side CRUD for
// nex_theme_emoji (Migration 116). Backs the CoverComposer emoji
// picker · when a theme has one or more rows, the picker renders
// THAT theme's set instead of the default 40-emoji hardcoded array.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";

export const NEX_THEME_EMOJI_MAX_BYTES = 512 * 1024; // 512 KB
export const NEX_THEME_EMOJI_ALLOWED_MIMES: Record<string, string> = {
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export interface NexThemeEmojiRow {
  id: string;
  theme_id: string;
  slug: string;
  image_url: string;
  label: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** List every emoji for a theme (sorted). Returns empty array when
 *  the theme has no custom set · caller falls back to the default. */
export async function listThemeEmojis(
  themeId: string,
): Promise<NexThemeEmojiRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_theme_emoji")
    .select(
      "id, theme_id, slug, image_url, label, sort_order, created_at, updated_at",
    )
    .eq("theme_id", themeId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    // Fail soft · never break the composer over a picker fetch.
    console.error(
      `theme-emoji-service.listThemeEmojis(${themeId}): ${error.message}`,
    );
    return [];
  }
  return (data ?? []) as NexThemeEmojiRow[];
}

/** Upload a raw file to the nex-theme-emoji bucket then insert a
 *  matching row. Returns the persisted row so admin UI can render it
 *  immediately without a re-fetch. */
export async function uploadThemeEmoji(input: {
  themeId: string;
  slug: string;
  file: File;
  label?: string;
  sortOrder?: number;
}): Promise<NexThemeEmojiRow> {
  const { themeId, file } = input;
  if (file.size > NEX_THEME_EMOJI_MAX_BYTES) {
    throw new Error(
      `Emoji exceeds ${NEX_THEME_EMOJI_MAX_BYTES / 1024}KB cap`,
    );
  }
  const mime = (file.type || "").toLowerCase();
  const ext = NEX_THEME_EMOJI_ALLOWED_MIMES[mime];
  if (!ext) {
    throw new Error(
      `Emoji must be png / webp / gif · got ${file.type || "unknown"}`,
    );
  }
  const slug = String(input.slug).toLowerCase().trim();
  if (!/^[a-z0-9][a-z0-9_-]{0,60}$/.test(slug)) {
    throw new Error(
      "Emoji slug must be 1-61 chars · alphanumeric + dash + underscore",
    );
  }
  const objectPath = `${themeId}/${slug}.${ext}`;
  const bucket = nexSupabaseAdmin.storage.from("nex-theme-emoji");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await bucket.upload(objectPath, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (upErr) {
    throw new Error(
      `theme-emoji-service.uploadThemeEmoji: ${upErr.message}`,
    );
  }
  const { data: pub } = bucket.getPublicUrl(objectPath);
  const label = String(input.label ?? "").trim().slice(0, 40);
  const sortOrder =
    typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)
      ? Math.max(0, Math.min(9999, Math.floor(input.sortOrder)))
      : await nextSortOrder(themeId);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_theme_emoji")
    .upsert(
      {
        theme_id: themeId,
        slug,
        image_url: pub.publicUrl,
        label,
        sort_order: sortOrder,
      },
      { onConflict: "theme_id,slug" },
    )
    .select(
      "id, theme_id, slug, image_url, label, sort_order, created_at, updated_at",
    )
    .single();
  if (error || !data) {
    throw new Error(
      `theme-emoji-service.uploadThemeEmoji insert: ${error?.message ?? "no data"}`,
    );
  }
  return data as NexThemeEmojiRow;
}

async function nextSortOrder(themeId: string): Promise<number> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_theme_emoji")
    .select("sort_order")
    .eq("theme_id", themeId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (error) return 0;
  const max = data?.[0]?.sort_order;
  return typeof max === "number" ? max + 1 : 0;
}
