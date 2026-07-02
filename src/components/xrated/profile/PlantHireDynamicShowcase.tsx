// Dynamic home showcase — reads `layout_config.rows` and renders each
// section in the merchant's chosen order + column arrangement.
//
// Fallback: PlantHireHomeShowcase only mounts this when layout_config
// is non-null. Merchants who never touch the layout editor keep the
// hardcoded default showcase.

import Link from "next/link";
import type { ReactNode } from "react";
import type { HammerexTradeOffListing } from "@/lib/supabase";
import {
  PLANT_CATEGORIES,
  formatPriceFrom,
  formatPounds,
  type PlantHireConfig
} from "@/lib/plantHire";
import { PlantHireDeliveryZonesSection } from "./PlantHireDeliveryZonesSection";
import {
  PlantBulkQuoteCard,
  PlantCdmPackSection,
  PlantNotifyWhenFreeCard,
  PlantRepeatLadderSection,
  PlantSubHireSection
} from "./PlantHireTier2Sections";
import { sectionByKey } from "@/lib/plantHireLayoutRegistry";

type Ctx = {
  listing: HammerexTradeOffListing;
  cfg: PlantHireConfig;
  subpage: string;
  merchantName: string;
  waHref: string | null;
};

/** Optional per-column wrapper. Layout editor uses this to inject an
 *  orange-rim overlay + click handler around every real section, so the
 *  merchant edits the actual live UI (not numbered placeholders). Default
 *  is identity — the customer route passes nothing and gets the raw
 *  section. */
export type WrapColProps = {
  rowId: string;
  sectionKey: string;
  colIdx: number;
  colTotal: number;
  children: ReactNode;
};

export function PlantHireDynamicShowcase({
  listing,
  cfg,
  subpage,
  merchantName,
  waHref,
  wrapCol
}: Ctx & { wrapCol?: (p: WrapColProps) => ReactNode }) {
  const rows = cfg.layout_config?.rows ?? [];
  const ctx: Ctx = { listing, cfg, subpage, merchantName, waHref };

  return (
    <>
      {rows.map((row) => {
        const cols = row.columns
          .map((k, colIdx) => ({ key: k, colIdx, node: renderSection(k, ctx) }))
          .filter((c) => c.node !== null);
        if (cols.length === 0) return null;
        const gridCols =
          cols.length === 3
            ? "grid-cols-1 lg:grid-cols-3"
            : cols.length === 2
              ? "grid-cols-1 lg:grid-cols-2"
              : "grid-cols-1";
        return (
          <div key={row.id} className={`mt-10 grid gap-4 ${gridCols}`}>
            {cols.map((c) => {
              const wrapped = wrapCol
                ? wrapCol({
                    rowId: row.id,
                    sectionKey: c.key,
                    colIdx: c.colIdx,
                    colTotal: cols.length,
                    children: c.node
                  })
                : c.node;
              return (
                <div key={c.key} data-section-key={c.key} data-editable="plant-hire-section">
                  {wrapped}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function renderSection(key: string, ctx: Ctx): ReactNode {
  const meta = sectionByKey(key);
  if (!meta) return null;
  // Feature-toggle gate.
  if (meta.toggleKey) {
    const v = ctx.cfg[meta.toggleKey] as unknown;
    if (v && typeof v === "object" && "enabled" in (v as Record<string, unknown>)) {
      if ((v as { enabled?: boolean }).enabled === false) return null;
    }
  }
  const R = RENDERERS[key];
  return R ? R(ctx) : null;
}

// ─── Section renderers ────────────────────────────────────────────

const RENDERERS: Record<string, (ctx: Ctx) => ReactNode> = {
  featured_machines: (ctx) => {
    const enabled = PLANT_CATEGORIES.map((m) => ({
      meta: m,
      c: ctx.cfg.categories[m.slug]
    })).filter((r) => r.c?.enabled);
    const featured = enabled
      .filter((r) => r.c?.image_url && (r.c?.price_day_pence ?? 0) > 0)
      .slice(0, 6);
    if (featured.length === 0) return null;
    return (
      <div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
              Featured machines
            </p>
            <h3 className="mt-1 text-2xl font-extrabold text-neutral-900 sm:text-3xl">
              Most-hired from {ctx.merchantName}
            </h3>
          </div>
          <Link
            href={`${ctx.subpage}/machines`}
            className="hidden shrink-0 text-[11px] font-extrabold uppercase tracking-widest text-neutral-500 hover:text-neutral-900 sm:inline-flex"
          >
            See all machines →
          </Link>
        </div>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {featured.map(({ meta, c }) => (
            <li key={meta.slug}>
              <Link
                href={`${ctx.subpage}/machines/${meta.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#FFB300] hover:shadow-md"
              >
                <div className="relative aspect-square w-full max-w-full shrink-0 overflow-hidden bg-neutral-50">
                  {c?.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.image_url}
                      alt={meta.label}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full max-h-full max-w-full object-contain p-2"
                    />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-[12px] font-extrabold leading-tight text-neutral-900">
                    {meta.label}
                  </p>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                    {formatPriceFrom(c?.price_day_pence)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  },

  for_sale_strip: (ctx) => {
    const enabled = PLANT_CATEGORIES.map((m) => ({
      meta: m,
      c: ctx.cfg.categories[m.slug]
    })).filter((r) => r.c?.enabled);
    const forSale = enabled
      .filter((r) => r.c?.for_sale && (r.c?.sale_price_pence ?? 0) > 0 && r.c?.image_url)
      .slice(0, 4);
    if (forSale.length === 0) return null;
    return (
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
          Ex-fleet · For sale
        </p>
        <h3 className="mt-1 text-2xl font-extrabold text-neutral-900 sm:text-3xl">
          Also for sale
        </h3>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {forSale.map(({ meta, c }) => (
            <li key={meta.slug}>
              <Link
                href={`${ctx.subpage}/machines/${meta.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:border-emerald-500 hover:shadow"
              >
                <div className="relative aspect-square w-full max-w-full shrink-0 overflow-hidden bg-neutral-50">
                  {c?.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.image_url}
                      alt={meta.label}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full max-h-full max-w-full object-contain p-2"
                    />
                  )}
                  <span className="absolute right-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white">
                    For sale
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-[12px] font-extrabold leading-tight text-neutral-900">
                    {meta.label}
                  </p>
                  <p className="mt-1 text-[14px] font-extrabold text-emerald-700">
                    {formatPounds(c?.sale_price_pence)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  },

  haulage_banner: (ctx) => (
    <Link
      href={`${ctx.subpage}/haulage`}
      className="group relative flex min-h-[200px] flex-col justify-between gap-3 overflow-hidden rounded-3xl p-6 text-white transition hover:opacity-95 sm:p-7"
      style={{ background: "#111827" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2001_29_50%20PM.png"
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
            "linear-gradient(135deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.65) 100%)"
        }}
      />
      <div className="relative z-10">
        <p className="text-[16px] font-extrabold leading-tight sm:text-[18px]">
          Hire or move a machine
        </p>
        <p className="mt-1 text-[13px] leading-relaxed opacity-85">
          Pick from our fleet and we deliver, or tell us about a machine you own and we&rsquo;ll
          haul it. Live estimate in 4 steps.
        </p>
      </div>
      <span
        className="relative z-10 inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-xl px-4 text-[11px] font-extrabold uppercase tracking-widest transition group-hover:translate-x-0.5"
        style={{ background: "#FFB300", color: "#0A0A0A" }}
      >
        Start haulage wizard →
      </span>
    </Link>
  ),

  breakdown_banner: (ctx) => (
    <Link
      href={`${ctx.subpage}/breakdown`}
      className="group relative flex min-h-[200px] flex-col justify-between gap-3 overflow-hidden rounded-3xl p-6 text-white transition hover:opacity-95 sm:p-7"
      style={{ background: "#111827" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2001_18_24%20PM.png"
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
            "linear-gradient(135deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.65) 100%)"
        }}
      />
      <div className="relative z-10">
        <p className="text-[16px] font-extrabold leading-tight sm:text-[18px]">
          24/7 breakdown service
        </p>
        <p className="mt-1 text-[13px] leading-relaxed opacity-85">
          Broke down on-site? WhatsApp for a replacement machine within our SLA — same day
          local, next day national.
        </p>
      </div>
      <span
        className="relative z-10 inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-xl px-4 text-[11px] font-extrabold uppercase tracking-widest text-white transition"
        style={{ background: "#DC2626" }}
      >
        <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
          <span
            className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75"
            style={{ animation: "ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite" }}
          />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
        </span>
        Report breakdown →
      </span>
    </Link>
  ),

  delivery_zones: (ctx) =>
    ctx.cfg.delivery_zones.length === 0 ? null : (
      <PlantHireDeliveryZonesSection
        zones={ctx.cfg.delivery_zones}
        depotPostcode={ctx.cfg.depot_postcode}
        yardAddress={ctx.cfg.yard_address}
        merchantSlug={ctx.listing.slug}
      />
    ),

  machine_finder_cta: (ctx) => (
    <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-col-reverse items-stretch md:flex-row md:items-center">
        <div className="flex flex-col justify-between gap-4 py-5 pl-5 pr-5 sm:py-6 sm:pl-6 md:flex-row md:items-center md:pl-0 md:pr-6">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
              Machine finder · Guided
            </p>
            <h3 className="mt-1 text-[22px] font-extrabold leading-tight text-neutral-900 sm:text-[26px]">
              {ctx.cfg.machine_finder.heading}
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">
              {ctx.cfg.machine_finder.subheading}
            </p>
          </div>
          <Link
            href={`${ctx.subpage}/finder`}
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-xl bg-neutral-900 px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:bg-black"
          >
            Start finder →
          </Link>
        </div>
        <div className="relative aspect-[4/3] w-full shrink-0 md:aspect-auto md:h-full md:w-[240px] lg:w-[280px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%202,%202026,%2003_12_37%20PM.png"
            alt="Machine finder"
            loading="lazy"
            className="h-full w-full object-contain"
          />
        </div>
      </div>
    </div>
  ),

  site_calculator_cta: (ctx) =>
    ctx.cfg.site_calculator.materials.length === 0 ? null : (
      <CtaCard
        kicker="Site services · Live calculator"
        heading={ctx.cfg.site_calculator.heading}
        body="Type area + depth → tonnes + cost, live."
        href={`${ctx.subpage}/calculator`}
        label="Open calculator"
      />
    ),

  video_center_cta: (ctx) =>
    ctx.cfg.video_center.videos.length === 0 ? null : (
      <CtaCard
        kicker="Video centre"
        heading={ctx.cfg.video_center.heading}
        body={`${ctx.cfg.video_center.videos.length} video${ctx.cfg.video_center.videos.length === 1 ? "" : "s"} · watch the fleet on-site.`}
        href={`${ctx.subpage}/video`}
        label="Open video centre"
      />
    ),

  credentials_cta: (ctx) => (
    <CtaCard
      kicker="Vetted · Insured · Audited"
      heading={ctx.cfg.trust_signals.heading}
      body="Accreditations, insurance cover, awards + NPS."
      href={`${ctx.subpage}/credentials`}
      label="Open credentials"
    />
  ),

  trust_benefits_strip: (ctx) => {
    if (ctx.cfg.trust_benefits.length === 0) return null;
    return (
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
          Why hire from {ctx.merchantName}
        </p>
        <h3 className="mt-1 text-2xl font-extrabold text-neutral-900 sm:text-3xl">
          When the ground moves,{" "}
          <span style={{ color: "#FFB300" }}>
            {ctx.merchantName.split(" ")[0]}&rsquo;s
          </span>{" "}
          name is behind it.
        </h3>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ctx.cfg.trust_benefits.map((b, i) => {
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
              </>
            );
            return (
              <li key={b.label + i}>
                {b.url ? (
                  <Link
                    href={b.url}
                    className="flex h-full items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#FFB300] hover:shadow-md"
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
    );
  },

  trade_circle_banner: (ctx) => (
    <Link
      href="/trade-off/yard?context=plant-hire"
      className="group relative flex min-h-[200px] flex-col items-start gap-4 overflow-hidden rounded-2xl p-5 text-white transition hover:opacity-95 sm:flex-row sm:items-center sm:gap-6 sm:p-6"
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
      </div>
      <span
        className="relative z-10 inline-flex h-11 shrink-0 items-center gap-1 rounded-xl px-4 text-[11px] font-extrabold uppercase tracking-widest transition group-hover:translate-x-0.5"
        style={{ background: "#FFB300", color: "#0A0A0A" }}
      >
        Open Trade Circle →
      </span>
    </Link>
  ),

  careers_cta: (ctx) => (
    <CtaCard
      kicker="Careers · We're hiring"
      heading={ctx.cfg.driver_recruitment.heading}
      body="Drivers, mechanics, dispatch — apply online or download the form."
      href={`${ctx.subpage}/careers`}
      label="Open careers"
    />
  ),

  trade_accounts_cta: (ctx) => (
    <CtaCard
      kicker="Credit accounts · Trade only"
      heading={ctx.cfg.trade_accounts.heading}
      body="30 days from invoice, weekly statements, priority delivery."
      href={`${ctx.subpage}/trade-accounts`}
      label="Open account"
    />
  ),

  compliance_cta: (ctx) => (
    <CtaCard
      kicker="Wide load · Nationwide delivery · Compliance"
      heading={ctx.cfg.compliance_info.heading}
      body="Full STGO / VR1 process, operator's licence, goods-in-transit cover."
      href={`${ctx.subpage}/compliance`}
      label="Open compliance"
    />
  ),

  cdm_pack: (ctx) => (
    <PlantCdmPackSection
      cfg={ctx.cfg.cdm_pack}
      merchantSlug={ctx.listing.slug}
      waHref={ctx.waHref}
    />
  ),

  repeat_ladder: (ctx) => <PlantRepeatLadderSection cfg={ctx.cfg.repeat_ladder} />,

  notify_when_free_card: (ctx) => <PlantNotifyWhenFreeCard cfg={ctx.cfg.notify_when_free} />,

  bulk_quote_card: (ctx) => (
    <PlantBulkQuoteCard
      cfg={ctx.cfg.bulk_quote}
      waHref={ctx.waHref}
      merchantName={ctx.merchantName}
    />
  ),

  sub_hire_section: (ctx) => (
    <PlantSubHireSection
      cfg={ctx.cfg.sub_hire}
      waHref={ctx.waHref}
      merchantName={ctx.merchantName}
    />
  ),

  trade_counter_marquee: (ctx) => {
    const items = ctx.cfg.parts_counter.items;
    if (items.length === 0) return null;
    const featured = items.filter((i) => i.featured);
    const source = featured.length >= 4 ? featured : items;
    const shown = source.slice(0, 16);
    return (
      <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-900 p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
              Trade counter · Featured parts
            </p>
            <h3 className="mt-1 text-2xl font-extrabold sm:text-3xl">
              {items.length.toLocaleString()} SKU{items.length === 1 ? "" : "s"} on the shelf.
            </h3>
          </div>
          <Link
            href={`${ctx.subpage}/parts`}
            className="inline-flex h-11 shrink-0 items-center rounded-xl bg-[#FFB300] px-4 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 hover:brightness-95"
          >
            Open trade counter →
          </Link>
        </div>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {shown.slice(0, 6).map((it, i) => (
            <li key={"m_" + it.sku + i}>
              <Link
                href={`${ctx.subpage}/parts`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5"
              >
                <div className="relative aspect-square w-full max-w-full shrink-0 overflow-hidden bg-white/5">
                  {it.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.image_url}
                      alt={it.name}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full max-h-full max-w-full object-contain p-2"
                    />
                  )}
                </div>
                <div className="p-2">
                  <p className="text-[11px] font-extrabold leading-tight text-white">
                    {it.name}
                  </p>
                  {it.price_pence !== null && (
                    <p className="mt-0.5 text-[12px] font-extrabold text-[#FFB300]">
                      £{(it.price_pence / 100).toFixed(2)}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  },

  big_cta: (ctx) => (
    <div className="text-center">
      <Link
        href={`${ctx.subpage}/machines`}
        className="inline-flex h-14 items-center rounded-2xl px-8 text-[13px] font-extrabold uppercase tracking-widest text-neutral-900 shadow-lg transition hover:brightness-95"
        style={{ background: "#FFB300" }}
      >
        See all machines →
      </Link>
    </div>
  )
};

function CtaCard({
  kicker,
  heading,
  body,
  href,
  label
}: {
  kicker: string;
  heading: string;
  body: string;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col items-start justify-between gap-3 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#FFB300] hover:shadow-md sm:flex-row sm:items-center sm:p-6"
    >
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
          {kicker}
        </p>
        <h3 className="mt-1 text-[20px] font-extrabold leading-tight text-neutral-900 sm:text-[22px]">
          {heading}
        </h3>
        <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-neutral-600">{body}</p>
      </div>
      <span className="inline-flex h-11 shrink-0 items-center rounded-xl bg-neutral-900 px-4 text-[11px] font-extrabold uppercase tracking-widest text-white transition group-hover:bg-black">
        {label} →
      </span>
    </Link>
  );
}
