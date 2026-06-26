import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabase, type HammerexTradeOffListing } from "@/lib/supabase";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { PremiumHero } from "@/components/xrated/profile/PremiumHero";
import { ServicesPageBody } from "@/components/xrated/profile/ServicesPageBody";
import { tradeLabel, whatsappQuoteUrl } from "@/lib/tradeOff";

export const revalidate = 300;

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
  if (!listing) return { title: "Services" };
  const primary = tradeLabel(listing.primary_trade);
  return {
    title: `Services — ${listing.display_name} | ${primary} in ${listing.city}`,
    description: `What ${listing.display_name} offers and the area they cover. ${primary} services in and around ${listing.city}.`
  };
}

export default async function TradeServicesPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) notFound();

  const primary = tradeLabel(listing.primary_trade);
  const waUrl = whatsappQuoteUrl(listing.whatsapp, listing.display_name, primary);

  return (
    <main className="flex flex-1 flex-col pb-20 md:pb-0">
      <XratedHeader />

      <PremiumHero listing={listing} waUrl={waUrl} currentPage="contact" />

      <ServicesPageBody
        displayName={listing.display_name}
        city={listing.city}
        servicePostcodes={listing.service_postcodes ?? []}
        services={listing.services_offered ?? []}
        lat={listing.lat}
        lng={listing.lng}
      />

      <div className="mt-auto">
        <XratedFooter />
      </div>
    </main>
  );
}
