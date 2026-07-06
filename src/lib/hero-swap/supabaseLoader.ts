// supabaseLoader — server-side function to fetch hero library from the
// hero_library Supabase table. Falls back to the static JSON if the
// table is empty or the query fails.
//
// The runtime pattern:
//   1. Server component / route handler calls loadHeroLibraryForMerchant()
//   2. If SUPABASE_URL is set and query returns rows, we use those
//   3. Otherwise fall back to scripts/hero-library.json (static import)
//
// Keeps merchant queries fast (single GIN-indexed query) while
// preserving the deploy-nothing dev experience.

import { createClient } from "@supabase/supabase-js";
import libraryJson from "../../../scripts/hero-library.json";
import type { HeroImage } from "./types";

type LibraryFileShape = {
  entries: HeroImage[];
};

const STATIC_ENTRIES = (libraryJson as unknown as LibraryFileShape).entries;

function getServerClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Fetch all hero library entries that match a merchant's trade keywords
 *  from Supabase. Falls back to static JSON on any failure. */
export async function loadHeroLibraryForMerchant(
  merchantTradeKeywords: string[]
): Promise<HeroImage[]> {
  if (merchantTradeKeywords.length === 0) return [];

  const client = getServerClient();
  if (!client) {
    return filterStatic(merchantTradeKeywords);
  }

  const { data, error } = await client
    .from("hero_library")
    .select("*")
    .overlaps("keywords_strict", merchantTradeKeywords)
    .in("recommended_use", ["hero", "split-hero"]);

  if (error || !data || data.length === 0) {
    return filterStatic(merchantTradeKeywords);
  }
  return data as unknown as HeroImage[];
}

/** Fetch a single hero image by id (Supabase-first, JSON fallback). */
export async function loadHeroImageById(
  id: string
): Promise<HeroImage | null> {
  const client = getServerClient();
  if (!client) {
    return STATIC_ENTRIES.find((e) => e.id === id) ?? null;
  }
  const { data, error } = await client
    .from("hero_library")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return STATIC_ENTRIES.find((e) => e.id === id) ?? null;
  }
  return data as unknown as HeroImage;
}

/** Read + write merchant hero slot persistence. Requires an
 *  authenticated Supabase session (RLS enforces merchant_id = auth.uid). */
export async function saveMerchantHeroSlot(params: {
  merchantId: string;
  slotKey: string;
  imageId: string;
  preset: string;
  edits: Record<string, unknown>;
  uploadUrl?: string | null;
  uploadFocals?: Record<string, unknown> | null;
}): Promise<boolean> {
  const client = getServerClient();
  if (!client) return false;
  const { error } = await client.from("merchant_hero_slots").upsert(
    {
      merchant_id: params.merchantId,
      slot_key: params.slotKey,
      image_id: params.imageId,
      preset: params.preset,
      edits: params.edits,
      upload_url: params.uploadUrl ?? null,
      upload_focals: params.uploadFocals ?? null
    },
    { onConflict: "merchant_id,slot_key" }
  );
  return !error;
}

function filterStatic(merchantTradeKeywords: string[]): HeroImage[] {
  const normalised = new Set(
    merchantTradeKeywords.map((k) => k.toLowerCase().trim())
  );
  return STATIC_ENTRIES.filter((image) => {
    if (
      image.recommended_use !== "hero" &&
      image.recommended_use !== "split-hero"
    ) {
      return false;
    }
    return image.keywords_strict.some((k) =>
      normalised.has(k.toLowerCase().trim())
    );
  });
}
