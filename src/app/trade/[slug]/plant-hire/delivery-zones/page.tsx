// /<slug>/plant-hire/delivery-zones — dedicated page showing the merchant's
// plant-hire delivery zones as a green / yellow / red map (mirrors the
// building-merchants Yard delivery zones system: YardMapPreview + zone
// rate cards + postcode lookup that pins the customer + highlights
// the matched zone).

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
import { isPlantHireConfigured, normalisePlantHireConfig } from "@/lib/plantHire";
import { PlantHireDeliveryZonesMapClient } from "@/components/xrated/profile/PlantHireDeliveryZonesMapClient";
import { PlantHireGetDirectionsCard } from "@/components/xrated/profile/PlantHireGetDirectionsCard";

export const revalidate = 60;

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Plant Hire Delivery Zones — ${slug}`,
    alternates: { canonical: `/${slug}/plant-hire/delivery-zones` }
  };
}

export default async function PlantHireDeliveryZonesPage({
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

  const enquireOnWa = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(
        `Hi ${merchantName}, checking your delivery zones for plant hire.`
      )}`
    : "#";

  const waFallback = adminWhatsapp();
  const waFinal = wa || waFallback;
  const waUrl = waFinal
    ? `https://wa.me/${waFinal}?text=${encodeURIComponent(
        `Hi ${merchantName}, checking your delivery zones for plant hire.`
      )}`
    : "#";

  const heroTier =
    tier === "app_paid" || tier === "app_verified"
      ? "paid"
      : tier === "app_trial"
        ? "paid"
        : "free";

  const yardLat = listing.wholesale_origin_lat;
  const yardLng = listing.wholesale_origin_lng;
  const hasCoords = typeof yardLat === "number" && typeof yardLng === "number";

  return (
    <main className="flex flex-1 flex-col bg-white pb-24">
      <TradeProfileHeader listing={listing} appName={`${primary} Service`} backHref={`/${slug}`} />
      <PremiumHero listing={listing} waUrl={waUrl} currentPage="contact" tier={heroTier} />

      {/* Breadcrumb */}
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
        <span className="text-neutral-900">Delivery zones</span>
      </nav>

      {/* Header */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
          Plant Hire · Delivery Zones
        </p>
        <h1 className="mt-1 text-3xl font-extrabold text-neutral-900 sm:text-4xl">
          Where we deliver, at a glance.
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
          Green = free zone, yellow = regional, red = national edge. Enter your postcode below to see which zone your job falls in.
        </p>
      </section>

      {/* Map + legend + zones + postcode input */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        {hasCoords ? (
          <PlantHireDeliveryZonesMapClient
            yardLat={yardLat as number}
            yardLng={yardLng as number}
            yardLabel={merchantName.split(/\s+/)[0]}
            zones={cfg.delivery_zones}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-[13px] text-neutral-600">
            The yard coordinates aren&rsquo;t set yet — the map opens once the merchant configures them.
            <br />
            Zones offered:{" "}
            <ul className="mt-2 space-y-0.5">
              {cfg.delivery_zones.map((z, i) => (
                <li key={i}>
                  <span className="font-bold">{z.label}</span>
                  {z.note ? ` — ${z.note}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* How to get to us — depot address + Get directions button */}
      {(cfg.yard_address || cfg.depot_postcode || listing.lat) && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
          <PlantHireGetDirectionsCard
            yardAddress={cfg.yard_address}
            depotPostcode={cfg.depot_postcode}
            lat={listing.lat}
            lng={listing.lng}
            merchantName={merchantName}
          />
        </section>
      )}

      {/* CTA to WhatsApp */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
        <div
          className="rounded-3xl p-6 text-white sm:p-8"
          style={{ background: "#111827" }}
        >
          <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-[#FFB300]">
            Not sure?
          </p>
          <h3 className="mt-1 text-2xl font-extrabold sm:text-3xl">
            WhatsApp us your site postcode — we&rsquo;ll quote in minutes.
          </h3>
          <a
            href={enquireOnWa}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex h-12 items-center gap-2 rounded-xl px-5 text-[13px] font-extrabold uppercase tracking-widest text-white transition hover:opacity-90"
            style={{ background: "#0F7A3F" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
            </svg>
            WhatsApp for a quote
          </a>
        </div>
      </section>

      <div className="mt-auto pt-12">
        <TradeProfileFooter listing={listing} appName={`${primary} Service`} />
      </div>
      <div aria-hidden="true" className="h-[72px]" />
      <PremiumStickyTrust
        ratingAvg={listing.rating_avg}
        ratingCount={listing.rating_count}
        whatsappHref={enquireOnWa}
      />
    </main>
  );
}
