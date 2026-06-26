// Xrated Shop Mode — cart page.
//
// Server shell. Loads the listing (notFound when missing / not live)
// and the tradesperson's shipping zones. The cart itself lives in
// localStorage on the client so the rendering of the cart list +
// shipping picker + WhatsApp composer is delegated to CartPageBody.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  supabase,
  type HammerexTradeOffListing,
  type HammerexXratedShippingZone
} from "@/lib/supabase";
import { isShopModeOn } from "@/lib/xratedAddons";
import { effectiveTier } from "@/lib/xratedTrades";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { CartPageBody } from "@/components/xrated/profile/CartPageBody";

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

async function loadShippingZones(
  listingId: string
): Promise<HammerexXratedShippingZone[]> {
  const res = await supabase
    .from("hammerex_xrated_shipping_zones")
    .select("*")
    .eq("listing_id", listingId)
    .order("country_name", { ascending: true });
  return (res.data ?? []) as HammerexXratedShippingZone[];
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) return { title: "Cart" };
  const firstName = listing.display_name.split(/\s+/)[0] ?? listing.display_name;
  return {
    title: `${firstName}'s shop — Your cart | Xrated`,
    description: `Review your cart and send a WhatsApp enquiry to ${firstName}. No card payments — ${firstName} confirms the final price.`,
    alternates: { canonical: `/${slug}/cart` },
    robots: { index: false }
  };
}

export default async function CartPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) notFound();

  const tier = effectiveTier(listing);
  const isPaid = tier === "app_trial" || tier === "app_paid";
  // Cart is only meaningful when shop mode is live AND the tradesperson
  // is on a paid tier. Send anyone else back to the main profile rather
  // than render an orphan page.
  if (!isShopModeOn(listing) || !isPaid) {
    redirect(`/${slug}`);
  }

  const zones = await loadShippingZones(listing.id);

  return (
    <main className="flex flex-1 flex-col bg-white pb-20 md:pb-0">
      <CartPageBody listing={listing} zones={zones} />
      <div className="mt-auto">
        <XratedFooter />
      </div>
    </main>
  );
}
