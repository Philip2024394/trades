// /nex-app/refacing/examples · Refacing Before/After Gallery (2026-08-13 · v2).
//
// Trade-Centre-styled cards (matching src/components/nex-app/centre/NexCentreLiveFeed
// ProductCard exactly: rounded-2xl · white card · black/5 border · masonry columns ·
// meta pills · orange "View Details" CTA · Promoted pill · Sponsored AdCard).
//
// EACH CARD = ONE BEFORE/AFTER PAIR. Image area is split top/bottom:
//   · Top half:    BEFORE (the distressed staircase)
//   · Bottom half: AFTER  (the specific refacing from the library)
// Small orange divider bar between them + BEFORE/AFTER labels.
//
// Data source: manifest.images_v3[] whole_staircase entries (79 as of today).
// Ad slots follow the Trade Centre AdCard schema (Sponsored eyebrow · brand ·
// headline · sub · cta chevron).

import Link from "next/link";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ArrowLeft, Bell, ChevronRight, MapPin, MessageSquare, Menu, Megaphone, Sparkles, Home, LayoutGrid, Lightbulb, Hammer, MoreHorizontal, ShieldCheck } from "lucide-react";
import type { V3Image } from "@/lib/refacing/hero-pool-resolver";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "NEX Refacing · Before & After Examples",
  description: "Real staircase refacing transformations. Every material, every pattern, every style.",
};

const LOGO_SRC   = "/brand/nex-logo.png";
const BEFORE_SRC = "/staircase-renovations/entry/before-after/before.png";
const ORANGE     = "#F97316";
const CREAM      = "#FBF7F0";

type AdTile = {
  kind: "ad";
  id: string;
  brand: string;
  headline: string;
  sub: string;
  cta: string;
  href: string;
  accentBg?: string;  // Tailwind bg class fragment (default: cream neutral)
  /** Optional decorative product image anchored in a specific corner
   *  (Philip 2026-08-13 · shared sponsored container pattern). */
  backgroundImage?: string;
  backgroundCorner?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
};

const AD_TILES: AdTile[] = [
  {
    kind: "ad",
    id: "ad-partner-directory",
    brand: "NEX Refacing",
    headline: "Find a verified refacing trade near you",
    sub: "Local first · fair rotation · no leads sold",
    cta: "Browse companies",
    href: "/nex-app/refacing/companies",
    accentBg: "bg-neutral-100",
  },
  {
    kind: "ad",
    id: "ad-design-browser",
    brand: "NEX Designs",
    headline: "Pick your riser material",
    sub: "Metal · Painted · Wood · Glass — see every combination",
    cta: "Browse designs",
    href: "/nex-app/refacing/browse",
    accentBg: "bg-orange-50",
  },
  {
    kind: "ad",
    id: "ad-partner-onboarding",
    brand: "For Trades",
    headline: "List your refacing company on NEX",
    sub: "Country-wide exposure · fair rotation · no commission",
    cta: "Learn more",
    href: "/nex-app/refacing/companies",
    accentBg: "bg-neutral-100",
  },
];

type Tile = { kind: "pair"; img: V3Image } | AdTile;

async function loadImages(): Promise<V3Image[]> {
  try {
    const path = join(process.cwd(), "data", "staircase-renovations", "manifest.json");
    const raw  = await readFile(path, "utf8");
    const j    = JSON.parse(raw) as { images_v3?: V3Image[] };
    const wholes = (j.images_v3 ?? []).filter((i) => i.component_role === "whole_staircase");
    return wholes.map((v, i) => ({ v, sort: ((i * 2654435761) % 1000) })).sort((a, b) => a.sort - b.sort).map((x) => x.v);
  } catch {
    return [];
  }
}

function interleave(images: V3Image[], ads: AdTile[]): Tile[] {
  const out: Tile[] = [];
  let adIdx = 0;
  images.forEach((img, i) => {
    out.push({ kind: "pair", img });
    if ((i + 1) % 5 === 0 && ads.length > 0) {
      out.push(ads[adIdx % ads.length]);
      adIdx++;
    }
  });
  if (adIdx === 0 && ads.length > 0 && images.length > 0) out.push(ads[0]);
  return out;
}

function componentOf(img: V3Image, role: string) {
  return img.material_composition?.find((c) => c.component_role === role);
}
function humanise(s?: string): string {
  return String(s || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function pairTitle(img: V3Image): string {
  const tread = componentOf(img, "tread");
  const riser = componentOf(img, "riser");
  const t = humanise(tread?.sub_material ?? "wood");
  const r = riser?.material === "metal"    ? "Metal riser"
          : riser?.material === "painted"  ? "Painted riser"
          : riser?.material === "wood"     ? "Wood riser"
          : "Refacing";
  return `${t} · ${r}`;
}
function pairSubline(img: V3Image): string {
  const bal = componentOf(img, "baluster");
  if (!bal) return "Full refacing example";
  const style = humanise(bal.style ?? "");
  const mat   = humanise(bal.sub_material ?? bal.material ?? "");
  return `${style} ${mat} balustrade`.trim() || "Full refacing example";
}

const NAV = [
  { Icon: Home,           label: "HOME",     href: "/nex-app/refacing" },
  { Icon: LayoutGrid,     label: "DESIGNS",  href: "/nex-app/refacing/browse" },
  { Icon: Lightbulb,      label: "EXAMPLES", active: true },
  { Icon: Hammer,         label: "TRADES",   href: "/nex-app/refacing/companies" },
  { Icon: MoreHorizontal, label: "MORE" },
];

export default async function RefacingExamplesPage() {
  const images = await loadImages();
  const tiles  = interleave(images, AD_TILES);

  return (
    <div className="relative min-h-screen bg-[#faf7f2] pb-24 text-black">
      {/* Header · mirrors landing */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-[#faf7f2]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-2.5">
          <Link href="/nex-app/refacing" aria-label="Back to refacing" className="flex items-center gap-2">
            <ArrowLeft size={18} strokeWidth={2.2} className="text-black/70" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_SRC} alt="NEX" className="h-5 w-auto object-contain" />
          </Link>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Notifications" className="grid h-8 w-8 place-items-center rounded-full border border-black/10 bg-white text-black/80 shadow-sm">
              <Bell size={14} strokeWidth={2} />
            </button>
            <button type="button" aria-label="Menu" className="grid h-8 w-8 place-items-center rounded-full border border-black/10 bg-white text-black/80 shadow-sm">
              <Menu size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      {/* Page eyebrow + title */}
      <section className="mx-auto max-w-4xl px-4 pt-5">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-600">
          NEX Refacing · Examples
        </div>
        <h1 className="mt-1 text-[22px] font-black leading-[1.08] tracking-tight text-black">
          Real before &amp; after transformations
        </h1>
        <p className="mt-2 max-w-[520px] text-[12.5px] leading-snug text-black/65">
          Every card shows one genuine refacing job — the same tired staircase turned into a completely new design. Tap through to see the material breakdown.
        </p>
      </section>

      {/* Masonry gallery — Trade Centre columns */}
      <main className="mx-auto max-w-4xl px-3 py-4">
        {tiles.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ columnGap: "0.75rem" }} className="columns-2 sm:columns-3 md:columns-4">
            {tiles.map((tile, i) => {
              if (tile.kind === "ad") return <AdCard key={`${tile.id}-${i}`} tile={tile} />;
              return <BeforeAfterCard key={tile.img.image_id} img={tile.img} />;
            })}
          </div>
        )}
      </main>

      {/* Sticky bottom nav */}
      <nav className="fixed bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white px-2 py-2 shadow-2xl" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
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
            <Link key={label} href={href} aria-label={label} className="rounded-full active:bg-black/5">{inner}</Link>
          ) : (
            <button key={label} type="button" aria-label={label} className="rounded-full active:bg-black/5">{inner}</button>
          );
        })}
      </nav>
    </div>
  );
}

// ── Before/After card · Trade-Centre ProductCard shape ─────────────
function BeforeAfterCard({ img }: { img: V3Image }) {
  const title = pairTitle(img);
  const sub   = pairSubline(img);
  return (
    <article className="group mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Split before/after image · top=before · bottom=after */}
      <Link
        href="/nex-app/refacing/browse"
        aria-label={`See ${title} refacing designs`}
        className="relative block w-full overflow-hidden"
      >
        <div className="flex flex-col">
          {/* Before */}
          <div className="relative aspect-[4/5] w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BEFORE_SRC}
              alt="Staircase before refacing"
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <span className="absolute left-1.5 top-1.5 rounded-full bg-black/75 px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider text-white/95 backdrop-blur-sm">
              Before
            </span>
          </div>
          {/* Orange separator bar */}
          <div className="h-[3px] w-full bg-orange-500" />
          {/* After */}
          <div className="relative aspect-[4/5] w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.src}
              alt={img.alt}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <span className="absolute left-1.5 top-1.5 rounded-full bg-orange-500 px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider text-white shadow-sm">
              After
            </span>
          </div>
        </div>
      </Link>

      {/* Content area · matches Trade Centre padding + type */}
      <div className="p-3">
        <div className="line-clamp-2 text-sm font-semibold leading-tight text-black">
          {title}
        </div>
        <div className="mt-1 truncate text-[11px] text-black/70">
          {sub}
        </div>

        {/* Meta pills · matches Trade Centre gray pills */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center gap-0.5 rounded-full bg-black/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-black/60">
            <ShieldCheck className="h-2 w-2" />
            NEX Library
          </span>
          <span className="inline-flex items-center gap-0.5 rounded-full bg-black/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-black/60">
            <MapPin className="h-2 w-2" />
            UK
          </span>
        </div>

        {/* Orange CTA — matches Trade Centre "View Details" button */}
        <Link
          href="/nex-app/refacing/browse"
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-orange-500 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:bg-orange-600"
        >
          <MessageSquare className="h-3 w-3" strokeWidth={2.5} />
          View Details
        </Link>
      </div>
    </article>
  );
}

// ── Ad card · Trade-Centre AdCard shape ────────────────────────────
function AdCard({ tile }: { tile: AdTile }) {
  const accent = tile.accentBg ?? "bg-neutral-50";
  const bgCorner = tile.backgroundCorner ?? "bottom-right";
  const cornerPos =
    bgCorner === "top-right"    ? "top-0 right-0" :
    bgCorner === "top-left"     ? "top-0 left-0" :
    bgCorner === "bottom-left"  ? "bottom-0 left-0" :
                                  "bottom-0 right-0";
  return (
    <Link
      href={tile.href}
      className={`relative mb-3 block break-inside-avoid overflow-hidden rounded-2xl border border-black/5 ${accent} p-3 shadow-sm transition-shadow hover:shadow-md`}
    >
      {tile.backgroundImage && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={tile.backgroundImage}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className={`pointer-events-none absolute ${cornerPos} h-24 w-24 object-contain opacity-90 sm:h-28 sm:w-28`}
        />
      )}
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider text-black/50">
            <Megaphone className="h-2 w-2" />
            Sponsored
          </span>
          <span className="text-[9px] font-medium text-black/40">Ad</span>
        </div>
        <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-black/50">
          {tile.brand}
        </div>
        <div className="mt-0.5 text-[12.5px] font-bold leading-tight text-black">
          {tile.headline}
        </div>
        <div className="mt-1 text-[10.5px] leading-relaxed text-black/60">
          {tile.sub}
        </div>
        <div className="mt-2 inline-flex items-center gap-0.5 text-[10px] font-semibold text-black">
          {tile.cta}
          <ChevronRight className="h-3 w-3" />
        </div>
      </div>
    </Link>
  );
}

// ── Empty state · matches Trade Centre honest empty ────────────────
function EmptyState() {
  return (
    <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-black/5 bg-white p-6 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-orange-500" />
      <div className="mt-3 text-base font-semibold text-black">
        No refacing examples yet.
      </div>
      <div className="mt-1 text-xs text-black/60">
        NEX will fill this page as the refacing library grows.
      </div>
    </div>
  );
}
