"use client";

// App Warehouse browser — the public /apps shop.
//
// Filter by trade → filter by category → filter by tier (free/pro).
// Cards show tagline + bullets + install button. Featured apps pin
// to the top of every view.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  APP_CATEGORIES,
  WAREHOUSE_APPS,
  type AppCategory,
  type WarehouseApp,
  warehouseAppsFor,
  warehouseFreeCount,
  warehouseProCount
} from "@/lib/apps/warehouse";
import {
  Activity,
  Calculator,
  Camera,
  FileText,
  Mail,
  Package,
  Sparkles,
  Star,
  UserRound,
  Users,
  Search,
  Filter,
  Check,
  Wrench,
  Eye,
  X,
  Zap,
  Lightbulb,
  TrendingUp,
  Award,
  Clock,
  Plus,
  ChevronRight,
  Download
} from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_AMBER, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

/** Hero background — construction warehouse aesthetic. Serves as the
 *  visual anchor for the /apps page hero. Hosted on ImageKit so it CDN-
 *  serves without a repo asset. */
const HERO_BG_URL = "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2010,%202026,%2012_04_19%20AM.png";

const ICONS: Record<string, typeof Wrench> = {
  Activity, Calculator, Camera, FileText, Mail, Package,
  Sparkles, Star, UserRound, Users, Wrench
};

const BLACK = BRAND_BLACK;
const AMBER = BRAND_AMBER;
const YELLOW = BRAND_YELLOW;
const GREEN = BRAND_GREEN_DARK; // dark green — Philip's rule

type Trade = { slug: string; label: string };

type Props = {
  trades: readonly Trade[];
  initialTrade: string;
  initialCategory: string;
  initialTier: "free" | "pro" | "";
};

export function AppWarehouseBrowser({
  trades,
  initialTrade,
  initialCategory,
  initialTier
}: Props): JSX.Element {
  const [tradeSlug, setTradeSlug] = useState(initialTrade);
  const [category, setCategory] = useState<AppCategory | "">(
    initialCategory as AppCategory | ""
  );
  const [tier, setTier] = useState<"free" | "pro" | "">(initialTier);
  const [query, setQuery] = useState("");
  const [infoApp, setInfoApp] = useState<WarehouseApp | null>(null);
  const [recommendOpen, setRecommendOpen] = useState(false);

  const filtered = useMemo(() => {
    const pool = tradeSlug ? warehouseAppsFor(tradeSlug) : WAREHOUSE_APPS;
    return pool
      .filter((a) => !category || a.category === category)
      .filter((a) => !tier || a.tier === tier)
      .filter((a) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
          a.name.toLowerCase().includes(q) ||
          a.tagline.toLowerCase().includes(q) ||
          a.slug.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        if (a.tier !== b.tier) return a.tier === "free" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [tradeSlug, category, tier, query]);

  const freeCount = warehouseFreeCount(tradeSlug || undefined);
  const proCount = warehouseProCount(tradeSlug || undefined);

  return (
    <div className="min-h-screen text-slate-900" style={{ fontFamily: "Inter, system-ui, sans-serif", backgroundColor: "#FBF6EC" }}>
      {/* Yard-style top nav — plain text links on white, no logo bar */}
      <YardStyleSubNav active="warehouse" />

      {/* Yard-style page title strip — big title + subhead + Recommend CTA */}
      <YardStylePageTitle
        title="App Warehouse"
        subtitle={`Every calculator, quote form, and network app. ${WAREHOUSE_APPS.length} apps live.`}
        onRecommend={() => setRecommendOpen(true)}
      />

      {/* Hero — floating rounded banner with left/right padding.
          Warehouse image as background, text overlaid on top. */}
      <div className="px-3 pt-4 sm:px-6 sm:pt-6">
        <div className="relative overflow-hidden rounded-2xl shadow-lg sm:rounded-3xl">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url('${HERO_BG_URL}')`,
              backgroundSize: "cover",
              backgroundPosition: "center"
            }}
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.25) 100%)" }}
          />

          <div className="relative mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14 md:py-18">
          <h1 className="text-[26px] font-bold leading-tight text-white sm:text-[32px] md:text-[40px]" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
            Every calculator, quote form, and network app.<br className="hidden sm:block"/>
            <span style={{ color: YELLOW }}>For every UK trade.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-white/90 sm:text-[15px]" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}>
            {freeCount} free apps bundled with your £14.99/mo profile. {proCount} paid apps for when you need more. Filter by trade. See only what fits you.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold shadow-md sm:text-[13px]"
              style={{ backgroundColor: BRAND_GREEN_DARK, color: "#FFFFFF" }}
            >
              <Check size={13} color="#FFFFFF" strokeWidth={2.5}/>
              {freeCount} Free apps
            </div>
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold shadow-md sm:text-[13px]"
              style={{ backgroundColor: YELLOW, color: BLACK }}
            >
              <span>£</span>
              {proCount} Pro apps
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* App Recommendation modal — bottom-sheet on mobile, dialog on desktop */}
      {recommendOpen && <IdeaSubmitModal onClose={() => setRecommendOpen(false)} />}

      {/* Live activity strip — in-progress apps + recently updated + submit idea */}
      <WarehouseLiveStripNoBorder />



      {/* Filter bar — mobile: search full-width row, filters compact row.
          Desktop: single row. Cream background, yellow accents. */}
      <div className="sticky top-0 z-10" style={{ backgroundColor: "#FBF6EC" }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-4">
          {/* Row 2 on mobile: trade + category selects side-by-side, tier tabs full width below */}
          <div className="flex gap-2 sm:contents">
            <select
              value={tradeSlug}
              onChange={(e) => setTradeSlug(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-md bg-white px-2 text-[13px] font-semibold text-slate-900 shadow-sm sm:flex-none sm:px-3 sm:text-[14px]"
              style={{ border: `2px solid ${tradeSlug ? YELLOW : "#E2E8F0"}` }}
            >
              <option value="">All trades</option>
              {trades.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AppCategory | "")}
              className="h-11 min-w-0 flex-1 rounded-md bg-white px-2 text-[13px] font-semibold text-slate-900 shadow-sm sm:flex-none sm:px-3 sm:text-[14px]"
              style={{ border: `2px solid ${category ? YELLOW : "#E2E8F0"}` }}
            >
              <option value="">All categories</option>
              {APP_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex overflow-hidden rounded-md bg-white shadow-sm" style={{ border: `2px solid ${tier ? YELLOW : "#E2E8F0"}` }}>
            <button
              onClick={() => setTier("")}
              className="h-10 px-3 text-[13px] font-bold"
              style={tier === "" ? { backgroundColor: YELLOW, color: BLACK } : { color: "#334155" }}
            >
              All
            </button>
            <button
              onClick={() => setTier("free")}
              className="h-10 border-l border-slate-200 px-3 text-[13px] font-bold"
              style={tier === "free" ? { backgroundColor: YELLOW, color: BLACK } : { color: "#334155" }}
            >
              Free
            </button>
            <button
              onClick={() => setTier("pro")}
              className="h-10 border-l border-slate-200 px-3 text-[13px] font-bold"
              style={tier === "pro" ? { backgroundColor: YELLOW, color: BLACK } : { color: "#334155" }}
            >
              Pro
            </button>
          </div>
          {(tradeSlug || category || tier || query) && (
            <button
              onClick={() => { setTradeSlug(""); setCategory(""); setTier(""); setQuery(""); }}
              className="flex h-11 items-center gap-1 rounded-md px-3 text-[13px] font-bold shadow-sm"
              style={{ backgroundColor: YELLOW, color: BLACK }}
              title="Clear all filters"
            >
              <X size={13} strokeWidth={2.5}/>
              Reset
            </button>
          )}
        </div>
      </div>

      {/* App grid */}
      <div className="mx-auto max-w-6xl px-4 pt-6">

        {filtered.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
            <Filter size={24} className="mx-auto mb-2 text-slate-400" />
            <div className="text-[14px] font-semibold text-slate-900">No apps match those filters</div>
            <div className="mt-1 text-[13px] text-slate-500">
              Try clearing the trade filter or category.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 pb-16 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filtered.map((app) => (
              <AppCard key={app.slug} app={app} onOpenInfo={setInfoApp} />
            ))}
          </div>
        )}
      </div>

      {infoApp && <AppInfoModal app={infoApp} onClose={() => setInfoApp(null)} />}
    </div>
  );
}

/** Derive a compact card label. Calc apps drop " Calculator" — other
 *  apps use `shortName` when provided, else `name`. */
function shortLabelFor(app: WarehouseApp): string {
  if (app.shortName) return app.shortName;
  if (app.slug.startsWith("calc-")) return app.name.replace(/ Calculator$/, "");
  return app.name;
}

const BADGE_STYLES: Record<string, { bg: string; fg: string; icon: typeof Award; label: string }> = {
  "founders-pick": { bg: BLACK, fg: YELLOW, icon: Award, label: "Founder's Pick" },
  "trending": { bg: AMBER, fg: "#0A0A0A", icon: TrendingUp, label: "Trending" },
  "new": { bg: "#0EA5E9", fg: "#FFFFFF", icon: Sparkles, label: "New" },
  "popular": { bg: "#8B4513", fg: "#FFFFFF", icon: Users, label: "Popular" }
};

function AppCard({
  app,
  onOpenInfo
}: {
  app: WarehouseApp;
  onOpenInfo: (app: WarehouseApp) => void;
}): JSX.Element {
  const Icon = ICONS[app.icon] ?? Wrench;
  const isFree = app.tier === "free";
  const label = shortLabelFor(app);
  const badge = app.installBadge ? BADGE_STYLES[app.installBadge] : null;

  // Force ImageKit to serve a sharp square version so cards stay crisp.
  const cardImage = app.bannerImage && app.bannerImage.includes("imagekit.io")
    ? `${app.bannerImage}${app.bannerImage.includes("?") ? "&" : "?"}tr=w-800,h-800,fo-auto,c-maintain_ratio,bg-FFFFFF`
    : app.bannerImage;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:border-slate-400 hover:shadow-sm">
      {/* Eye icon — small yellow chip, top-right, minimal footprint */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenInfo(app);
        }}
        className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full shadow-md transition hover:brightness-95"
        style={{ backgroundColor: YELLOW }}
        aria-label={`What is ${app.name}?`}
        title={`What is ${app.name}?`}
      >
        <Eye size={12} color={BLACK} strokeWidth={2.5}/>
      </button>

      {/* Square banner slot — image if we have it, else icon on brand black.
          Badges live below the image (in the footer) so nothing covers it. */}
      <Link href={`/apps/${app.slug}`} className="block aspect-square w-full overflow-hidden">
        {cardImage ? (
          <div
            className="h-full w-full transition-transform duration-300 group-hover:scale-105"
            style={{
              backgroundImage: `url('${cardImage}')`,
              backgroundSize: "cover",
              backgroundPosition: "center"
            }}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ backgroundColor: BLACK }}
          >
            <Icon size={56} color={YELLOW} strokeWidth={1.8} />
          </div>
        )}
      </Link>

      {/* Compact footer row — short name + install chip */}
      <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[13px] font-bold text-slate-900"
            title={app.name}
          >
            {label}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {app.category}
          </div>
        </div>
        <Link
          href={`/apps/${app.slug}`}
          className="flex h-8 flex-shrink-0 items-center rounded-md px-2 text-[12px] font-semibold"
          style={{ backgroundColor: YELLOW, color: BLACK }}
        >
          Install
        </Link>
      </div>
    </div>
  );
}

const PRICING_COPY: Record<string, { primary: string; sub: string; badge: string; badgeBg: string }> = {
  "bundled":         { primary: "Free with your plan", sub: "Bundled with your £14.99/mo profile — no extra charge.", badge: "Free · Plan", badgeBg: BRAND_GREEN_DARK },
  "paid-monthly":    { primary: "Pro add-on",           sub: "Extra £/mo on top of your profile plan. Cancel anytime.", badge: "Add-on",     badgeBg: BRAND_AMBER },
  "paid-oneoff":     { primary: "One-off install",      sub: "Pay once when you install. No recurring charge.",         badge: "One-off",    badgeBg: BRAND_AMBER },
  "free-standalone": { primary: "Free — no plan",       sub: "Genuinely free. No profile subscription required.",       badge: "Free",       badgeBg: BRAND_GREEN_DARK }
};

function AppInfoModal({
  app,
  onClose
}: {
  app: WarehouseApp;
  onClose: () => void;
}): JSX.Element {
  const isFree = app.tier === "free";
  const Icon = ICONS[app.icon] ?? Wrench;
  const badge = app.installBadge ? BADGE_STYLES[app.installBadge] : null;
  const pricingModel = app.pricingModel ?? (isFree ? "bundled" : "paid-monthly");
  const pricing = PRICING_COPY[pricingModel]!;
  const ctaLabel = isFree
    ? (pricingModel === "bundled" ? "Install — included in plan" : "Install free")
    : (pricingModel === "paid-oneoff"
        ? `Install — £${app.price?.oneOff ?? app.price?.monthly ?? ""} once`
        : `Start Pro — £${app.price?.monthly ?? ""}/mo`);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:px-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag pill */}
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm hover:bg-slate-100"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Banner with dark gradient + title overlay */}
        <div className="relative aspect-[16/10] w-full overflow-hidden sm:aspect-video">
          {app.bannerImage ? (
            <div
              className="h-full w-full"
              style={{
                backgroundImage: `url('${app.bannerImage}')`,
                backgroundSize: "cover",
                backgroundPosition: "center"
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: BLACK }}>
              <Icon size={72} color={YELLOW} strokeWidth={1.8} />
            </div>
          )}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.85) 100%)" }}
          />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                style={{ backgroundColor: pricing.badgeBg }}
              >
                {pricing.badge}
              </span>
              {badge && (
                <span
                  className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: badge.bg, color: badge.fg }}
                >
                  <badge.icon size={10} strokeWidth={2.5}/>
                  {badge.label}
                </span>
              )}
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/80">
                {app.category}
              </span>
            </div>
            <div className="mt-1 text-[22px] font-bold leading-tight text-white sm:text-[24px]">
              {app.name}
            </div>
            <div className="mt-0.5 text-[13px] leading-snug text-white/80">
              {app.tagline}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* Benefit — the one-line "why" */}
          {app.benefit && (
            <div
              className="mb-4 flex items-start gap-2 rounded-lg border p-3"
              style={{ borderColor: `${YELLOW}66`, backgroundColor: `${YELLOW}10` }}
            >
              <Zap size={16} className="mt-0.5 flex-shrink-0" color={AMBER} strokeWidth={2.5}/>
              <div className="text-[13px] font-semibold leading-snug text-slate-900">
                {app.benefit}
              </div>
            </div>
          )}

          {/* Pricing model box */}
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: pricing.badgeBg }}>
              {isFree ? <Check size={14} color="#FFFFFF" strokeWidth={2.5}/> : <span className="text-[11px] font-bold text-white">£</span>}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-slate-900">{pricing.primary}</div>
              <div className="mt-0.5 text-[12px] leading-snug text-slate-600">{pricing.sub}</div>
              {!isFree && app.price?.monthly && (
                <div className="mt-1 text-[16px] font-bold" style={{ color: AMBER }}>
                  £{app.price.monthly}<span className="text-[11px] font-semibold text-slate-500">/mo</span>
                </div>
              )}
            </div>
          </div>

          {/* What it does */}
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              What it does
            </div>
            <ul className="flex flex-col gap-1.5">
              {app.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-[13px] leading-snug text-slate-700">
                  <Check size={13} className="mt-1 flex-shrink-0" color={AMBER} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Why this matters — outcomes */}
          {app.outcomes && app.outcomes.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <TrendingUp size={11} color={BRAND_GREEN_DARK}/>
                Why this matters for you
              </div>
              <ul className="flex flex-col gap-1.5">
                {app.outcomes.map((o) => (
                  <li key={o} className="flex items-start gap-2 rounded-md border-l-2 py-1 pl-2 pr-1 text-[13px] leading-snug text-slate-700"
                    style={{ borderColor: BRAND_GREEN_DARK, backgroundColor: `${BRAND_GREEN_DARK}08` }}>
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Best for context */}
          {app.bestForContext && (
            <div className="mt-4">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Best for
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-2.5 text-[12px] leading-snug italic text-slate-600">
                "{app.bestForContext}"
              </div>
            </div>
          )}

          {/* Plugs into */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[12px] text-slate-600">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Plugs into:</span>
            {app.zones.map((z) => (
              <span
                key={z}
                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700"
              >
                {z}
              </span>
            ))}
          </div>
        </div>

        {/* Sticky footer with dark-green primary CTA */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
          <button
            onClick={onClose}
            className="hidden h-11 rounded-md border border-slate-300 bg-white px-4 text-[13px] font-semibold text-slate-900 sm:block"
          >
            Close
          </button>
          <Link
            href={`/apps/${app.slug}`}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md px-4 text-[14px] font-bold text-white sm:flex-none"
            style={{ backgroundColor: BRAND_GREEN_DARK }}
          >
            <Download size={14}/>
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Live activity strip — in-progress apps + recently updated +
// user idea submission. Mobile-first: horizontal-scroll on
// mobile, full grid on desktop.
// ────────────────────────────────────────────────────────────

type LiveApp = {
  name: string;
  category: string;
  eta?: string;         // "Sep 2026"
  progress?: number;    // 0–100
  status: "in-progress" | "recently-updated" | "coming-soon";
  icon: keyof typeof ICONS;
  blurb: string;
};

const LIVE_APPS: LiveApp[] = [
  {
    name: "Site Diary Pro",
    category: "portfolio",
    eta: "Aug 2026",
    progress: 62,
    status: "in-progress",
    icon: "Camera",
    blurb: "GPS-tagged site diary that auto-writes weekly progress reports."
  },
  {
    name: "Quote Workspace",
    category: "sales",
    status: "recently-updated",
    icon: "FileText",
    blurb: "Now auto-nudges leads at 72h — recovers ~1 in 4 stalled quotes."
  },
  {
    name: "AI Visualiser",
    category: "sales",
    status: "recently-updated",
    icon: "Sparkles",
    blurb: "Reference-photo depth better; kitchens now feel 30% more real."
  },
  {
    name: "Referrals",
    category: "network",
    eta: "Oct 2026",
    progress: 28,
    status: "in-progress",
    icon: "Users",
    blurb: "Track who referred which customer to you — automatic thank-yous."
  },
  {
    name: "Insurance Vault",
    category: "customer",
    eta: "Q4 2026",
    progress: 12,
    status: "coming-soon",
    icon: "Wrench",
    blurb: "Customer stores insurance docs alongside every job — one place, always."
  }
];

function WarehouseLiveStripNoBorder(): JSX.Element {
  const [ideaOpen, setIdeaOpen] = useState(false);
  const inProgress = LIVE_APPS.filter((a) => a.status !== "recently-updated");
  const updated = LIVE_APPS.filter((a) => a.status === "recently-updated");

  return (
    <>
      <div style={{ backgroundColor: "#FBF6EC" }}>
        <div className="mx-auto max-w-6xl px-4 py-3 sm:py-4">
          {/* Header + submit-idea CTA */}
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: BRAND_GREEN_DARK }}>
              <span className="h-2 w-2 animate-pulse rounded-full bg-white"/>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold uppercase tracking-wider text-slate-900">
                Warehouse is live
              </div>
              <div className="text-[11px] leading-tight text-slate-500">
                {inProgress.length} in build · {updated.length} updated this week
              </div>
            </div>
          </div>

          {/* Horizontal-scroll strip on mobile, grid on desktop */}
          <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {LIVE_APPS.map((la) => {
              const Icon = ICONS[la.icon] ?? Wrench;
              const isBuilding = la.status === "in-progress" || la.status === "coming-soon";
              const statusColor = la.status === "recently-updated" ? BRAND_GREEN_DARK
                : la.status === "in-progress" ? AMBER
                : "#8B4513";
              const statusLabel = la.status === "recently-updated" ? "Updated"
                : la.status === "in-progress" ? "In build"
                : "Coming";
              return (
                <div
                  key={la.name}
                  className="w-[220px] flex-shrink-0 snap-start rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:w-auto"
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: BLACK }}
                    >
                      <Icon size={14} color={YELLOW}/>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <div className="truncate text-[12px] font-bold text-slate-900">{la.name}</div>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1">
                        <span
                          className="rounded-sm px-1 text-[8px] font-bold uppercase tracking-wider text-white"
                          style={{ backgroundColor: statusColor }}
                        >
                          {statusLabel}
                        </span>
                        {la.eta && (
                          <span className="flex items-center gap-0.5 text-[9px] font-semibold text-slate-500">
                            <Clock size={8}/>
                            {la.eta}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-slate-600">
                    {la.blurb}
                  </div>
                  {isBuilding && typeof la.progress === "number" && (
                    <div className="mt-2">
                      <div className="h-1 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${la.progress}%`, backgroundColor: AMBER }}
                        />
                      </div>
                      <div className="mt-0.5 text-[9px] font-semibold text-slate-500">{la.progress}% built</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {ideaOpen && <IdeaSubmitModal onClose={() => setIdeaOpen(false)} />}
    </>
  );
}

/** Yard-style top nav — plain text links on white, no logo bar, sticky
 *  at top. Matches YardInboxShell's SubNav visual for consistency. */
function YardStyleSubNav({ active }: { active: string }): JSX.Element {
  const items: Array<{ id: string; label: string; href: string }> = [
    { id: "home", label: "Home", href: "/trade-off" },
    { id: "warehouse", label: "App Warehouse", href: "/apps" },
    { id: "yard", label: "The Yard", href: "/trade-off/yard" },
    { id: "news", label: "Trade News", href: "/trade-off/yard?topic=news" },
    { id: "studio", label: "Studio", href: "/studio/editor" },
    { id: "pricing", label: "Pricing", href: "/trade-off/pricing" },
    { id: "showcase", label: "Showcase", href: "/showcase" },
    { id: "how", label: "How it works", href: "/trade-off/how" }
  ];
  return (
    <nav
      className="sticky top-0 z-30 backdrop-blur"
      style={{ backgroundColor: "rgba(251,246,236,0.95)", borderBottom: "1px solid rgba(139,69,19,0.15)" }}
    >
      <div
        className="mx-auto flex w-full max-w-[1400px] items-center gap-5 overflow-x-auto px-3 py-3 sm:gap-6 sm:px-6"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <style>{`nav > div::-webkit-scrollbar{display:none;}`}</style>
        {items.map((it) => {
          const isActive = it.id === active;
          return (
            <Link
              key={it.id}
              href={it.href}
              className="inline-flex shrink-0 items-center text-[13px] font-bold tracking-wide transition"
              style={{
                color: isActive ? "#111827" : "#6B7280",
                borderBottom: isActive ? `2px solid ${BRAND_YELLOW}` : "2px solid transparent",
                paddingBottom: "6px",
                marginBottom: "-6px"
              }}
            >
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Yard-style page title strip — big black-weight title + subhead,
 *  yellow pill CTA on the right. Matches YardInboxShell.PageTitleStrip. */
function YardStylePageTitle({
  title, subtitle, onRecommend
}: {
  title: string;
  subtitle: string;
  onRecommend?: () => void;
}): JSX.Element {
  return (
    <section style={{ backgroundColor: "#FBF6EC", borderBottom: "1px solid rgba(139,69,19,0.15)" }}>
      <div className="mx-auto flex w-full max-w-[1400px] items-start gap-3 px-3 py-5 md:px-6 md:py-8">
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-black leading-tight text-neutral-900 md:text-[32px]">
            {title}
          </h1>
          <p className="mt-1 text-[12px] leading-snug text-neutral-600 md:text-[14px]">
            {subtitle}
          </p>
        </div>
        {onRecommend && (
          <button
            onClick={onRecommend}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-extrabold uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.97] md:h-12 md:px-5 md:text-[13px]"
            style={{ background: BRAND_YELLOW }}
            aria-label="Recommend an App"
          >
            <Lightbulb size={14} strokeWidth={2.5}/>
            <span className="hidden sm:inline">Recommend an App</span>
            <span className="sm:hidden">Recommend</span>
          </button>
        )}
      </div>
    </section>
  );
}

/** DEPRECATED — kept only for backward-compat reference. Use
 *  YardStyleSubNav above instead. */
function _SubNavLegacy({ active }: { active: string }): JSX.Element {
  const links: Array<{ id: string; label: string; href: string }> = [
    { id: "home", label: "Home", href: "/trade-off" },
    { id: "warehouse", label: "App Warehouse", href: "/apps" },
    { id: "studio", label: "Studio", href: "/studio/editor" },
    { id: "yard", label: "The Yard", href: "/trade-off/yard" },
    { id: "pricing", label: "Pricing", href: "/trade-off/pricing" },
    { id: "showcase", label: "Showcase", href: "/showcase" },
    { id: "contact", label: "Contact", href: "/contact" }
  ];
  return (
    <div style={{ backgroundColor: BRAND_BLACK, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="mx-auto max-w-6xl">
        <nav className="scrollbar-hide flex gap-1 overflow-x-auto px-2 py-2 sm:px-4">
          {links.map((l) => {
            const isActive = l.id === active;
            return (
              <Link
                key={l.id}
                href={l.href}
                className="flex h-9 flex-shrink-0 items-center rounded-full px-3 text-[12px] font-bold uppercase tracking-wider transition hover:text-white"
                style={isActive
                  ? { backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }
                  : { color: "rgba(255,255,255,0.7)" }}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function IdeaSubmitModal({ onClose }: { onClose: () => void }): JSX.Element {
  const [trade, setTrade] = useState("");
  const [problem, setProblem] = useState("");
  const [dream, setDream] = useState("");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/apps/idea-submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trade, problem, dream, contact })
      });
      const json = await res.json() as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "submit-failed");
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = problem.trim().length > 4 && dream.trim().length > 4;

  // Progress signal — how many of the 4 fields have real content.
  const filled = [trade, problem, dream, contact].filter((s) => s.trim().length > 0).length;
  const pct = Math.round((filled / 4) * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:px-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-300"/>
        </div>

        {sent ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: BRAND_GREEN_DARK }}>
              <Check size={30} color="#FFFFFF" strokeWidth={2.5}/>
            </div>
            <div className="text-[22px] font-bold leading-tight text-slate-900">Recommendation logged</div>
            <div className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-slate-600">
              Our product team examines every recommendation against App Warehouse build standards. Check back in a few weeks — if it meets the bar, it will be live in the warehouse.
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: BRAND_GREEN_DARK }}/>
              Under review
            </div>
            <div className="mt-6">
              <button
                onClick={onClose}
                className="h-11 rounded-md px-8 text-[13px] font-bold uppercase tracking-wider text-white shadow-sm"
                style={{ backgroundColor: BRAND_BLACK }}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Executive header — dark bar with yellow accent and progress rail */}
            <div className="relative" style={{ backgroundColor: BRAND_BLACK }}>
              <button
                onClick={onClose}
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10"
                aria-label="Close"
              >
                <X size={16} color="#FFFFFF"/>
              </button>
              <div className="px-5 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md" style={{ backgroundColor: YELLOW }}>
                    <Lightbulb size={16} color={BLACK} strokeWidth={2.5}/>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: YELLOW }}>
                      App Warehouse · Recommendations
                    </div>
                    <div className="text-[19px] font-bold leading-tight text-white sm:text-[20px]">
                      Recommend an App
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-[12px] leading-snug text-white/70">
                  Suggest an app you'd like added to the App Warehouse. Recommendations are examined against our build standards; qualifying ideas ship to the warehouse within a few weeks.
                </div>
              </div>
              {/* Progress rail */}
              <div className="h-0.5 w-full bg-white/10">
                <div className="h-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: YELLOW }}/>
              </div>
            </div>

            {/* Body — scroll region, hidden scrollbar */}
            <div
              className="flex-1 overflow-y-auto p-5 sm:p-6"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              <style>{`.pro-form-scroll::-webkit-scrollbar{display:none;}`}</style>

              <div className="space-y-4">
                <FieldCard
                  step={1}
                  title="Your trade"
                  hint="Optional. Helps route the review to the right vertical lead."
                  filled={trade.trim().length > 0}
                >
                  <input
                    value={trade}
                    onChange={(e) => setTrade(e.target.value)}
                    placeholder="e.g. Carpenter, Kitchen Fitter, Electrician"
                    className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-[13px] focus:outline-none"
                    style={{ borderColor: trade ? YELLOW : undefined }}
                  />
                </FieldCard>

                <FieldCard
                  step={2}
                  title="The problem you're solving"
                  hint="What breaks or wastes time in your workflow today?"
                  required
                  filled={problem.trim().length > 4}
                >
                  <textarea
                    value={problem}
                    onChange={(e) => setProblem(e.target.value)}
                    rows={2}
                    placeholder="e.g. Losing track of which customer replied to which quote last week."
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] focus:outline-none"
                    style={{ borderColor: problem ? YELLOW : undefined, resize: "none" }}
                  />
                </FieldCard>

                <FieldCard
                  step={3}
                  title="What the app would do"
                  hint="One sentence of shape is enough. The team will fill in the specifics."
                  required
                  filled={dream.trim().length > 4}
                >
                  <textarea
                    value={dream}
                    onChange={(e) => setDream(e.target.value)}
                    rows={3}
                    placeholder="e.g. A single inbox pulling every enquiry across WhatsApp, email, and Yard replies into one thread per customer."
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] focus:outline-none"
                    style={{ borderColor: dream ? YELLOW : undefined, resize: "none" }}
                  />
                </FieldCard>

                <FieldCard
                  step={4}
                  title="Contact for follow-up"
                  hint="Optional. WhatsApp or email if you'd like a reply."
                  filled={contact.trim().length > 0}
                >
                  <input
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="e.g. +44 7… or you@company.co.uk"
                    className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-[13px] focus:outline-none"
                    style={{ borderColor: contact ? YELLOW : undefined }}
                  />
                </FieldCard>

                {/* Reassurance strip */}
                <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: BRAND_GREEN_DARK }}>
                    <Check size={11} color="#FFFFFF" strokeWidth={3}/>
                  </div>
                  <div className="text-[11px] leading-snug text-slate-600">
                    <div className="font-bold text-slate-900">Examined against App Warehouse standards.</div>
                    Qualifying recommendations are built and released to the warehouse within a few weeks. Check back and yours could be live.
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">
                  Something went wrong ({error}). Try again in a moment.
                </div>
              )}
            </div>

            {/* Sticky footer — dark green submit, black cancel, no borders */}
            <div className="flex items-center gap-2 bg-white p-4 sm:p-5" style={{ borderTop: "1px solid #F1F5F9" }}>
              <button
                onClick={onClose}
                className="h-11 flex-shrink-0 rounded-md border border-slate-200 bg-white px-4 text-[12px] font-bold uppercase tracking-wider text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!canSubmit || submitting}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md text-[13px] font-bold uppercase tracking-wider text-white shadow-sm transition disabled:opacity-40"
                style={{ backgroundColor: BRAND_GREEN_DARK }}
              >
                {submitting ? "Submitting…" : "Submit Recommendation"}
                {!submitting && <ChevronRight size={14} strokeWidth={3}/>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Step card with a numbered chip, title, hint, filled-tick, and slot. */
function FieldCard({
  step, title, hint, required, filled, children
}: {
  step: number;
  title: string;
  hint?: string;
  required?: boolean;
  filled?: boolean;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
      <div className="mb-2 flex items-start gap-2.5">
        <div
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
          style={{
            backgroundColor: filled ? BRAND_GREEN_DARK : BRAND_BLACK,
            color: "#FFFFFF"
          }}
        >
          {filled ? <Check size={11} strokeWidth={3}/> : step}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="text-[13px] font-bold text-slate-900">{title}</div>
            {required && (
              <span className="rounded-sm px-1 text-[8px] font-bold uppercase tracking-wider" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
                Required
              </span>
            )}
          </div>
          {hint && <div className="mt-0.5 text-[11px] leading-snug text-slate-500">{hint}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}
