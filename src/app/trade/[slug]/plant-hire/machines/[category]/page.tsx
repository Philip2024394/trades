// /<slug>/plant-hire/machines/[category] — individual machine detail
// page. The "ultimate machine product page" — hero gallery, price
// panel with hire dates, spec table, description, machine size modal,
// docs, reviews, related machines, delivery calc, buy-now.
//
// Every field editable via existing PlantHireEditor — this page is a
// dedicated renderer of what's already in plant_hire.categories[slug].

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
  formatPounds,
  isCategoryCartEnabled,
  isPlantHireConfigured,
  mergeSpecs,
  nextAvailableAfterBlocks,
  normalisePlantHireConfig,
  type PlantCategorySlug
} from "@/lib/plantHire";
import { PlantHireEnquire } from "@/components/xrated/profile/PlantHireEnquire";
import { PlantAddToCartButton } from "@/components/xrated/profile/PlantAddToCartButton";
import { PlantMachineImageModal } from "@/components/xrated/profile/PlantMachineImageModal";
import { MachineSizeModal } from "@/components/xrated/profile/MachineSizeModal";
import { MachineRunningBanner } from "@/components/xrated/profile/MachineRunningBanner";
import { MachineGalleryStrip } from "@/components/xrated/profile/MachineGalleryStrip";
import { MachineDescription } from "@/components/xrated/profile/MachineDescription";
import { MachineReviewsSection } from "@/components/xrated/profile/MachineReviewsSection";
import { MachineImageCarousel } from "@/components/xrated/profile/MachineImageCarousel";
import { MachineOverviewTabs } from "@/components/xrated/profile/MachineOverviewTabs";

export const revalidate = 60;

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string; category: string }>;
}): Promise<Metadata> {
  const { slug, category } = await params;
  const meta = PLANT_CATEGORIES.find((m) => m.slug === (category as PlantCategorySlug));
  const title = meta ? `${meta.label} hire — ${slug}` : `Machine — ${slug}`;
  return {
    title,
    alternates: { canonical: `/${slug}/plant-hire/machines/${category}` }
  };
}

export default async function MachineDetailPage({
  params
}: {
  params: Promise<{ slug: string; category: string }>;
}) {
  const { slug, category } = await params;
  const meta = PLANT_CATEGORIES.find((m) => m.slug === (category as PlantCategorySlug));
  if (!meta) notFound();

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

  const c = cfg.categories[meta.slug];
  if (!c?.enabled) notFound();

  const specs = mergeSpecs(meta.slug, c?.specs);
  const wa = whatsappDigits(listing.whatsapp ?? "");
  const primary = tradeLabel(listing.primary_trade);
  const merchantName = listing.display_name ?? slug;
  const waFallback = adminWhatsapp();
  const waUrl = wa || waFallback ? `https://wa.me/${wa || waFallback}` : "#";
  const heroTier =
    tier === "app_paid" || tier === "app_verified" ? "paid" : tier === "app_trial" ? "paid" : "free";

  const today = new Date().toISOString().slice(0, 10);
  const onHire = (c?.blocked_ranges ?? []).some((r) => today >= r.from && today <= r.to);
  const nextFreeIso = onHire ? nextAvailableAfterBlocks(today, c?.blocked_ranges ?? []) : null;

  // Related — compatible attachments + a couple of siblings from the
  // same category family.
  const relatedSlugs = new Set<string>(c?.compatible_attachments ?? []);
  // If merchant hasn't set compat, pick 3 other enabled categories.
  if (relatedSlugs.size === 0) {
    for (const m of PLANT_CATEGORIES) {
      if (m.slug === meta.slug) continue;
      if (cfg.categories[m.slug]?.enabled) {
        relatedSlugs.add(m.slug);
        if (relatedSlugs.size >= 3) break;
      }
    }
  }
  const related = PLANT_CATEGORIES.filter(
    (m) => relatedSlugs.has(m.slug) && cfg.categories[m.slug]?.enabled
  ).slice(0, 4);

  const galleryUrls = [
    ...(c?.image_url ? [c.image_url] : []),
    ...(c?.gallery_urls ?? [])
  ];
  const canBuy = c?.for_sale === true && (c.sale_price_pence ?? 0) > 0;

  // Machine size button uses transport dims.
  const hasAnyDims =
    specs.transport_length_mm ||
    specs.transport_width_mm ||
    specs.transport_height_mm ||
    specs.weight_kg;

  return (
    <main className="flex flex-1 flex-col bg-white pb-24">
      <TradeProfileHeader listing={listing} appName={`${primary} Service`} backHref={`/${slug}`} />
      <PremiumHero listing={listing} waUrl={waUrl} currentPage="contact" tier={heroTier} />

      {/* Per-machine running announcement — merchant editable per
       *  category. Empty string = no banner. */}
      {c.running_text && c.running_text.trim().length > 0 && (
        <MachineRunningBanner text={c.running_text} />
      )}

      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-4 pt-6 text-[11px] font-bold uppercase tracking-widest text-neutral-500 sm:px-6"
      >
        <Link href={`/${slug}`} className="transition hover:text-[#FFB300]">
          {merchantName}
        </Link>
        <span aria-hidden="true">›</span>
        <Link href={`/${slug}/plant-hire`} className="transition hover:text-[#FFB300]">
          Plant Hire
        </Link>
        <span aria-hidden="true">›</span>
        <Link href={`/${slug}/plant-hire/machines`} className="transition hover:text-[#FFB300]">
          All machines
        </Link>
        <span aria-hidden="true">›</span>
        <span className="text-neutral-900">{meta.label}</span>
      </nav>

      {/* Hero row */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_1fr]">
          {/* LEFT: gallery — interactive 3-thumbnail carousel with yellow
           *  indicator bar. Availability badge floats top-left over the
           *  main image; video slot renders separately below. */}
          <div className="relative flex flex-col gap-3">
            <span
              className="pointer-events-none absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest shadow-md"
              style={
                onHire
                  ? { background: "#FEE2E2", color: "#991B1B" }
                  : { background: "#DCFCE7", color: "#166534" }
              }
              aria-hidden="true"
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: onHire ? "#DC2626" : "#22C55E" }}
              />
              {onHire ? `On hire until ${fmtNiceDate(nextFreeIso)}` : "Available today"}
            </span>
            {c.image_url ? (
              <MachineImageCarousel
                mainImage={c.image_url}
                galleryUrls={galleryUrls}
                videoUrl={c.video_url}
                label={meta.label}
                buyNowSalePricePence={canBuy ? c.sale_price_pence : null}
                buyNowSaleYear={canBuy ? c.sale_year : null}
                buyNowWaHref={wa ? `https://wa.me/${wa}` : null}
                merchantName={merchantName}
              />
            ) : (
              <div className="grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
                <span className="text-[64px]" aria-hidden="true">
                  {meta.emoji}
                </span>
              </div>
            )}
          </div>

          {/* RIGHT: title + price + booking. Extra top spacing on mobile
           *  so the title reads well clear of the thumbnail row above
           *  before it collapses beside the gallery on desktop. */}
          <div className="mt-6 flex flex-col gap-4 lg:mt-0">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
                Plant Hire · {meta.label}
              </p>
              <h1 className="mt-1 text-3xl font-extrabold text-neutral-900 sm:text-4xl">
                {meta.label}
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-2">
                {specs.weight_kg && (
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-800">
                    {specs.weight_kg.toLocaleString()} kg
                  </span>
                )}
                {specs.hp && (
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-800">
                    {specs.hp} hp
                  </span>
                )}
                {c.sale_year && (
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-800">
                    {c.sale_year}
                  </span>
                )}
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest"
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
                  {onHire ? `On hire until ${fmtNiceDate(nextFreeIso)}` : "Available today"}
                </span>
              </p>
            </div>

            {c.rating && c.rating.count > 0 && (
              <p className="text-[13px] font-bold text-neutral-800">
                <span style={{ color: "#FFB300" }}>★</span> {c.rating.avg.toFixed(1)} · {c.rating.count} reviews
              </p>
            )}

            <MachineOverviewTabs
              shortDesc={meta.short_desc}
              longDesc={c.note}
              specs={specs}
              saleYear={c.sale_year}
              saleHoursUsed={c.sale_hours_used}
              depotPostcode={cfg.depot_postcode}
              yardAddress={cfg.yard_address}
              zones={cfg.delivery_zones}
              fuelPolicy={cfg.fuel_policy}
            />

            {/* Rate table */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                Hire rates
              </p>
              <ul className="mt-2 grid grid-cols-3 gap-2 text-center">
                <li>
                  <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">Day</p>
                  <p className="mt-0.5 text-[16px] font-extrabold text-neutral-900">{formatPounds(c.price_day_pence)}</p>
                </li>
                <li>
                  <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">Week</p>
                  <p className="mt-0.5 text-[16px] font-extrabold text-neutral-900">{formatPounds(c.price_week_pence)}</p>
                </li>
                <li>
                  <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">Month</p>
                  <p className="mt-0.5 text-[16px] font-extrabold text-neutral-900">{formatPounds(c.price_month_pence)}</p>
                </li>
              </ul>
              {c.operator_premium_day_pence !== null && c.operator_premium_day_pence > 0 && (
                <p className="mt-2 text-[12px] text-neutral-700">
                  <span className="font-bold text-neutral-900">
                    + {formatPounds(c.operator_premium_day_pence)}/day
                  </span>{" "}
                  with CPCS operator
                </p>
              )}
            </div>

            {/* Booking card */}
            {isCategoryCartEnabled(c, meta) && (
              <PlantHireEnquire
                merchantName={merchantName}
                categoryLabel={meta.label}
                categorySlug={meta.slug}
                dayPricePence={c?.price_day_pence ?? null}
                weekPricePence={c?.price_week_pence ?? null}
                monthPricePence={c?.price_month_pence ?? null}
                operatorPremiumDayPence={
                  cfg.modes.operator ? c?.operator_premium_day_pence ?? null : null
                }
                buyNowSalePricePence={canBuy ? c.sale_price_pence : null}
                buyNowSaleYear={canBuy ? c.sale_year : null}
                breakEvenNudge={cfg.sections_enabled.break_even_nudge}
                blockedRanges={c?.blocked_ranges ?? []}
                depotPostcode={cfg.sections_enabled.postcode_calculator ? cfg.depot_postcode : ""}
                zones={cfg.sections_enabled.postcode_calculator ? cfg.delivery_zones : []}
                waHref={wa ? `https://wa.me/${wa}` : null}
              />
            )}

            {/* Machine size button */}
            {(hasAnyDims || c.dimension_diagram_url) && (
              <MachineSizeModal
                label={meta.label}
                categorySlug={meta.slug}
                imageUrl={c.image_url}
                diagramUrl={c.dimension_diagram_url}
                specs={specs}
              />
            )}

            {/* Add to hire list + book link */}
            {isCategoryCartEnabled(c, meta) && (
              <>
                <PlantAddToCartButton
                  merchantSlug={listing.slug}
                  slug={meta.slug}
                  label={meta.label}
                  dayPricePence={c.price_day_pence}
                  weekPricePence={c.price_week_pence}
                  monthPricePence={c.price_month_pence}
                  wetDayPricePence={c.wet_price_day_pence ?? null}
                />
                <Link
                  href={`/${listing.slug}/plant-hire/book?machine=${meta.slug}`}
                  className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:border-[#FFB300]"
                >
                  Book with dates + delivery →
                </Link>
              </>
            )}

            {/* Buy Now is now embedded inside the Book This Machine card
             *  (paired beside the Enquire button) — see PlantHireEnquire's
             *  buyNowSalePricePence prop above. */}
          </div>
        </div>
      </section>

      {/* Description — 8-line clamp with Show more / Show less toggle. */}
      {c.note && <MachineDescription text={c.note} />}

      {/* Specs table */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Technical specifications
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {buildSpecRows(specs, c.sale_year, c.sale_hours_used).map((row) => (
            <div
              key={row.label}
              className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3"
            >
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
                style={{ background: "#FFF8E1", color: "#0A0A0A" }}
              >
                <SpecIcon kind={row.icon} />
              </span>
              <div className="min-w-0 flex-1">
                <dt className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                  {row.label}
                </dt>
                <dd className="mt-0.5 truncate text-[14px] font-extrabold text-neutral-900">
                  {row.value}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      {/* Downloads */}
      {(c.brochure_pdf_url || c.loler_cert_url) && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
          <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">Downloads</h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            {c.brochure_pdf_url && (
              <li>
                <a
                  href={c.brochure_pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-800 transition hover:border-[#FFB300]"
                >
                  ↓ Spec sheet PDF
                </a>
              </li>
            )}
            {c.loler_cert_url && (
              <li>
                <a
                  href={c.loler_cert_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-800 transition hover:border-[#FFB300]"
                >
                  ↓ LOLER cert
                </a>
              </li>
            )}
          </ul>
        </section>
      )}

      {/* Video */}
      {c.video_url && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
          <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">Video walkaround</h2>
          <a
            href={c.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex h-11 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-[12px] font-extrabold text-neutral-900 transition hover:border-[#FFB300]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            Watch on YouTube
          </a>
        </section>
      )}

      {/* Reviews — full section (grid + view modal + leave-review modal) */}
      <MachineReviewsSection
        reviews={c.reviews ?? []}
        machineLabel={meta.label}
        machineImageUrl={c.image_url}
        merchantName={merchantName}
        waHref={wa ? `https://wa.me/${wa}` : null}
      />


      {/* Related / Frequently hired with */}
      {related.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
          <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
            Frequently hired with
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {related.map((m) => {
              const rc = cfg.categories[m.slug];
              return (
                <li key={m.slug}>
                  <Link
                    href={`/${slug}/plant-hire/machines/${m.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:border-[#FFB300]"
                  >
                    <span className="relative block aspect-square w-full overflow-hidden bg-neutral-50">
                      {rc?.image_url && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={rc.image_url}
                          alt={m.label}
                          className="absolute inset-0 h-full w-full object-contain transition group-hover:scale-105"
                        />
                      )}
                    </span>
                    <div className="flex flex-col gap-1 p-3">
                      <p className="text-[12px] font-extrabold text-neutral-900">{m.label}</p>
                      <p className="text-[11px] font-bold text-neutral-700">
                        from {formatPounds(rc?.price_day_pence)}/day
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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

function fmtNiceDate(iso: string | null): string {
  if (!iso) return "soon";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

type SpecIconKind =
  | "weight"
  | "power"
  | "fuel"
  | "emission"
  | "depth"
  | "reach"
  | "bucket"
  | "length"
  | "width"
  | "height"
  | "year"
  | "hours";

function buildSpecRows(
  specs: import("@/lib/plantHire").PlantSpec,
  year: number | null | undefined,
  hoursUsed: number | null | undefined
): { label: string; value: string; icon: SpecIconKind }[] {
  const rows: { label: string; value: string; icon: SpecIconKind }[] = [];
  if (specs.weight_kg)
    rows.push({ label: "Operating weight", value: `${specs.weight_kg.toLocaleString()} kg`, icon: "weight" });
  if (specs.hp) rows.push({ label: "Power", value: `${specs.hp} hp`, icon: "power" });
  if (specs.fuel_type)
    rows.push({
      label: "Fuel",
      value:
        specs.fuel_type === "diesel"
          ? "Diesel"
          : specs.fuel_type === "petrol"
            ? "Petrol"
            : specs.fuel_type === "electric"
              ? "Electric"
              : "Hybrid",
      icon: "fuel"
    });
  if (specs.emission)
    rows.push({
      label: "Emission",
      value:
        specs.emission === "stage_v" ? "Stage V" : specs.emission === "stage_iiib" ? "Stage IIIB" : "Euro 6",
      icon: "emission"
    });
  if (specs.dig_depth_mm)
    rows.push({ label: "Max dig depth", value: `${(specs.dig_depth_mm / 1000).toFixed(2)} m`, icon: "depth" });
  if (specs.reach_mm) rows.push({ label: "Max reach", value: `${(specs.reach_mm / 1000).toFixed(2)} m`, icon: "reach" });
  if (specs.bucket_l) rows.push({ label: "Bucket capacity", value: `${specs.bucket_l} L`, icon: "bucket" });
  if (specs.transport_length_mm)
    rows.push({ label: "Transport length", value: `${(specs.transport_length_mm / 1000).toFixed(2)} m`, icon: "length" });
  if (specs.transport_width_mm)
    rows.push({ label: "Transport width", value: `${(specs.transport_width_mm / 1000).toFixed(2)} m`, icon: "width" });
  if (specs.transport_height_mm)
    rows.push({ label: "Transport height", value: `${(specs.transport_height_mm / 1000).toFixed(2)} m`, icon: "height" });
  if (year) rows.push({ label: "Year", value: String(year), icon: "year" });
  if (hoursUsed !== null && hoursUsed !== undefined)
    rows.push({ label: "Hours (this unit)", value: hoursUsed.toLocaleString(), icon: "hours" });
  return rows;
}

function SpecIcon({ kind }: { kind: SpecIconKind }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };
  switch (kind) {
    case "weight":
      return (
        <svg {...common}>
          <path d="M6 3h12l-1 4H7z" />
          <path d="M5 7h14l2 14H3z" />
          <path d="M12 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
        </svg>
      );
    case "power":
      return (
        <svg {...common}>
          <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
        </svg>
      );
    case "fuel":
      return (
        <svg {...common}>
          <path d="M4 21h11V4H4z" />
          <path d="M15 8h3l2 2v9a2 2 0 0 1-2 2h-1" />
          <path d="M8 8h3" />
        </svg>
      );
    case "emission":
      return (
        <svg {...common}>
          <path d="M12 2a6 6 0 0 0-6 6c0 5 6 12 6 12s6-7 6-12a6 6 0 0 0-6-6z" />
          <path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
        </svg>
      );
    case "depth":
      return (
        <svg {...common}>
          <path d="M12 3v14" />
          <path d="m6 13 6 6 6-6" />
          <path d="M4 21h16" />
        </svg>
      );
    case "reach":
      return (
        <svg {...common}>
          <path d="M3 12h18" />
          <path d="m6 7-5 5 5 5" />
          <path d="m18 7 5 5-5 5" />
        </svg>
      );
    case "bucket":
      return (
        <svg {...common}>
          <path d="M5 8h14l-2 12H7z" />
          <path d="M9 4h6l1 4H8z" />
        </svg>
      );
    case "length":
      return (
        <svg {...common}>
          <path d="M3 12h18" />
          <path d="M6 8v8" />
          <path d="M18 8v8" />
        </svg>
      );
    case "width":
      return (
        <svg {...common}>
          <path d="M12 3v18" />
          <path d="M8 6h8" />
          <path d="M8 18h8" />
        </svg>
      );
    case "height":
      return (
        <svg {...common}>
          <path d="M12 3v18" />
          <path d="m6 8 6-6 6 6" />
          <path d="m6 16 6 6 6-6" />
        </svg>
      );
    case "year":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 3v4M16 3v4" />
        </svg>
      );
    case "hours":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
  }
}
