"use client";

// FoodCentreLiveFeed — food-directory clone of NexCentreLiveFeed visual language.
// Off-white bg · sticky header · CSS-columns masonry · sponsor/category
// interstitials. Kept intentionally leaner than the source (single-city,
// no country picker, no infinite-scroll · Yogyakarta V1 has ~10 businesses).

import { Fragment, useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import type { FoodListing } from "@/lib/nexapp/foodListings";
import { FOOD_CATEGORIES } from "@/lib/nexapp/foodListings";
import { FoodBusinessCard } from "./FoodBusinessCard";
import { FoodInterstitial, type FoodInterstitialTile } from "./FoodInterstitial";
import {
  matchesIntent,
  TOP_FILTER_LABELS,
  SUB_LABELS,
  type FoodFilterIntent,
  type TopFilter,
} from "./filterIntent";

type ListingWithClaim = FoodListing & { rawClaimStatus: string; cuisine?: string | null };

type Props = {
  listings: ListingWithClaim[];
  attribution: string;
};

const SPONSOR_TILES: FoodInterstitialTile[] = [
  {
    kind: "sponsor",
    id: "sp-claim-yours",
    eyebrow: "Sponsor slot available",
    headline: "Klaim bisnismu di NEX",
    sub: "Own a Yogyakarta food business? Claim your listing to unlock this slot.",
    cta: "Claim your business",
    href: "/food/claim",
    accent: "orange",
  },
  {
    kind: "sponsor",
    id: "sp-nex-partner",
    eyebrow: "NEX Partner",
    headline: "Berkembang bersama NEX",
    sub: "Verified members get customer conversations · qualified enquiries · booking requests.",
    cta: "How NEX works",
    href: "/food/claim",
    accent: "neutral",
  },
];

const CATEGORY_TILES: FoodInterstitialTile[] = FOOD_CATEGORIES.map((c) => ({
  kind: "category",
  id: `cat-${c.slug}`,
  emoji: c.emoji,
  label: c.labelEn,
  labelId: c.labelId,
  slug: c.slug,
}));

// Deterministic PRNG · seeded shuffle so banners land at the same masonry
// positions across renders/reloads (avoids layout jump). Seed is the joined
// public_listing_refs so filter changes DO re-shuffle · that's intentional.
function seededShuffle<T>(arr: readonly T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    return ((h ^ (h >>> 15)) >>> 0) / 0xffffffff;
  };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Interleave organic business cards with banner slots.
 *
 * Banner slots monetisation ladder (Philip 2026-08-21):
 *   1. Paid voucher (Phase 8.4 · weekly promotion by a paying restaurant)
 *   2. Member imagery (owner-uploaded dish/drink/snack photo)
 *   3. Generic category tile (default fallback · always safe)
 *
 * V1 · we only have level 3 available today. Levels 1 + 2 land as the
 * schema for `nex.food_voucher` and member imagery approval lands.
 *
 * Positioning: banners distributed every ~5 organic cards with the exact
 * position seeded by the current feed for stability across renders.
 */
function interleave(
  organic: ListingWithClaim[],
): Array<{ kind: "organic"; item: ListingWithClaim } | { kind: "interstitial"; item: FoodInterstitialTile }> {
  const out: Array<{ kind: "organic"; item: ListingWithClaim } | { kind: "interstitial"; item: FoodInterstitialTile }> = [];
  const seed = organic.map((o) => o.publicListingRef).join("|") || "empty";

  // Full banner pool · sponsors first, then category tiles as fallback fillers.
  const bannerPool: FoodInterstitialTile[] = [
    ...SPONSOR_TILES,
    ...CATEGORY_TILES,
  ];
  const shuffledBanners = seededShuffle(bannerPool, seed);
  let bannerIdx = 0;

  organic.forEach((item, i) => {
    out.push({ kind: "organic", item });
    // Insert a banner every 5 organic cards for masonry balance.
    // Also fires on the last card so short feeds still show one banner.
    if ((i + 1) % 5 === 0 || i === organic.length - 1) {
      if (shuffledBanners.length > 0) {
        out.push({ kind: "interstitial", item: shuffledBanners[bannerIdx % shuffledBanners.length]! });
        bannerIdx++;
      }
    }
  });
  return out;
}

export function FoodCentreLiveFeed({ listings, attribution }: Props) {
  const [query, setQuery] = useState("");
  const [intent, setIntent] = useState<FoodFilterIntent>({ top: "all", sub: null });

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (!matchesIntent(l, intent)) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        (l.description ?? "").toLowerCase().includes(q) ||
        l.district.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q) ||
        (l.cuisine ?? "").toLowerCase().includes(q)
      );
    });
  }, [listings, query, intent]);

  const tiles = useMemo(() => interleave(filtered), [filtered]);

  return (
    <div className="relative min-h-screen bg-[#faf7f2]">
      {/* Sticky header · mirrors /nex-app/centre · no filter chrome here ·
          filters live inside the search hero container below (Philip 2026-08-21). */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-[#faf7f2]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-2.5">
          <div className="text-sm font-semibold tracking-tight text-black">
            NEX Food
          </div>
          <div className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
            Yogyakarta
          </div>
          <div className="flex-1" />
          {intent.top !== "all" && (
            <button
              type="button"
              onClick={() => setIntent({ top: "all", sub: null })}
              className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[10.5px] font-medium text-black/60 hover:bg-black/[0.03]"
            >
              Reset filter
            </button>
          )}
        </div>
      </header>

      {/* Search hero · mirrors /nex-app/centre pattern (compact for Yogyakarta V1) */}
      <section className="relative mx-4 mt-4 max-w-4xl rounded-[22px] border border-black/10 bg-white px-4 py-4 shadow-sm md:mx-auto">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-600">
          Discover Yogyakarta food
        </div>
        <h2 className="mt-1 text-[22px] font-black leading-[1.08] tracking-tight text-black">
          Restoran, kopi, dessert, dan cepat saji · dekat kamu.
        </h2>
        <div className="mt-3 flex items-center gap-2 rounded-full border border-black/10 bg-white pl-3.5 pr-1 py-1 shadow-sm">
          <input
            type="text"
            placeholder="Cari nama · daerah · kategori"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent py-2 text-[12px] text-black placeholder:text-black/45 outline-none"
          />
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-3 py-2 text-[11px] font-black text-white transition-transform active:scale-95 disabled:opacity-55"
            disabled
            title="Natural-language search lands with the NEX brain in Priority 4+"
          >
            <MessageSquare className="h-3 w-3" strokeWidth={2.5} />
            Ask NEX
          </button>
        </div>
        {/* Filter row · flat text links directly under the input field.
            NO badge chrome · NO dropdown · NO slider (Philip 2026-08-21).
            Every filter is a STRUCTURED INTENT TOKEN · same vocabulary NEX
            conversation uses. */}
        <div className="mt-3 scrollbar-none -mx-1 flex items-center gap-3 overflow-x-auto px-1 text-[11.5px]">
          {(Object.keys(TOP_FILTER_LABELS) as TopFilter[]).map((t) => {
            const active = intent.top === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setIntent({ top: t, sub: null })}
                className={`whitespace-nowrap py-1 transition ${
                  active
                    ? "font-semibold text-orange-600"
                    : "text-black/55 hover:text-black"
                }`}
              >
                {TOP_FILTER_LABELS[t]}
              </button>
            );
          })}
        </div>

        {/* Level 2 · sub-filter text row · only when the top has one */}
        {SUB_LABELS[intent.top] && (
          <div className="mt-1 scrollbar-none -mx-1 flex items-center gap-3 overflow-x-auto px-1 text-[10.5px]">
            <button
              type="button"
              onClick={() => setIntent({ top: intent.top, sub: null })}
              className={`whitespace-nowrap py-1 transition ${
                intent.sub === null
                  ? "font-semibold text-orange-600"
                  : "text-black/45 hover:text-black/80"
              }`}
            >
              Semua {TOP_FILTER_LABELS[intent.top]}
            </button>
            {SUB_LABELS[intent.top]!.map((s) => {
              const active = intent.sub === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setIntent({ top: intent.top, sub: s.id })}
                  className={`whitespace-nowrap py-1 transition ${
                    active
                      ? "font-semibold text-orange-600"
                      : "text-black/45 hover:text-black/80"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-3 text-[10.5px] text-black/50">
          {filtered.length} of {listings.length} businesses
        </div>
      </section>

      {/* Feed · CSS masonry columns matching /nex-app/centre */}
      <main className="mx-auto max-w-4xl px-3 py-4">
        {filtered.length === 0 ? (
          <div className="mx-auto mt-6 max-w-md rounded-2xl border border-black/10 bg-white p-6 text-center">
            <div className="text-[13px] font-black text-black">Tidak ada hasil</div>
            <p className="mt-1 text-[11.5px] text-black/60">
              Coba kategori lain atau kata kunci berbeda. Lebih banyak bisnis Yogyakarta bergabung dengan NEX setiap minggu.
            </p>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 md:columns-4 gap-3">
            {tiles.map((t, idx) => (
              <Fragment key={
                t.kind === "organic"
                  ? `o-${t.item.publicListingRef}`
                  : `i-${t.item.id}-${idx}`
              }>
                {t.kind === "organic" ? (
                  <FoodBusinessCard listing={t.item} promoted={t.item.rawClaimStatus === "paying"} />
                ) : (
                  <FoodInterstitial
                    tile={t.item}
                    onCategorySelect={(slug) => setCategory(slug)}
                  />
                )}
              </Fragment>
            ))}
          </div>
        )}

        {attribution && (
          <p className="mt-4 text-center text-[10px] text-black/45">
            {attribution} · NEX never invents dishes or prices.
          </p>
        )}
      </main>
    </div>
  );
}

