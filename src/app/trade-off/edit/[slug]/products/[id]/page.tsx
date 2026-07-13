// /trade-off/edit/[slug]/products/[id]
//
// Merchant product editor — create ("new" id) or edit existing.
// Validates the magic-link token, resolves the merchant's canteen,
// loads the product (or seeds an empty one), and hands the client
// form the state + edit_token so save/delete round-trips through
// the /api/trade-off/canteen-product/save endpoint with re-verified
// auth.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ProductEditorForm, type ProductEditorInitial, type MerchantTier } from "./ProductEditorForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit product · Merchant · Thenetworkers",
  robots: { index: false, follow: false }
};

function constantTimeEq(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

const EMPTY: ProductEditorInitial = {
  id: "",
  name: "",
  blurb: "",
  description: "",
  imageUrl: "",
  galleryUrls: [],
  videoUrls: [],
  priceGbp: 0,
  currency: "GBP",
  specs: [],
  tradeCenterListingId: null,
  showInCanteenProducts: true,
  showInTrending: true,
  showInTradeCenter: true,
  featured: false,
  variants: null,
  commerce: null,
  categorySlug: "",
  categoryAspects: {}
};

// Map the DB's XratedTier onto the 4-tier product UI.
// Every paid/trial/verified tier is treated as "marketplace" for now —
// this unlocks all three surfaces so the merchant sees no locks. Once
// the new packages-tier schema lands, swap this to a proper lookup.
// `standard` and `app_expired` map to "free" — canteen only, TC locked.
function resolveTier(row: Record<string, unknown> | null | undefined): MerchantTier {
  const t = String(row?.tier ?? "standard").toLowerCase();
  if (t === "app_paid" || t === "app_trial" || t === "app_verified") return "marketplace";
  return "free";
}

export default async function MerchantProductEditorPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const token = Array.isArray(sp.token) ? sp.token[0] : sp.token ?? "";
  if (!token) redirect(`/trade-off/edit/${slug}`);

  const { data: listing } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name, edit_token, status, tier")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing || !constantTimeEq(listing.edit_token, token)) {
    redirect(`/trade-off/edit/${slug}`);
  }
  if (listing.status !== "live") redirect(`/trade-off/edit/${slug}`);

  // Resolve merchant canteen.
  const { data: canteen } = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, host_slug")
    .eq("host_slug", slug)
    .maybeSingle();
  if (!canteen) {
    // No canteen yet — the flow still works because save-new will
    // route through canteen resolution again; but the editor needs
    // a valid canteen for the read step. Send back to dashboard.
    redirect(`/trade-off/edit/${slug}?token=${encodeURIComponent(token)}&needs_canteen=1`);
  }

  const isNew = id === "new";
  let initial: ProductEditorInitial = EMPTY;

  if (!isNew) {
    const { data: row } = await supabaseAdmin
      .from("hammerex_canteen_products")
      .select("*")
      .eq("id", id)
      .eq("canteen_id", canteen.id)
      .maybeSingle();
    if (!row) {
      redirect(`/trade-off/edit/${slug}/products?token=${encodeURIComponent(token)}&notfound=1`);
    }
    initial = {
      id: row.id,
      name: row.name ?? "",
      blurb: row.blurb ?? "",
      description: row.description ?? "",
      imageUrl: row.image_url ?? "",
      galleryUrls: Array.isArray(row.gallery_urls) ? row.gallery_urls : [],
      videoUrls: Array.isArray(row.video_urls) ? row.video_urls : [],
      priceGbp: row.price_gbp ?? 0,
      currency: (row.currency ?? "GBP") as ProductEditorInitial["currency"],
      specs: Array.isArray(row.specs) ? row.specs : [],
      tradeCenterListingId: row.trade_center_listing_id ?? null,
      showInCanteenProducts: row.show_in_canteen_products ?? true,
      showInTrending: row.show_in_trending ?? true,
      showInTradeCenter: row.show_in_trade_center ?? true,
      featured: row.featured ?? false,
      variants: row.variants ?? null,
      commerce: row.commerce ?? null,
      categorySlug: row.category_slug ?? "",
      categoryAspects: row.category_aspects ?? {}
    };
  }

  const tier = resolveTier(listing as Record<string, unknown>);

  return (
    <main className="min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <ProductEditorForm
        slug={slug}
        editToken={token}
        initial={initial}
        isNew={isNew}
        merchantTier={tier}
      />
    </main>
  );
}
