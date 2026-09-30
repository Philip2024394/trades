// src/lib/nex-native/product-section-service.ts
//
// Category Tabs · sealed 2026-09-30.
// -----------------------------------------------------------------------------
// CRUD helpers for nex_product_section (Migration 107). Mirrors the shape of
// menu-service.ts's section functions so the seller UX can be built with the
// same primitives on both sides.
//
// Doctrine-enforced constraints (form + service layer only · DB stays loose
// per founder ruling so legacy data + tooling stays portable):
//
//   · Hard cap of 3 sections per business (assertMaxThreeSections)
//   · One-word name rule /^[A-Za-z0-9\-]{1,20}$/ (assertOneWordName)
//   · Delete of a non-empty section requires reassignment via reassignAndDelete
//     (the raw deleteSection is still exported for the empty-section case)

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid, NexTimestamp } from "./types";

/* ------------------------------------------------------------------
 * Public constraints · exported so the UI can share the same values.
 * ------------------------------------------------------------------ */

export const NEX_PRODUCT_SECTION_MAX = 3;
export const NEX_PRODUCT_SECTION_NAME_PATTERN = /^[A-Za-z0-9\-]{1,20}$/;

export const NEX_PRODUCT_SECTION_ERRORS = {
  MULTI_WORD: "One word please — try Babyclothes or Kids-Wear.",
  TOO_LONG: "Category name too long (max 20 characters).",
  EMPTY: "Give the category a name.",
  MAX_REACHED: `Only ${NEX_PRODUCT_SECTION_MAX} categories per shop. Rename or delete an existing one.`,
  NOT_EMPTY_NEEDS_REASSIGN:
    "That category still has products. Choose where to move them before deleting.",
  DUPLICATE: "You already have a category with that name.",
} as const;

export type NexProductSectionErrorCode =
  keyof typeof NEX_PRODUCT_SECTION_ERRORS;

export class NexProductSectionError extends Error {
  code: NexProductSectionErrorCode;
  constructor(code: NexProductSectionErrorCode) {
    super(NEX_PRODUCT_SECTION_ERRORS[code]);
    this.code = code;
  }
}

/* ------------------------------------------------------------------
 * Row types
 * ------------------------------------------------------------------ */

export interface NexProductSectionRow {
  id: NexUuid;
  business_id: NexUuid;
  name: string;
  sort_order: number;
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
}

/* ------------------------------------------------------------------
 * Validators · pure functions the UI can also import to pre-check
 * ------------------------------------------------------------------ */

export function assertOneWordName(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) throw new NexProductSectionError("EMPTY");
  if (trimmed.length > 20) throw new NexProductSectionError("TOO_LONG");
  if (!NEX_PRODUCT_SECTION_NAME_PATTERN.test(trimmed)) {
    throw new NexProductSectionError("MULTI_WORD");
  }
  return trimmed;
}

/* ------------------------------------------------------------------
 * Section reads + writes
 * ------------------------------------------------------------------ */

export async function listSectionsByBusiness(
  businessId: NexUuid,
): Promise<NexProductSectionRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product_section")
    .select("*")
    .eq("business_id", businessId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(
      `product-section-service.listSectionsByBusiness: ${error.message}`,
    );
  }
  return (data as NexProductSectionRow[]) ?? [];
}

export async function countSectionsByBusiness(
  businessId: NexUuid,
): Promise<number> {
  const { count, error } = await nexSupabaseAdmin
    .from("nex_product_section")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);
  if (error) {
    throw new Error(
      `product-section-service.countSectionsByBusiness: ${error.message}`,
    );
  }
  return count ?? 0;
}

export async function createSection(input: {
  business_id: NexUuid;
  name: string;
  sort_order?: number;
}): Promise<NexProductSectionRow> {
  const name = assertOneWordName(input.name);

  const current = await listSectionsByBusiness(input.business_id);
  if (current.length >= NEX_PRODUCT_SECTION_MAX) {
    throw new NexProductSectionError("MAX_REACHED");
  }
  if (current.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    throw new NexProductSectionError("DUPLICATE");
  }

  const nextSortOrder =
    typeof input.sort_order === "number"
      ? input.sort_order
      : current.reduce((m, s) => Math.max(m, s.sort_order), -1) + 1;

  const { data, error } = await nexSupabaseAdmin
    .from("nex_product_section")
    .insert({
      business_id: input.business_id,
      name,
      sort_order: nextSortOrder,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-section-service.createSection: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexProductSectionRow;
}

export async function updateSection(
  sectionId: NexUuid,
  patch: { name?: string; sort_order?: number },
): Promise<NexProductSectionRow> {
  const update: Record<string, string | number> = {};
  if (patch.name !== undefined) {
    update.name = assertOneWordName(patch.name);
  }
  if (patch.sort_order !== undefined) {
    update.sort_order = patch.sort_order;
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product_section")
    .update(update)
    .eq("id", sectionId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `product-section-service.updateSection: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexProductSectionRow;
}

/**
 * Delete a section that has NO products assigned. Callers must check
 * assigned_count first (or use reassignAndDelete for the non-empty path).
 * The FK on nex_product.section_id is ON DELETE SET NULL, so even if this
 * runs against a non-empty section the products won't be lost — but the
 * seller-facing UX is nicer when we surface the reassignment step.
 */
export async function deleteSection(sectionId: NexUuid): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_product_section")
    .delete()
    .eq("id", sectionId);
  if (error) {
    throw new Error(
      `product-section-service.deleteSection: ${error.message}`,
    );
  }
}

/**
 * Move every product from `fromSectionId` to `toSectionId` (or NULL for
 * "uncategorised") and then delete the source section. Wrapped in a
 * pseudo-transaction (best-effort: reassign first, then delete).
 */
export async function reassignAndDelete(
  fromSectionId: NexUuid,
  toSectionId: NexUuid | null,
): Promise<{ moved: number }> {
  const { count: moved, error: e1 } = await nexSupabaseAdmin
    .from("nex_product")
    .update({ section_id: toSectionId }, { count: "exact" })
    .eq("section_id", fromSectionId);
  if (e1) {
    throw new Error(
      `product-section-service.reassignAndDelete (move): ${e1.message}`,
    );
  }
  await deleteSection(fromSectionId);
  return { moved: moved ?? 0 };
}

/* ------------------------------------------------------------------
 * Product ↔ section assignment
 * ------------------------------------------------------------------ */

export async function assignProductToSection(
  productId: NexUuid,
  sectionId: NexUuid | null,
): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_product")
    .update({ section_id: sectionId })
    .eq("id", productId);
  if (error) {
    throw new Error(
      `product-section-service.assignProductToSection: ${error.message}`,
    );
  }
}

/**
 * Convenience for the inline autocomplete flow: given a raw name, either
 * find an existing section with that (case-insensitive) name or create a
 * new one. Enforces the hard cap of 3.
 */
export async function ensureSectionByName(
  businessId: NexUuid,
  rawName: string,
): Promise<NexProductSectionRow> {
  const name = assertOneWordName(rawName);
  const existing = await listSectionsByBusiness(businessId);
  const hit = existing.find(
    (s) => s.name.toLowerCase() === name.toLowerCase(),
  );
  if (hit) return hit;
  return createSection({ business_id: businessId, name });
}

/**
 * How many products live under each section for a given business. Used by
 * /manage/categories to show "3 products" chips and disable delete-inline
 * for non-empty sections.
 */
export async function countProductsPerSection(
  businessId: NexUuid,
): Promise<Map<NexUuid, number>> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product")
    .select("section_id")
    .eq("business_id", businessId)
    .not("section_id", "is", null);
  if (error) {
    throw new Error(
      `product-section-service.countProductsPerSection: ${error.message}`,
    );
  }
  const counts = new Map<NexUuid, number>();
  for (const row of (data as { section_id: NexUuid | null }[]) ?? []) {
    if (!row.section_id) continue;
    counts.set(row.section_id, (counts.get(row.section_id) ?? 0) + 1);
  }
  return counts;
}
