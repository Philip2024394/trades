// /<slug>/plant-hire/haulage — machine haulage wizard.
// Reusable across every merchant with the plant_hire add-on. Wizard
// serves two products (hire + delivery, or move my machine) and
// submits via rich WhatsApp handoff.

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
import {
  PLANT_CATEGORIES,
  isPlantHireConfigured,
  normalisePlantHireConfig,
  type PlantCategoryConfig
} from "@/lib/plantHire";
import { PlantHaulageWizard } from "@/components/xrated/profile/PlantHaulageWizard";

export const revalidate = 60;

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Machine haulage — ${slug}`,
    alternates: { canonical: `/${slug}/plant-hire/haulage` }
  };
}

export default async function PlantHaulagePage({
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

  const wa = whatsappDigits(listing.whatsapp ?? "");
  const primary = tradeLabel(listing.primary_trade);
  const merchantName = listing.display_name ?? slug;
  const waFinal = wa || adminWhatsapp();
  const waUrl = waFinal ? `https://wa.me/${waFinal}` : "#";
  const heroTier =
    tier === "app_paid" || tier === "app_verified"
      ? "paid"
      : tier === "app_trial"
        ? "paid"
        : "free";

  const fleet = PLANT_CATEGORIES.map((meta) => {
    const raw = cfg.categories[meta.slug] as PlantCategoryConfig | undefined;
    if (!raw?.enabled) return null;
    return {
      slug: meta.slug,
      label: meta.label,
      emoji: meta.emoji,
      cfg: raw
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  const haulage = cfg.haulage_service;
  const notEnabled = !haulage.enabled;

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
        <span className="text-neutral-900">Machine haulage</span>
      </nav>

      <section className="mx-auto w-full max-w-4xl px-4 pt-4 sm:px-6">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
          Machine haulage · Hire &amp; delivery + third-party moves
        </p>
        <h1 className="mt-1 text-3xl font-extrabold text-neutral-900 sm:text-4xl">
          Hire a machine — or have us move yours.
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
          {notEnabled
            ? `${merchantName} handles both hire delivery and full third-party haulage. WhatsApp us and we'll build a quote.`
            : "Two flows below. Pick a machine from our fleet and we deliver it, or tell us about a machine you own and we'll haul it. Live estimate, quote confirmed within 30 minutes."}
        </p>
        {haulage.operators_licence_number && (
          <p className="mt-3 text-[11px] font-bold text-neutral-500">
            Operator's licence · {haulage.operators_licence_number}
            {haulage.goods_in_transit_cover_pence
              ? ` · Goods-in-transit £${(haulage.goods_in_transit_cover_pence / 100).toLocaleString()}`
              : ""}
          </p>
        )}
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 pt-6 sm:px-6">
        {notEnabled ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-6 text-center">
            <p className="text-[14px] font-extrabold text-neutral-900">
              Haulage wizard not enabled yet.
            </p>
            <p className="mt-2 text-[12px] text-neutral-500">
              WhatsApp {merchantName} directly for a hire delivery or machine move quote.
            </p>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex h-11 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-black transition"
              style={{ background: "#FFB300" }}
            >
              WhatsApp {merchantName}
            </a>
          </div>
        ) : (
          <PlantHaulageWizard
            merchantName={merchantName}
            waHref={wa ? `https://wa.me/${wa}` : null}
            config={haulage}
            depotPostcode={cfg.depot_postcode}
            fleet={fleet}
          />
        )}
      </section>

      <div className="mt-auto pt-12">
        <TradeProfileFooter listing={listing} appName={`${primary} Service`} />
      </div>
    </main>
  );
}
