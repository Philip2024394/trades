/**
 * @fileoverview MERCHANT-ONLY component.
 * @merchantOnly Only renders when the listing is merchant-grade AND
 * isTradeCenterPicksOn(listing) === true (parent gate). The component
 * self-hides when there are zero non-expired picks so a freshly-toggled
 * add-on never leaves a dead container on the profile.
 */

// Public profile — Trade Center Picks landscape banner shell.
//
// Server component. Fetches the active picks for the listing and hands
// them to the client banner, which handles auto-rotation when more than
// one pick is active. Renders nothing when every pick has expired
// (expires_at < now) or none exist. Banner aspect, cross-fade, dots,
// hover-pause + reduced-motion are all owned by TradeCenterPicksBanner.

import {
  supabase,
  type HammerexTradeOffListing,
  type HammerexXratedTradeCenterPick,
  type HammerexXratedProduct
} from "@/lib/supabase";
import {
  TradeCenterPicksBanner,
  type BannerItem
} from "./TradeCenterPicksBanner";

const PREVIEW_LIMIT = 6;

async function loadActivePicks(
  listingId: string
): Promise<Array<HammerexXratedTradeCenterPick & {
  product: Pick<HammerexXratedProduct, "id" | "name" | "slug" | "cover_url"> | null;
}>> {
  const nowIso = new Date().toISOString();
  const res = await supabase
    .from("hammerex_xrated_trade_center_picks")
    .select("*")
    .eq("listing_id", listingId)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("sort_order", { ascending: true })
    .order("effective_at", { ascending: false })
    .limit(PREVIEW_LIMIT);
  const rows = (res.data ?? []) as HammerexXratedTradeCenterPick[];
  if (rows.length === 0) return [];

  const productIds = Array.from(new Set(rows.map((r) => r.product_id)));
  const prods = await supabase
    .from("hammerex_xrated_products")
    .select("id, name, slug, cover_url")
    .in("id", productIds);
  const byId = new Map<
    string,
    Pick<HammerexXratedProduct, "id" | "name" | "slug" | "cover_url">
  >();
  for (const p of (prods.data ?? []) as Pick<
    HammerexXratedProduct,
    "id" | "name" | "slug" | "cover_url"
  >[]) {
    byId.set(p.id, p);
  }
  return rows.map((r) => ({ ...r, product: byId.get(r.product_id) ?? null }));
}

export async function TradeCenterPicksSection({
  listing
}: {
  listing: HammerexTradeOffListing;
}) {
  const picks = await loadActivePicks(listing.id);
  if (picks.length === 0) return null;

  const items: BannerItem[] = picks.map((p) => ({
    id: p.id,
    status: p.status,
    note: p.note,
    arrival_at: p.arrival_at,
    productName: p.product?.name ?? "Product",
    productSlug: p.product?.slug ?? null,
    // Banner image override takes precedence over the product's PDP
    // cover so a merchant can run a custom landscape promo image.
    productCover: p.banner_image_url ?? p.product?.cover_url ?? null
  }));

  return (
    <section className="w-full pt-10 sm:pt-12">
      {/* Heading + subtitle stay in the standard content gutter; the
          banner itself breaks out to full viewport width below. */}
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Trade Center Picks
        </h2>
        <p className="mt-1 text-[13px] text-neutral-500 sm:text-sm">
          Peek at new products arrived for season.
        </p>
      </div>
      <div className="px-4 sm:px-6">
        <TradeCenterPicksBanner
          items={items}
          listingSlug={listing.slug}
          seeAllHref={`/${listing.slug}/trade-center-picks`}
        />
      </div>
    </section>
  );
}
