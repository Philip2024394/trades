// Customer-facing /<slug>/plant-hire sub-page.
//
// Structure mirrors /key-cutting:
//   1. TradeProfileHeader + shared PremiumHero
//   2. Optional promo banner
//   3. Title row (kicker + H1 + custom note + illustration)
//   4. Trust bar (years, CPA T&Cs, hired-in insurance, CPCS ops)
//   5. Trust & Benefits (yellow-tick strip)
//   6. Fleet brands (logos)
//   7. What we hire — 12 category tiles with day/week/month + operator
//   8. How to hire — 4 mode tiles (collect / delivery / operator / long-term)
//   9. Delivery zones + rates
//  10. Damage waiver options
//  11. Long-term / bulk tiers ladder + WA quote button
//  12. Trade customers pills
//  13. Related products cross-sell
//  14. FAQ accordion
//  15. Sticky footer + shared TradeProfileFooter

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

const PLANT_HIRE_ILLUSTRATION_FALLBACK =
  "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%201,%202026,%2010_17_59%20PM.png?updatedAt=1782919107938";

import {
  PLANT_CATEGORIES,
  formatPriceFrom,
  formatPounds,
  isCategoryCartEnabled,
  isPlantHireConfigured,
  nextAvailableAfterBlocks,
  normalisePlantHireConfig
} from "@/lib/plantHire";
import { PlantHireEnquire } from "@/components/xrated/profile/PlantHireEnquire";
import { PlantHireCategoryDetail } from "@/components/xrated/profile/PlantHireCategoryDetail";
import { PlantHireFilterBar } from "@/components/xrated/profile/PlantHireFilterBar";
import { PlantMachineImageModal } from "@/components/xrated/profile/PlantMachineImageModal";
import { PlantHireQuickNav } from "@/components/xrated/profile/PlantHireQuickNav";
import { PlantCartBadge } from "@/components/xrated/profile/PlantCartBadge";

// Rendered under each tile when the merchant has set blocked dates.
// Splits into: "On hire until DD Mmm" (when a range covers today) +
// list of upcoming ranges (transparency signal).
function BlockedDatesBanner({
  ranges
}: {
  ranges: { from: string; to: string; note?: string }[] | undefined;
}) {
  if (!ranges || ranges.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const nextFree = nextAvailableAfterBlocks(today, ranges);
  const upcoming = ranges
    .filter((r) => r.to >= today)
    .slice()
    .sort((a, b) => (a.from < b.from ? -1 : 1))
    .slice(0, 3);
  if (upcoming.length === 0) return null;

  function fmt(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-2">
      {nextFree ? (
        <p className="text-[11px] font-extrabold text-red-600">
          On hire until {fmt(nextFree)}
        </p>
      ) : (
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Booked dates
        </p>
      )}
      <ul className="mt-1 flex flex-wrap gap-1">
        {upcoming.map((r, i) => (
          <li
            key={i}
            className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-700 ring-1 ring-neutral-200"
            title={r.note}
          >
            {fmt(r.from)}
            {r.from !== r.to ? ` – ${fmt(r.to)}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const revalidate = 60;

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Plant Hire — ${slug}`,
    alternates: { canonical: `/${slug}/plant-hire` }
  };
}

export default async function PlantHirePage({
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

  const enabledCategories = PLANT_CATEGORIES.map((meta) => ({
    meta,
    c: cfg.categories[meta.slug]
  })).filter((row) => row.c?.enabled);

  const relatedCategories =
    cfg.related_product_categories.length > 0
      ? cfg.related_product_categories
      : ["safety_workwear", "hand_tools", "fuel_lubricants"];
  const relatedRes = await supabase
    .from("hammerex_xrated_products")
    .select("id, slug, name, price_pence, cover_url, merchant_category")
    .eq("listing_id", listing.id)
    .eq("status", "live")
    .in("merchant_category", relatedCategories)
    .limit(8);
  const relatedProducts = (relatedRes.data ?? []) as {
    id: string;
    slug: string | null;
    name: string;
    price_pence: number;
    cover_url: string | null;
    merchant_category: string | null;
  }[];

  const wa = whatsappDigits(listing.whatsapp ?? "");
  const primary = tradeLabel(listing.primary_trade);
  const merchantName = listing.display_name ?? slug;

  const enquireOnWa = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(
        `Hi ${merchantName}, I'd like to enquire about plant hire. Machine: [ … ]. Start date: [ … ]. Duration: [ … ]. Delivery or collect: [ … ]. With operator: [ yes / no ].`
      )}`
    : "#";

  const waFallback = adminWhatsapp();
  const waFinal = wa || waFallback;
  const waUrl = waFinal
    ? `https://wa.me/${waFinal}?text=${encodeURIComponent(
        `Hi ${merchantName}, I'd like to enquire about plant hire.`
      )}`
    : "#";

  const heroTier =
    tier === "app_paid" || tier === "app_verified" ? "paid" : tier === "app_trial" ? "paid" : "free";

  const H1 = cfg.headline_text || "Every Machine You Need. On Your Site.";
  const headings = {
    trust_benefits: cfg.section_headings.trust_benefits || "Why customers hire from us",
    brands: cfg.section_headings.brands || "Fleet brands",
    what_we_hire: cfg.section_headings.what_we_hire || "What we hire",
    how_to_hire: cfg.section_headings.how_to_hire || "How to hire from us",
    delivery: cfg.section_headings.delivery || "Delivery zones + rates",
    waivers: cfg.section_headings.waivers || "Damage waiver options",
    bulk: cfg.section_headings.bulk || "Long-term & bulk hires",
    trade_customers: cfg.section_headings.trade_customers || "Trade customers we serve",
    related_products: cfg.section_headings.related_products || "While you're here",
    faq: cfg.section_headings.faq || "Frequently asked questions"
  };
  const defaultExplanatoryParagraphs = [
    "The full plant hire fleet — everything from a 0.8T micro digger for a garden path to a 14T excavator for a full site strip. Every machine is CPA-standard: you get a maintained, serviced machine with a walk-round check on delivery and a 24/7 breakdown line printed on the cab.",
    "Prices below are 'from £X' — the day rate for the smallest machine in the category. Larger models and attachments carry their own uplift; WhatsApp us for a firm quote if you're not sure which size you need. Weekly hire is roughly 3-4× the day rate; monthly is roughly 3× the weekly rate. Long-term contracts (2+ weeks) unlock the tier discount ladder further down the page.",
    "Self-drive by default. If you need a CPCS-carded operator we can supply one at the day-rate premium shown. Not sure which machine? Send a WhatsApp with a photo of the job — we'll spec it and quote."
  ];
  const explanatoryParagraphs =
    cfg.explanatory_paragraphs.length > 0 ? cfg.explanatory_paragraphs : defaultExplanatoryParagraphs;
  const modeBodies = {
    collect:
      cfg.mode_bodies.collect ||
      `Collect from our yard${cfg.yard_open_from && cfg.yard_open_to ? ` ${cfg.yard_open_from}–${cfg.yard_open_to}` : ""}. Bring photo ID + a utility bill, deposit on card pre-auth. No trade account needed.`,
    delivery:
      cfg.mode_bodies.delivery ||
      "Same-day local delivery in our free zone, next-day national further out. See the Delivery section for zone rates.",
    operator:
      cfg.mode_bodies.operator ||
      "CPCS-carded operators supplied at the day-rate premium shown. Book 24h in advance for standard machines, 48h for larger plant.",
    long_term:
      cfg.mode_bodies.long_term ||
      "2-week+ hires get automatic tier discount. Long-term contracts (3+ months) get invoice-billed with waived deposit against a trade account."
  };

  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${H1} — Plant Hire`,
    serviceType: "Plant Hire",
    provider: {
      "@type": "LocalBusiness",
      name: merchantName,
      address: cfg.yard_address
        ? { "@type": "PostalAddress", streetAddress: cfg.yard_address }
        : undefined,
      telephone: listing.whatsapp ?? undefined
    },
    areaServed: cfg.yard_address ? "United Kingdom" : undefined,
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Plant Hire Services",
      itemListElement: enabledCategories.map(({ meta, c }) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: meta.label, description: meta.short_desc },
        priceSpecification: c?.price_day_pence
          ? {
              "@type": "PriceSpecification",
              price: (c.price_day_pence / 100).toFixed(2),
              priceCurrency: "GBP",
              unitCode: "DAY"
            }
          : undefined
      }))
    }
  };
  const faqLd =
    cfg.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: cfg.faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a }
          }))
        }
      : null;

  const fuelPolicyLabel =
    cfg.fuel_policy === "refuel_on_return"
      ? "Refuel on return"
      : cfg.fuel_policy === "pay_refuel_charge"
        ? `Refuel charge: ${cfg.fuel_refuel_pence_per_litre ? `${formatPounds(cfg.fuel_refuel_pence_per_litre)}/L` : "quoted"}`
        : cfg.fuel_policy === "diesel_included"
          ? "Diesel included"
          : "Electric fleet — charge included";

  return (
    <main className="flex flex-1 flex-col bg-white pb-24">
      <TradeProfileHeader listing={listing} appName={`${primary} Service`} backHref={`/${slug}`} />

      <PlantHireQuickNav merchantSlug={listing.slug} cfg={cfg} />
      <PlantCartBadge merchantSlug={listing.slug} />

      <PremiumHero listing={listing} waUrl={waUrl} currentPage="contact" tier={heroTier} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceLd) }}
      />
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      )}

      {cfg.promo_banner.enabled && cfg.promo_banner.text.trim().length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
            style={{ background: "#FFB300", color: "#0A0A0A" }}
          >
            <p className="text-[13px] font-extrabold sm:text-[14px]">{cfg.promo_banner.text}</p>
            {cfg.promo_banner.cta_label && cfg.promo_banner.cta_href && (
              <a
                href={cfg.promo_banner.cta_href}
                target={cfg.promo_banner.cta_href.startsWith("http") ? "_blank" : undefined}
                rel={
                  cfg.promo_banner.cta_href.startsWith("http") ? "noopener noreferrer" : undefined
                }
                className="inline-flex h-9 items-center rounded-lg bg-neutral-900 px-3 text-[11px] font-extrabold uppercase tracking-widest text-white transition hover:opacity-90"
              >
                {cfg.promo_banner.cta_label} →
              </a>
            )}
          </div>
        </section>
      )}

      {/* Title row. */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
              Plant Hire
            </p>
            <h1 className="mt-1 text-3xl font-extrabold text-neutral-900 sm:text-4xl">{H1}</h1>
            {cfg.custom_note && (
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-neutral-600">
                {cfg.custom_note}
              </p>
            )}
          </div>
          <div className="order-first flex justify-center sm:order-last">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cfg.illustration_image_url || PLANT_HIRE_ILLUSTRATION_FALLBACK}
              alt=""
              aria-hidden="true"
              className="h-32 w-auto object-contain sm:h-40 md:h-48"
            />
          </div>
        </div>
      </section>

      {/* Trust bar. */}
      {(cfg.years_hiring ||
        cfg.cpa_terms ||
        cfg.hired_in_insured ||
        cfg.cpcs_operators ||
        cfg.turnaround_text) && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
          <ul className="flex flex-wrap items-center gap-2">
            {cfg.years_hiring && <TrustPill label={`${cfg.years_hiring}+ years hiring plant`} />}
            {cfg.cpa_terms && <TrustPill label="CPA T&Cs" />}
            {cfg.hired_in_insured && <TrustPill label="Hired-in insured" />}
            {cfg.cpcs_operators && <TrustPill label="CPCS-carded operators" />}
            {cfg.hse_audited && <TrustPill label="HSE-audited" />}
            {cfg.turnaround_text && <TrustPill label={cfg.turnaround_text} accent />}
          </ul>
        </section>
      )}

      {/* Trust & Benefits. */}
      {cfg.trust_benefits.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
          <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
            {headings.trust_benefits}
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {cfg.trust_benefits.map((b, i) => {
              const inner = (
                <>
                  <span
                    aria-hidden="true"
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px] font-extrabold text-black"
                    style={{ background: "#FFB300" }}
                  >
                    ✓
                  </span>
                  <span className="flex-1 text-[12px] font-bold text-neutral-800">
                    {b.label}
                  </span>
                  {b.url && (
                    <span
                      aria-hidden="true"
                      className="text-[10px] font-extrabold text-neutral-400"
                    >
                      →
                    </span>
                  )}
                </>
              );
              return (
                <li key={b.label + i}>
                  {b.url ? (
                    <Link
                      href={b.url}
                      className="flex h-full items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3 transition hover:border-[#FFB300] hover:shadow-sm"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex h-full items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3">
                      {inner}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Brands. */}
      {cfg.plant_brands.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
          <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
            {headings.brands}
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] text-neutral-600">
            OEM-serviced fleet from the UK&rsquo;s most trusted plant manufacturers.
          </p>
          <ul className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-4">
            {cfg.plant_brands.map((b) => (
              <li key={b.name} className="flex items-center">
                {b.logo_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={sharpenLogoUrl(b.logo_url)}
                    alt={b.name}
                    title={b.name}
                    loading="lazy"
                    className="h-7 w-auto object-contain sm:h-8"
                  />
                ) : (
                  <span className="text-[13px] font-bold text-neutral-700">{b.name}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* What we hire. */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          {headings.what_we_hire}
        </h2>
        <div className="mt-2 max-w-3xl space-y-3 text-[13px] leading-relaxed text-neutral-600">
          {explanatoryParagraphs.map((paragraph, i) => (
            <p key={i} className="whitespace-pre-line">
              {paragraph}
            </p>
          ))}
        </div>
        {cfg.sections_enabled.search_filter && (
          <PlantHireFilterBar
            categories={enabledCategories.map(({ meta, c }) => ({
              slug: meta.slug,
              label: meta.label,
              weight_kg: c?.specs?.weight_kg ?? null,
              available_today: !(c?.blocked_ranges ?? []).some(
                (r) => {
                  const t = new Date().toISOString().slice(0, 10);
                  return t >= r.from && t <= r.to;
                }
              )
            }))}
          />
        )}
        <ul id="plant-tiles" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {enabledCategories.map(({ meta, c }) => (
            <li
              key={meta.slug}
              data-slug={meta.slug}
              data-label={meta.label.toLowerCase()}
              data-weight={c?.specs?.weight_kg ?? ""}
              data-available-today={
                (c?.blocked_ranges ?? []).some((r) => {
                  const t = new Date().toISOString().slice(0, 10);
                  return t >= r.from && t <= r.to;
                })
                  ? "false"
                  : "true"
              }
              className="flex h-full flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                {c?.image_url ? (
                  <PlantMachineImageModal
                    imageUrl={c.image_url}
                    label={meta.label}
                    categorySlug={meta.slug}
                    specs={c?.specs}
                    dayPricePence={c?.price_day_pence ?? null}
                    weekPricePence={c?.price_week_pence ?? null}
                    merchantName={merchantName}
                    waHref={wa ? `https://wa.me/${wa}` : null}
                    forSale={c?.for_sale === true}
                    salePricePence={c?.sale_price_pence ?? null}
                    saleCondition={c?.sale_condition ?? ""}
                    saleYear={c?.sale_year ?? null}
                    saleHoursUsed={c?.sale_hours_used ?? null}
                    saleNote={c?.sale_note ?? ""}
                    saleStockCount={c?.sale_stock_count ?? null}
                    triggerClassName="h-20 shrink-0 sm:h-24"
                  />
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-neutral-100 text-[22px]">
                    {meta.emoji}
                  </span>
                )}
                <div className="flex flex-col items-end gap-1">
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-black"
                    style={{ background: "#FFB300" }}
                  >
                    {formatPriceFrom(c?.price_day_pence)}
                  </span>
                  {c?.for_sale && c.sale_price_pence && c.sale_price_pence > 0 && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white"
                      style={{ background: "#0F7A3F" }}
                    >
                      <span aria-hidden="true">£</span>
                      For sale {formatPounds(c.sale_price_pence)}
                    </span>
                  )}
                  {(() => {
                    const today = new Date().toISOString().slice(0, 10);
                    const onHire = (c?.blocked_ranges ?? []).some(
                      (r) => today >= r.from && today <= r.to
                    );
                    return onHire ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest"
                        style={{ background: "#FEE2E2", color: "#991B1B" }}
                      >
                        <span
                          aria-hidden="true"
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ background: "#DC2626" }}
                        />
                        On hire
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest"
                        style={{ background: "#DCFCE7", color: "#166534" }}
                      >
                        <span
                          aria-hidden="true"
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ background: "#22C55E" }}
                        />
                        Available today
                      </span>
                    );
                  })()}
                </div>
              </div>
              <p className="text-[14px] font-extrabold text-neutral-900">{meta.label}</p>
              <p className="text-[12px] text-neutral-600">{meta.short_desc}</p>

              {/* Rate table */}
              <ul className="grid grid-cols-3 gap-1 rounded-md bg-neutral-50 p-2 text-center">
                <li>
                  <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
                    Day
                  </p>
                  <p className="text-[12px] font-bold text-neutral-900">
                    {formatPounds(c?.price_day_pence)}
                  </p>
                </li>
                <li>
                  <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
                    Week
                  </p>
                  <p className="text-[12px] font-bold text-neutral-900">
                    {formatPounds(c?.price_week_pence)}
                  </p>
                </li>
                <li>
                  <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
                    Month
                  </p>
                  <p className="text-[12px] font-bold text-neutral-900">
                    {formatPounds(c?.price_month_pence)}
                  </p>
                </li>
              </ul>

              {c?.operator_premium_day_pence !== null &&
                c?.operator_premium_day_pence !== undefined &&
                c.operator_premium_day_pence > 0 && (
                  <p className="text-[11px] text-neutral-600">
                    <span className="font-bold text-neutral-900">
                      + {formatPounds(c.operator_premium_day_pence)}/day
                    </span>{" "}
                    with CPCS operator
                  </p>
                )}

              {c?.sub_types && c.sub_types.length > 0 && (
                <ul className="mt-1 flex flex-wrap gap-1">
                  {c.sub_types.map((s) => (
                    <li
                      key={s}
                      className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-700"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              )}

              {c?.note && (
                <p className="mt-1 rounded-md bg-neutral-50 px-2 py-1 text-[11px] font-bold text-neutral-700">
                  {c.note}
                </p>
              )}

              <BlockedDatesBanner ranges={c?.blocked_ranges} />

              <PlantHireCategoryDetail
                categorySlug={meta.slug}
                sectionsEnabled={cfg.sections_enabled}
                specs={c?.specs}
                galleryUrls={c?.gallery_urls}
                videoUrl={c?.video_url}
                brochureUrl={c?.brochure_pdf_url}
                lolerCertUrl={c?.loler_cert_url}
                compatibleAttachments={c?.compatible_attachments}
                allCategories={enabledCategories.map(({ meta }) => ({
                  slug: meta.slug,
                  label: meta.label,
                  emoji: meta.emoji
                }))}
                rating={c?.rating}
                reviews={c?.reviews}
              />

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
                  breakEvenNudge={cfg.sections_enabled.break_even_nudge}
                  blockedRanges={c?.blocked_ranges ?? []}
                  depotPostcode={
                    cfg.sections_enabled.postcode_calculator ? cfg.depot_postcode : ""
                  }
                  zones={
                    cfg.sections_enabled.postcode_calculator ? cfg.delivery_zones : []
                  }
                  waHref={wa ? `https://wa.me/${wa}` : null}
                />
              )}
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-3xl text-[12px] leading-relaxed text-neutral-500">
          Not sure which size machine you need? WhatsApp a photo of the job — we&rsquo;ll spec it and quote.
        </p>
      </section>

      {/* How to hire. */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          {headings.how_to_hire}
        </h2>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cfg.modes.collect && (
            <ModeTile
              n={1}
              title="Collect from yard"
              body={modeBodies.collect}
              cta={cfg.yard_address ? { label: "See yard address", href: "#yard-address" } : undefined}
            />
          )}
          {cfg.modes.delivery && (
            <ModeTile
              n={(cfg.modes.collect ? 1 : 0) + 1}
              title="Delivery"
              body={modeBodies.delivery}
              cta={cfg.delivery_zones.length > 0 ? { label: "See zone map", href: `/${slug}/plant-hire/delivery-zones` } : undefined}
            />
          )}
          {cfg.modes.operator && (
            <ModeTile
              n={(cfg.modes.collect ? 1 : 0) + (cfg.modes.delivery ? 1 : 0) + 1}
              title="With operator"
              body={modeBodies.operator}
              cta={wa ? { label: "Book operator", href: `https://wa.me/${wa}`, external: true } : undefined}
            />
          )}
          {cfg.modes.long_term && (
            <ModeTile
              n={
                (cfg.modes.collect ? 1 : 0) +
                (cfg.modes.delivery ? 1 : 0) +
                (cfg.modes.operator ? 1 : 0) +
                1
              }
              title="Long-term contract"
              body={modeBodies.long_term}
              cta={
                cfg.bulk_tiers.length > 0
                  ? { label: "See tiers", href: "#bulk-tiers" }
                  : undefined
              }
            />
          )}
        </ul>
      </section>

      {/* Yard address. */}
      {cfg.modes.collect && cfg.yard_address && (
        <section id="yard-address" className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#FFB300]">
              Yard address
            </p>
            <p className="mt-2 whitespace-pre-line font-mono text-[14px] text-neutral-900">
              {cfg.yard_address}
            </p>
            {cfg.yard_open_from && cfg.yard_open_to && (
              <p className="mt-2 text-[12px] text-neutral-600">
                Open {cfg.yard_open_from} – {cfg.yard_open_to}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Delivery zones. */}
      {cfg.modes.delivery && cfg.delivery_zones.length > 0 && (
        <section id="delivery-zones" className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
          <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
            {headings.delivery}
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cfg.delivery_zones.map((z) => (
              <li
                key={z.label}
                className="rounded-2xl border border-neutral-200 bg-white p-4"
              >
                <p className="text-[13px] font-extrabold text-neutral-900">{z.label}</p>
                <ul className="mt-2 space-y-1 text-[12px] text-neutral-700">
                  {z.free_radius_miles !== null && z.free_radius_miles > 0 && (
                    <li>
                      <span className="font-bold">Free radius:</span> {z.free_radius_miles} miles
                    </li>
                  )}
                  {z.price_per_mile_pence !== null && z.price_per_mile_pence > 0 && (
                    <li>
                      <span className="font-bold">Per mile:</span> {formatPounds(z.price_per_mile_pence)}
                    </li>
                  )}
                  {z.fixed_price_pence !== null && z.fixed_price_pence > 0 && (
                    <li>
                      <span className="font-bold">Fixed:</span> {formatPounds(z.fixed_price_pence)}
                    </li>
                  )}
                </ul>
                {z.note && <p className="mt-2 text-[11px] text-neutral-500">{z.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Damage waivers. */}
      {cfg.waiver_options.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
          <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
            {headings.waivers}
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] text-neutral-600">
            Pick one at hire. All waivers carry an excess — check the number before you sign.
          </p>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {cfg.waiver_options.map((w) => (
              <li key={w.slug} className="rounded-2xl border border-neutral-200 bg-white p-4">
                <p className="text-[13px] font-extrabold text-neutral-900">{w.label}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  {w.price_day_pence !== null && (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 font-extrabold text-black"
                      style={{ background: "#FFB300" }}
                    >
                      {w.price_day_pence === 0 ? "No charge" : `${formatPounds(w.price_day_pence)}/day`}
                    </span>
                  )}
                  {w.excess_pence !== null && (
                    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 font-bold text-neutral-700">
                      Excess: {formatPounds(w.excess_pence)}
                    </span>
                  )}
                </div>
                {w.note && <p className="mt-2 text-[12px] text-neutral-600">{w.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Fuel + policies row. */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <PolicyPill label="Fuel" value={fuelPolicyLabel} />
          {cfg.deposit_pence !== null && cfg.deposit_pence > 0 && (
            <PolicyPill label="Deposit" value={formatPounds(cfg.deposit_pence)} />
          )}
          {cfg.weekend_rate_percent !== null && cfg.weekend_rate_percent > 0 && (
            <PolicyPill
              label="Weekend"
              value={`${cfg.weekend_rate_percent}% of day rate`}
            />
          )}
          {cfg.bank_holiday_surcharge_percent !== null &&
            cfg.bank_holiday_surcharge_percent > 0 && (
              <PolicyPill
                label="Bank holiday"
                value={`+${cfg.bank_holiday_surcharge_percent}%`}
              />
            )}
          {cfg.min_operator_age && (
            <PolicyPill label="Min age" value={`${cfg.min_operator_age}+`} />
          )}
          {cfg.cpcs_required && <PolicyPill label="CPCS" value="Required at enquiry" />}
        </ul>
      </section>

      {/* Bulk tiers. */}
      {cfg.bulk_tiers.length > 0 && (
        <section id="bulk-tiers" className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
          <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">{headings.bulk}</h2>
          <p className="mt-2 max-w-2xl text-[13px] text-neutral-600">
            The longer the hire, the more you save. Contract discount applies automatically at the tier threshold.
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {cfg.bulk_tiers.map((t) => (
              <li
                key={t.min_period_days}
                className="rounded-2xl border border-neutral-200 bg-white p-4 text-center"
              >
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                  {t.min_period_days}+ days
                </p>
                <p className="mt-1 text-[14px] font-extrabold" style={{ color: "#0A0A0A" }}>
                  {t.label}
                </p>
              </li>
            ))}
          </ul>
          {wa && (
            <a
              href={`https://wa.me/${wa}?text=${encodeURIComponent(
                `Hi ${merchantName}, I'd like a long-term plant hire quote. Machine: [ … ]. Start date: [ … ]. Duration: [ … ]. Delivery or collect: [ … ].`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex h-11 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90"
              style={{ background: "#FFB300" }}
            >
              Request long-term quote
            </a>
          )}
        </section>
      )}

      {/* Trade customers. */}
      {cfg.trade_customers.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
          <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
            {headings.trade_customers}
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] text-neutral-600">
            Trade accounts welcome. Same-day delivery, contract pricing, monthly invoicing.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {cfg.trade_customers.map((c) => (
              <li
                key={c}
                className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-bold text-neutral-800"
              >
                {c}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Related products cross-sell. */}
      {relatedProducts.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
          <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
            {headings.related_products}
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] text-neutral-600">
            PPE, hand tools, fuel and small consumables — grab what you need for the site while you&rsquo;re booking the machine.
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {relatedProducts.map((p) => (
              <li key={p.id}>
                <a
                  href={`/${slug}/shop/${p.slug ?? p.id}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:border-[#FFB300]"
                >
                  <span
                    className="relative block w-full overflow-hidden bg-neutral-100"
                    style={{ aspectRatio: "1 / 1" }}
                    aria-hidden="true"
                  >
                    {p.cover_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={p.cover_url}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : null}
                  </span>
                  <div className="flex flex-col gap-2 p-3">
                    <p className="line-clamp-2 text-[12px] font-extrabold text-neutral-900">
                      {p.name}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-2">
                      <p className="text-[13px] font-bold text-neutral-900">
                        £{(p.price_pence / 100).toFixed(2)}
                      </p>
                      <span
                        className="inline-flex h-7 items-center rounded-md px-2 text-[10px] font-extrabold uppercase tracking-widest text-black transition group-hover:opacity-90"
                        style={{ background: "#FFB300" }}
                      >
                        View →
                      </span>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* FAQ. */}
      {cfg.faq.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
          <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">{headings.faq}</h2>
          <ul className="mt-4 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
            {cfg.faq.map((f, i) => (
              <li key={i}>
                <details className="group">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-[13px] font-extrabold text-neutral-900">
                    {f.q}
                    <span
                      aria-hidden="true"
                      className="text-[16px] font-extrabold text-[#FFB300] transition group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <div className="px-4 pb-4 text-[13px] leading-relaxed text-neutral-700">{f.a}</div>
                </details>
              </li>
            ))}
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
        whatsappHref={enquireOnWa}
      />
    </main>
  );
}

function sharpenLogoUrl(url: string): string {
  if (!url.includes("ik.imagekit.io/")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}tr=h-72,q-95`;
}

function TrustPill({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <li
      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest"
      style={{
        background: accent ? "#FFB300" : "#F5F5F5",
        color: accent ? "#0A0A0A" : "#404040"
      }}
    >
      {label}
    </li>
  );
}

function PolicyPill({ label, value }: { label: string; value: string }) {
  return (
    <li className="rounded-xl border border-neutral-200 bg-white p-3">
      <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
        {label}
      </p>
      <p className="mt-0.5 text-[12px] font-bold text-neutral-900">{value}</p>
    </li>
  );
}

function ModeTile({
  n,
  title,
  body,
  cta
}: {
  n: number;
  title: string;
  body: string;
  cta?: { label: string; href: string; external?: boolean };
}) {
  return (
    <li className="flex h-full flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4">
      <span
        className="grid h-9 w-9 place-items-center rounded-full text-[14px] font-extrabold text-black"
        style={{ background: "#FFB300" }}
      >
        {n}
      </span>
      <p className="text-[14px] font-extrabold text-neutral-900">{title}</p>
      <p className="flex-1 text-[12px] text-neutral-600">{body}</p>
      {cta && (
        <a
          href={cta.href}
          target={cta.external ? "_blank" : undefined}
          rel={cta.external ? "noopener noreferrer" : undefined}
          className="mt-2 inline-flex h-10 items-center justify-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90 active:scale-[0.98]"
          style={{ background: "#FFB300" }}
        >
          {cta.label}
        </a>
      )}
    </li>
  );
}
