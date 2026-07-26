"use client";

// NexCentreShell — NEX Trade Centre. World-class mobile experience
// per the Master Prompt. Off-white premium light theme, magazine-
// style layouts, no dark backgrounds, no repeating grids, deliberate
// visual rhythm across 12 sections.
//
// Palette (locked to the NEX design language, no exceptions):
//   bg             #FAF8F4        off-white page
//   card           #FFFFFF        pure-white surface
//   primary        #F68A1E        NEX orange
//   secondary      #FFB15A        warm orange (gradient stop)
//   lightOrange    #FFE7CC        tint for chips + accents
//   text           #222222        headings + body
//   textSoft       #6B7280        secondary text
//   border         #ECECEC        hairline
//   gradient       #F68A1E → #FFB15A on CTAs and accent chips
//
// Section rhythm (deliberate — no boring grids):
//   1  Floating hero        — living trading world
//   2  Universal AI search  — glass bar
//   3  Trade Worlds         — magazine category cards
//   4  Live Trading         — activity feed
//   5  Featured Opps        — magazine offer cards
//   6  Trending Projects    — project cards + apply
//   7  Nearby Suppliers     — horizontal supplier row
//   8  Trade Insights       — Bloomberg-style analytics
//   9  NEX AI Assistant     — large glass recommendation card
//   10 Recommended For You  — magazine alternating
//   11 Trade Community      — floating avatars
//   12 Floating CTA         — orange glass button

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Bell, Camera, ChevronRight, Clock,
  Eye, MapPin, MessageSquare, Mic, Package, ShieldCheck, Sparkles, Star,
  TrendingUp, Users, Zap
} from "lucide-react";
import { StatusBar } from "../shell/StatusBar";
import { SupplierCard } from "./SupplierCard";
import { SupplierSheet } from "./SupplierSheet";
import { NEARBY_SUPPLIERS, FEATURED_SUPPLIER } from "@/lib/nex/centre/_mock";
import type { Supplier } from "@/lib/nex/centre/_types";
import {
  HERO_PIPS, TRADE_WORLDS, LIVE_TRADES, OPPORTUNITIES, PROJECTS,
  INSIGHTS, RECOMMENDED, COMMUNITY, fmtHours
} from "@/lib/nex/centre/_sections_mock";

// ── Locked palette ────────────────────────────────────────────────
export const T = {
  bg:           "#FAF8F4",
  card:         "#FFFFFF",
  primary:      "#F68A1E",
  secondary:    "#FFB15A",
  lightOrange:  "#FFE7CC",
  // Dark green for messaging CTAs per CLAUDE.md ("Dark green for
  // CTAs... use #166534 for CTAs"). Consumed by SupplierCard +
  // SupplierSheet — keep this token or those components will crash
  // if this shell is ever re-routed.
  whatsapp:     "#166534",
  text:         "#222222",
  textSoft:     "#6B7280",
  border:       "#ECECEC",
  gradient:     "linear-gradient(135deg, #F68A1E 0%, #FFB15A 100%)",
  gradientSoft: "linear-gradient(135deg, #FFE7CC 0%, #FFF6EB 100%)",
  shadowSoft:   "0 10px 30px -14px rgba(246,138,30,0.18), 0 4px 14px -8px rgba(0,0,0,0.06)",
  shadowLift:   "0 20px 50px -18px rgba(246,138,30,0.28), 0 8px 20px -10px rgba(0,0,0,0.08)"
};

// ═══════════════════════════════════════════════════════════════════
// Shell composition
// ═══════════════════════════════════════════════════════════════════

export function NexCentreShell() {
  const [openSupplier, setOpenSupplier] = useState<Supplier | null>(null);

  return (
    <div
      className="relative mx-auto flex w-full max-w-md flex-col"
      style={{ background: T.bg, color: T.text, minHeight: "100dvh" }}
    >
      <StatusBar />
      <TopBar />

      <main className="flex flex-col pb-32">
        <FloatingHero />
        <AISearchBar />
        <TradeWorldsSection />
        <LiveTradingSection />
        <FeaturedOpportunitiesSection />
        <TrendingProjectsSection />
        <NearbySuppliersSection onOpen={setOpenSupplier} />
        <TradeInsightsSection />
        <NexAssistantCardSection />
        <RecommendedForYouSection />
        <TradeCommunitySection />
      </main>

      <FloatingCTA />

      <SupplierSheet supplier={openSupplier} onClose={() => setOpenSupplier(null)} />
    </div>
  );
}

// ── Top bar (thin, quiet) ─────────────────────────────────────────

function TopBar() {
  return (
    <header className="flex items-center justify-between px-5 pt-3 pb-2">
      <Link
        href="/nex-app"
        aria-label="Back to home"
        className="grid h-10 w-10 place-items-center rounded-full"
        style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }}
      >
        <ArrowLeft size={18} strokeWidth={1.75} />
      </Link>
      <h1
        className="text-[12px] font-black uppercase tracking-[0.28em]"
        style={{
          background: T.gradient,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text"
        }}
      >
        NEX Trade Centre
      </h1>
      <button
        type="button"
        aria-label="Notifications"
        className="relative grid h-10 w-10 place-items-center rounded-full"
        style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }}
      >
        <Bell size={17} strokeWidth={1.75} />
        <span
          aria-hidden
          className="absolute right-2 top-2 h-2 w-2 rounded-full"
          style={{ background: T.primary, boxShadow: `0 0 0 3px rgba(246,138,30,0.20)` }}
        />
      </button>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section 1 · Floating hero — living trading world
// ═══════════════════════════════════════════════════════════════════

function FloatingHero() {
  return (
    <section className="relative mx-4 mt-3 overflow-hidden" style={{ borderRadius: 24, height: 320 }}>
      {/* Cream base with soft flowing orange abstract shapes */}
      <div className="absolute inset-0" style={{ background: T.gradientSoft }} />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full opacity-70"
        style={{ background: "radial-gradient(circle, rgba(246,138,30,0.45) 0%, transparent 70%)", filter: "blur(40px)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full opacity-50"
        style={{ background: "radial-gradient(circle, rgba(255,177,90,0.55) 0%, transparent 70%)", filter: "blur(50px)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 left-1/3 h-56 w-56 rounded-full opacity-40"
        style={{ background: "radial-gradient(circle, rgba(255,231,204,0.9) 0%, transparent 70%)", filter: "blur(40px)" }}
      />

      {/* Floating mini cards — three types positioned at different depths */}
      <FloatingMiniCard
        style={{ top: 24, left: 18 }}
        delay="0s"
        kind="product"
        title="Milwaukee Fuel"
        subtitle="Impact Wrench"
        photo="https://images.unsplash.com/photo-1504148455328-c376907d081c?w=200&q=80"
      />
      <FloatingMiniCard
        style={{ top: 78, right: 20 }}
        delay="1.4s"
        kind="supplier"
        title="Salford Timber"
        subtitle="Verified · 4.8★"
        photo="https://images.unsplash.com/photo-1615529162924-f8605388461d?w=200&q=80"
      />
      <FloatingMiniCard
        style={{ bottom: 26, left: 30 }}
        delay="0.7s"
        kind="buyer"
        title="Ahmad"
        subtitle="Requested quote"
        photo="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&q=80"
      />

      {/* Floating activity pips */}
      <HeroPip style={{ top: 22, right: 20 }}   text="42 viewing"       icon="👀" delay="0.2s" />
      <HeroPip style={{ top: 130, left: 20 }}   text="Verified Supplier" icon="✔"  delay="1.1s" />
      <HeroPip style={{ bottom: 130, right: 24 }} text="New Offer"       icon="🔥" delay="0.5s" />
      <HeroPip style={{ bottom: 74, left: 22 }} text="Ships Today"       icon="📦" delay="1.8s" />
      <HeroPip style={{ bottom: 30, right: 28 }} text="Quote Accepted"   icon="💬" delay="0.9s" />

      {/* Overlay headline — bottom-anchored */}
      <div className="absolute inset-x-0 bottom-0 px-5 pb-4">
        <div className="text-[10.5px] font-black uppercase tracking-[0.28em]" style={{ color: T.primary }}>
          NEX Trade Centre
        </div>
        <h2 className="mt-1 text-[24px] font-black leading-[1.05] tracking-tight" style={{ color: T.text }}>
          A living trading world.
        </h2>
        <p className="mt-1 text-[12px] leading-[1.4]" style={{ color: T.textSoft }}>
          Suppliers · products · quotes · verified. All in one place.
        </p>
      </div>
    </section>
  );
}

function FloatingMiniCard({
  style, delay, kind, title, subtitle, photo
}: {
  style: React.CSSProperties;
  delay: string;
  kind: "product" | "supplier" | "buyer";
  title: string;
  subtitle: string;
  photo: string;
}) {
  return (
    <div
      className="absolute nex-float"
      style={{
        ...style,
        width: 128,
        animationDelay: delay,
        transform: `rotate(${kind === "product" ? -3 : kind === "supplier" ? 2 : -1}deg)`
      }}
    >
      <div
        className="flex items-center gap-2 rounded-2xl p-1.5 pr-3"
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          boxShadow: T.shadowSoft
        }}
      >
        <span className="grid h-9 w-9 flex-shrink-0 overflow-hidden rounded-xl"
              style={{ background: T.lightOrange }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" className="h-full w-full object-cover" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[10.5px] font-bold leading-tight" style={{ color: T.text }}>
            {title}
          </div>
          <div className="truncate text-[9px] leading-tight" style={{ color: T.textSoft }}>
            {subtitle}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroPip({
  style, text, icon, delay
}: {
  style: React.CSSProperties;
  text: string;
  icon: string;
  delay: string;
}) {
  return (
    <div
      className="absolute nex-float-slow"
      style={{ ...style, animationDelay: delay }}
    >
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9.5px] font-bold whitespace-nowrap"
        style={{
          background: T.card,
          color: T.text,
          border: `1px solid ${T.border}`,
          boxShadow: "0 6px 14px -6px rgba(0,0,0,0.10)"
        }}
      >
        <span aria-hidden>{icon}</span>
        {text}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section 2 · Universal AI search
// ═══════════════════════════════════════════════════════════════════

function AISearchBar() {
  const [q, setQ] = useState("");
  return (
    <section className="mx-4 mt-5">
      <div
        className="flex items-center gap-2 rounded-[18px] pl-4 pr-2 py-2"
        style={{
          height: 56,
          background: T.card,
          border: `1px solid ${T.border}`,
          boxShadow: T.shadowSoft
        }}
      >
        <span
          className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-white"
          style={{ background: T.gradient, boxShadow: "0 4px 12px -3px rgba(246,138,30,0.55)" }}
        >
          <Sparkles size={15} strokeWidth={2.5} />
        </span>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products, suppliers or ask NEX AI…"
          aria-label="Search NEX"
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:opacity-50"
          style={{ color: T.text }}
        />
        <button type="button" aria-label="Voice search"
                className="grid h-9 w-9 place-items-center rounded-full"
                style={{ background: T.lightOrange, color: T.primary }}>
          <Mic size={15} strokeWidth={2} />
        </button>
        <button type="button" aria-label="Camera search"
                className="grid h-9 w-9 place-items-center rounded-full"
                style={{ background: T.lightOrange, color: T.primary }}>
          <Camera size={15} strokeWidth={2} />
        </button>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section 3 · Trade Worlds
// ═══════════════════════════════════════════════════════════════════

function TradeWorldsSection() {
  return (
    <section className="mt-8">
      <SectionHeader eyebrow="Trade Worlds" title="Explore by industry" />
      <div className="scrollbar-none flex gap-3 overflow-x-auto px-4 pb-1">
        {TRADE_WORLDS.map((w) => (
          <button
            key={w.id}
            type="button"
            className="group relative flex-shrink-0 overflow-hidden text-left"
            style={{
              width: 260,
              height: 180,
              borderRadius: 22,
              background: T.card,
              boxShadow: T.shadowSoft
            }}
            aria-label={w.label}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={w.image} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-active:scale-[1.03]" loading="lazy" />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(24,15,4,0.55) 100%)" }}
            />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-4 pb-4">
              <div>
                <div className="text-[17px] font-black text-white tracking-tight">{w.label}</div>
                <div className="mt-0.5 text-[11px]" style={{ color: "rgba(255,255,255,0.82)" }}>
                  {w.suppliers.toLocaleString("en-GB")} suppliers
                </div>
              </div>
              <span
                className="grid h-9 w-9 place-items-center rounded-full"
                style={{ background: T.card, color: T.primary, boxShadow: "0 6px 14px -4px rgba(0,0,0,0.25)" }}
                aria-hidden
              >
                <ArrowUpRight size={16} strokeWidth={2.25} />
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section 4 · Live Trading feed
// ═══════════════════════════════════════════════════════════════════

function LiveTradingSection() {
  return (
    <section className="mt-8 px-4">
      <SectionHeader inline eyebrow="Live" title="Trading now" indicator />
      <div className="mt-3 flex flex-col gap-2">
        {LIVE_TRADES.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 rounded-[18px] px-3 py-2.5"
            style={{
              background: T.card,
              border: `1px solid ${T.border}`,
              boxShadow: "0 4px 14px -10px rgba(0,0,0,0.10)"
            }}
          >
            <span className="grid h-9 w-9 flex-shrink-0 overflow-hidden rounded-full"
                  style={{ background: T.lightOrange }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.avatar} alt="" className="h-full w-full object-cover" />
            </span>
            <div className="min-w-0 flex-1 text-[12px] leading-tight" style={{ color: T.text }}>
              <span className="font-bold">{t.actor}</span>
              <span style={{ color: T.textSoft }}> {t.action} </span>
              <span className="font-semibold">{t.item}</span>
            </div>
            <span className="flex-shrink-0 text-[10.5px]" style={{ color: T.textSoft }}>
              {t.time}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section 5 · Featured opportunities
// ═══════════════════════════════════════════════════════════════════

function FeaturedOpportunitiesSection() {
  return (
    <section className="mt-8">
      <SectionHeader eyebrow="Featured" title="Opportunities this week" seeAll />
      <div className="scrollbar-none flex gap-4 overflow-x-auto px-4 pb-2">
        {OPPORTUNITIES.map((o) => (
          <article
            key={o.id}
            className="flex-shrink-0 overflow-hidden"
            style={{ width: 300, borderRadius: 22, background: T.card, boxShadow: T.shadowLift }}
          >
            <div className="relative h-40 w-full overflow-hidden" style={{ background: T.lightOrange }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.image} alt="" className="h-full w-full object-cover" loading="lazy" />
              <span
                className="absolute left-3 top-3 flex items-center gap-1 rounded-full px-2 py-1 text-[9.5px] font-black uppercase tracking-widest text-white"
                style={{ background: T.gradient, boxShadow: "0 6px 14px -3px rgba(246,138,30,0.55)" }}
              >
                <Zap size={10} strokeWidth={2.5} />
                {fmtHours(o.ends_in_hours)}
              </span>
              {o.verified && (
                <span
                  className="absolute right-3 top-3 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black"
                  style={{ background: "rgba(255,255,255,0.94)", color: T.text, backdropFilter: "blur(6px)" }}
                >
                  <ShieldCheck size={11} strokeWidth={2.25} style={{ color: T.primary }} />
                  Verified
                </span>
              )}
            </div>
            <div className="px-4 pb-4 pt-3">
              <h3 className="text-[14px] font-black leading-tight" style={{ color: T.text }}>
                {o.title}
              </h3>
              <div className="mt-3 flex items-center gap-2">
                <span className="grid h-7 w-7 flex-shrink-0 overflow-hidden rounded-full"
                      style={{ background: T.lightOrange }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.supplier_photo} alt="" className="h-full w-full object-cover" />
                </span>
                <div className="min-w-0 flex-1 text-[11px]" style={{ color: T.textSoft }}>
                  {o.supplier}
                </div>
                <div className="flex items-center gap-1 text-[10px]" style={{ color: T.textSoft }}>
                  <Eye size={10} strokeWidth={1.75} />
                  {o.watchers}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-3" style={{ borderColor: T.border }}>
                <div>
                  <div className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: T.textSoft }}>
                    From
                  </div>
                  <div className="text-[15px] font-black" style={{ color: T.text }}>
                    £{o.price_from_gbp.toLocaleString("en-GB")}
                  </div>
                </div>
                <button type="button"
                        className="flex items-center gap-1 rounded-full px-3.5 py-2 text-[11.5px] font-black text-white"
                        style={{ background: T.gradient, boxShadow: "0 8px 18px -4px rgba(246,138,30,0.55)" }}>
                  Save
                  <ArrowRight size={11} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section 6 · Trending projects
// ═══════════════════════════════════════════════════════════════════

function TrendingProjectsSection() {
  return (
    <section className="mt-8 px-4">
      <SectionHeader eyebrow="Live projects" title="Trending briefs" seeAll noPad />
      <div className="mt-3 flex flex-col gap-3">
        {PROJECTS.map((p) => (
          <article
            key={p.id}
            className="relative flex overflow-hidden"
            style={{ borderRadius: 22, background: T.card, boxShadow: T.shadowSoft, minHeight: 128 }}
          >
            <div className="relative w-32 flex-shrink-0 overflow-hidden" style={{ background: T.lightOrange }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col p-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="truncate text-[14px] font-black leading-tight" style={{ color: T.text }}>
                  {p.name}
                </h3>
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[11px]" style={{ color: T.textSoft }}>
                <MapPin size={11} strokeWidth={1.75} />
                {p.location}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {p.trades.slice(0, 4).map((t) => (
                  <span key={t}
                        className="rounded-full px-2 py-0.5 text-[9.5px] font-semibold"
                        style={{ background: T.lightOrange, color: T.primary }}>
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-auto flex items-center justify-between pt-2">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: T.textSoft }}>
                    Budget
                  </div>
                  <div className="text-[13px] font-black" style={{ color: T.text }}>
                    {p.budget_label}
                  </div>
                </div>
                <button type="button"
                        className="rounded-full px-3.5 py-1.5 text-[11px] font-black text-white"
                        style={{ background: T.gradient, boxShadow: "0 6px 14px -4px rgba(246,138,30,0.55)" }}>
                  Apply
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section 7 · Nearby suppliers (uses existing SupplierCard)
// ═══════════════════════════════════════════════════════════════════

function NearbySuppliersSection({ onOpen }: { onOpen: (s: Supplier) => void }) {
  const list = [FEATURED_SUPPLIER, ...NEARBY_SUPPLIERS];
  return (
    <section className="mt-8">
      <SectionHeader eyebrow="Near you" title="Local suppliers" seeAll />
      <div className="scrollbar-none flex gap-3 overflow-x-auto px-4 pb-2">
        {list.map((s) => (
          <SupplierCard key={s.id} supplier={s} onOpen={() => onOpen(s)} variant="grid" />
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section 8 · Trade Insights (Bloomberg-style)
// ═══════════════════════════════════════════════════════════════════

function TradeInsightsSection() {
  return (
    <section className="mt-8 px-4">
      <SectionHeader inline eyebrow="Today" title="Trade insights" noPad />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <InsightStat label="Today's trades"  value={INSIGHTS.todays_trades}  />
        <InsightStat label="Products shipped" value={INSIGHTS.products_shipped} />
        <InsightStat label="Quotes accepted"  value={INSIGHTS.quotes_accepted}  />
      </div>
      <div
        className="mt-3 rounded-[22px] p-4"
        style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadowSoft }}
      >
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em]"
             style={{ color: T.textSoft }}>
          <TrendingUp size={11} strokeWidth={2} style={{ color: T.primary }} />
          Trending searches
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {INSIGHTS.trending.map((k, i) => (
            <span key={k}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    background: i === 0 ? T.gradient : T.lightOrange,
                    color: i === 0 ? "#FFFFFF" : T.primary
                  }}>
              {i === 0 && <Zap size={10} strokeWidth={2.5} />}
              {k}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function InsightStat({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="flex flex-col justify-between rounded-[18px] p-3"
      style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: "0 4px 14px -10px rgba(0,0,0,0.10)", minHeight: 96 }}
    >
      <div className="text-[9.5px] font-bold uppercase tracking-widest" style={{ color: T.textSoft }}>
        {label}
      </div>
      <div className="text-[19px] font-black tracking-tight" style={{ color: T.text }}>
        {value.toLocaleString("en-GB")}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section 9 · NEX AI Assistant recommendation card
// ═══════════════════════════════════════════════════════════════════

function NexAssistantCardSection() {
  return (
    <section className="mt-8 px-4">
      <div
        className="relative overflow-hidden rounded-[22px] p-5"
        style={{
          background: T.gradientSoft,
          border: `1px solid ${T.border}`,
          boxShadow: T.shadowLift
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full opacity-70"
          style={{ background: "radial-gradient(circle, rgba(246,138,30,0.40) 0%, transparent 65%)", filter: "blur(30px)" }}
        />
        <div className="relative flex items-start gap-3">
          <span
            className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl text-white"
            style={{ background: T.gradient, boxShadow: "0 8px 22px -4px rgba(246,138,30,0.55)" }}
          >
            <Sparkles size={19} strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.22em]"
                 style={{ color: T.primary }}>
              NEX AI Assistant
            </div>
            <div className="mt-1 text-[15px] font-black leading-tight" style={{ color: T.text }}>
              Let NEX find your next trade.
            </div>
            <p className="mt-1 text-[11.5px] leading-[1.45]" style={{ color: T.textSoft }}>
              Tell NEX what you need and get matched with verified
              suppliers, delivery slots and install teams — one tap away.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3 text-[12.5px] font-black text-white"
          style={{ background: T.gradient, boxShadow: "0 10px 26px -6px rgba(246,138,30,0.55)" }}
        >
          Ask NEX for a recommendation
          <ArrowRight size={13} strokeWidth={2.5} />
        </button>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section 10 · Recommended For You (magazine alternating)
// ═══════════════════════════════════════════════════════════════════

function RecommendedForYouSection() {
  const large = RECOMMENDED.filter((r) => r.size === "large");
  const small = RECOMMENDED.filter((r) => r.size === "small");
  return (
    <section className="mt-8 px-4">
      <SectionHeader eyebrow="For you" title="Recommended" seeAll noPad />
      <div className="mt-3 flex flex-col gap-3">
        {large[0] && <RecommendedLarge item={large[0]} />}
        <div className="grid grid-cols-2 gap-3">
          {small.map((s) => <RecommendedSmall key={s.id} item={s} />)}
        </div>
        {large[1] && <RecommendedLarge item={large[1]} />}
      </div>
    </section>
  );
}

function RecommendedLarge({ item }: { item: typeof RECOMMENDED[number] }) {
  return (
    <article
      className="group relative overflow-hidden"
      style={{ borderRadius: 22, background: T.card, boxShadow: T.shadowSoft }}
    >
      <div className="relative h-56 w-full overflow-hidden" style={{ background: T.lightOrange }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.image} alt="" className="h-full w-full object-cover transition-transform duration-500 group-active:scale-[1.03]" loading="lazy" />
        <div className="absolute inset-0"
             style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(24,15,4,0.5) 100%)" }} />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-4 pb-4">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-black text-white tracking-tight">{item.title}</div>
            <div className="mt-0.5 text-[11px]" style={{ color: "rgba(255,255,255,0.82)" }}>{item.supplier}</div>
          </div>
          <div className="ml-3 flex-shrink-0 rounded-full px-3 py-1.5 text-[13px] font-black"
               style={{ background: T.card, color: T.text, boxShadow: "0 6px 14px -4px rgba(0,0,0,0.25)" }}>
            £{item.price_gbp.toLocaleString("en-GB")}
          </div>
        </div>
      </div>
    </article>
  );
}

function RecommendedSmall({ item }: { item: typeof RECOMMENDED[number] }) {
  return (
    <article
      className="overflow-hidden"
      style={{ borderRadius: 22, background: T.card, boxShadow: "0 6px 16px -10px rgba(0,0,0,0.12)" }}
    >
      <div className="relative h-28 w-full overflow-hidden" style={{ background: T.lightOrange }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.image} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="px-3 pb-3 pt-2">
        <div className="truncate text-[12px] font-bold leading-tight" style={{ color: T.text }}>{item.title}</div>
        <div className="mt-0.5 truncate text-[10.5px]" style={{ color: T.textSoft }}>{item.supplier}</div>
        <div className="mt-2 text-[13px] font-black" style={{ color: T.primary }}>
          £{item.price_gbp.toLocaleString("en-GB")}
        </div>
      </div>
    </article>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section 11 · Trade community
// ═══════════════════════════════════════════════════════════════════

function TradeCommunitySection() {
  return (
    <section className="mt-8">
      <SectionHeader eyebrow="Community" title="Recently online" seeAll />
      <div className="scrollbar-none flex gap-3 overflow-x-auto px-4 pb-3">
        {COMMUNITY.map((m, i) => (
          <div
            key={m.id}
            className="flex flex-shrink-0 flex-col items-center gap-1.5 nex-float"
            style={{ width: 84, animationDelay: `${(i * 0.35) % 2}s` }}
          >
            <span className="relative grid h-16 w-16 place-items-center overflow-hidden rounded-full"
                  style={{ background: T.card, border: `3px solid ${T.card}`, boxShadow: T.shadowSoft }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.photo} alt="" className="h-full w-full object-cover" />
              {m.online && (
                <span aria-label="Online"
                      className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full"
                      style={{ background: "#22C55E", border: `2px solid ${T.card}` }} />
              )}
            </span>
            <div className="text-center leading-tight">
              <div className="text-[11.5px] font-bold" style={{ color: T.text }}>{m.name}</div>
              <div className="text-[9.5px]" style={{ color: T.textSoft }}>{m.role}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section 12 · Floating CTA
// ═══════════════════════════════════════════════════════════════════

function FloatingCTA() {
  return (
    <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-6" style={{ pointerEvents: "none" }}>
      <button
        type="button"
        className="flex items-center gap-2 rounded-full py-3.5 px-6 text-[12.5px] font-black uppercase tracking-[0.18em] text-white transition-transform active:scale-95"
        style={{
          pointerEvents: "auto",
          background: T.gradient,
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.5) inset, " +
            "0 16px 36px -8px rgba(246,138,30,0.55), " +
            "0 24px 60px -12px rgba(255,177,90,0.45)"
        }}
      >
        Find Your Next Trade
        <ArrowUpRight size={14} strokeWidth={2.75} />
      </button>
    </div>
  );
}

// ── Shared section header ─────────────────────────────────────────

function SectionHeader({
  eyebrow, title, seeAll = false, inline = false, indicator = false, noPad = false
}: {
  eyebrow: string;
  title: string;
  seeAll?: boolean;
  inline?: boolean;
  indicator?: boolean;
  noPad?: boolean;
}) {
  return (
    <header className={`${noPad ? "" : "px-4"} mb-3 flex items-baseline justify-between`}>
      <div className={inline ? "flex items-baseline gap-2" : ""}>
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.24em]"
             style={{ color: T.primary }}>
          {indicator && (
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "#22C55E", boxShadow: "0 0 0 3px rgba(34,197,94,0.22)" }}
            />
          )}
          {eyebrow}
        </div>
        <div className={`${inline ? "" : "mt-1"} text-[17px] font-black tracking-tight`} style={{ color: T.text }}>
          {title}
        </div>
      </div>
      {seeAll && (
        <button type="button"
                className="flex items-center gap-1 text-[11px] font-bold"
                style={{ color: T.primary }}>
          See all <ChevronRight size={12} strokeWidth={2.25} />
        </button>
      )}
    </header>
  );
}
