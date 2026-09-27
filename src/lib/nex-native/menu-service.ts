// src/lib/nex-native/menu-service.ts
//
// Bridge 15a · Restaurant menu service.
// -------------------------------------
// CRUD + list functions for nex_menu_section + nex_menu_item.
// Restaurants and cafes are the first vertical to plug into the
// Bridge 14 category foundation · menu items are a distinct
// primitive from products so restaurants don't inherit fields
// (SKU · MOQ · dispatch time) that don't apply.
//
// Doctrine kept:
//   · Chat is still the order path · this service ships browsing +
//     display · Bridge 15c will add "Order this dish" as a peer-
//     message attachment_type='menu_item'
//   · Sellers control everything · no auto-generation
//   · Availability toggle is separate from status · sold-out today
//     is not the same as archived from the menu
//
// Dietary + allergen values are stored as text[] and normalised on
// write to lowercase-hyphen (vegan, gluten-free, contains-nuts) so
// menu display can render consistent chip labels without extra
// mapping.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid, NexTimestamp } from "./types";

/* ------------------------------------------------------------------
 * Canonical vocabularies · the seller UI presents these as toggles
 * but the DB stays flexible for future additions.
 * ------------------------------------------------------------------ */

export const NEX_MENU_DIETARY_TAGS = [
  "vegan",
  "vegetarian",
  "pescatarian",
  "gluten-free",
  "dairy-free",
  "halal",
  "kosher",
  "keto",
  "low-carb",
  "sugar-free",
  "organic",
  "spicy",
] as const;

export const NEX_MENU_ALLERGENS = [
  "nuts",
  "peanuts",
  "dairy",
  "eggs",
  "shellfish",
  "fish",
  "soy",
  "wheat",
  "gluten",
  "sesame",
  "mustard",
  "sulphites",
] as const;

/* ------------------------------------------------------------------
 * Row types
 * ------------------------------------------------------------------ */

export interface NexMenuSectionRow {
  id: NexUuid;
  business_id: NexUuid;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
}

export type NexMenuItemStatus = "draft" | "live" | "archived";

export interface NexMenuItemRow {
  id: NexUuid;
  business_id: NexUuid;
  section_id: NexUuid | null;
  name: string;
  description: string | null;
  price_pence: number;
  currency: string;
  image_url: string | null;
  dietary_tags: string[];
  allergens: string[];
  spice_level: number;
  is_available: boolean;
  is_featured: boolean;
  preparation_time: string | null;
  portion_note: string | null;
  sort_order: number;
  status: NexMenuItemStatus;
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
}

export interface NexMenuSectionInsert {
  business_id: NexUuid;
  name: string;
  description?: string | null;
  sort_order?: number;
}

export interface NexMenuItemInsert {
  business_id: NexUuid;
  section_id?: NexUuid | null;
  name: string;
  description?: string | null;
  price_pence: number;
  currency?: string;
  image_url?: string | null;
  dietary_tags?: string[];
  allergens?: string[];
  spice_level?: number;
  is_available?: boolean;
  is_featured?: boolean;
  preparation_time?: string | null;
  portion_note?: string | null;
  sort_order?: number;
  status?: NexMenuItemStatus;
}

/* ------------------------------------------------------------------
 * Section reads + writes
 * ------------------------------------------------------------------ */

export async function listSectionsByBusiness(
  businessId: NexUuid,
): Promise<NexMenuSectionRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_menu_section")
    .select("*")
    .eq("business_id", businessId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(`menu-service.listSectionsByBusiness: ${error.message}`);
  }
  return (data as NexMenuSectionRow[]) ?? [];
}

export async function createSection(
  input: NexMenuSectionInsert,
): Promise<NexMenuSectionRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_menu_section")
    .insert({
      business_id: input.business_id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      sort_order: input.sort_order ?? 0,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `menu-service.createSection: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexMenuSectionRow;
}

export async function updateSection(
  sectionId: NexUuid,
  patch: {
    name?: string;
    description?: string | null;
    sort_order?: number;
  },
): Promise<NexMenuSectionRow> {
  const update: Record<string, string | number | null> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.description !== undefined) {
    const v = (patch.description ?? "").trim();
    update.description = v.length > 0 ? v : null;
  }
  if (patch.sort_order !== undefined) update.sort_order = patch.sort_order;
  const { data, error } = await nexSupabaseAdmin
    .from("nex_menu_section")
    .update(update)
    .eq("id", sectionId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `menu-service.updateSection: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexMenuSectionRow;
}

export async function deleteSection(sectionId: NexUuid): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_menu_section")
    .delete()
    .eq("id", sectionId);
  if (error) {
    throw new Error(`menu-service.deleteSection: ${error.message}`);
  }
}

/* ------------------------------------------------------------------
 * Menu item reads + writes
 * ------------------------------------------------------------------ */

export async function listMenuItemsByBusiness(
  businessId: NexUuid,
  opts: { status?: NexMenuItemStatus } = {},
): Promise<NexMenuItemRow[]> {
  let q = nexSupabaseAdmin
    .from("nex_menu_item")
    .select("*")
    .eq("business_id", businessId);
  if (opts.status) q = q.eq("status", opts.status);
  const { data, error } = await q
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(
      `menu-service.listMenuItemsByBusiness: ${error.message}`,
    );
  }
  return (data as NexMenuItemRow[]) ?? [];
}

export async function listMenuItemsBySection(
  sectionId: NexUuid,
  opts: { status?: NexMenuItemStatus } = {},
): Promise<NexMenuItemRow[]> {
  let q = nexSupabaseAdmin
    .from("nex_menu_item")
    .select("*")
    .eq("section_id", sectionId);
  if (opts.status) q = q.eq("status", opts.status);
  const { data, error } = await q
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(
      `menu-service.listMenuItemsBySection: ${error.message}`,
    );
  }
  return (data as NexMenuItemRow[]) ?? [];
}

export async function getMenuItemById(
  id: NexUuid,
): Promise<NexMenuItemRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_menu_item")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`menu-service.getMenuItemById: ${error.message}`);
  }
  return (data as NexMenuItemRow) ?? null;
}

export async function createMenuItem(
  input: NexMenuItemInsert,
): Promise<NexMenuItemRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_menu_item")
    .insert({
      business_id: input.business_id,
      section_id: input.section_id ?? null,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      price_pence: input.price_pence,
      currency: input.currency ?? "IDR",
      image_url: input.image_url?.trim() || null,
      dietary_tags: normaliseTagArray(input.dietary_tags),
      allergens: normaliseTagArray(input.allergens),
      spice_level: clampSpice(input.spice_level),
      is_available: input.is_available ?? true,
      is_featured: input.is_featured ?? false,
      preparation_time: input.preparation_time?.trim() || null,
      portion_note: input.portion_note?.trim() || null,
      sort_order: input.sort_order ?? 0,
      status: input.status ?? "live",
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `menu-service.createMenuItem: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexMenuItemRow;
}

export async function updateMenuItem(
  itemId: NexUuid,
  patch: Partial<Omit<NexMenuItemInsert, "business_id">>,
): Promise<NexMenuItemRow> {
  const update: Record<string, unknown> = {};
  if (patch.section_id !== undefined) update.section_id = patch.section_id;
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.description !== undefined) {
    const v = (patch.description ?? "").trim();
    update.description = v.length > 0 ? v : null;
  }
  if (patch.price_pence !== undefined) update.price_pence = patch.price_pence;
  if (patch.currency !== undefined) update.currency = patch.currency;
  if (patch.image_url !== undefined) {
    const v = (patch.image_url ?? "").trim();
    update.image_url = v.length > 0 ? v : null;
  }
  if (patch.dietary_tags !== undefined) {
    update.dietary_tags = normaliseTagArray(patch.dietary_tags);
  }
  if (patch.allergens !== undefined) {
    update.allergens = normaliseTagArray(patch.allergens);
  }
  if (patch.spice_level !== undefined) {
    update.spice_level = clampSpice(patch.spice_level);
  }
  if (patch.is_available !== undefined) update.is_available = patch.is_available;
  if (patch.is_featured !== undefined) update.is_featured = patch.is_featured;
  if (patch.preparation_time !== undefined) {
    const v = (patch.preparation_time ?? "").trim();
    update.preparation_time = v.length > 0 ? v : null;
  }
  if (patch.portion_note !== undefined) {
    const v = (patch.portion_note ?? "").trim();
    update.portion_note = v.length > 0 ? v : null;
  }
  if (patch.sort_order !== undefined) update.sort_order = patch.sort_order;
  if (patch.status !== undefined) update.status = patch.status;

  const { data, error } = await nexSupabaseAdmin
    .from("nex_menu_item")
    .update(update)
    .eq("id", itemId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `menu-service.updateMenuItem: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexMenuItemRow;
}

export async function deleteMenuItem(itemId: NexUuid): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_menu_item")
    .delete()
    .eq("id", itemId);
  if (error) {
    throw new Error(`menu-service.deleteMenuItem: ${error.message}`);
  }
}

/* ------------------------------------------------------------------
 * Shape a business's menu into a flat "sections with items" bundle
 * the visitor page can render in one map. Uncategorised items land
 * in a synthetic "Menu" section at the end.
 * ------------------------------------------------------------------ */

export interface MenuBundle {
  sections: Array<{
    section: NexMenuSectionRow | null;
    items: NexMenuItemRow[];
  }>;
  totalItems: number;
}

export async function getMenuBundleForBusiness(
  businessId: NexUuid,
  opts: { onlyLive?: boolean } = { onlyLive: true },
): Promise<MenuBundle> {
  const [sections, items] = await Promise.all([
    listSectionsByBusiness(businessId),
    listMenuItemsByBusiness(businessId, {
      status: opts.onlyLive ? "live" : undefined,
    }),
  ]);
  const bySection = new Map<string, NexMenuItemRow[]>();
  const uncategorised: NexMenuItemRow[] = [];
  for (const it of items) {
    if (it.section_id) {
      const arr = bySection.get(it.section_id) ?? [];
      arr.push(it);
      bySection.set(it.section_id, arr);
    } else {
      uncategorised.push(it);
    }
  }
  const bundle: MenuBundle["sections"] = [];
  for (const s of sections) {
    const arr = bySection.get(s.id) ?? [];
    if (arr.length > 0) bundle.push({ section: s, items: arr });
  }
  if (uncategorised.length > 0) {
    bundle.push({ section: null, items: uncategorised });
  }
  return { sections: bundle, totalItems: items.length };
}

/* ------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------ */

function normaliseTagArray(input: string[] | undefined): string[] {
  if (!input || input.length === 0) return [];
  const cleaned = input
    .map((s) => (typeof s === "string" ? s.trim().toLowerCase() : ""))
    .map((s) => s.replace(/\s+/g, "-"))
    .filter((s) => s.length > 0 && s.length <= 40);
  return Array.from(new Set(cleaned));
}

function clampSpice(v: number | undefined): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(3, Math.round(v)));
}
