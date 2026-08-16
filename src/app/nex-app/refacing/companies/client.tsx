"use client";

// Refacing Companies · client component (2026-08-13).
//
// Fetches /api/nex/centre/feed with the canonical Staircase Refacing category
// and renders Trade-Centre-style listing cards. Every card carries an "Unclaimed"
// badge (or the merchant's actual verification level if the seed has been
// claimed downstream) plus a "Claim this business" CTA that routes into the
// existing shared claim endpoint.
//
// NO fake trades. If the feed returns zero, we show the honest empty state.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bell, Menu, Hammer, MapPin, Star, ShieldCheck, Sparkles, Megaphone, ChevronRight } from "lucide-react";
import type { CentreFeedItem } from "@/lib/nex/centre-publishing/types";
import { assignRefacingHeroPool } from "@/lib/refacing/refacingHeroPool";
import { NexBottomSheet } from "@/components/nex-app/centre/NexBottomSheet";
import { TradeProfileSheet } from "@/components/nex-app/refacing/TradeProfileSheet";
import { CountryPicker } from "@/components/nex-app/centre/CountryPicker";
import {
  getSelectedCountry,
  setSelectedCountry,
  type SelectedCountry,
} from "@/lib/nex/geography/countryStore";
import { findCountryByCode } from "@/lib/nex/geography/countries";
import { formatCardLocation } from "@/lib/nex/geography/formatAddress";

const LOGO_SRC = "/brand/nex-logo.png";
const ORANGE   = "#F97316";

type Feed = {
  ok: boolean;
  items?: CentreFeedItem[];
  count?: number;
  error?: string;
};

// Sponsored slots reserved for related-supply merchants (stair parts · lights ·
// carpet · mats · rope). Currently mapped to real NEX categories in the shared
// Trade Centre so customers can browse actual inventory. When paid sponsors
// sign up, replace href + brand + copy per slot. Never fabricate a paying sponsor.
//
// Philip 2026-08-13 · every staircase-product sponsor tile carries a decorative
// product image anchored in a specified corner (background style). The rest of
// the container renders the sponsor copy on top. Position options:
//   "top-right" / "top-left" / "bottom-right" / "bottom-left"
type CornerPosition = "top-right" | "top-left" | "bottom-right" | "bottom-left";
type SponsoredTile = {
  kind: "sponsored";
  id: string;
  brand: string;
  headline: string;
  sub: string;
  cta: string;
  href: string;
  accentBg: string; // Tailwind class
  backgroundImage?: string;      // Decorative product image URL
  backgroundCorner?: CornerPosition;
};

const SPONSORED_SLOTS: SponsoredTile[] = [
  {
    kind: "sponsored",
    id: "sponsor-stair-parts",
    brand: "NEX Marketplace",
    headline: "Stair parts · treads, risers, spindles",
    sub: "Handrails, newel posts, balusters and full replacement kits.",
    cta: "Browse stair parts",
    href: "/nex-app/centre?category=Staircase+Parts",
    accentBg: "bg-neutral-100",
    backgroundImage: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2013,%202026,%2005_17_53%20PM.png",
    backgroundCorner: "top-right",
  },
  {
    kind: "sponsored",
    id: "sponsor-stair-lights",
    brand: "NEX Marketplace",
    headline: "Staircase lights · LED tread + step",
    sub: "Integrated LED strips, motion-sensor step lights and low-voltage kits for refacing projects.",
    cta: "Browse lighting",
    href: "/nex-app/centre?category=Lighting",
    accentBg: "bg-neutral-100",
    backgroundImage: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2013,%202026,%2005_19_52%20PM.png",
    backgroundCorner: "bottom-right",
  },
  {
    kind: "sponsored",
    id: "sponsor-stair-rope",
    brand: "NEX Marketplace",
    headline: "Staircase rope · handrail + banister",
    sub: "Woven cotton and synthetic rope handrails for statement staircases.",
    cta: "Browse rope",
    href: "/nex-app/centre?category=Staircase+Rope",
    accentBg: "bg-orange-50",
    backgroundImage: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2013,%202026,%2005_21_27%20PM.png",
    backgroundCorner: "top-right",
  },
  {
    kind: "sponsored",
    id: "sponsor-stair-mats",
    brand: "NEX Marketplace",
    headline: "Staircase mats · non-slip step covers",
    sub: "Individual step mats with anti-slip backing · fitted or peel-and-stick.",
    cta: "Browse stair mats",
    href: "/nex-app/centre?category=Staircase+Mats",
    accentBg: "bg-neutral-100",
    backgroundImage: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2013,%202026,%2005_25_02%20PM.png",
    backgroundCorner: "bottom-right",
  },
  {
    kind: "sponsored",
    id: "sponsor-stair-carpet",
    brand: "NEX Marketplace",
    headline: "Staircase carpet · runners + full-cover",
    sub: "Wool, sisal and synthetic runners cut to your flight length. Rod-fitting kits available.",
    cta: "Browse carpet",
    href: "/nex-app/centre?category=Staircase+Carpet",
    accentBg: "bg-orange-50",
    backgroundImage: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2013,%202026,%2005_30_56%20PM.png",
    backgroundCorner: "bottom-right",
  },
];

type FeedTile = CentreFeedItem | SponsoredTile;

function interleaveSponsored(items: CentreFeedItem[], sponsors: SponsoredTile[]): FeedTile[] {
  const out: FeedTile[] = [];
  let sponsorIdx = 0;
  items.forEach((item, i) => {
    out.push(item);
    // Every 4 real listings, insert a sponsored tile so the grid stays balanced
    // and no sponsor slot is over-shown.
    if ((i + 1) % 4 === 0 && sponsors.length > 0) {
      out.push(sponsors[sponsorIdx % sponsors.length]);
      sponsorIdx++;
    }
  });
  // Tail sponsor when fewer than 4 items — still show one so the pattern is visible.
  if (sponsorIdx === 0 && sponsors.length > 0 && items.length > 0) {
    out.push(sponsors[0]);
  }
  return out;
}

export default function CompaniesClient() {
  const [items, setItems] = useState<CentreFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [country, setCountry] = useState<SelectedCountry>("all");
  // Slider state (Rule 1: one orange "More Details" opens a slider · state lives here,
  // not per-card, so exactly one sheet is mounted at a time).
  const [openItem, setOpenItem] = useState<CentreFeedItem | null>(null);
  const openSheet  = useCallback((item: CentreFeedItem) => setOpenItem(item), []);
  const closeSheet = useCallback(() => setOpenItem(null), []);

  // Country rehydrate · URL > localStorage > "all". Cold-mount only.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromUrl = new URLSearchParams(window.location.search).get("country");
    let initial: SelectedCountry | null = null;
    if (fromUrl === "all") initial = "all";
    else if (fromUrl) initial = findCountryByCode(fromUrl)?.code ?? null;
    if (!initial) initial = getSelectedCountry();
    if (initial) setCountry(initial);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Capability-based query (Philip 2026-08-16 · P0-5). The prior
        // `category="Staircase Refacing"` filter missed every non-UK
        // refacing record because the US/IE imports used plain "Staircase"
        // + `capabilities.refacing='yes'`. Capability is first-class per the
        // two-dimension schema — surface the 14 US directly-evidenced
        // refacing rows without falsely promoting the 58 unverified claims.
        const params: Record<string, string> = { capability: "refacing", limit: "100" };
        if (country && country !== "all") params.country = country;
        const qs = new URLSearchParams(params);
        const res = await fetch(`/api/nex/centre/feed?${qs}`, { cache: "no-store" });
        const data = (await res.json()) as Feed;
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setError(data.error ?? "feed_failed");
        } else {
          setItems(data.items ?? []);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("network");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [country]);

  return (
    <div className="relative min-h-screen bg-[#faf7f2] pb-24 text-black">
      {/* Hero banner · extends up to the top of the page · header floats on top of it */}
      <section className="relative w-full overflow-hidden bg-[#f7f0e6]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/staircase-renovations/entry/companies-hero.png"
          alt="Refacing trade fitting a new oak tread onto an existing staircase"
          className="block h-auto w-full select-none object-cover"
          draggable={false}
        />

        {/* Floating header · sits on top of the hero · no NEX logo here (moved to hero right) */}
        <header className="absolute inset-x-0 top-0 z-30">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <Link href="/nex-app/refacing" aria-label="Back to refacing" className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white/90 text-black/80 shadow-sm backdrop-blur-sm">
              <ArrowLeft size={16} strokeWidth={2.2} />
            </Link>
            <div className="flex items-center gap-2">
              <CountryPicker
                value={country}
                onChange={(next) => {
                  setCountry(next);
                  setSelectedCountry(next);
                }}
              />
              <button type="button" aria-label="Notifications" className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white/90 text-black/80 shadow-sm backdrop-blur-sm">
                <Bell size={15} strokeWidth={2} />
              </button>
              <button type="button" aria-label="Menu" className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white/90 text-black/80 shadow-sm backdrop-blur-sm">
                <Menu size={15} strokeWidth={2} />
              </button>
            </div>
          </div>
        </header>

        {/* Overlay text · sits high (items-start pt-14 so it clears the header buttons) */}
        <div className="pointer-events-none absolute inset-0 flex items-start pt-14 sm:pt-16">
          <div className="mx-auto flex w-full max-w-4xl items-start justify-between gap-4 px-5">
            {/* Left · title text */}
            <div className="max-w-[55%] sm:max-w-[50%]">
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-600 sm:text-[11px]">
                NEX Refacing
              </div>
              <h1 className="mt-1 text-[20px] font-black uppercase leading-[1.05] tracking-tight text-black sm:text-[28px] md:text-[34px]">
                Staircase<br />Refacing<br />Companies
              </h1>
              <p className="mt-2 hidden text-[12px] leading-snug text-black/70 sm:block">
                Trusted UK refacing trades. Local companies first, fair rotation across every verified trade.
              </p>
            </div>
            {/* Right · NEX brand logo */}
            <div className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO_SRC} alt="NEX" className="h-6 w-auto object-contain drop-shadow-sm sm:h-8" />
            </div>
          </div>
        </div>
      </section>

      {/* Fairness pill row · below hero */}
      <section className="mx-auto max-w-4xl px-4 pt-4">
        <p className="text-[12.5px] leading-snug text-black/65 max-w-[520px] sm:hidden">
          Trusted UK refacing trades. Local companies first, fair rotation across every verified trade.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: "rgba(249,115,22,0.12)", color: ORANGE }}>
            <MapPin size={12} strokeWidth={2.2} />
            Near you first
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-black/70 shadow-sm">
            Fair rotation for all trades
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-black/70 shadow-sm">
            <ShieldCheck size={12} strokeWidth={2.2} style={{ color: ORANGE }} />
            Verified only
          </span>
        </div>
      </section>

      {/* Feed */}
      <main className="mx-auto max-w-4xl px-3 py-4">
        {error && (
          <div className="mx-auto mt-6 max-w-md rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
            Couldn&apos;t load the refacing directory just now. Please try again.
          </div>
        )}

        {loading ? (
          <MasonrySkeleton />
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          // Trade-Centre masonry · exact same columns as /nex-app/centre
          <RefacingGrid items={items} onOpen={openSheet} />
        )}
      </main>

      {/* NEX TRADE CARD RULE · Rule 1 · single reusable slider shown when
          any card's "More Details" button is tapped. NexBottomSheet is the
          shared bottom-sheet shell used across NEX; TradeProfileSheet is the
          refacing-scoped content (info · services · Contact Company · claim
          invitation for unclaimed listings). */}
      {openItem && (
        <NexBottomSheet
          open
          onClose={closeSheet}
          eyebrow={openItem.merchant_verification_level === "partner" ? "NEX Refacing Member" : "Trade profile"}
        >
          <TradeProfileSheet
            item={openItem}
            isPartner={openItem.merchant_verification_level === "partner"}
            isUnclaimed={openItem.merchant_verification_level === "listed"}
          />
        </NexBottomSheet>
      )}
    </div>
  );
}

// Assigns a UNIQUE random pool image to every UNCLAIMED card per render.
// Rotates on every page refresh (Fisher-Yates shuffle) so trades that
// haven't uploaded their own image show a fresh look each time. Merchant
// uploads on claimed accounts are preserved — never overridden.
function RefacingGrid({ items, onOpen }: { items: CentreFeedItem[]; onOpen: (item: CentreFeedItem) => void }) {
  const itemsWithHeroes = useMemo(
    () => assignRefacingHeroPool(
      items,
      (item) => item.merchant_verification_level === "listed",
    ),
    [items],
  );
  const tiles = useMemo(
    () => interleaveSponsored(itemsWithHeroes, SPONSORED_SLOTS),
    [itemsWithHeroes],
  );
  return (
    <div style={{ columnGap: "0.75rem" }} className="columns-2 sm:columns-3 md:columns-4">
      {tiles.map((tile, i) => {
        if ("kind" in tile && tile.kind === "sponsored") {
          return <SponsoredCard key={`${tile.id}-${i}`} tile={tile} />;
        }
        const item = tile as CentreFeedItem;
        return <RefacingListingCard key={item.offer_id} item={item} onOpen={onOpen} />;
      })}
    </div>
  );
}

// ── Sponsored card · matches Trade-Centre AdCard shape ─────────────
function SponsoredCard({ tile }: { tile: SponsoredTile }) {
  return (
    <Link
      href={tile.href}
      className={`relative mb-3 block break-inside-avoid overflow-hidden rounded-2xl border border-black/5 ${tile.accentBg} p-3 shadow-sm transition-shadow hover:shadow-md`}
    >
      {/* Decorative corner product image · sits behind the sponsor copy.
          `pointer-events-none` so the outer <Link> still catches clicks; the
          card content has `relative` z-index so text stays crisp on top. */}
      {tile.backgroundImage && (
        <CornerBackground src={tile.backgroundImage} corner={tile.backgroundCorner ?? "bottom-right"} alt="" />
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

/**
 * Shared corner-anchored decorative background image (Philip 2026-08-13).
 * Sits absolutely-positioned in the specified corner of a sponsored
 * container. Sized so the image feels like an inset decoration rather than
 * a hero — text content on top stays readable. `pointer-events-none` so
 * clicks pass through to the parent Link/anchor.
 */
function CornerBackground({ src, corner, alt }: { src: string; corner: CornerPosition; alt: string }) {
  const pos =
    corner === "top-right"    ? "top-0 right-0" :
    corner === "top-left"     ? "top-0 left-0" :
    corner === "bottom-left"  ? "bottom-0 left-0" :
                                "bottom-0 right-0";
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      aria-hidden={alt === "" ? "true" : undefined}
      className={`pointer-events-none absolute ${pos} h-24 w-24 object-contain opacity-90 sm:h-28 sm:w-28`}
      loading="lazy"
    />
  );
}

// ── Refacing listing card · Trade-Centre-style ─────────────────────
//
// NEX TRADE CARD RULE (standing · app-wide · memory: project_nex_trade_card_rule_2026_08_13.md):
//   Rule 1 · ONE orange "More Details" button · opens a SLIDER (NexBottomSheet).
//            Never two buttons · never a page navigation.
//   Rule 2 · Contact Company (inside the slider) opens NEX Chat — never tel:/mailto:.
//   Rule 3 · Unclaimed listings remain listed + discoverable · inbox closed until membership.
//   Rule 4 · Enquiries route via 8-hour SLA rotation between eligible trades.
//   Rule 5 · One company · many services (never duplicate records).
//   NEX owns the enquiry journey. Homeowner → NEX Chat → routing engine → trade.
function RefacingListingCard({ item, onOpen }: { item: CentreFeedItem; onOpen: (item: CentreFeedItem) => void }) {
  const location =
    formatCardLocation({
      country: item.merchant_country,
      city: item.merchant_city,
      county: item.merchant_region,
      region: item.merchant_region,
      postcode: item.merchant_postcode_prefix,
      postcode_prefix: item.merchant_postcode_prefix,
    }) || (item.merchant_city ?? item.merchant_postcode_prefix ?? "");
  const isUnclaimed = item.merchant_verification_level === "listed";
  const isPartner = item.merchant_verification_level === "partner";

  const handleOpen = () => onOpen(item);

  return (
    <article className="group mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Hero + business name are both tap-targets that open the slider. Using
          <button> (not <Link>) because the primary UX is the sheet, not a page nav. */}
      <button
        type="button"
        onClick={handleOpen}
        className="block w-full text-left"
        aria-label={`Open details for ${item.name}`}
      >
        <div className="relative w-full overflow-hidden bg-neutral-100">
          {item.hero_image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={item.hero_image_url}
              alt={item.name}
              loading="lazy"
              className="block h-auto w-full transition-transform duration-500 group-hover:scale-[1.02]"
              onError={(e) => {
                const el = e.currentTarget;
                el.style.display = "none";
                if (el.parentElement) {
                  el.parentElement.style.background = "linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)";
                  el.parentElement.style.aspectRatio = "3 / 4";
                }
              }}
            />
          ) : (
            <div className="grid aspect-[3/4] w-full place-items-center bg-gradient-to-br from-amber-100 to-orange-200 text-black/40">
              <Hammer size={32} strokeWidth={1.5} />
            </div>
          )}
          {isUnclaimed && (
            <span className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-black/70 shadow-sm">
              Unclaimed
            </span>
          )}
          {isPartner && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest text-white shadow-sm">
              <ShieldCheck size={9} strokeWidth={2.5} />
              Member
            </span>
          )}
        </div>
      </button>

      <div className="p-3">
        {/* Business name · also opens the slider */}
        <button
          type="button"
          onClick={handleOpen}
          className="block w-full text-left text-sm font-semibold leading-tight text-black line-clamp-2 hover:underline"
        >
          {item.name}
        </button>

        {/* Location */}
        <div className="mt-1 flex items-center gap-1 text-[11px] text-black/60">
          <MapPin size={11} strokeWidth={2} />
          {location}
        </div>

        {/* Google rating · only if genuinely present */}
        {item.merchant_google_rating != null && (
          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-black/75">
            <Star size={12} strokeWidth={2.2} className="fill-amber-400 text-amber-400" />
            <span className="font-semibold">{item.merchant_google_rating.toFixed(1)}</span>
            {item.merchant_google_review_count != null && (
              <span className="text-black/50">({item.merchant_google_review_count})</span>
            )}
          </div>
        )}

        {/* Services / capabilities */}
        {item.merchant_services.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.merchant_services.slice(0, 4).map((svc) => (
              <span key={svc} className="inline-flex items-center rounded-full bg-black/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-black/60">
                {svc}
              </span>
            ))}
          </div>
        )}

        {/* SINGLE orange "More Details" CTA · Rule 1 · opens the slider.
            Everything else (Contact Company, Website, Claim, Services detail)
            lives INSIDE the slider — never on the card face. */}
        <button
          type="button"
          onClick={handleOpen}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-orange-500 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:bg-orange-600"
        >
          More Details
        </button>
      </div>
    </article>
  );
}

// ── Masonry skeleton · matches Trade-Centre loading state ──────────
function MasonrySkeleton() {
  return (
    <div style={{ columnGap: "0.75rem" }} className="columns-1 sm:columns-2 md:columns-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="mb-3 break-inside-avoid rounded-2xl border border-black/5 bg-white p-2 shadow-sm">
          <div className="mb-2 w-full animate-pulse rounded-xl bg-black/5" style={{ height: `${140 + ((i * 37) % 100)}px` }} />
          <div className="mb-1 h-3 w-3/4 animate-pulse rounded bg-black/5" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-black/5" />
        </div>
      ))}
    </div>
  );
}

// ── Truthful empty state (no fake companies) ───────────────────────
function EmptyState() {
  return (
    <div className="mx-auto mt-8 max-w-md rounded-2xl border border-black/5 bg-white p-6 text-center shadow-sm">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full" style={{ background: "rgba(249,115,22,0.10)" }}>
        <Sparkles size={22} strokeWidth={2} style={{ color: ORANGE }} />
      </div>
      <div className="mt-4 text-[14px] font-bold uppercase tracking-wide">
        Refacing trades onboarding
      </div>
      <p className="mt-2 text-[12px] leading-snug text-black/65">
        NEX only shows verified refacing companies. As UK trades are discovered and imported, they will appear here — local first, then a fair rotation across every trade in the country.
      </p>
      <Link href="/nex-app/refacing" className="mt-6 inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white transition-transform active:scale-95">
        <ArrowLeft size={14} strokeWidth={2.5} />
        Back to refacing
      </Link>
    </div>
  );
}
