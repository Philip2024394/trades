// NEX Business Context · database adapter (Wave 1 · 2026-09-23)
//
// Thin Supabase wrapper for the AppBlueprint persistence columns added
// to os_business_listings in migration
// 20260923170000_os_business_listings_blueprint.sql.
//
// Server-only · never imported by client bundles.
//
// Doctrine notes (per project_nex_conversation_first_product_direction_permanent_2026_09_23
// + project_nex_chat_complete_ecosystem_build_wave_master_directive_2026_09_23):
//   · One business brain, many surfaces: this module is the ONLY place
//     that reads/writes AppBlueprint persistence columns. Every other
//     consumer goes through the registry.
//   · No mock production data: writes fail loudly rather than silently
//     succeed if the row is missing.
//   · Composition-v2 never touches this module — engine stays generic.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AppBlueprint } from "@/lib/app-builder/blueprint-schema";
import type { BusinessRecord } from "./types";
import {
  deserialiseBlueprint,
  nextBlueprintRevision,
  serialiseBlueprint,
} from "./blueprint-serialisation";

/** Shape of the columns this module reads from os_business_listings. */
interface BusinessBlueprintRow {
  id: string;
  slug: string;
  blueprint_id: string | null;
  blueprint_snapshot: unknown;
  blueprint_revision: number;
  blueprint_published_at: string | null;
  published_by_party_id: string | null;
  owning_entity_id: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT_COLUMNS =
  "id, slug, blueprint_id, blueprint_snapshot, blueprint_revision, " +
  "blueprint_published_at, published_by_party_id, owning_entity_id, " +
  "created_at, updated_at";

/**
 * Read a business's currently-published AppBlueprint from the OS layer.
 * Returns null if no listing exists for the slug OR if the listing has
 * never had a blueprint published.
 */
export async function loadBlueprintBySlug(
  slug: string
): Promise<BusinessRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("os_business_listings")
    .select(SELECT_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(
      `loadBlueprintBySlug("${slug}"): ${error.message ?? "unknown supabase error"}`
    );
  }
  if (!data) return null;
  const row = data as BusinessBlueprintRow;
  if (!row.blueprint_snapshot) return null;

  return {
    slug: row.slug,
    blueprint: deserialiseBlueprint(row.blueprint_snapshot),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Read the currently-published AppBlueprint by owning entity id. Used
 * when the caller has a session with a resolved business entity but not
 * the slug (owner surfaces).
 */
export async function loadBlueprintByOwningEntityId(
  entityId: string
): Promise<BusinessRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("os_business_listings")
    .select(SELECT_COLUMNS)
    .eq("owning_entity_id", entityId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `loadBlueprintByOwningEntityId("${entityId}"): ${error.message ?? "unknown"}`
    );
  }
  if (!data) return null;
  const row = data as BusinessBlueprintRow;
  if (!row.blueprint_snapshot) return null;

  return {
    slug: row.slug,
    blueprint: deserialiseBlueprint(row.blueprint_snapshot),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Result envelope for `publishBlueprintForSlug`. */
export type PublishOutcome =
  | {
      ok: true;
      record: BusinessRecord;
      dbRevision: number;
      publishedAt: string;
    }
  | { ok: false; error: string; status: 404 | 409 | 500 };

/**
 * Persist a new AppBlueprint snapshot on the listing identified by slug.
 * Bumps the DB revision counter monotonically. Records the publishing
 * party (when supplied) on `published_by_party_id`.
 *
 * Does NOT create a new listing row — publication requires an existing
 * os_business_listings row (typically created via the merchant claim
 * flow). This is intentional: we do not fabricate business identities.
 */
export async function publishBlueprintForSlug(
  slug: string,
  blueprint: AppBlueprint,
  opts: { publishedByPartyId?: string | null } = {}
): Promise<PublishOutcome> {
  const existing = await supabaseAdmin
    .from("os_business_listings")
    .select("id, blueprint_revision")
    .eq("slug", slug)
    .maybeSingle();

  if (existing.error) {
    return {
      ok: false,
      status: 500,
      error: `publishBlueprintForSlug lookup: ${existing.error.message ?? "unknown"}`,
    };
  }
  if (!existing.data) {
    return {
      ok: false,
      status: 404,
      error: `publishBlueprintForSlug: no os_business_listings row for slug "${slug}"`,
    };
  }

  const nextRevision = nextBlueprintRevision(existing.data.blueprint_revision ?? 0);
  const nowIso = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("os_business_listings")
    .update({
      blueprint_id: blueprint.id,
      blueprint_snapshot: serialiseBlueprint(blueprint),
      blueprint_revision: nextRevision,
      blueprint_published_at: nowIso,
      published_by_party_id: opts.publishedByPartyId ?? null,
      updated_at: nowIso,
    })
    .eq("slug", slug)
    .select(SELECT_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      status: 500,
      error: `publishBlueprintForSlug update: ${error?.message ?? "no row returned"}`,
    };
  }

  const row = data as BusinessBlueprintRow;
  return {
    ok: true,
    dbRevision: row.blueprint_revision,
    publishedAt: row.blueprint_published_at ?? nowIso,
    record: {
      slug: row.slug,
      blueprint,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  };
}

/**
 * List every listing that has ever had a blueprint published. Used by
 * boot-time cache warmers and diagnostic tools. Ordered by most-recent
 * publish first.
 */
export async function listPublishedBlueprints(
  limit = 500
): Promise<BusinessRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("os_business_listings")
    .select(SELECT_COLUMNS)
    .not("blueprint_snapshot", "is", null)
    .order("blueprint_published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new Error(
      `listPublishedBlueprints: ${error.message ?? "unknown supabase error"}`
    );
  }
  const rows = (data ?? []) as BusinessBlueprintRow[];
  return rows.map((row) => ({
    slug: row.slug,
    blueprint: deserialiseBlueprint(row.blueprint_snapshot),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Resolve the owning entity id (if any) for a business identified by
 * slug. Returns null when the row is missing OR has not yet been linked
 * to an entity. Used by permissions / entitlement code paths.
 */
export async function resolveOwningEntityIdForSlug(
  slug: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("os_business_listings")
    .select("owning_entity_id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(
      `resolveOwningEntityIdForSlug("${slug}"): ${error.message ?? "unknown"}`
    );
  }
  return (data?.owning_entity_id as string | null) ?? null;
}

/**
 * Read the `tier` column for a business listing. Kept here (not in
 * permissions.ts) so permissions stays free of `supabaseAdmin` imports
 * and remains unit-testable.
 */
export async function readListingTier(slug: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("os_business_listings")
    .select("tier")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(
      `readListingTier("${slug}"): ${error.message ?? "unknown"}`
    );
  }
  return (data?.tier as string | null) ?? null;
}
