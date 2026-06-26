import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabase, type HammerexTradeOffListing } from "@/lib/supabase";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { PremiumHero } from "@/components/xrated/profile/PremiumHero";
import { ReviewFormPanel } from "@/components/xrated/profile/ReviewFormPanel";
import { tradeLabel, whatsappQuoteUrl } from "@/lib/tradeOff";
import { isShopModeOn } from "@/lib/xratedAddons";

export const revalidate = 60;

async function loadListing(slug: string): Promise<HammerexTradeOffListing | null> {
  const res = await supabase
    .from("hammerex_trade_off_listings")
    .select("*")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  return (res.data ?? null) as HammerexTradeOffListing | null;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) return { title: "Leave a review" };
  const primary = tradeLabel(listing.primary_trade);
  return {
    title: `Leave a review for ${listing.display_name} — ${primary} | Xrated Trades`,
    description: `Share your experience working with ${listing.display_name} on Xrated Trades. Honest reviews protect good tradespeople and help customers choose.`
  };
}

export default async function TradeReviewPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) notFound();

  const primary = tradeLabel(listing.primary_trade);
  const waUrl = whatsappQuoteUrl(listing.whatsapp, listing.display_name, primary);

  // Shop Mode add-on — when on, customers can tag the review to a
  // specific product. We always fetch the product list (kept tiny —
  // just id/name/kind/cover_url) so the form's Service/Product tab
  // toggle can decide whether to render. Empty array = no products and
  // ReviewFormPanel falls back to the single-picker layout.
  const shopModeOn = isShopModeOn(listing);
  let products: { id: string; name: string; kind: "product" | "service"; cover_url: string | null }[] = [];
  if (shopModeOn) {
    const productsRes = await supabase
      .from("hammerex_xrated_products")
      .select("id, name, kind, cover_url")
      .eq("listing_id", listing.id)
      .eq("status", "live")
      .eq("kind", "product")
      .order("sort_order", { ascending: true });
    products = (productsRes.data ?? []) as typeof products;
  }

  return (
    <main className="flex flex-1 flex-col pb-20 md:pb-0">
      <XratedHeader />

      <PremiumHero listing={listing} waUrl={waUrl} currentPage="contact" />

      <ReviewFormPanel
        listingId={listing.id}
        displayName={listing.display_name}
        pricedServices={listing.priced_services ?? []}
        products={products}
        shopModeOn={shopModeOn}
      />

      <div className="mt-auto">
        <XratedFooter />
      </div>
    </main>
  );
}
