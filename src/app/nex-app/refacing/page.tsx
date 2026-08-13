// /nex-app/refacing · REFACING/RENOVATION LANDING PAGE (2026-08-13 · v3).
//
// Design brief supplied by Philip 2026-08-13 · overlay mockup + hero background.
// This is the FIRST screen after clicking the Refacing/Renovation button on the
// NEX home. Primary CTAs (GET STARTED · DESIGNS nav · icon grid) all route to
// /nex-app/refacing/browse (the material design browser).
//
// Assets:
//   · /brand/nex-logo.png                                 — official NEX wordmark
//   · /staircase-renovations/entry/renovation-hero.png    — hero: presenter + staircase
//   · Before/after images pulled from existing library

import Link from "next/link";
import {
  Bell, Menu, ShieldCheck, ArrowRight, MapPin, Hammer,
  Layers, Grip, Square, Paintbrush, Package, Sparkles,
  Home, LayoutGrid, Lightbulb, MoreHorizontal,
} from "lucide-react";

export const dynamic = "force-static";
export const metadata = {
  title: "NEX Staircase Renovation · What can be achieved",
  description: "Transform your staircase with premium materials and expert craftsmanship. Built to last 50+ years — durability, safety, style.",
};

const HERO_SRC      = "/staircase-renovations/entry/renovation-hero.png";
const LOGO_SRC      = "/brand/nex-logo.png";
const BROWSE_URL    = "/nex-app/refacing/browse";
const COMPANIES_URL = "/nex-app/refacing/companies";
const EXAMPLES_URL  = "/nex-app/refacing/examples";

const FEATURES = [
  { Icon: Layers,     label: "NEW TREADS" },
  { Icon: Grip,       label: "MODERN BALUSTERS" },
  { Icon: Square,     label: "GLASS SYSTEMS" },
  { Icon: Paintbrush, label: "PAINT & FINISH" },
  { Icon: Package,    label: "STORAGE IDEAS" },
  { Icon: Sparkles,   label: "COMPLETE MAKEOVER" },
];

// Before/after set curated by Philip 2026-08-13 — real refacing transformation
// pair (distressed staircase with tools → three modern renovations).
const BEFORE_IMAGE = "/staircase-renovations/entry/before-after/before.png";
const AFTER_IMAGES = [
  "/staircase-renovations/entry/before-after/after-1.png",
  "/staircase-renovations/entry/before-after/after-2.png",
  "/staircase-renovations/entry/before-after/after-3.png",
];

const NAV = [
  { Icon: Home,            label: "HOME",      active: true  },
  { Icon: LayoutGrid,      label: "DESIGNS",   href: BROWSE_URL },
  { Icon: Lightbulb,       label: "IDEAS" },
  { Icon: Layers,          label: "MATERIALS", href: BROWSE_URL },
  { Icon: MoreHorizontal,  label: "MORE" },
];

const ORANGE = "#F97316";
const CREAM  = "#FBF7F0";

export default function RefacingLandingPage() {
  return (
    <div
      className="relative min-h-[100dvh] w-full pb-24"
      style={{ background: CREAM, color: "#0F0F0F" }}
    >
      {/* Hero section · fills top of viewport · header floats on top */}
      <section className="relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_SRC}
          alt="NEX presenter at a staircase in the NEX Trade Center"
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-top"
          draggable={false}
        />

        {/* Header · floats above hero · brand already visible on hero image so no logo needed */}
        <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-end gap-2 px-4 pt-4">
          <button
            type="button"
            aria-label="Notifications"
            className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white/95 text-black/80 shadow-md"
          >
            <Bell size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Menu"
            className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white/95 text-black/80 shadow-md"
          >
            <Menu size={16} strokeWidth={2} />
          </button>
        </header>

        {/* Content layer on hero · text sits high so it clears the presenter below */}
        <div className="relative z-10 min-h-[460px] px-5 pt-6">
          {/* Title · left */}
          <div className="max-w-[62%]">
            <h1 className="text-[26px] font-black leading-[1.05] tracking-tight text-black">
              NEX<br />STAIRCASE<br />
              <span style={{ color: ORANGE }}>RENOVATION</span>
            </h1>
            <div className="mt-3 text-[11px] font-bold uppercase tracking-widest text-black/85">
              What can be achieved
            </div>
            <div className="mt-1.5 h-[2px] w-16" style={{ background: ORANGE }} />
            <p className="mt-3 max-w-[220px] text-[13px] font-semibold leading-snug text-black/80">
              The experts that got you covered.
            </p>
          </div>

        </div>
      </section>

      {/* Feature grid · 6 icon tiles · overlays hero by ~10% (46px lift on a 460px hero) */}
      <section className="relative z-20 mx-4 -mt-12 rounded-2xl bg-white p-4 shadow-lg" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="grid grid-cols-3 gap-3">
          {FEATURES.map(({ Icon, label }) => (
            <Link
              key={label}
              href={BROWSE_URL}
              className="flex flex-col items-center gap-1.5 rounded-lg py-2 transition-colors active:bg-black/5"
            >
              <div
                className="grid h-10 w-10 place-items-center rounded-lg"
                style={{ background: "rgba(249,115,22,0.08)" }}
              >
                <Icon size={20} strokeWidth={1.8} style={{ color: ORANGE }} />
              </div>
              <div className="text-center text-[9px] font-bold uppercase leading-tight tracking-wide text-black/80">
                {label}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FROM THIS → TO THIS before/after row · items-stretch keeps both cards equal height */}
      <section className="mt-4 grid grid-cols-[1fr_auto_1.6fr] items-stretch gap-2 px-4">
        {/* FROM THIS card · flex-col so before image can flex-1 to full card height */}
        <div className="flex flex-col overflow-hidden rounded-xl bg-neutral-200/70">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-black/70">
            From this
          </div>
          <div className="relative min-h-[220px] flex-1 w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BEFORE_IMAGE}
              alt="Staircase before refacing"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </div>

        {/* Arrow · center */}
        <div
          className="grid h-8 w-8 self-center place-items-center rounded-full"
          style={{ background: ORANGE, boxShadow: "0 4px 12px rgba(249,115,22,0.4)" }}
        >
          <ArrowRight size={16} strokeWidth={2.5} className="text-white" />
        </div>

        {/* TO THIS card · with View Examples CTA */}
        <div className="flex flex-col overflow-hidden rounded-xl" style={{ background: ORANGE }}>
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white">
            To this
          </div>
          <div className="grid grid-cols-3 gap-1 p-1">
            {AFTER_IMAGES.map((src, i) => (
              <div key={src} className="relative aspect-[3/4] overflow-hidden rounded">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Refaced staircase example ${i + 1}`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
          <Link
            href={EXAMPLES_URL}
            className="mx-1 mb-1 mt-0.5 flex items-center justify-center gap-1.5 rounded bg-black py-2 text-[10px] font-bold uppercase tracking-wider text-white transition-transform active:scale-95"
          >
            View examples
            <ArrowRight size={12} strokeWidth={2.5} />
          </Link>
        </div>
      </section>

      {/* Two-card bottom row · refacing trades directory + primary CTA */}
      <section className="mt-4 grid grid-cols-2 gap-3 px-4">
        {/* Staircase Refacing Companies card · dark · tappable → trade directory */}
        <Link
          href={COMPANIES_URL}
          className="flex flex-col justify-between rounded-2xl p-4 text-white transition-transform active:scale-95"
          style={{ background: "#0F0F0F" }}
        >
          <div>
            <div className="flex items-center gap-2">
              <div
                className="grid h-9 w-9 place-items-center rounded-lg"
                style={{ background: "rgba(249,115,22,0.15)" }}
              >
                <Hammer size={18} strokeWidth={2.2} style={{ color: ORANGE }} />
              </div>
              <div className="text-[11px] font-bold uppercase leading-tight tracking-wider">
                Staircase<br />Refacing<br />Companies
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-snug text-white/80">
              Browse trusted refacing trades near you. NEX shows local companies first, then rotates so every trade gets a fair shot.
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-white/70">
            <span className="flex items-center gap-1.5">
              <MapPin size={12} strokeWidth={2.2} style={{ color: ORANGE }} />
              Near you first
            </span>
            <ArrowRight size={14} strokeWidth={2.5} style={{ color: ORANGE }} />
          </div>
        </Link>

        {/* Primary CTA card · orange */}
        <div className="flex flex-col justify-between rounded-2xl p-4 text-white" style={{ background: ORANGE }}>
          <div>
            <div className="text-[12px] font-bold uppercase leading-tight tracking-wide">
              Ready to transform<br />your staircase?
            </div>
            <p className="mt-2 text-[11px] leading-snug text-white/90">
              Get a free consultation and discover the possibilities.
            </p>
          </div>
          <Link
            href={BROWSE_URL}
            className="mt-4 flex items-center justify-between gap-2 rounded-full bg-black px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white transition-transform active:scale-95"
          >
            <span>Get started</span>
            <ArrowRight size={14} strokeWidth={2.5} />
          </Link>
        </div>
      </section>

      {/* Sticky bottom nav · floating pill */}
      <nav
        className="fixed bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white px-2 py-2 shadow-2xl"
        style={{ border: "1px solid rgba(0,0,0,0.08)" }}
      >
        {NAV.map(({ Icon, label, active, href }) => {
          const inner = (
            <div className="flex items-center gap-1.5 px-3 py-1.5">
              <Icon size={16} strokeWidth={2} style={{ color: active ? ORANGE : "#0F0F0F" }} />
              {active && (
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: ORANGE }}>
                  {label}
                </span>
              )}
            </div>
          );
          return href ? (
            <Link key={label} href={href} aria-label={label} className="rounded-full active:bg-black/5">
              {inner}
            </Link>
          ) : (
            <button key={label} type="button" aria-label={label} className="rounded-full active:bg-black/5">
              {inner}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
