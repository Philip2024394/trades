"use client";

// NexCardLibrary — the NEX Trade Centre design language, Phase 1.
// 25 distinct card styles. No repeated layouts. Light off-white
// theme locked to the NEX palette. Reusable across every NEX app
// surface: Trade Centre, Discover, Contacts, Business, Marketplace.
//
// Rules baked in:
//   · light mode ONLY (never dark)
//   · off-white page (#FAF8F4) / pure-white cards (#FFFFFF)
//   · one accent gradient (#F68A1E → #FFB15A) — used sparingly
//   · dark charcoal (#202124) text, soft grey (#6F7280) secondary
//   · hairline #ECECEC borders + soft warm shadows
//   · photography-heavy where the layout allows (60–80% of the card)
//   · 22px card radius / 18px button radius / 24px hero radius
//   · no material design, no bootstrap, no icon-first tiles
//
// Every exported <Card…> component is standalone: it accepts its
// data via props and renders one card. The <NexCardGallery /> at
// the bottom composes them all into a labelled showcase page.

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Bell, Clock, Eye, Flame,
  Gauge, Hammer, Heart, MapPin, MessageSquare, Package, Play, ShieldCheck,
  Sparkles, Star, TrendingUp, Users, Zap
} from "lucide-react";

// ── Locked palette (referenced by every card) ─────────────────────
export const T = {
  bg:           "#FAF8F4",
  card:         "#FFFFFF",
  primary:      "#F68A1E",
  secondary:    "#FFB15A",
  lightOrange:  "#FFE6C7",
  text:         "#202124",
  textSoft:     "#6F7280",
  border:       "#ECECEC",
  gradient:     "linear-gradient(135deg, #F68A1E 0%, #FFB15A 100%)",
  gradientSoft: "linear-gradient(135deg, #FFE6C7 0%, #FFF6EB 100%)",
  shadowSoft:   "0 8px 24px -14px rgba(246,138,30,0.18), 0 2px 8px -4px rgba(0,0,0,0.05)",
  shadowLift:   "0 20px 44px -20px rgba(246,138,30,0.22), 0 6px 18px -10px rgba(0,0,0,0.08)"
};

// ── Photo bank — Unsplash construction/trade imagery ─────────────
const PHOTO = {
  loft:       "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
  timber:     "https://images.unsplash.com/photo-1615529162924-f8605388461d?w=1200&q=80",
  tools:      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1200&q=80",
  drill:      "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=1200&q=80",
  concrete:   "https://images.unsplash.com/photo-1590069261209-f8e9b8642343?w=1200&q=80",
  scaffold:   "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1200&q=80",
  villa:      "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1200&q=80",
  roofing:    "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1200&q=80",
  workshop:   "https://images.unsplash.com/photo-1533107862482-0e6974b06ec4?w=1200&q=80",
  excavator:  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=1200&q=80",
  handrail:   "https://images.unsplash.com/photo-1519996529931-28324d5a630e?w=1200&q=80",
  factory:    "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=1200&q=80",
  van:        "https://images.unsplash.com/photo-1583002347338-92ca57ff0a97?w=1200&q=80",
  builder1:   "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80",
  builder2:   "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80",
  builder3:   "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
  builder4:   "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80",
  logo:       "https://images.unsplash.com/photo-1615529162924-f8605388461d?w=200&q=80"
};

// ── Base primitives ───────────────────────────────────────────────

function CardBase({
  children, radius = 22, elevated = false, className = "", style = {}
}: {
  children: React.ReactNode;
  radius?: number;
  elevated?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        borderRadius: radius,
        background: T.card,
        border: `1px solid ${T.border}`,
        boxShadow: elevated ? T.shadowLift : T.shadowSoft,
        ...style
      }}
    >
      {children}
    </div>
  );
}

function GradientChip({ children, small = false }: { children: React.ReactNode; small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-black text-white uppercase tracking-widest ${small ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"}`}
      style={{ background: T.gradient, boxShadow: "0 4px 12px -3px rgba(246,138,30,0.55)" }}
    >
      {children}
    </span>
  );
}

function SoftChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
      style={{ background: T.lightOrange, color: T.primary }}
    >
      {children}
    </span>
  );
}

function PrimaryButton({ children, glow = true }: { children: React.ReactNode; glow?: boolean }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-full py-2 px-3.5 text-[11.5px] font-black text-white transition-transform active:scale-95"
      style={{
        background: T.gradient,
        boxShadow: glow ? "0 10px 22px -6px rgba(246,138,30,0.55)" : "none"
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-full py-2 px-3.5 text-[11.5px] font-black transition-transform active:scale-95"
      style={{
        background: T.card,
        color: T.text,
        border: `1px solid ${T.border}`
      }}
    >
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 25 CARD STYLES — each one a distinct layout, no repeats
// ═══════════════════════════════════════════════════════════════════

// 1 · Large Hero Card ─────────────────────────────────────────────
// Full-bleed photo, dark gradient scrim at the base, headline +
// subtitle + primary CTA overlaid. Anchor tile of a page.
export function CardLargeHero() {
  return (
    <CardBase radius={24} elevated>
      <div className="relative h-[280px] w-full overflow-hidden" style={{ background: T.lightOrange }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PHOTO.villa} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(24,15,4,0.7) 100%)" }} />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/85">Trade Centre</div>
          <h2 className="mt-1 text-[24px] font-black leading-[1.05] tracking-tight text-white">
            Luxury Villa Programme
          </h2>
          <p className="mt-1 text-[12px] leading-[1.4] text-white/80">
            42 verified suppliers actively bidding this week.
          </p>
          <div className="mt-3">
            <PrimaryButton>
              Explore <ArrowRight size={11} strokeWidth={2.5} />
            </PrimaryButton>
          </div>
        </div>
      </div>
    </CardBase>
  );
}

// 2 · Floating Deal Card ─────────────────────────────────────────
// Pill-shaped horizontal, tiny left photo circle, deal text + price.
export function CardFloatingDeal() {
  return (
    <div
      className="flex items-center gap-3 rounded-full py-2 pl-2 pr-4"
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        boxShadow: T.shadowLift
      }}
    >
      <span className="grid h-11 w-11 flex-shrink-0 overflow-hidden rounded-full"
            style={{ background: T.lightOrange }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PHOTO.drill} alt="" className="h-full w-full object-cover" />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[12px] font-black" style={{ color: T.text }}>Milwaukee Fuel</div>
        <div className="truncate text-[10.5px]" style={{ color: T.textSoft }}>Ends in 3h · trade-only</div>
      </div>
      <div className="text-[15px] font-black tracking-tight" style={{ color: T.primary }}>£420</div>
    </div>
  );
}

// 3 · Supplier Card ──────────────────────────────────────────────
// Square photo top, name + verified + rating below, WhatsApp CTA.
export function CardSupplier() {
  return (
    <CardBase>
      <div className="relative h-32 w-full overflow-hidden" style={{ background: T.lightOrange }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PHOTO.timber} alt="" className="h-full w-full object-cover" />
        <span className="absolute right-3 top-3 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-black"
              style={{ background: "rgba(255,255,255,0.94)", backdropFilter: "blur(4px)", color: T.text }}>
          <Star size={10} strokeWidth={0} fill={T.primary} style={{ color: T.primary }} />
          4.8
        </span>
      </div>
      <div className="px-4 pt-3 pb-4">
        <div className="flex items-center gap-1">
          <div className="text-[14px] font-black" style={{ color: T.text }}>Salford Timber Co.</div>
          <BadgeCheck size={13} strokeWidth={2.25} style={{ color: T.primary }} />
        </div>
        <div className="mt-0.5 text-[11px]" style={{ color: T.textSoft }}>Timber merchant · Salford</div>
        <div className="mt-3">
          <span className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-black text-white"
                style={{ background: "#25D366", boxShadow: "0 6px 14px -4px rgba(37,211,102,0.5)" }}>
            <MessageSquare size={11} strokeWidth={2.25} />
            Message
          </span>
        </div>
      </div>
    </CardBase>
  );
}

// 4 · Trade Activity Card ────────────────────────────────────────
// Thin single-line horizontal — avatar + "actor did X" + timestamp.
export function CardTradeActivity() {
  return (
    <div
      className="flex items-center gap-3 rounded-[18px] px-3 py-2.5"
      style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: "0 4px 14px -10px rgba(0,0,0,0.10)" }}
    >
      <span className="grid h-8 w-8 flex-shrink-0 overflow-hidden rounded-full" style={{ background: T.lightOrange }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PHOTO.builder2} alt="" className="h-full w-full object-cover" />
      </span>
      <div className="min-w-0 flex-1 text-[12px] leading-tight" style={{ color: T.text }}>
        <span className="font-bold">John</span>
        <span style={{ color: T.textSoft }}> purchased </span>
        <span className="font-semibold">Makita Drill</span>
      </div>
      <span className="text-[10px]" style={{ color: T.textSoft }}>2s</span>
    </div>
  );
}

// 5 · Project Card ────────────────────────────────────────────────
// Landscape: photo left, trades chips + budget + apply on the right.
export function CardProject() {
  return (
    <CardBase>
      <div className="flex" style={{ minHeight: 128 }}>
        <div className="relative w-32 flex-shrink-0 overflow-hidden" style={{ background: T.lightOrange }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PHOTO.villa} alt="" className="absolute inset-0 h-full w-full object-cover" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col p-3">
          <div className="text-[13.5px] font-black leading-tight" style={{ color: T.text }}>Luxury Villa · Ubud</div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px]" style={{ color: T.textSoft }}>
            <MapPin size={11} strokeWidth={1.75} />Bali
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {["Electrical", "Roofing", "Concrete"].map((t) => <SoftChip key={t}>{t}</SoftChip>)}
          </div>
          <div className="mt-auto flex items-center justify-between pt-2">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: T.textSoft }}>Budget</div>
              <div className="text-[13px] font-black" style={{ color: T.text }}>Rp 1.4B</div>
            </div>
            <PrimaryButton>Apply</PrimaryButton>
          </div>
        </div>
      </div>
    </CardBase>
  );
}

// 6 · Builder Card ────────────────────────────────────────────────
// Portrait vertical: circular avatar top-centre, name/role/tags, connect.
export function CardBuilder() {
  return (
    <CardBase>
      <div className="flex flex-col items-center px-4 pt-5 pb-4">
        <span className="grid h-16 w-16 overflow-hidden rounded-full"
              style={{ background: T.lightOrange, border: `3px solid ${T.card}`, boxShadow: T.shadowSoft }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PHOTO.builder3} alt="" className="h-full w-full object-cover" />
        </span>
        <div className="mt-2.5 text-[14px] font-black" style={{ color: T.text }}>James Whitfield</div>
        <div className="text-[11px]" style={{ color: T.textSoft }}>Master Builder · Manchester</div>
        <div className="mt-2 flex flex-wrap justify-center gap-1">
          <SoftChip>Loft specialist</SoftChip>
          <SoftChip>Heritage</SoftChip>
        </div>
        <div className="mt-3"><PrimaryButton>Connect</PrimaryButton></div>
      </div>
    </CardBase>
  );
}

// 7 · Service Card ────────────────────────────────────────────────
// Square icon-tile + service name + soft chip CTA. Text-forward.
export function CardService() {
  return (
    <CardBase>
      <div className="flex items-center gap-3 p-3.5">
        <span className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-2xl text-white"
              style={{ background: T.gradient, boxShadow: "0 8px 18px -4px rgba(246,138,30,0.5)" }}>
          <Hammer size={22} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-black leading-tight" style={{ color: T.text }}>Same-day carpentry</div>
          <div className="mt-0.5 text-[11px]" style={{ color: T.textSoft }}>Book verified joiners near you</div>
          <div className="mt-2"><SoftChip>Book →</SoftChip></div>
        </div>
      </div>
    </CardBase>
  );
}

// 8 · Promotion Card ──────────────────────────────────────────────
// Magazine, big text overlay + subtle tinted photo. Editorial feel.
export function CardPromotion() {
  return (
    <div
      className="relative overflow-hidden"
      style={{ borderRadius: 22, minHeight: 200, background: T.gradientSoft, boxShadow: T.shadowSoft }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PHOTO.workshop} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ mixBlendMode: "multiply", opacity: 0.28 }} />
      <div className="relative flex h-full flex-col justify-between p-5" style={{ minHeight: 200 }}>
        <div className="text-[10.5px] font-black uppercase tracking-[0.28em]" style={{ color: T.primary }}>
          NEX Trade Fair
        </div>
        <div>
          <h3 className="text-[26px] font-black leading-[0.98] tracking-tight" style={{ color: T.text }}>
            Meet 300+<br />UK suppliers
          </h3>
          <p className="mt-2 text-[12px]" style={{ color: T.textSoft }}>
            Manchester · 14 March · free trade entry
          </p>
        </div>
      </div>
    </div>
  );
}

// 9 · Flash Deal Card ─────────────────────────────────────────────
// Urgent — countdown prominent, orange gradient banner top.
export function CardFlashDeal() {
  return (
    <CardBase>
      <div className="flex items-center justify-between px-4 py-2 text-white text-[11px] font-black uppercase tracking-widest"
           style={{ background: T.gradient }}>
        <span className="flex items-center gap-1"><Flame size={11} strokeWidth={2.5} /> Flash</span>
        <span className="flex items-center gap-1"><Clock size={11} strokeWidth={2.5} /> 02:14:33</span>
      </div>
      <div className="flex items-center gap-3 p-3.5">
        <span className="grid h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl" style={{ background: T.lightOrange }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PHOTO.drill} alt="" className="h-full w-full object-cover" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-black leading-tight" style={{ color: T.text }}>DeWalt XR combo kit</div>
          <div className="mt-0.5 text-[11px]" style={{ color: T.textSoft }}>Ends today · 40% off trade</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[16px] font-black" style={{ color: T.primary }}>£248</span>
            <span className="text-[11px] line-through" style={{ color: T.textSoft }}>£420</span>
          </div>
        </div>
      </div>
    </CardBase>
  );
}

// 10 · Auction Card ───────────────────────────────────────────────
// Current bid + timer + bid CTA.
export function CardAuction() {
  return (
    <CardBase>
      <div className="relative h-32 w-full overflow-hidden" style={{ background: T.lightOrange }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PHOTO.excavator} alt="" className="h-full w-full object-cover" />
        <span className="absolute left-3 top-3"><GradientChip small>Auction</GradientChip></span>
      </div>
      <div className="px-4 pt-3 pb-4">
        <div className="text-[13.5px] font-black leading-tight" style={{ color: T.text }}>20t Cat Excavator</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]" style={{ color: T.textSoft }}>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest">Current bid</div>
            <div className="text-[15px] font-black" style={{ color: T.text }}>£38,500</div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest">Ends in</div>
            <div className="text-[15px] font-black" style={{ color: T.primary }}>1d 14h</div>
          </div>
        </div>
        <div className="mt-3 flex justify-end"><PrimaryButton>Place bid</PrimaryButton></div>
      </div>
    </CardBase>
  );
}

// 11 · Nearby Card ────────────────────────────────────────────────
// Distance pill, map-pin badge, image LEFT + info right.
export function CardNearby() {
  return (
    <CardBase>
      <div className="flex" style={{ minHeight: 96 }}>
        <div className="relative w-24 flex-shrink-0 overflow-hidden" style={{ background: T.lightOrange }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PHOTO.tools} alt="" className="absolute inset-0 h-full w-full object-cover" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
          <div>
            <div className="text-[13px] font-black leading-tight" style={{ color: T.text }}>Manchester Tool Depot</div>
            <div className="mt-0.5 text-[11px]" style={{ color: T.textSoft }}>Trade tools · Ancoats</div>
          </div>
          <div className="flex items-center gap-2 text-[10.5px]" style={{ color: T.textSoft }}>
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: T.lightOrange, color: T.primary }}>
              <MapPin size={10} strokeWidth={2} />2.1 mi
            </span>
            <span>Open · closes 6PM</span>
          </div>
        </div>
      </div>
    </CardBase>
  );
}

// 12 · Verified Business Card ─────────────────────────────────────
// Logo cutout floating over gradient banner + tagline + CTA.
export function CardVerifiedBusiness() {
  return (
    <CardBase>
      <div className="relative h-16" style={{ background: T.gradient }}>
        <span
          aria-hidden
          className="absolute -bottom-6 left-4 grid h-14 w-14 place-items-center overflow-hidden rounded-2xl"
          style={{ background: T.card, border: `3px solid ${T.card}`, boxShadow: T.shadowSoft }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PHOTO.logo} alt="" className="h-full w-full object-cover" />
        </span>
        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black text-white"
              style={{ background: "rgba(0,0,0,0.20)", backdropFilter: "blur(6px)" }}>
          <ShieldCheck size={11} strokeWidth={2.25} /> Verified
        </span>
      </div>
      <div className="px-4 pt-9 pb-4">
        <div className="text-[14px] font-black" style={{ color: T.text }}>Salford Timber Co.</div>
        <div className="mt-0.5 text-[11px]" style={{ color: T.textSoft }}>Family-run · 45 yrs · Trade prices</div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1"><SoftChip>Oak</SoftChip><SoftChip>Delivery</SoftChip></div>
          <PrimaryButton>Follow</PrimaryButton>
        </div>
      </div>
    </CardBase>
  );
}

// 13 · Trending Card ──────────────────────────────────────────────
// Big rank number + trend arrow, photo behind at low opacity.
export function CardTrending() {
  return (
    <div
      className="relative overflow-hidden"
      style={{ borderRadius: 22, minHeight: 140, background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadowSoft }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PHOTO.concrete} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: 0.12 }} />
      <div className="relative flex h-full items-center gap-4 p-4">
        <div className="text-[54px] font-black leading-none tracking-tighter" style={{ color: T.primary }}>#1</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: T.textSoft }}>
            <TrendingUp size={11} strokeWidth={2.25} style={{ color: T.primary }} /> Trending
          </div>
          <div className="mt-1 text-[16px] font-black" style={{ color: T.text }}>Ready-mix concrete</div>
          <div className="mt-0.5 text-[11px]" style={{ color: T.textSoft }}>+184% searches this week</div>
        </div>
      </div>
    </div>
  );
}

// 14 · Community Card ─────────────────────────────────────────────
// 4-avatar cluster + community name + member count + join.
export function CardCommunity() {
  return (
    <CardBase>
      <div className="flex items-center gap-3 p-4">
        <div className="flex flex-shrink-0 items-center">
          {[PHOTO.builder1, PHOTO.builder2, PHOTO.builder3, PHOTO.builder4].map((src, i) => (
            <span key={i}
                  className="grid h-9 w-9 overflow-hidden rounded-full"
                  style={{ marginLeft: i === 0 ? 0 : -11, border: `2.5px solid ${T.card}`, zIndex: 4 - i, background: T.lightOrange }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-black" style={{ color: T.text }}>Loft Builders UK</div>
          <div className="mt-0.5 text-[11px]" style={{ color: T.textSoft }}>4,218 members · 12 online</div>
        </div>
        <PrimaryButton>Join</PrimaryButton>
      </div>
    </CardBase>
  );
}

// 15 · Offer Card ─────────────────────────────────────────────────
// Split card: photo left, offer terms + save right (accent focus).
export function CardOffer() {
  return (
    <CardBase>
      <div className="flex">
        <div className="relative w-1/2 flex-shrink-0 overflow-hidden" style={{ background: T.lightOrange, minHeight: 150 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PHOTO.roofing} alt="" className="absolute inset-0 h-full w-full object-cover" />
        </div>
        <div className="flex flex-1 flex-col justify-between p-4">
          <div>
            <GradientChip small>Save 15%</GradientChip>
            <div className="mt-2 text-[14px] font-black leading-tight" style={{ color: T.text }}>
              Slate roof<br />tiles pallet
            </div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: T.textSoft }}>From</div>
            <div className="text-[17px] font-black" style={{ color: T.text }}>£380</div>
            <button type="button"
                    className="mt-1 flex w-full items-center justify-center gap-1 rounded-full py-1.5 text-[11px] font-black"
                    style={{ background: T.card, color: T.primary, border: `1px solid ${T.border}` }}>
              <Heart size={11} strokeWidth={2} /> Save
            </button>
          </div>
        </div>
      </div>
    </CardBase>
  );
}

// 16 · Quote Card ─────────────────────────────────────────────────
// Quote reference + price + supplier avatar + view.
export function CardQuote() {
  return (
    <CardBase>
      <div className="flex items-center gap-3 p-3.5">
        <span className="grid h-11 w-11 flex-shrink-0 overflow-hidden rounded-2xl" style={{ background: T.lightOrange }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PHOTO.logo} alt="" className="h-full w-full object-cover" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px]" style={{ color: T.textSoft }}>Quote NEX-Q-3184</div>
          <div className="text-[14px] font-black" style={{ color: T.text }}>Salford Timber Co.</div>
          <div className="text-[10.5px]" style={{ color: T.textSoft }}>Bespoke oak staircase · delivered</div>
        </div>
        <div className="text-right">
          <div className="text-[15px] font-black" style={{ color: T.text }}>£2,480</div>
          <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: T.primary }}>View →</div>
        </div>
      </div>
    </CardBase>
  );
}

// 17 · Live Update Card ───────────────────────────────────────────
// Pulse live badge + short text + tiny thumbnail on the right.
export function CardLiveUpdate() {
  return (
    <div
      className="flex items-center gap-3 rounded-[18px] p-3"
      style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: "0 4px 14px -10px rgba(0,0,0,0.10)" }}
    >
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-widest text-white"
            style={{ background: "#22C55E" }}>
        <span aria-hidden className="h-1 w-1 rounded-full bg-white nex-pulse-dot" />
        Live
      </span>
      <div className="min-w-0 flex-1 text-[12px] leading-tight" style={{ color: T.text }}>
        <span className="font-bold">32 quotes</span> accepted in the last hour
      </div>
      <span className="grid h-8 w-8 flex-shrink-0 overflow-hidden rounded-lg" style={{ background: T.lightOrange }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PHOTO.factory} alt="" className="h-full w-full object-cover" />
      </span>
    </div>
  );
}

// 18 · Magazine Card ──────────────────────────────────────────────
// Large photo, editorial serif-style headline, kicker + reading time.
export function CardMagazine() {
  return (
    <CardBase elevated>
      <div className="relative h-56 w-full overflow-hidden" style={{ background: T.lightOrange }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PHOTO.scaffold} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="px-4 py-4">
        <div className="text-[9.5px] font-black uppercase tracking-[0.28em]" style={{ color: T.primary }}>Industry · Long read</div>
        <h3 className="mt-1.5 text-[19px] font-black leading-[1.15] tracking-tight" style={{ color: T.text, fontFamily: "Georgia, serif" }}>
          Why the UK trade shortage is really a marketing problem.
        </h3>
        <div className="mt-3 flex items-center gap-2 text-[11px]" style={{ color: T.textSoft }}>
          <span className="grid h-6 w-6 overflow-hidden rounded-full" style={{ background: T.lightOrange }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PHOTO.builder2} alt="" className="h-full w-full object-cover" />
          </span>
          NEX Editorial · 4 min read
        </div>
      </div>
    </CardBase>
  );
}

// 19 · Recommendation Card ────────────────────────────────────────
// AI-suggested item on a soft gradient background with reason text.
export function CardRecommendation() {
  return (
    <div
      className="relative overflow-hidden"
      style={{ borderRadius: 22, background: T.gradientSoft, border: `1px solid ${T.border}`, boxShadow: T.shadowLift }}
    >
      <div className="flex items-start gap-3 p-4">
        <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl text-white"
              style={{ background: T.gradient, boxShadow: "0 8px 18px -4px rgba(246,138,30,0.55)" }}>
          <Sparkles size={19} strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[9.5px] font-black uppercase tracking-[0.22em]" style={{ color: T.primary }}>NEX picks</div>
          <div className="mt-1 text-[13.5px] font-black leading-tight" style={{ color: T.text }}>
            Try North Timber Co. for your February pallet order
          </div>
          <div className="mt-1 text-[11px] leading-[1.4]" style={{ color: T.textSoft }}>
            Matches your last 3 quotes · 12% cheaper on average · delivers Salford weekly.
          </div>
        </div>
      </div>
    </div>
  );
}

// 20 · Split Card ─────────────────────────────────────────────────
// 50/50 vertical split: hero photo above, tabular info block below.
export function CardSplit() {
  return (
    <CardBase>
      <div className="grid grid-cols-2" style={{ minHeight: 180 }}>
        <div className="relative overflow-hidden" style={{ background: T.lightOrange }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PHOTO.handrail} alt="" className="absolute inset-0 h-full w-full object-cover" />
        </div>
        <div className="flex flex-col justify-center gap-2 p-4">
          <div className="text-[9.5px] font-black uppercase tracking-widest" style={{ color: T.textSoft }}>Bespoke</div>
          <div className="text-[16px] font-black leading-tight" style={{ color: T.text }}>Oak Handrails</div>
          <div className="text-[11px]" style={{ color: T.textSoft }}>Cut to size · £45/lm</div>
          <div className="mt-2"><PrimaryButton>Enquire</PrimaryButton></div>
        </div>
      </div>
    </CardBase>
  );
}

// 21 · Glass Card ─────────────────────────────────────────────────
// Frosted translucent card over a warm gradient tinted background.
export function CardGlass() {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        borderRadius: 22,
        minHeight: 160,
        background: "linear-gradient(135deg, #FFF6EB 0%, #FFE6C7 50%, #FFCE8F 100%)"
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full opacity-70"
        style={{ background: "radial-gradient(circle, rgba(246,138,30,0.5) 0%, transparent 65%)", filter: "blur(24px)" }}
      />
      <div className="absolute inset-4 rounded-[18px] p-4"
           style={{
             background: "rgba(255,255,255,0.72)",
             backdropFilter: "blur(14px) saturate(180%)",
             WebkitBackdropFilter: "blur(14px) saturate(180%)",
             border: "1px solid rgba(255,255,255,0.9)",
             boxShadow: "0 8px 24px -12px rgba(0,0,0,0.15)"
           }}>
        <div className="text-[9.5px] font-black uppercase tracking-[0.22em]" style={{ color: T.primary }}>Trade discount</div>
        <div className="mt-1 text-[16px] font-black leading-tight" style={{ color: T.text }}>Unlock 15% off first order</div>
        <div className="mt-1 text-[11px]" style={{ color: T.textSoft }}>Verified trade accounts only.</div>
        <div className="mt-3"><PrimaryButton>Verify trade</PrimaryButton></div>
      </div>
    </div>
  );
}

// 22 · Horizontal Card ────────────────────────────────────────────
// Long thin — small image left, one-line text, chevron right.
export function CardHorizontal() {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl p-2 pr-4"
      style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadowSoft }}
    >
      <span className="grid h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl" style={{ background: T.lightOrange }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PHOTO.van} alt="" className="h-full w-full object-cover" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-black leading-tight" style={{ color: T.text }}>Book a delivery slot</div>
        <div className="mt-0.5 text-[10.5px]" style={{ color: T.textSoft }}>Same-day across Greater Manchester</div>
      </div>
      <ArrowRight size={14} strokeWidth={2.25} style={{ color: T.textSoft }} />
    </div>
  );
}

// 23 · Image Card ─────────────────────────────────────────────────
// Pure image with tiny corner label — Pinterest-style tile.
export function CardImage() {
  return (
    <div
      className="group relative overflow-hidden"
      style={{ borderRadius: 22, aspectRatio: "3 / 4", boxShadow: T.shadowSoft }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PHOTO.workshop} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-active:scale-[1.05]" />
      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-widest"
            style={{ color: T.text, backdropFilter: "blur(4px)" }}>
        Workshop
      </span>
      <span className="absolute right-3 bottom-3 grid h-8 w-8 place-items-center rounded-full text-white"
            style={{ background: T.gradient, boxShadow: "0 6px 14px -3px rgba(246,138,30,0.55)" }}>
        <Heart size={13} strokeWidth={2.25} />
      </span>
    </div>
  );
}

// 24 · Editorial Card ─────────────────────────────────────────────
// Text-heavy; photo used as accent thumbnail bottom-right corner.
export function CardEditorial() {
  return (
    <CardBase>
      <div className="relative p-5" style={{ minHeight: 200 }}>
        <div className="text-[9.5px] font-black uppercase tracking-[0.28em]" style={{ color: T.textSoft }}>Editor's Note</div>
        <h3 className="mt-1.5 text-[22px] font-black leading-[1.08] tracking-tight" style={{ color: T.text, fontFamily: "Georgia, serif" }}>
          &ldquo;The best supplier isn't always the cheapest — it's the one who answers the phone.&rdquo;
        </h3>
        <div className="mt-3 text-[10.5px]" style={{ color: T.textSoft }}>— Nex</div>
        <span className="absolute right-4 bottom-4 grid h-16 w-16 overflow-hidden rounded-2xl"
              style={{ background: T.lightOrange, boxShadow: T.shadowSoft }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PHOTO.timber} alt="" className="h-full w-full object-cover" />
        </span>
      </div>
    </CardBase>
  );
}

// 25 · Minimal Card ───────────────────────────────────────────────
// Mostly whitespace, one line, tiny orange dot accent.
export function CardMinimal() {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl p-5"
      style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: "0 2px 8px -4px rgba(0,0,0,0.04)" }}
    >
      <span aria-hidden className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: T.primary, boxShadow: `0 0 0 4px rgba(246,138,30,0.14)` }} />
      <div className="min-w-0 flex-1 text-[13px] font-bold" style={{ color: T.text }}>
        Explore all 12,984 verified suppliers →
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Gallery — the showcase composition
// ═══════════════════════════════════════════════════════════════════

const CATALOG: { name: string; note: string; render: () => React.ReactElement }[] = [
  { name: "01 · Large Hero",         note: "Anchor tile · full-bleed photo",       render: () => <CardLargeHero /> },
  { name: "02 · Floating Deal",      note: "Pill shape · price-forward",           render: () => <CardFloatingDeal /> },
  { name: "03 · Supplier",           note: "Photo top · WhatsApp CTA",             render: () => <CardSupplier /> },
  { name: "04 · Trade Activity",     note: "Single-line feed row",                 render: () => <CardTradeActivity /> },
  { name: "05 · Project",            note: "Landscape · brief with budget",        render: () => <CardProject /> },
  { name: "06 · Builder",            note: "Portrait · person-first",              render: () => <CardBuilder /> },
  { name: "07 · Service",            note: "Icon-tile + soft CTA",                 render: () => <CardService /> },
  { name: "08 · Promotion",          note: "Magazine · big display type",          render: () => <CardPromotion /> },
  { name: "09 · Flash Deal",         note: "Urgent · gradient banner + timer",     render: () => <CardFlashDeal /> },
  { name: "10 · Auction",            note: "Bid + countdown",                      render: () => <CardAuction /> },
  { name: "11 · Nearby",             note: "Distance pill · location-first",       render: () => <CardNearby /> },
  { name: "12 · Verified Business",  note: "Logo cutout + banner",                 render: () => <CardVerifiedBusiness /> },
  { name: "13 · Trending",           note: "Rank + trend arrow",                   render: () => <CardTrending /> },
  { name: "14 · Community",          note: "Avatar cluster + join",                render: () => <CardCommunity /> },
  { name: "15 · Offer",              note: "Split · save with heart",              render: () => <CardOffer /> },
  { name: "16 · Quote",              note: "Reference · price · avatar",           render: () => <CardQuote /> },
  { name: "17 · Live Update",        note: "Green pulse · thumbnail right",        render: () => <CardLiveUpdate /> },
  { name: "18 · Magazine",           note: "Editorial serif · long-form",          render: () => <CardMagazine /> },
  { name: "19 · Recommendation",     note: "AI suggestion · gradient bg",          render: () => <CardRecommendation /> },
  { name: "20 · Split",              note: "50/50 photo & info",                   render: () => <CardSplit /> },
  { name: "21 · Glass",              note: "Frosted glass on warm gradient",       render: () => <CardGlass /> },
  { name: "22 · Horizontal",         note: "Thin nav-style row",                   render: () => <CardHorizontal /> },
  { name: "23 · Image",              note: "Pure Pinterest tile · 3:4",            render: () => <CardImage /> },
  { name: "24 · Editorial",          note: "Text-forward with quote",              render: () => <CardEditorial /> },
  { name: "25 · Minimal",            note: "Whitespace · single line",             render: () => <CardMinimal /> }
];

export function NexCardGallery() {
  return (
    <div
      className="mx-auto flex w-full max-w-md flex-col"
      style={{ background: T.bg, color: T.text, minHeight: "100dvh" }}
    >
      <header className="px-5 pt-8 pb-3">
        <div className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: T.primary }}>
          NEX Design Language · v1
        </div>
        <h1 className="mt-2 text-[26px] font-black leading-[1.05] tracking-tight" style={{ color: T.text }}>
          25 card styles.<br />
          <span style={{
            background: T.gradient,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text"
          }}>
            One design system.
          </span>
        </h1>
        <p className="mt-2 text-[12px] leading-[1.5]" style={{ color: T.textSoft }}>
          Reusable building blocks. No two the same layout. Any NEX
          surface can compose from these — Trade Centre, Discover,
          Contacts, Business, Marketplace.
        </p>
      </header>

      <div className="flex flex-col gap-8 px-5 pb-24 pt-4">
        {CATALOG.map((entry) => (
          <section key={entry.name} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <div className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: T.text }}>
                {entry.name}
              </div>
              <div className="text-[10.5px]" style={{ color: T.textSoft }}>{entry.note}</div>
            </div>
            {entry.render()}
          </section>
        ))}
      </div>
    </div>
  );
}
