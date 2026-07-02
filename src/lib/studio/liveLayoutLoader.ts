// Module 21 — Storefront live-layout loader.
//
// Given a merchant + pageId, returns the merchant's default brand's
// currently-published layout (highest version of status='published'),
// its brand token map, and the brand row itself. Returns null when the
// merchant has NEVER published a Studio layout for this page — the
// storefront then falls back to the hand-composed profile.
//
// Auto-detect model: publishing IS the opt-in. No listing flag required.
// A merchant who has never touched Studio sees zero behaviour change.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadBrandTokens } from "./tokensLoader";
import type { BrandTokens } from "./sectionTypes";
import type { StudioLayoutJson } from "./schema";

export type LivePublishedLayout = {
  layout: StudioLayoutJson;
  tokens: BrandTokens;
  brandId: string;
  brandName: string;
  version: number;
  publishedAt: string;
};

/** Fetch the live-published layout for a merchant + page. Returns null
 *  if the merchant has no default brand or no published layout for the
 *  given page. Callers use null as the "fall back to hand-composed
 *  profile" signal.
 *
 *  Only reads `breakpoint='default'` — per-breakpoint overrides land in
 *  Module 12 (Responsive editing); until then every viewport reads the
 *  same row and CSS handles adaptation. */
export async function loadLivePublishedLayout(
  merchantId: string,
  pageId: string
): Promise<LivePublishedLayout | null> {
  const brandRes = await supabaseAdmin
    .from("studio_brands")
    .select("id, name")
    .eq("merchant_id", merchantId)
    .eq("is_default", true)
    .maybeSingle();
  if (!brandRes.data) return null;
  const brand = brandRes.data as { id: string; name: string };

  const layoutRes = await supabaseAdmin
    .from("studio_layouts")
    .select("layout_json, version, published_at")
    .eq("merchant_id", merchantId)
    .eq("brand_id", brand.id)
    .eq("page_id", pageId)
    .eq("breakpoint", "default")
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!layoutRes.data?.layout_json) return null;

  const tokens = await loadBrandTokens(brand.id);

  return {
    layout: layoutRes.data.layout_json as StudioLayoutJson,
    tokens,
    brandId: brand.id,
    brandName: brand.name,
    version: (layoutRes.data.version as number) ?? 1,
    publishedAt: (layoutRes.data.published_at as string) ?? ""
  };
}
