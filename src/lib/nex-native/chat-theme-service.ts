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
  tier: NexChatThemeTier;
  category: NexChatThemeCategory;
  hero_image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface NexChatThemeInsert {
  id: string;
  name: string;
  tagline?: string | null;
  accent_hex: string;
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
