// PlantHireHomeShowcase — the premium plant-hire home section that
// replaces the small PlantHireCard teaser for merchants whose entire
// business IS plant hire (primary_trade === 'plant-hire' OR the
// merchant flips this on manually).
//
// Renders as a single "big section" on the profile home page, mobile-
// first, with:
//   1. Full-bleed dark showcase strip with banner + big headline + CTA
//   2. Auto-scrolling category chip strip (client component)
//   3. Featured machines grid (biggest 6, real day/week/month rates)
//   4. "Same-day delivery" promo banner
//   5. "Why hire from us" 8-icon strip (from cfg.trust_benefits)
//   6. "How it works" 3-step block
//   7. Featured brands strip (from cfg.plant_brands)
//   8. Big CTA button linking into the /plant-hire sub-page

import Link from "next/link";
import type { HammerexTradeOffListing } from "@/lib/supabase";
import {
  PLANT_CATEGORIES,
  formatPriceFrom,
  formatPounds,
  isPlantHireConfigured,
  normalisePlantHireConfig
} from "@/lib/plantHire";
import { PlantHireDeliveryZonesSection } from "./PlantHireDeliveryZonesSection";
import {
  PlantBulkQuoteCard,
  PlantCdmPackSection,
  PlantNotifyWhenFreeCard,
  PlantRepeatLadderSection,
  PlantSubHireSection
} from "./PlantHireTier2Sections";
import { PlantCartBadge } from "./PlantCartBadge";
import { PlantHireQuickNav } from "./PlantHireQuickNav";
import { PlantHireDynamicShowcase } from "./PlantHireDynamicShowcase";
import { whatsappDigits } from "@/lib/tradeOff";

export function PlantHireHomeShowcase({ listing }: { listing: HammerexTradeOffListing }) {
  const cfg = normalisePlantHireConfig(listing.plant_hire);
  if (!isPlantHireConfigured(cfg)) return null;
  // Master switch — merchant can hide the mega showcase from their
  // home while keeping every sub-page + wizard operational.
  if (!cfg.showcase_enabled) return null;

  const enabled = PLANT_CATEGORIES.map((meta) => ({ meta, c: cfg.categories[meta.slug] })).filter(
    (row) => row.c?.enabled
  );

  // Featured machines: 6 tiles, prioritising ones with images + a day price.
  const featured = enabled
    .filter((row) => row.c?.image_url && (row.c?.price_day_pence ?? 0) > 0)
    .slice(0, 6);

  // For-sale machines (surfaces the Buy Now feature front-and-centre).
  const forSale = enabled
    .filter(
      (row) => row.c?.for_sale === true && (row.c?.sale_price_pence ?? 0) > 0 && row.c?.image_url
    )
    .slice(0, 4);

  const baseSlug = encodeURIComponent(listing.slug);
  const subpage = `/${baseSlug}/plant-hire`;
  const merchantName = listing.display_name ?? listing.slug;
  const waDigits = whatsappDigits(listing.whatsapp ?? "");
  const waHref = waDigits ? `https://wa.me/${waDigits}` : null;

  // If merchant customised their layout, hand over to the dynamic
  // renderer. Otherwise render the hardcoded default below (unchanged).
  if (cfg.layout_config && cfg.layout_config.rows.length > 0) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 sm:pt-16">
        <PlantCartBadge merchantSlug={listing.slug} />
        <PlantHireQuickNav merchantSlug={listing.slug} cfg={cfg} />
        <PlantHireDynamicShowcase
          listing={listing}
          cfg={cfg}
          subpage={subpage}
          merchantName={merchantName}
          waHref={waHref}
        />
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 sm:pt-16">
      {/* Featured machines grid */}
      {featured.length > 0 && (
        <div className="mt-10">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
                Featured machines
              </p>
              <h3 className="mt-1 text-2xl font-extrabold text-neutral-900 sm:text-3xl">
                Most-hired from {merchantName}
              </h3>
            </div>
          </div>
          <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map(({ meta, c }) => (
              <li key={meta.slug}>
                <Link
                  href={`${subpage}/machines/${meta.slug}`}
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
                  </span>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <p className="text-[15px] font-extrabold text-neutral-900">{meta.label}</p>
                    <p className="line-clamp-2 text-[12px] text-neutral-600">{meta.short_desc}</p>
                    <ul className="mt-1 grid grid-cols-3 gap-1 rounded-md bg-neutral-50 p-2 text-center">
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
                    {c?.for_sale && (c.sale_price_pence ?? 0) > 0 && (
                      <p
                        className="mt-auto inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1 text-[11px] font-extrabold uppercase tracking-widest text-white"
                        style={{ background: "#0F7A3F" }}
                      >
                        £ For sale — £{((c!.sale_price_pence ?? 0) / 100).toLocaleString()}
                      </p>
                    )}
                    <span
                      className={`inline-flex h-10 items-center justify-center gap-1 rounded-lg text-[11px] font-extrabold uppercase tracking-widest transition group-hover:opacity-90 ${
                        c?.for_sale && (c.sale_price_pence ?? 0) > 0 ? "" : "mt-auto"
                      }`}
                      style={{ background: "#FFB300", color: "#0A0A0A" }}
                    >
                      View & enquire →
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* "See all 31 →" — moved below the grid as a real button */}
          <div className="mt-6 flex justify-center">
            <Link
              href={`${subpage}/machines`}
              className="inline-flex h-12 items-center gap-1.5 rounded-xl px-6 text-[12px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90 active:scale-[0.98]"
              style={{ background: "#FFB300" }}
            >
              See all {enabled.length} →
            </Link>
          </div>
        </div>
      )}

      {/* 4. For-sale strip — only when the merchant has any Buy Now stock */}
      {forSale.length > 0 && (
        <div
          className="relative mt-10 overflow-hidden rounded-3xl p-6 sm:p-10"
          style={{ background: "#052E1A" }}
        >
          {/* Background image — no overlay, image renders full clarity. */}
          <span aria-hidden="true" className="absolute inset-0 z-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2011_14_06%20AM.png"
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </span>
          <div className="relative z-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-[#22C55E]">
                Also for sale
              </p>
              <h3 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">
                Ex-fleet & refurbished machines
              </h3>
            </div>
            <Link
              href={subpage}
              className="inline-flex h-10 items-center rounded-lg bg-white px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:opacity-90"
            >
              See all sale →
            </Link>
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {forSale.map(({ meta, c }) => (
              <li key={meta.slug}>
                <Link
                  href={`${subpage}/machines/${meta.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white transition hover:shadow-xl"
                >
                  <span className="relative block aspect-square w-full overflow-hidden bg-neutral-50">
                    {c?.image_url && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={c.image_url}
                        alt={meta.label}
                        className="absolute inset-0 h-full w-full object-contain transition group-hover:scale-105"
                      />
                    )}
                  </span>
                  <div className="flex flex-col gap-1 p-3">
                    <p className="text-[12px] font-extrabold text-neutral-900">{meta.label}</p>
                    <p className="text-[14px] font-extrabold text-[#0F7A3F]">
                      £{((c!.sale_price_pence ?? 0) / 100).toLocaleString()}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                      {c?.sale_condition === "new"
                        ? "New"
                        : c?.sale_condition === "used"
                          ? "Used"
                          : c?.sale_condition === "refurbished"
                            ? "Refurbished"
                            : c?.sale_condition === "ex_demo"
                              ? "Ex-demo"
                              : ""}
                      {c?.sale_year ? ` · ${c.sale_year}` : ""}
                      {c?.sale_hours_used ? ` · ${c.sale_hours_used.toLocaleString()} hrs` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          </div>
        </div>
      )}

      {/* 5. Same-day delivery + Breakdown promo banners — each gated on
       *  its own feature toggle so a merchant who's disabled haulage
       *  or breakdown doesn't ship a broken CTA. */}
      {(cfg.haulage_service.enabled || cfg.breakdown_service.enabled) && (
        <div
          className={`mt-10 grid gap-4 ${
            cfg.haulage_service.enabled && cfg.breakdown_service.enabled
              ? "grid-cols-1 lg:grid-cols-2"
              : "grid-cols-1"
          }`}
        >
          {cfg.haulage_service.enabled && (
            <PromoBanner
              headline="Hire or move a machine"
              body="Pick from our fleet and we deliver, or tell us about a machine you own and we&rsquo;ll haul it. Live estimate in 4 steps."
              ctaLabel="Start haulage wizard"
              ctaHref={`${subpage}/haulage`}
              background="#111827"
              backgroundImage="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2001_29_50%20PM.png"
              textColor="#FFFFFF"
            />
          )}
          {cfg.breakdown_service.enabled && (
            <PromoBanner
              headline="24/7 breakdown service"
              body="Broke down on-site? WhatsApp for a replacement machine within our SLA — same day local, next day national."
              ctaLabel="Report breakdown"
              ctaHref={`${subpage}/breakdown`}
              background="#111827"
              backgroundImage="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2001_18_24%20PM.png"
              textColor="#FFFFFF"
              urgent
            />
          )}
        </div>
      )}

      {/* 5b. Delivery zones — page-style section with live postcode calculator */}
      {cfg.delivery_zones.length > 0 && (
        <PlantHireDeliveryZonesSection
          zones={cfg.delivery_zones}
          depotPostcode={cfg.depot_postcode}
          yardAddress={cfg.yard_address}
          merchantSlug={listing.slug}
        />
      )}

      {/* 5c. Machine finder wizard CTA + Site services calculator */}
      {cfg.machine_finder.enabled && (
        <div className="mt-10 overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex flex-col items-stretch gap-0 md:flex-row md:items-center">
            <div className="relative aspect-[4/3] w-full shrink-0 md:aspect-auto md:h-full md:w-[240px] lg:w-[280px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2003_12_37%20PM.png"
                alt="Which machine do I need — guided finder"
                loading="lazy"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="flex flex-col justify-between gap-4 pl-1 pr-5 py-5 sm:py-6 sm:pr-6 md:flex-row md:items-center md:pl-0">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
                  Machine finder · Guided
                </p>
                <h3 className="mt-1 text-[22px] font-extrabold leading-tight text-neutral-900 sm:text-[26px]">
                  {cfg.machine_finder.heading}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">
                  {cfg.machine_finder.subheading}
                </p>
              </div>
              <Link
                href={`${subpage}/finder`}
                className="inline-flex h-12 shrink-0 items-center justify-center rounded-xl bg-neutral-900 px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:bg-black"
              >
                Start finder →
              </Link>
            </div>
          </div>
        </div>
      )}
      {/* Site calculator + Video centre — moved to /plant-hire/calculator
       *  and /plant-hire/video respectively. Home now shows compact
       *  click-through cards. */}
      {cfg.site_calculator.enabled && cfg.site_calculator.materials.length > 0 && (
        <Link
          href={`${subpage}/calculator`}
          className="group mt-10 flex flex-col items-start justify-between gap-3 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#FFB300] hover:shadow-md sm:flex-row sm:items-center sm:p-6"
        >
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
              Site services · Live calculator
            </p>
            <h3 className="mt-1 text-[20px] font-extrabold leading-tight text-neutral-900 sm:text-[22px]">
              {cfg.site_calculator.heading}
            </h3>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-neutral-600">
              Type area + depth, get tonnes + cost live. Aggregates, concrete, hardcore, sand,
              topsoil — 6 UK materials preloaded.
            </p>
          </div>
          <span className="inline-flex h-11 shrink-0 items-center rounded-xl bg-neutral-900 px-4 text-[11px] font-extrabold uppercase tracking-widest text-white transition group-hover:bg-black">
            Open calculator →
          </span>
        </Link>
      )}

      {cfg.video_center.enabled && cfg.video_center.videos.length > 0 && (
        <Link
          href={`${subpage}/video`}
          className="group mt-10 flex flex-col items-start justify-between gap-3 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#FFB300] hover:shadow-md sm:flex-row sm:items-center sm:p-6"
        >
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
              Video centre
            </p>
            <h3 className="mt-1 text-[20px] font-extrabold leading-tight text-neutral-900 sm:text-[22px]">
              {cfg.video_center.heading}
            </h3>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-neutral-600">
              {cfg.video_center.videos.length} video
              {cfg.video_center.videos.length === 1 ? "" : "s"} · watch the fleet on-site with
              machine-tagged tours.
            </p>
          </div>
          <span className="inline-flex h-11 shrink-0 items-center rounded-xl bg-neutral-900 px-4 text-[11px] font-extrabold uppercase tracking-widest text-white transition group-hover:bg-black">
            Open video centre →
          </span>
        </Link>
      )}

      {/* 5e. Trust signals — moved to /plant-hire/credentials. Home
       *  now shows a compact click-through card matching the pattern
       *  used for Careers, Trade Accounts, Compliance, Trade Counter. */}
      {cfg.trust_signals.enabled && (
        <Link
          href={`${subpage}/credentials`}
          className="group mt-10 flex flex-col items-start justify-between gap-3 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#FFB300] hover:shadow-md sm:flex-row sm:items-center sm:p-6"
        >
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
              Vetted · Insured · Audited
            </p>
            <h3 className="mt-1 text-[20px] font-extrabold leading-tight text-neutral-900 sm:text-[22px]">
              {cfg.trust_signals.heading}
            </h3>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-neutral-600">
              Accreditations, insurance cover, awards + NPS — every credential you&rsquo;d expect
              from a national brand.
            </p>
          </div>
          <span className="inline-flex h-11 shrink-0 items-center rounded-xl bg-neutral-900 px-4 text-[11px] font-extrabold uppercase tracking-widest text-white transition group-hover:bg-black">
            Open credentials →
          </span>
        </Link>
      )}

      {/* 6. Why hire from us */}
      {cfg.trust_benefits.length > 0 && (
        <div className="mt-10">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
            Why hire from {merchantName}
          </p>
          <h3 className="mt-1 text-2xl font-extrabold text-neutral-900 sm:text-3xl">
            When the ground moves,{" "}
            <span style={{ color: "#FFB300" }}>{merchantName.split(" ")[0]}&rsquo;s</span> name is
            behind it.
          </h3>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {cfg.trust_benefits.map((b, i) => {
              const inner = (
                <>
                  <span
                    aria-hidden="true"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[15px] font-extrabold text-black"
                    style={{ background: "#FFB300" }}
                  >
                    ✓
                  </span>
                  <span className="flex-1 text-[13px] font-bold leading-tight text-neutral-800">
                    {b.label}
                  </span>
                  {b.url && (
                    <span
                      aria-hidden="true"
                      className="text-[11px] font-extrabold text-neutral-400 transition group-hover:text-neutral-900"
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
                      className="group flex h-full items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#FFB300] hover:shadow-md"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex h-full items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-4">
                      {inner}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* 6b. Meet the team — moved to Contact page. */}

      {/* 7. Trade Circle — plant hire context (heavy plant + suppliers only) */}
      <Link
        href="/trade-off/yard?context=plant-hire"
        className="group relative mt-10 flex min-h-[200px] flex-col items-start gap-4 overflow-hidden rounded-2xl p-5 text-white transition hover:opacity-95 sm:flex-row sm:items-center sm:gap-6 sm:p-6"
        style={{ background: "#0F172A" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2002_10_51%20PM.png"
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(115deg, rgba(10,15,30,0.88) 0%, rgba(10,15,30,0.55) 55%, rgba(10,15,30,0.25) 100%)"
          }}
        />
        <div className="relative z-10 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
            Trade Circle · Heavy plant & site machinery
          </p>
          <p className="mt-1 text-[16px] font-extrabold leading-tight text-white sm:text-[18px]">
            Machinery, aggregates, quarries, oil, parts &amp; site trades.
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-white/85">
            Machinery yards, quarries, aggregates, transport, oil &amp; fuel, parts, groundworks
            and site services — the trades that keep sites moving.
          </p>
        </div>
        <span
          className="relative z-10 inline-flex h-11 shrink-0 items-center gap-1 rounded-xl px-4 text-[11px] font-extrabold uppercase tracking-widest transition group-hover:translate-x-0.5"
          style={{ background: "#FFB300", color: "#0A0A0A" }}
        >
          Open Trade Circle →
        </span>
      </Link>

      {/* 7b. Business services strip — link to Careers + Trade Accounts pages */}
      {(cfg.trade_accounts.enabled || cfg.driver_recruitment.enabled) && (
        <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {cfg.driver_recruitment.enabled && (
            <Link
              href={`${subpage}/careers`}
              className="group flex flex-col justify-between gap-3 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#FFB300] hover:shadow-md sm:p-6"
            >
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
                  Careers · We&rsquo;re hiring
                </p>
                <h3 className="mt-1 text-[20px] font-extrabold leading-tight text-neutral-900 sm:text-[22px]">
                  {cfg.driver_recruitment.heading}
                </h3>
                <p className="mt-1 text-[12px] leading-relaxed text-neutral-600">
                  Drivers, mechanics, dispatch — apply online or download the form.
                </p>
              </div>
              <span className="inline-flex h-11 shrink-0 items-center rounded-xl bg-neutral-900 px-4 text-[11px] font-extrabold uppercase tracking-widest text-white transition group-hover:bg-black">
                Open careers →
              </span>
            </Link>
          )}
          {cfg.trade_accounts.enabled && (
            <Link
              href={`${subpage}/trade-accounts`}
              className="group flex flex-col justify-between gap-3 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#FFB300] hover:shadow-md sm:p-6"
            >
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
                  Credit accounts · Trade only
                </p>
                <h3 className="mt-1 text-[20px] font-extrabold leading-tight text-neutral-900 sm:text-[22px]">
                  {cfg.trade_accounts.heading}
                </h3>
                <p className="mt-1 text-[12px] leading-relaxed text-neutral-600">
                  30 days from invoice, weekly statements, priority delivery.
                </p>
              </div>
              <span className="inline-flex h-11 shrink-0 items-center rounded-xl bg-neutral-900 px-4 text-[11px] font-extrabold uppercase tracking-widest text-white transition group-hover:bg-black">
                Open account →
              </span>
            </Link>
          )}
        </div>
      )}

      {/* 7c. Spare parts trade counter — teaser removed. Featured parts
       *  carousel now lives at the bottom of the page (see below). Full
       *  catalogue on /plant-hire/parts, drawer link in header. */}

      {/* 7d. Wide load / nationwide compliance — link to /compliance */}
      {cfg.compliance_info.enabled && (
        <Link
          href={`${subpage}/compliance`}
          className="group mt-10 flex flex-col items-start justify-between gap-3 rounded-3xl border border-neutral-200 bg-neutral-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#FFB300] hover:shadow-md sm:flex-row sm:items-center sm:p-6"
        >
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
              Wide load · Nationwide delivery · Compliance
            </p>
            <h3 className="mt-1 text-[20px] font-extrabold leading-tight text-neutral-900 sm:text-[22px]">
              {cfg.compliance_info.heading}
            </h3>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-neutral-600">
              Full STGO / VR1 process, operator&rsquo;s licence, goods-in-transit cover, route
              surveys — everything the yard is audited on.
            </p>
          </div>
          <span className="inline-flex h-11 shrink-0 items-center rounded-xl bg-neutral-900 px-4 text-[11px] font-extrabold uppercase tracking-widest text-white transition group-hover:bg-black">
            Open compliance →
          </span>
        </Link>
      )}

      {/* 7e. CDM 2015 pack */}
      <PlantCdmPackSection cfg={cfg.cdm_pack} merchantSlug={listing.slug} waHref={waHref} />

      {/* 7f. Repeat customer ladder */}
      <PlantRepeatLadderSection cfg={cfg.repeat_ladder} />

      {/* 7g. Notify-when-free + Bulk quote — 2 small teaser cards */}
      {(cfg.notify_when_free.enabled || cfg.bulk_quote.enabled) && (
        <div className="mt-10 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <PlantNotifyWhenFreeCard cfg={cfg.notify_when_free} />
          <PlantBulkQuoteCard cfg={cfg.bulk_quote} waHref={waHref} merchantName={merchantName} />
        </div>
      )}

      {/* 7h. Closure calendar — moved to Contact page as "Check our dates". */}

      {/* 7i. Sub-hire network */}
      <PlantSubHireSection cfg={cfg.sub_hire} waHref={waHref} merchantName={merchantName} />

      {/* Floating cart FAB */}
      <PlantCartBadge merchantSlug={listing.slug} />

      {/* Top-right burger → plant hire quick-nav drawer */}
      <PlantHireQuickNav merchantSlug={listing.slug} cfg={cfg} />

      {/* Customer tools — moved into the burger drawer top-right for a
       *  cleaner home. All 8 links (Book, Hire list, Compare, Finder,
       *  Delivery report, Damage report, My hires, Extend) live in the
       *  Fleet + Your hires groups of the drawer. */}

      {/* Legacy 3-step block removed — data preserved below in a hidden
       *  no-op so we can bring it back easily if you change your mind. */}
      {false && (
        <div className="mt-10 rounded-3xl bg-neutral-900 p-6 text-white sm:p-10">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-[#FFB300]">
          How it works
        </p>
        <h3 className="mt-1 text-2xl font-extrabold sm:text-3xl">
          Three steps from browse to site.
        </h3>
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              n: 1,
              title: "Pick your machine",
              body: "Browse the fleet. Every tile has day/week/month rates + specs + availability calendar.",
              icon: "🚜"
            },
            {
              n: 2,
              title: "Confirm dates + postcode",
              body: "Enquire card auto-calculates the delivery cost to your postcode and flags any conflicts.",
              icon: "📍"
            },
            {
              n: 3,
              title: "WhatsApp to book",
              body: "We reply fast. Machine on-site same day locally, next day nationally. Damage waiver at hire.",
              icon: "💬"
            }
          ].map((s) => (
            <li key={s.n} className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5">
              <div className="flex items-center gap-3">
                <span
                  className="grid h-12 w-12 place-items-center rounded-full text-[22px] font-extrabold text-black"
                  style={{ background: "#FFB300" }}
                >
                  {s.n}
                </span>
                <span className="text-[28px]" aria-hidden="true">
                  {s.icon}
                </span>
              </div>
              <p className="mt-3 text-[15px] font-extrabold text-white">{s.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-neutral-300">{s.body}</p>
            </li>
          ))}
        </ul>
      </div>
      )}

      {/* 8. Trade counter parts — auto-scrolling featured strip.
       *  Replaces the old brands carousel. Shows the merchant's
       *  featured trade-counter items with images, prices, and click
       *  through to the full /plant-hire/parts page. */}
      {cfg.parts_counter.enabled && cfg.parts_counter.items.length > 0 && (
        <TradeCounterFeaturedMarquee
          items={cfg.parts_counter.items}
          subpage={subpage}
        />
      )}

      {/* 9. Big CTA */}
      <div className="mt-10 text-center">
        <Link
          href={`${subpage}/machines`}
          className="inline-flex h-14 items-center gap-1.5 rounded-2xl px-8 text-[14px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90 active:scale-[0.98]"
          style={{ background: "#FFB300", boxShadow: "0 10px 30px rgba(255,179,0,0.35)" }}
        >
          See the full plant hire fleet →
        </Link>
      </div>
    </section>
  );
}

function TradeCounterFeaturedMarquee({
  items,
  subpage
}: {
  items: import("@/lib/plantHire").PartsItem[];
  subpage: string;
}) {
  const featured = items.filter((i) => i.featured);
  const source = featured.length >= 4 ? featured : items;
  const shown = source.slice(0, 16);
  const total = items.length;
  return (
    <div className="mt-10 overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-900 p-5 text-white sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
            Trade counter · Featured parts
          </p>
          <h3 className="mt-1 text-2xl font-extrabold sm:text-3xl">
            {featured.length >= 4
              ? "Fast-moving parts on the shelf right now."
              : "Parts + spares from our trade counter."}
          </h3>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-white/80">
            {total.toLocaleString()} SKU{total === 1 ? "" : "s"} on the shelf · same-day
            dispatch on stocked items · full search + filter on the trade counter page.
          </p>
        </div>
        <Link
          href={`${subpage}/parts`}
          className="inline-flex h-11 shrink-0 items-center rounded-xl bg-[#FFB300] px-4 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 hover:brightness-95"
        >
          Open trade counter →
        </Link>
      </div>

      <div
        className="parts-home-marquee-mask relative mt-5 overflow-hidden"
        aria-label="Featured parts — auto-scrolling"
      >
        <ul className="parts-home-marquee-track flex w-max gap-3">
          {[...shown, ...shown].map((it, i) => (
            <li
              key={"phm_" + it.sku + "_" + i}
              className="w-[200px] shrink-0 sm:w-[220px]"
              aria-hidden={i >= shown.length ? "true" : undefined}
            >
              <Link
                href={`${subpage}/parts`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-[#FFB300] hover:bg-white/10"
              >
                <div className="relative aspect-square w-full max-w-full shrink-0 overflow-hidden bg-white/5">
                  {it.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.image_url}
                      alt={it.name}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full max-h-full max-w-full object-contain p-3"
                    />
                  ) : (
                    <div className="absolute inset-0 grid h-full w-full place-items-center text-[9px] font-extrabold uppercase text-white/40">
                      Photo pending
                    </div>
                  )}
                  <span
                    className="absolute left-2 top-2 text-[10px] font-extrabold uppercase tracking-widest text-white"
                    style={{ textShadow: "0 1px 3px rgba(0,0,0,0.75)" }}
                  >
                    {it.in_stock ? "In stock" : "To order"}
                  </span>
                  {it.sku && (
                    <span className="absolute bottom-2 left-2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                      {it.sku}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <p className="text-[12px] font-extrabold leading-tight text-white">
                    {it.name}
                  </p>
                  <div className="mt-auto flex items-baseline justify-between pt-2">
                    {it.price_pence !== null ? (
                      <p className="text-[14px] font-extrabold text-[#FFB300]">
                        £{(it.price_pence / 100).toFixed(2)}
                      </p>
                    ) : (
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                        POA
                      </p>
                    )}
                    <span
                      aria-hidden="true"
                      className="text-[11px] font-extrabold text-white/50 transition group-hover:text-[#FFB300]"
                    >
                      →
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <style>{`
        @keyframes parts-home-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .parts-home-marquee-track {
          animation: parts-home-marquee 55s linear infinite;
        }
        .parts-home-marquee-track:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .parts-home-marquee-track { animation: none; }
        }
        .parts-home-marquee-mask {
          -webkit-mask-image: linear-gradient(90deg, transparent 0, black 40px, black calc(100% - 40px), transparent 100%);
                  mask-image: linear-gradient(90deg, transparent 0, black 40px, black calc(100% - 40px), transparent 100%);
        }
      `}</style>
    </div>
  );
}

function PartsCounterTeaser({
  cfg,
  subpage
}: {
  cfg: import("@/lib/plantHire").PlantPartsCounter;
  subpage: string;
}) {
  const featured = cfg.items.filter((i) => i.featured).slice(0, 4);
  const total = cfg.items.length;
  const phoneDigits = cfg.phone.replace(/[^\d+]/g, "");
  const waDigits = cfg.whatsapp.replace(/[^\d]/g, "");
  return (
    <div className="mt-10 rounded-3xl border border-neutral-200 bg-neutral-50 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
            Trade counter · Spares + parts + manuals
          </p>
          <h3 className="mt-1 text-2xl font-extrabold text-neutral-900 sm:text-3xl">
            {cfg.heading}
          </h3>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-neutral-600">
            {cfg.subheading}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-neutral-700">
            <span className="rounded-full bg-white px-3 py-1 shadow-sm">
              {cfg.hours_summary}
            </span>
            {total > 0 && (
              <span className="rounded-full bg-white px-3 py-1 shadow-sm">
                <strong className="text-neutral-900">{total.toLocaleString()}</strong> SKUs on the
                shelf
              </span>
            )}
            {cfg.same_day_cutoff && (
              <span className="rounded-full bg-white px-3 py-1 shadow-sm">
                🚚 {cfg.same_day_cutoff}
              </span>
            )}
          </div>
        </div>
        <Link
          href={`${subpage}/parts`}
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-xl bg-neutral-900 px-5 text-[12px] font-extrabold uppercase tracking-widest text-white hover:bg-black"
        >
          Open trade counter →
        </Link>
      </div>

      {featured.length > 0 && (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {featured.map((it, i) => (
            <li key={it.sku + i}>
              <Link
                href={`${subpage}/parts`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#FFB300] hover:shadow-md"
              >
                <div className="relative aspect-square w-full max-w-full shrink-0 overflow-hidden bg-neutral-100">
                  {it.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.image_url}
                      alt={it.name}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full max-h-full max-w-full object-contain p-2"
                    />
                  ) : (
                    <div className="absolute inset-0 grid h-full w-full place-items-center text-[9px] font-extrabold uppercase text-neutral-400">
                      Photo pending
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-[12px] font-extrabold leading-tight text-neutral-900">
                    {it.name}
                  </p>
                  {it.price_pence !== null && (
                    <p className="mt-0.5 text-[13px] font-extrabold text-neutral-900">
                      £{(it.price_pence / 100).toFixed(2)}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {phoneDigits && (
          <a
            href={`tel:${phoneDigits}`}
            className="inline-flex h-10 items-center rounded-lg bg-neutral-900 px-3 text-[11px] font-extrabold uppercase tracking-widest text-white hover:bg-black"
          >
            📞 {cfg.phone}
          </a>
        )}
        {waDigits && (
          <a
            href={`https://wa.me/${waDigits}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-95"
            style={{ background: "#25D366" }}
          >
            💬 WhatsApp counter
          </a>
        )}
      </div>
    </div>
  );
}

function ToolTile({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <li>
      <Link
        href={href}
        className="group flex h-full flex-col justify-between gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 transition hover:-translate-y-0.5 hover:border-[#FFB300] hover:bg-white hover:shadow-md"
      >
        <div>
          <p className="text-[14px] font-extrabold leading-tight text-neutral-900">{title}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-neutral-600">{body}</p>
        </div>
        <span className="mt-2 text-[10px] font-extrabold uppercase tracking-widest text-neutral-500 transition group-hover:text-neutral-900">
          Open →
        </span>
      </Link>
    </li>
  );
}

function PromoBanner({
  headline,
  body,
  ctaLabel,
  ctaHref,
  background,
  backgroundImage,
  textColor,
  icon,
  urgent
}: {
  headline: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  background: string;
  backgroundImage?: string;
  textColor: string;
  icon?: string;
  /** When true, the CTA pill turns red with a pulsing red heartbeat
   *  dot — for genuinely urgent flows (breakdown / 24/7 call-out). */
  urgent?: boolean;
}) {
  return (
    <a
      href={ctaHref}
      target={ctaHref.startsWith("http") ? "_blank" : undefined}
      rel={ctaHref.startsWith("http") ? "noopener noreferrer" : undefined}
      className="group relative flex min-h-[200px] flex-col gap-3 overflow-hidden rounded-3xl p-6 transition hover:opacity-95 sm:min-h-[180px] sm:flex-row sm:items-center sm:p-7"
      style={{ background, color: textColor }}
    >
      {backgroundImage && (
        <span aria-hidden="true" className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backgroundImage}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
          {/* Overlay tuned to the banner's text colour so contrast holds. */}
          <span
            className="absolute inset-0"
            style={{
              background:
                textColor === "#0A0A0A"
                  ? "linear-gradient(135deg, rgba(255,179,0,0.35) 0%, rgba(255,179,0,0.15) 50%, rgba(255,179,0,0.45) 100%)"
                  : "linear-gradient(135deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.65) 100%)"
            }}
          />
        </span>
      )}
      {icon && (
        <span
          className="relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-[32px]"
          style={{ background: "rgba(255,255,255,0.14)" }}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <div className="relative z-10 flex-1">
        <p className="text-[16px] font-extrabold leading-tight sm:text-[18px]">{headline}</p>
        <p className="mt-1 text-[13px] leading-relaxed opacity-85">{body}</p>
      </div>
      <span
        className="relative z-10 inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-[11px] font-extrabold uppercase tracking-widest transition group-hover:translate-x-0.5"
        style={{
          background: urgent
            ? "#DC2626"
            : textColor === "#0A0A0A"
              ? "#0A0A0A"
              : "#FFB300",
          color: urgent
            ? "#FFFFFF"
            : textColor === "#0A0A0A"
              ? "#FFB300"
              : "#0A0A0A"
        }}
      >
        {urgent && (
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="promo-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
        )}
        {ctaLabel} →
      </span>
      {urgent && (
        <style>{`
          .promo-ping {
            animation: promo-ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite;
          }
          @keyframes promo-ping {
            75%, 100% {
              transform: scale(2.2);
              opacity: 0;
            }
          }
        `}</style>
      )}
    </a>
  );
}
