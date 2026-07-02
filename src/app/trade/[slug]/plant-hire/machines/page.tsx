// /<slug>/plant-hire/machines — searchable grid of every enabled
// machine on the merchant's plant hire config. Each card links to
// /<slug>/plant-hire/machines/<category> for the full machine detail
// page. Reuses PlantHireFilterBar for search + weight + available today.

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
import { PremiumStickyTrust } from "@/components/xrated/profile/PremiumStickyTrust";
import { adminWhatsapp } from "@/lib/whatsapp";
import {
  PLANT_CATEGORIES,
  formatPriceFrom,
  isPlantHireConfigured,
  mergeSpecs,
  normalisePlantHireConfig
} from "@/lib/plantHire";
import { PlantHireFilterBar } from "@/components/xrated/profile/PlantHireFilterBar";

export const revalidate = 60;

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `All machines — ${slug} | Plant Hire`,
    alternates: { canonical: `/${slug}/plant-hire/machines` }
  };
}

export default async function MachinesGridPage({
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

  const enabled = PLANT_CATEGORIES.map((meta) => ({ meta, c: cfg.categories[meta.slug] })).filter(
    (row) => row.c?.enabled
  );

  const wa = whatsappDigits(listing.whatsapp ?? "");
  const primary = tradeLabel(listing.primary_trade);
  const merchantName = listing.display_name ?? slug;
  const waUrl = wa || adminWhatsapp() ? `https://wa.me/${wa || adminWhatsapp()}` : "#";
  const heroTier =
    tier === "app_paid" || tier === "app_verified" ? "paid" : tier === "app_trial" ? "paid" : "free";

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="flex flex-1 flex-col bg-white pb-24">
      <TradeProfileHeader listing={listing} appName={`${primary} Service`} backHref={`/${slug}`} />
      <PremiumHero listing={listing} waUrl={waUrl} currentPage="contact" tier={heroTier} />

      <nav
        aria-label="Breadcrumb"
        className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 pt-6 text-[11px] font-bold uppercase tracking-widest text-neutral-500 sm:px-6"
      >
        <Link href={`/${slug}`} className="transition hover:text-[#FFB300]">
          {merchantName}
        </Link>
        <span aria-hidden="true">›</span>
        <Link href={`/${slug}/plant-hire`} className="transition hover:text-[#FFB300]">
          Plant Hire
        </Link>
        <span aria-hidden="true">›</span>
        <span className="text-neutral-900">All machines</span>
      </nav>

      <section className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
          {enabled.length} machines
        </p>
        <h1 className="mt-1 text-3xl font-extrabold text-neutral-900 sm:text-4xl">
          Find your machine
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
          Search by name, filter by weight, or narrow to what&rsquo;s available today. Tap any card to open the full machine detail page.
        </p>

        <PlantHireFilterBar
          categories={enabled.map(({ meta, c }) => ({
            slug: meta.slug,
            label: meta.label,
            weight_kg: mergeSpecs(meta.slug, c?.specs).weight_kg ?? null,
            available_today: !(c?.blocked_ranges ?? []).some(
              (r) => today >= r.from && today <= r.to
            )
          }))}
        />

        <ul id="plant-tiles" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {enabled.map(({ meta, c }) => {
            const specs = mergeSpecs(meta.slug, c?.specs);
            const onHire = (c?.blocked_ranges ?? []).some((r) => today >= r.from && today <= r.to);
            return (
              <li
                key={meta.slug}
                data-slug={meta.slug}
                data-label={meta.label.toLowerCase()}
                data-weight={specs.weight_kg ?? ""}
                data-available-today={onHire ? "false" : "true"}
              >
                <Link
                  href={`/${slug}/plant-hire/machines/${meta.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:border-[#FFB300] hover:shadow-lg"
                >
                  <span className="relative block aspect-video w-full overflow-hidden bg-neutral-50">
                    {c?.image_url && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={c.image_url}
                        alt={meta.label}
                        className="absolute inset-0 h-full w-full object-contain transition group-hover:scale-105"
                      />
                    )}
                    <span
                      className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-black"
                      style={{ background: "#FFB300" }}
                    >
                      {formatPriceFrom(c?.price_day_pence)}
                    </span>
                    <span
                      className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest"
                      style={
                        onHire
                          ? { background: "#FEE2E2", color: "#991B1B" }
                          : { background: "#DCFCE7", color: "#166534" }
                      }
                    >
                      <span
                        aria-hidden="true"
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: onHire ? "#DC2626" : "#22C55E" }}
                      />
                      {onHire ? "On hire" : "Available today"}
                    </span>
                  </span>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <p className="text-[15px] font-extrabold text-neutral-900">{meta.label}</p>
                    <p className="line-clamp-2 text-[12px] text-neutral-600">{meta.short_desc}</p>
                    {(specs.weight_kg || specs.hp) && (
                      <ul className="flex flex-wrap gap-1.5">
                        {specs.weight_kg && (
                          <li className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-800">
                            {specs.weight_kg.toLocaleString()} kg
                          </li>
                        )}
                        {specs.hp && (
                          <li className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-800">
                            {specs.hp} hp
                          </li>
                        )}
                        {specs.fuel_type && (
                          <li className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-800">
                            {specs.fuel_type === "diesel"
                              ? "Diesel"
                              : specs.fuel_type === "petrol"
                                ? "Petrol"
                                : specs.fuel_type === "electric"
                                  ? "Electric"
                                  : "Hybrid"}
                          </li>
                        )}
                      </ul>
                    )}
                    <span
                      className="mt-auto inline-flex h-10 items-center justify-center gap-1 rounded-lg text-[11px] font-extrabold uppercase tracking-widest transition group-hover:opacity-90"
                      style={{ background: "#FFB300", color: "#0A0A0A" }}
                    >
                      View machine spec →
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-auto pt-12">
        <TradeProfileFooter listing={listing} appName={`${primary} Service`} />
      </div>
      <div aria-hidden="true" className="h-[72px]" />
      <PremiumStickyTrust
        ratingAvg={listing.rating_avg}
        ratingCount={listing.rating_count}
        whatsappHref={waUrl}
      />
    </main>
  );
}
