// /<slug>/plant-hire/trade-accounts — full trade credit accounts page,
// moved off the plant hire home so the application content has room.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { effectiveTier } from "@/lib/xratedTrades";
import { isPlantHireOn } from "@/lib/xratedAddons";
import { tradeLabel, whatsappDigits } from "@/lib/tradeOff";
import { TradeProfileHeader } from "@/components/xrated/TradeProfileHeader";
import { TradeProfileFooter } from "@/components/xrated/TradeProfileFooter";
import { PremiumHero } from "@/components/xrated/profile/PremiumHero";
import { adminWhatsapp } from "@/lib/whatsapp";
import { isPlantHireConfigured, normalisePlantHireConfig } from "@/lib/plantHire";
import { PlantTradeAccountsSection } from "@/components/xrated/profile/PlantHireExtraSections";

export const revalidate = 60;

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Open a trade account — ${slug}`,
    alternates: { canonical: `/${slug}/plant-hire/trade-accounts` }
  };
}

export default async function TradeAccountsPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listingRes = await supabase
    .from("hammerex_trade_off_listings")
    .select("*")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  if (!listingRes.data) notFound();
  const listing = listingRes.data;

  const tier = effectiveTier(listing);
  const isPaid = tier === "app_trial" || tier === "app_paid" || tier === "app_verified";
  if (!isPaid || !isPlantHireOn(listing)) redirect(`/${slug}`);

  const cfg = normalisePlantHireConfig(listing.plant_hire);
  if (!isPlantHireConfigured(cfg)) redirect(`/${slug}`);
  if (!cfg.trade_accounts.enabled) redirect(`/${slug}/plant-hire`);

  const wa = whatsappDigits(listing.whatsapp ?? "");
  const waFinal = wa || adminWhatsapp();
  const waUrl = waFinal ? `https://wa.me/${waFinal}` : "#";
  const primary = tradeLabel(listing.primary_trade);
  const merchantName = listing.display_name ?? slug;
  const heroTier =
    tier === "app_paid" || tier === "app_verified"
      ? "paid"
      : tier === "app_trial"
        ? "paid"
        : "free";

  return (
    <main className="flex flex-1 flex-col bg-neutral-50 pb-16">
      <TradeProfileHeader listing={listing} appName={`${primary} Service`} backHref={`/${slug}`} />
      <PremiumHero listing={listing} waUrl={waUrl} currentPage="contact" tier={heroTier} />

      <nav
        aria-label="Breadcrumb"
        className="mx-auto flex w-full max-w-4xl items-center gap-2 px-4 pt-6 text-[11px] font-bold uppercase tracking-widest text-neutral-500 sm:px-6"
      >
        <Link href={`/${slug}`} className="transition hover:text-[#FFB300]">
          {merchantName}
        </Link>
        <span aria-hidden="true">›</span>
        <Link href={`/${slug}/plant-hire`} className="transition hover:text-[#FFB300]">
          Plant Hire
        </Link>
        <span aria-hidden="true">›</span>
        <span className="text-neutral-900">Trade accounts</span>
      </nav>

      <section className="mx-auto w-full max-w-4xl px-4 pt-4 sm:px-6">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
          Open a trade account
        </p>
        <h1 className="mt-1 text-3xl font-extrabold text-neutral-900 sm:text-4xl">
          {cfg.trade_accounts.heading}
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
          {cfg.trade_accounts.subheading}
        </p>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 pt-6 sm:px-6">
        <PlantTradeAccountsSection
          cfg={cfg.trade_accounts}
          merchantName={merchantName}
          merchantSlug={listing.slug}
          waHref={wa ? `https://wa.me/${wa}` : null}
        />
      </section>

      <div className="mt-auto pt-12">
        <TradeProfileFooter listing={listing} appName={`${primary} Service`} />
      </div>
    </main>
  );
}
