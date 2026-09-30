// src/lib/nex-native/terminology-service.ts
//
// Bridge Profession-D · sealed 2026-09-30 · server-side resolver for
// the terminology fallback chain:
//
//   business terminology_overrides (Phase 2.5 · deferred)
//     → profession.default_terminology (sparse)
//     → vertical.default_terminology (full)
//     → GLOBAL_DEFAULT_TERMINOLOGY (in code)
//
// One entry point · resolveTerminology(businessId) · returns the fully
// merged NexTerminology object. Callers pass its keys straight into
// layout files.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";
import {
  GLOBAL_DEFAULT_TERMINOLOGY,
  mergeTerminology,
  type NexTerminology,
} from "./terminology";

export interface NexVerticalRow {
  id: NexUuid;
  slug: string;
  label: string;
  sort_order: number;
  default_cover_layout_id: string | null;
  default_terminology: Record<string, unknown> | null;
}

export interface NexProfessionRow {
  id: NexUuid;
  vertical_id: NexUuid;
  slug: string;
  label: string;
  sort_order: number;
  default_cover_layout_id: string | null;
  default_terminology: Record<string, unknown> | null;
}

/**
 * Resolve the six terminology keys for a business. When the business
 * has no profession_id the resolver returns GLOBAL_DEFAULT_TERMINOLOGY
 * verbatim · that's the correct behaviour for accounts that haven't
 * gone through profession-aware onboarding yet.
 */
export async function resolveTerminology(
  businessId: NexUuid | null,
): Promise<NexTerminology> {
  if (!businessId) return GLOBAL_DEFAULT_TERMINOLOGY;

  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .select(
      `profession_id,
       profession:nex_profession!nex_business_profession_id_fkey(
         default_terminology,
         vertical:nex_vertical!nex_profession_vertical_id_fkey(default_terminology)
       )`,
    )
    .eq("id", businessId)
    .maybeSingle();
  if (error) {
    // Fail SOFT · a resolver problem should never break the cover.
    console.error(
      `terminology-service.resolveTerminology(${businessId}): ${error.message}`,
    );
    return GLOBAL_DEFAULT_TERMINOLOGY;
  }
  if (!data?.profession) return GLOBAL_DEFAULT_TERMINOLOGY;
  const prof = Array.isArray(data.profession) ? data.profession[0] : data.profession;
  if (!prof) return GLOBAL_DEFAULT_TERMINOLOGY;
  const vert = Array.isArray(prof.vertical) ? prof.vertical[0] : prof.vertical;
  const withVertical = mergeTerminology(
    GLOBAL_DEFAULT_TERMINOLOGY,
    (vert?.default_terminology ?? null) as Record<string, unknown> | null,
  );
  const withProfession = mergeTerminology(
    withVertical,
    (prof.default_terminology ?? null) as Record<string, unknown> | null,
  );
  return withProfession;
}

/** List every vertical (sorted). Used by the profession picker. */
export async function listVerticals(): Promise<NexVerticalRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vertical")
    .select(
      "id, slug, label, sort_order, default_cover_layout_id, default_terminology",
    )
    .order("sort_order", { ascending: true });
  if (error) {
    throw new Error(
      `terminology-service.listVerticals: ${error.message}`,
    );
  }
  return (data ?? []) as NexVerticalRow[];
}

/** List every profession (sorted, grouped by vertical). Used by the
 *  profession picker. */
export async function listProfessions(): Promise<NexProfessionRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_profession")
    .select(
      "id, vertical_id, slug, label, sort_order, default_cover_layout_id, default_terminology",
    )
    .order("sort_order", { ascending: true });
  if (error) {
    throw new Error(
      `terminology-service.listProfessions: ${error.message}`,
    );
  }
  return (data ?? []) as NexProfessionRow[];
}

/** Read a single profession row · used by /manage/profession to show
 *  the currently-selected row and by the picker submit action to
 *  extract suggested defaults. */
export async function getProfessionById(
  professionId: NexUuid | null,
): Promise<NexProfessionRow | null> {
  if (!professionId) return null;
  const { data, error } = await nexSupabaseAdmin
    .from("nex_profession")
    .select(
      "id, vertical_id, slug, label, sort_order, default_cover_layout_id, default_terminology",
    )
    .eq("id", professionId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `terminology-service.getProfessionById(${professionId}): ${error.message}`,
    );
  }
  return (data ?? null) as NexProfessionRow | null;
}

/**
 * CRITICAL invariant (founder-sealed 2026-09-30) · updating
 * profession_id must NOT modify any other column on nex_business.
 * This helper writes ONLY profession_id · never touches
 * cover_layout_id, info_pages, description, or anything else.
 */
export async function setBusinessProfession(
  businessId: NexUuid,
  professionId: NexUuid | null,
): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ profession_id: professionId })
    .eq("id", businessId);
  if (error) {
    throw new Error(
      `terminology-service.setBusinessProfession(${businessId}): ${error.message}`,
    );
  }
}
