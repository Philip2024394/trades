// merchantPageLoader — server-side read/write for merchant page state.
//
// Supabase-first. Falls back to in-memory (never persists) when no
// Supabase creds are set, so demo mode still works.

import { createClient } from "@supabase/supabase-js";

type SectionsMap = Record<string, unknown>;

function getServerClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Read the current published sections for a merchant page. Public
 *  visitors always see this. Merchants in edit mode call this on
 *  first mount to hydrate the last saved state. */
export async function loadPublishedSections(
  merchantId: string,
  pageSlug: string
): Promise<SectionsMap | null> {
  const client = getServerClient();
  if (!client) return null;
  const { data, error } = await client
    .from("merchant_pages")
    .select("published_sections")
    .eq("merchant_id", merchantId)
    .eq("page_slug", pageSlug)
    .maybeSingle();
  if (error || !data) return null;
  return (data.published_sections as SectionsMap) ?? {};
}

/** Read the draft — for merchants previewing unpublished changes. */
export async function loadDraftSections(
  merchantId: string,
  pageSlug: string
): Promise<SectionsMap | null> {
  const client = getServerClient();
  if (!client) return null;
  const { data, error } = await client
    .from("merchant_pages")
    .select("draft_sections")
    .eq("merchant_id", merchantId)
    .eq("page_slug", pageSlug)
    .maybeSingle();
  if (error || !data) return null;
  return (data.draft_sections as SectionsMap) ?? {};
}

/** Write draft sections (auto-save on every change from the client). */
export async function saveDraftSections(
  merchantId: string,
  pageSlug: string,
  sections: SectionsMap
): Promise<boolean> {
  const client = getServerClient();
  if (!client) return false;
  const { error } = await client
    .from("merchant_pages")
    .upsert(
      {
        merchant_id: merchantId,
        page_slug: pageSlug,
        draft_sections: sections
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
  // Read current draft, then write both fields in one upsert
  const { data, error: readErr } = await client
    .from("merchant_pages")
    .select("draft_sections")
    .eq("merchant_id", merchantId)
    .eq("page_slug", pageSlug)
    .maybeSingle();
  if (readErr || !data) return false;
  const draft = data.draft_sections;
  const { error: writeErr } = await client
    .from("merchant_pages")
    .upsert(
      {
        merchant_id: merchantId,
        page_slug: pageSlug,
        draft_sections: draft,
        published_sections: draft,
        published_at: new Date().toISOString()
      },
      { onConflict: "merchant_id,page_slug" }
    );
  return !writeErr;
}
