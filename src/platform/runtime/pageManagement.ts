// Platform Runtime — page management.
//
// Materialises App-declared pages into studio_pages, and reverses the
// change on uninstall via soft-hide. Only pages with a non-null
// origin_app_slug participate in this lifecycle — merchant-created
// pages are untouched.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PageDeclaration } from "../manifest/types";

/** Resolve a brand id from a merchant. Prefers the default brand;
 *  returns null if the merchant somehow has no brand row yet
 *  (loadStudioSession auto-creates one, so this should be null only
 *  for merchants who have never opened Studio). */
export async function resolveDefaultBrandId(
  merchantId: string
): Promise<string | null> {
  const res = await supabaseAdmin
    .from("studio_brands")
    .select("id")
    .eq("merchant_id", merchantId)
    .eq("is_default", true)
    .maybeSingle();
  if (res.error || !res.data) return null;
  return (res.data.id as string) ?? null;
}

/** Materialise a single App-declared page. Returns the slug that ended
 *  up in studio_pages (may differ from the declaration if the merchant
 *  already had a page with that slug — collision policy: leave existing
 *  page alone, do not overwrite content). */
export async function createAppPage(args: {
  brandId: string;
  appSlug: string;
  page: PageDeclaration;
}): Promise<{ slug: string; created: boolean }> {
  const existing = await supabaseAdmin
    .from("studio_pages")
    .select("id, origin_app_slug, hidden_at")
    .eq("brand_id", args.brandId)
    .eq("slug", args.page.pageId)
    .maybeSingle();

  // Merchant already has this page — do not overwrite. If it's a
  // previously hidden App-created page for the same App, unhide it
  // (this is the reinstall path).
  if (existing.data) {
    if (existing.data.origin_app_slug === args.appSlug) {
      await supabaseAdmin
        .from("studio_pages")
        .update({ hidden_at: null })
        .eq("id", existing.data.id);
    }
    return { slug: args.page.pageId, created: false };
  }

  const ins = await supabaseAdmin.from("studio_pages").insert({
    brand_id: args.brandId,
    slug: args.page.pageId,
    name: args.page.title,
    sort_order: 100,
    is_home: false,
    origin_app_slug: args.appSlug
  });
  if (ins.error) {
    throw new Error(`createAppPage: ${ins.error.message}`);
  }
  return { slug: args.page.pageId, created: true };
}

/** Soft-hide every App-created page for the given merchant + slug so
 *  the page manager, storefront nav, and route resolver skip them
 *  until the App is reinstalled. */
export async function hideAppPages(args: {
  brandId: string;
  appSlug: string;
}): Promise<void> {
  const res = await supabaseAdmin
    .from("studio_pages")
    .update({ hidden_at: new Date().toISOString() })
    .eq("brand_id", args.brandId)
    .eq("origin_app_slug", args.appSlug)
    .is("hidden_at", null);
  if (res.error) {
    throw new Error(`hideAppPages: ${res.error.message}`);
  }
}

/** Hard-delete every App-created page — invoked only during a purge
 *  uninstall. */
export async function deleteAppPages(args: {
  brandId: string;
  appSlug: string;
}): Promise<void> {
  const res = await supabaseAdmin
    .from("studio_pages")
    .delete()
    .eq("brand_id", args.brandId)
    .eq("origin_app_slug", args.appSlug);
  if (res.error) {
    throw new Error(`deleteAppPages: ${res.error.message}`);
  }
}

/** List pages an App has created for a merchant's brand. `includeHidden`
 *  = true surfaces soft-hidden pages too (useful for the Studio page
 *  manager showing the "hidden" tab); false-by-default matches the
 *  App Store's "your live pages" view. */
export async function listAppCreatedPages(args: {
  brandId: string;
  appSlug: string;
  includeHidden?: boolean;
}): Promise<{ slug: string; name: string; hidden: boolean }[]> {
  let q = supabaseAdmin
    .from("studio_pages")
    .select("slug, name, hidden_at, sort_order")
    .eq("brand_id", args.brandId)
    .eq("origin_app_slug", args.appSlug)
    .order("sort_order", { ascending: true });
  if (!args.includeHidden) q = q.is("hidden_at", null);
  const res = await q;
  if (res.error || !res.data) return [];
  return (res.data as {
    slug: string;
    name: string;
    hidden_at: string | null;
  }[]).map((r) => ({
    slug: r.slug,
    name: r.name,
    hidden: !!r.hidden_at
  }));
}
