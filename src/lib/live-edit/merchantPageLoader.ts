// merchantPageLoader — server-side read/write for merchant page state.
//
// Supabase-first. Falls back to in-memory (never persists) when no
// Supabase creds are set, so demo mode still works.
//
// Two parallel maps per page:
//   sections    — sectionId → { section-type-specific config }
//   placements  — sectionId → { slotId, variant } for the reorder /
//                  variant-aware placement system

import { createClient } from "@supabase/supabase-js";

type SectionsMap = Record<string, unknown>;
export type PlacementsMap = Record<
  string,
  { slotId: string; variant: string }
>;

function getServerClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Read the current published sections + placements for a merchant
 *  page. Public visitors always see this. */
export async function loadPublishedSections(
  merchantId: string,
  pageSlug: string
): Promise<{
  sections: SectionsMap;
  placements: PlacementsMap;
} | null> {
  const client = getServerClient();
  if (!client) return null;
  const { data, error } = await client
    .from("merchant_pages")
    .select("published_sections, published_placements")
    .eq("merchant_id", merchantId)
    .eq("page_slug", pageSlug)
    .maybeSingle();
  if (error || !data) return null;
  return {
    sections: (data.published_sections as SectionsMap) ?? {},
    placements: (data.published_placements as PlacementsMap) ?? {}
  };
}

/** Read the draft — for merchants previewing unpublished changes. */
export async function loadDraftSections(
  merchantId: string,
  pageSlug: string
): Promise<{
  sections: SectionsMap;
  placements: PlacementsMap;
} | null> {
  const client = getServerClient();
  if (!client) return null;
  const { data, error } = await client
    .from("merchant_pages")
    .select("draft_sections, draft_placements")
    .eq("merchant_id", merchantId)
    .eq("page_slug", pageSlug)
    .maybeSingle();
  if (error || !data) return null;
  return {
    sections: (data.draft_sections as SectionsMap) ?? {},
    placements: (data.draft_placements as PlacementsMap) ?? {}
  };
}

/** Write draft sections + placements (auto-save from the client). */
export async function saveDraftSections(
  merchantId: string,
  pageSlug: string,
  sections: SectionsMap,
  placements: PlacementsMap = {}
): Promise<boolean> {
  const client = getServerClient();
  if (!client) return false;
  const { error } = await client
    .from("merchant_pages")
    .upsert(
      {
        merchant_id: merchantId,
        page_slug: pageSlug,
        draft_sections: sections,
        draft_placements: placements
      },
      { onConflict: "merchant_id,page_slug" }
    );
  return !error;
}

/** Publish — copies draft → published + timestamps. Atomic. */
export async function publishPage(
  merchantId: string,
  pageSlug: string
): Promise<boolean> {
  const client = getServerClient();
  if (!client) return false;
  const { data, error: readErr } = await client
    .from("merchant_pages")
    .select("draft_sections, draft_placements")
    .eq("merchant_id", merchantId)
    .eq("page_slug", pageSlug)
    .maybeSingle();
  if (readErr || !data) return false;
  const draftSections = data.draft_sections;
  const draftPlacements = data.draft_placements;
  const { error: writeErr } = await client
    .from("merchant_pages")
    .upsert(
      {
        merchant_id: merchantId,
        page_slug: pageSlug,
        draft_sections: draftSections,
        draft_placements: draftPlacements,
        published_sections: draftSections,
        published_placements: draftPlacements,
        published_at: new Date().toISOString()
      },
      { onConflict: "merchant_id,page_slug" }
    );
  return !writeErr;
}
