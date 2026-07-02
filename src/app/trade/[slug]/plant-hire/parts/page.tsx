// /<slug>/plant-hire/parts — full trade counter product catalogue. Hero
// with image on the right; search + filter + grid + featured carousel
// below. Handles hundreds of SKUs via client-side filter + pagination.

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
import { PlantPartsCounterClient } from "@/components/xrated/profile/PlantPartsCounterClient";
import { PlantCdmPackSection } from "@/components/xrated/profile/PlantHireTier2Sections";

export const revalidate = 60;

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Trade counter — parts + spares — ${slug}`,
    alternates: { canonical: `/${slug}/plant-hire/parts` }
  };
}

export default async function PartsCounterPage({
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
  if (!cfg.parts_counter.enabled) redirect(`/${slug}/plant-hire`);

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

  const pc = cfg.parts_counter;
  const waDigits = pc.whatsapp.replace(/[^\d]/g, "");
  const phoneDigits = pc.phone.replace(/[^\d+]/g, "");
  const counterWaHref = waDigits ? `https://wa.me/${waDigits}` : wa ? `https://wa.me/${wa}` : null;

  return (
    <main className="flex flex-1 flex-col bg-neutral-50 pb-16">
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
        <span className="text-neutral-900">Trade counter</span>
      </nav>

      {/* Hero — text left, image right */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex flex-col-reverse items-stretch gap-0 md:flex-row md:items-center">
            <div className="flex-1 py-6 pl-5 pr-1 sm:pl-6 md:py-8 md:pr-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
                Trade counter · Spares + parts + manuals
              </p>
              <h1 className="mt-1 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl md:text-[44px]">
                {pc.heading}
              </h1>
              <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-neutral-600">
                {pc.subheading}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-neutral-600">
                <span className="rounded-full bg-neutral-100 px-3 py-1">{pc.hours_summary}</span>
                {pc.same_day_cutoff && (
                  <span className="rounded-full bg-neutral-100 px-3 py-1">
                    🚚 {pc.same_day_cutoff}
                  </span>
                )}
                {pc.delivery_available && (
                  <span className="rounded-full bg-neutral-100 px-3 py-1">Delivery available</span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {phoneDigits && (
                  <a
                    href={`tel:${phoneDigits}`}
                    className="inline-flex h-11 items-center rounded-xl bg-[#FFB300] px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 hover:brightness-95"
                  >
                    📞 {pc.phone}
                  </a>
                )}
                {waDigits && (
                  <a
                    href={`https://wa.me/${waDigits}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-95"
                    style={{ background: "#25D366" }}
                  >
                    💬 WhatsApp counter
                  </a>
                )}
                {pc.manual_library_url && (
                  <a
                    href={pc.manual_library_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center rounded-xl bg-[#FFB300] px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-900 hover:brightness-95"
                  >
                    📄 Manual library
                  </a>
                )}
              </div>
            </div>
            <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden md:aspect-square md:w-[320px] lg:w-[400px]">
              {pc.hero_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pc.hero_image_url}
                  alt="Trade counter"
                  loading="lazy"
                  className="absolute inset-0 h-full w-full max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="absolute inset-0 grid h-full w-full place-items-center bg-neutral-50 text-[10px] font-extrabold uppercase text-neutral-400">
                  Hero image pending
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Category tiles */}
      {pc.categories.length > 0 && (
        <section className="mx-auto mt-8 w-full max-w-6xl px-4 sm:px-6">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
            Browse by category
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {pc.categories.map((c, i) => (
              <li
                key={c.name + i}
                className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-extrabold leading-tight text-neutral-900">
                    {c.name}
                  </p>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest ${
                      c.in_stock ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {c.in_stock ? "In stock" : "To order"}
                  </span>
                </div>
                {c.description && (
                  <p className="text-[11px] leading-relaxed text-neutral-600">{c.description}</p>
                )}
                {c.lead_time && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                    Lead time · {c.lead_time}
                  </p>
                )}
                {c.manual_url && (
                  <a
                    href={c.manual_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex h-8 w-fit items-center rounded-lg bg-[#FFB300] px-2.5 text-[10px] font-extrabold uppercase tracking-widest text-neutral-900 hover:brightness-95"
                  >
                    📄 Manual
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Search + product grid + featured carousel */}
      <section className="mx-auto mt-8 w-full max-w-6xl px-4 sm:px-6">
        <PlantPartsCounterClient
          items={pc.items}
          categories={pc.categories}
          waHref={counterWaHref}
          merchantName={merchantName}
        />
      </section>

      {/* CDM 2015 · Site safety pack — surfaced on the trade counter
       *  page so customers see it while browsing spare parts. */}
      {cfg.cdm_pack.enabled && (
        <section className="mx-auto mt-8 w-full max-w-6xl px-4 sm:px-6">
          <PlantCdmPackSection
            cfg={cfg.cdm_pack}
            merchantSlug={listing.slug}
            waHref={wa ? `https://wa.me/${wa}` : null}
          />
        </section>
      )}

      {/* Terms */}
      {pc.terms_of_service && (
        <section className="mx-auto mt-8 w-full max-w-6xl px-4 sm:px-6">
          <details className="rounded-2xl border border-neutral-200 bg-white p-4">
            <summary className="cursor-pointer text-[11px] font-extrabold uppercase tracking-widest text-neutral-700">
              Trade counter terms of service
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-neutral-600">
              {pc.terms_of_service}
            </p>
          </details>
        </section>
      )}

      <div className="mt-auto pt-12">
        <TradeProfileFooter listing={listing} appName={`${primary} Service`} />
      </div>
    </main>
  );
}
