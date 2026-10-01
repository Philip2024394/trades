// src/lib/nex-native/color-palette-service.ts
//
// NEX colour palette service · sealed 2026-10-01.
// -----------------------------------------------------------------------------
// Reads the NEX-managed master palette (Migration 123) that sellers
// pick from when adding colour variants to a product. Public-read RLS
// means any session (authenticated or anonymous) can list it.

import { nexSupabaseAdmin } from "./supabase-admin";

export interface NexColorRow {
  id: string;
  slug: string;
  label: string;
  hex: string;
  sort_order: number;
}

/** List every active colour in sort order. The palette is small (26
 *  rows at Phase 1 launch), so there's no pagination or filtering —
 *  callers just render the full set. */
export async function listColorPalette(): Promise<NexColorRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_color_palette")
    .select("id, slug, label, hex, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    throw new Error(`color-palette-service.listColorPalette: ${error.message}`);
  }
  return (data ?? []) as NexColorRow[];
}

/** Resolve a set of slugs against the live palette. Returns only the
 *  rows that match, in the palette's canonical sort order (so the
 *  seller's chosen set always renders in a stable sequence regardless
 *  of pick order). Unknown slugs are silently dropped — the server
 *  action re-validates on submit so stray IDs can't leak through. */
export async function resolveColorSlugs(
  slugs: string[],
): Promise<NexColorRow[]> {
  if (!slugs.length) return [];
  const palette = await listColorPalette();
  const set = new Set(slugs.map((s) => s.toLowerCase()));
  return palette.filter((c) => set.has(c.slug));
}
