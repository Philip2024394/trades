// src/lib/nex-native/chat-theme-service.ts
//
// Bridge 4 · chat theme catalogue.
// --------------------------------
// Reads + writes for nex_chat_theme (migration 048). Peer chat surface
// and the /settings/theme picker consume this via listActiveThemes()
// and getThemeById(); the admin builder at /nex-native/admin/theme/new
// consumes createTheme() / updateTheme().
//
// Doctrine · doctrine_theme_ownership_2026_09_27.md.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";

export type NexChatThemeTier = "gratis" | "bisnis";
export type NexChatThemeCategory = "standard" | "premium";

export interface NexChatThemeRow {
  id: string;
  name: string;
  tagline: string | null;
  accent_hex: string;
  /** Optional override for message bubble rims (both sides) · when
   *  null, bubbles use accent_hex. Sealed 2026-09-27 · migration 051. */
  bubble_rim_hex: string | null;
  /** Optional override for composer input rim · when null, composer
   *  uses accent_hex. Send button stays universal orange regardless. */
  composer_rim_hex: string | null;
  tier: NexChatThemeTier;
  category: NexChatThemeCategory;
  hero_image_url: string | null;
  is_active: boolean;
  sort_order: number;
  /** Per-theme environmental overlay settings · e.g. moon glow
   *  position, size, colour. When null, the theme's chat surface
   *  paints no environmental overlay. Sealed 2026-09-27 · migration
   *  056. */
  wallpaper_config: NexChatThemeWallpaperConfig | null;
  /** Bridge 34 · feed shape · migration 085. Determines the message
   *  row renderer used by PortraitBloomShell:
   *    'bubbles'         · classic bubble feed (default)
   *    'sky_cards'       · cloud-shaped panels · sealed as Theme 1
   *    'timeline_ribbon' · tab-slate panels · sealed as Theme 4
   *  When the DB row predates migration 085 or the value is missing
   *  in code, callers should treat it as 'bubbles'. */
  layout_style: NexChatThemeLayoutStyle;
  created_at: string;
  updated_at: string;
}

export type NexChatThemeLayoutStyle =
  | "bubbles"
  | "sky_cards"
  | "timeline_ribbon";

/** Structured shape of nex_chat_theme.wallpaper_config JSONB. Every
 *  key is optional so themes can opt into whichever overlays fit. */
export interface NexChatThemeWallpaperConfig {
  /** Soft breathing halo positioned over a moon (or other point
   *  source) in the wallpaper photograph. */
  moonGlow?: {
    /** CSS left · e.g. "72%" */
    x: string;
    /** CSS top · e.g. "calc(11% - 15px)" */
    y: string;
    /** Halo diameter in px */
    size: number;
    /** Core colour of the halo · e.g. "rgba(225, 238, 255, 0.6)" */
    color?: string;
  };
}

/** Resolved colour bundle for a theme · every element has a concrete
 *  hex. Callers use this to paint bubbles / composer / ripple without
 *  reaching for null-check boilerplate. */
export interface NexChatThemeColours {
  accent: string;
  bubbleRim: string;
  composerRim: string;
}

/** Given a theme row, resolve every element's colour with fallbacks
 *  to accent when overrides are null. Pure function · safe anywhere. */
export function resolveThemeColours(
  row: Pick<NexChatThemeRow, "accent_hex" | "bubble_rim_hex" | "composer_rim_hex">,
): NexChatThemeColours {
  return {
    accent: row.accent_hex,
    bubbleRim: row.bubble_rim_hex ?? row.accent_hex,
    composerRim: row.composer_rim_hex ?? row.accent_hex,
  };
}

export interface NexChatThemeInsert {
  id: string;
  name: string;
  tagline?: string | null;
  accent_hex: string;
  bubble_rim_hex?: string | null;
  composer_rim_hex?: string | null;
  tier?: NexChatThemeTier;
  category?: NexChatThemeCategory;
  hero_image_url?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

/** List every active theme, ordered for picker rendering. */
export async function listActiveThemes(): Promise<NexChatThemeRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_chat_theme")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) {
    throw new Error(
      `chat-theme-service.listActiveThemes: ${error.message}`,
    );
  }
  return (data as NexChatThemeRow[]) ?? [];
}

/** Get a single theme by id. Falls back to null on unknown / inactive. */
export async function getThemeById(
  id: string,
): Promise<NexChatThemeRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_chat_theme")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`chat-theme-service.getThemeById: ${error.message}`);
  }
  return (data as NexChatThemeRow | null) ?? null;
}

/** Resolve the accent hex for a chat_theme value with a safe fallback
 *  when the id is unknown or the theme is inactive. Never throws. */
export async function accentForTheme(
  themeId: string | null | undefined,
): Promise<string> {
  const DEFAULT = "#00AFFF";
  if (!themeId) return DEFAULT;
  try {
    const row = await getThemeById(themeId);
    if (!row || !row.is_active) return DEFAULT;
    return row.accent_hex;
  } catch {
    return DEFAULT;
  }
}

/** Admin-only · insert a new theme row. Slug must be unique. */
export async function createTheme(
  input: NexChatThemeInsert,
): Promise<NexChatThemeRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_chat_theme")
    .insert({
      id: input.id,
      name: input.name,
      tagline: input.tagline ?? null,
      accent_hex: input.accent_hex,
      bubble_rim_hex: input.bubble_rim_hex ?? null,
      composer_rim_hex: input.composer_rim_hex ?? null,
      tier: input.tier ?? "gratis",
      category: input.category ?? "standard",
      hero_image_url: input.hero_image_url ?? null,
      is_active: input.is_active ?? true,
      sort_order: input.sort_order ?? 100,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `chat-theme-service.createTheme: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexChatThemeRow;
}

/** Admin-only · patch fields on an existing theme by id. */
export async function updateTheme(
  id: string,
  patch: Partial<Omit<NexChatThemeInsert, "id">>,
): Promise<NexChatThemeRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_chat_theme")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `chat-theme-service.updateTheme: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexChatThemeRow;
}

/** Upload a hero image for a theme to Supabase Storage
 *  (bucket `nex-chat-theme-hero`, public read · migration 049).
 *  Returns the public URL to save into `nex_chat_theme.hero_image_url`.
 *  Throws on failure · caller decides how to surface it. */
export async function uploadThemeHero(
  themeSlug: string,
  file: File,
): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const safeExt = ["png", "jpg", "jpeg", "webp", "avif"].includes(ext)
    ? ext
    : "png";
  const objectPath = `${themeSlug}-${Date.now()}.${safeExt}`;
  const bucket = nexSupabaseAdmin.storage.from("nex-chat-theme-hero");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await bucket.upload(objectPath, bytes, {
    contentType: file.type || `image/${safeExt}`,
    upsert: true,
  });
  if (error) {
    throw new Error(
      `chat-theme-service.uploadThemeHero: ${error.message}`,
    );
  }
  const { data } = bucket.getPublicUrl(objectPath);
  return data.publicUrl;
}

/** Group themes by category for picker rendering.
 *  Guarantees at least an empty array on each category. */
export function groupByCategory(themes: NexChatThemeRow[]): {
  standard: NexChatThemeRow[];
  premium: NexChatThemeRow[];
} {
  const standard: NexChatThemeRow[] = [];
  const premium: NexChatThemeRow[] = [];
  for (const t of themes) {
    if (t.category === "premium") premium.push(t);
    else standard.push(t);
  }
  return { standard, premium };
}
