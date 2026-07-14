// App template catalogue + per-merchant selection.
//
// Data source: hammerex_app_templates (catalogue) +
// hammerex_trade_off_listings.mobile_app_template_slug (per-merchant
// applied choice). See supabase/migrations/20260719140000_app_templates.sql.
//
// Template 1 (Offwhite) is Mike Watson's original canteen mobile
// design. As more templates ship they land as rows in the catalogue;
// the canteen shell reads the applied slug and dispatches on
// hero_layout + feed_layout.

import { supabaseAdmin } from "./supabaseAdmin";

export type AppTemplate = {
  slug: string;
  name: string;
  themeName: string;
  themeBgColor: string;
  themeAccentColor: string;
  themeInkColor: string;
  heroLayout: string;
  feedLayout: string;
  previewImageUrl: string | null;
  description: string | null;
  minTier: string;
  isDefault: boolean;
  sortOrder: number;
};

/** Fallback used when the DB is unreachable OR the merchant's applied
 *  slug doesn't resolve to a live catalogue row. Every canteen renders
 *  something even if the catalogue is empty. */
export const DEFAULT_APP_TEMPLATE: AppTemplate = {
  slug: "template-1",
  name: "Original",
  themeName: "Offwhite",
  themeBgColor: "#FBF6EC",
  themeAccentColor: "#B8860B",
  themeInkColor: "#1B1A17",
  heroLayout: "hero-wow-split-cream",
  feedLayout: "tabbed-live-feed",
  previewImageUrl: null,
  description:
    "The original Thenetworkers mobile app design — cream (offwhite) surface, warm gold accents, split-hero with floating KPI cards, tabbed live feed, and verified WhatsApp contact throughout.",
  minTier: "app_paid",
  isDefault: true,
  sortOrder: 1
};

function shape(row: Record<string, unknown>): AppTemplate {
  return {
    slug: row.slug as string,
    name: row.name as string,
    themeName: row.theme_name as string,
    themeBgColor: row.theme_bg_color as string,
    themeAccentColor: row.theme_accent_color as string,
    themeInkColor: row.theme_ink_color as string,
    heroLayout: row.hero_layout as string,
    feedLayout: row.feed_layout as string,
    previewImageUrl: (row.preview_image_url as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    minTier: (row.min_tier as string) ?? "app_paid",
    isDefault: (row.is_default as boolean) ?? false,
    sortOrder: (row.sort_order as number) ?? 0
  };
}

/** Load every active template ordered for the picker UI. */
export async function listAppTemplates(): Promise<AppTemplate[]> {
  try {
    const res = await supabaseAdmin
      .from("hammerex_app_templates")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (res.error || !res.data) return [DEFAULT_APP_TEMPLATE];
    if (res.data.length === 0) return [DEFAULT_APP_TEMPLATE];
    return res.data.map(shape);
  } catch {
    return [DEFAULT_APP_TEMPLATE];
  }
}

/** Load one template by slug, or null. */
export async function getAppTemplate(slug: string): Promise<AppTemplate | null> {
  try {
    const res = await supabaseAdmin
      .from("hammerex_app_templates")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (res.error || !res.data) return null;
    return shape(res.data);
  } catch {
    return null;
  }
}

/** Load the template a merchant currently applies. Falls back to the
 *  DEFAULT_APP_TEMPLATE if the merchant hasn't picked one yet, or if
 *  their pick was later archived. Never throws. */
export async function loadMerchantTemplate(merchantSlug: string): Promise<AppTemplate> {
  try {
    const listing = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("mobile_app_template_slug")
      .eq("slug", merchantSlug)
      .maybeSingle();
    const applied =
      typeof listing.data?.mobile_app_template_slug === "string"
        ? listing.data.mobile_app_template_slug
        : DEFAULT_APP_TEMPLATE.slug;
    const template = await getAppTemplate(applied);
    return template ?? DEFAULT_APP_TEMPLATE;
  } catch {
    return DEFAULT_APP_TEMPLATE;
  }
}

/** Apply a template to a merchant. Called from the picker UI when the
 *  merchant selects a new template. Returns { ok: true } on success. */
export async function applyTemplateToMerchant(
  merchantSlug: string,
  templateSlug: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const template = await getAppTemplate(templateSlug);
  if (!template) return { ok: false, error: "template-not-found" };
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({ mobile_app_template_slug: templateSlug })
    .eq("slug", merchantSlug);
  if (res.error) return { ok: false, error: res.error.message };
  return { ok: true };
}
