"use client";

// src/components/nex-directory/NexDirectoryFeed.tsx
//
// Task #89 Phase B (2026-08-22) · shared NEX Directory shell.
//
// One directory engine · consumed by /hotel · /villa · /guesthouse · /kos ·
// /hostel · /accommodation · Rentals routes · anything future. Same NEX
// visual language as /food (off-white bg · sticky header · masonry-style
// card grid) · category-specific data + terminology come from props.
//
// Philip 2026-08-22 Phase B rule (verbatim): "Extract the existing Food card/
// grid into a shared NEX directory component. Do NOT clone the Food UI."
// "The directory must feel like the same NEX product, not five separate
// applications."
//
// Food's own FoodCentreLiveFeed keeps its existing behaviour unchanged for
// Phase B (Philip: "Food must continue functioning exactly as before").
// Food migration to consume this shell is a Phase B follow-up (technical debt
// tracked · doesn't block Phase B ship).
//
// Doctrine anchors:
//   project_nex_focused_category_directory_architecture_2026_08_22
//   project_nex_category_wheel_access_mandatory_2026_08_22
//   project_nex_local_directory_engine_architecture_2026_08_22
//   project_nex_task89_accommodation_spec_2026_08_22

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { AccommodationDetailSlider, type AccommodationDetailData } from "./AccommodationDetailSlider";
import { NexDiscoveryCard, type DiscoveryCardData } from "./NexDiscoveryCard";
import { SmartDiscoveryCard } from "./SmartDiscoveryCard";
import { SmartDiscoveryController } from "./SmartDiscoveryController";
import type { SmartDiscoverySignal } from "@/lib/nex-accommodation/smart-discovery-signals";

export interface NexDirectoryListing {
  publicListingRef: string;
  businessName:     string;
  category:         string;                     // canonical category id (matches registry)
  categories?:      string[];                   // secondary tokens (Task #85 pattern)
  city:             string;
  district?:        string | null;
  address?:         string | null;
  phone?:           string | null;
  whatsappNumber?:  string | null;
  website?:         string | null;
  heroImageUrl?:    string | null;
  rating?:          number | null;
  reviewCount?:     number | null;
  // PART B 2026-08-24 · optional detail-slider payload · when present the
  // card renders a "Details" button and the slider opens with rich content.
  detail?:          AccommodationDetailData;
  // Category-specific badges shown in the card header row (star rating for
  // accommodation · cuisine for food · vehicle-class for rentals · future).
  categoryBadges?:  Array<{ label: string; tone?: "neutral" | "orange" | "green" }>;
}

export interface NexDirectoryFeedProps {
  categoryId:        string;                    // registry canonical id ('hotel' · 'villa' · etc.)
  categoryLabel:     string;                    // display name
  categoryIcon:      string;                    // emoji or short glyph
  city:              string;                    // 'Yogyakarta'
  listings:          NexDirectoryListing[];
  emptyState?: {
    totalDiscovered: number;                    // rows sitting behind admin promotion gate
    totalUniverse:   number;                    // total rows for this category
    ctaHref?:        string;                    // e.g. /food/register for owner claim
    ctaLabel?:       string;
  };
  attribution?:      string;                    // OSM ODbL etc.
  // PART C 2026-08-24 · optional contextual discovery cards interspersed in
  // the grid. If omitted no cards appear · directory renders as before.
  discoveryCards?:   DiscoveryCardData[];
  // Smart Discovery prototype (2026-08-24) · optional map of publicListingRef → signal.
  // Present on only the 3-5 demonstration accommodations · rest of the grid
  // renders exactly as before · flip is orchestrated by SmartDiscoveryController.
  smartDiscovery?:   Record<string, SmartDiscoverySignal>;
}

// ── Main feed component ─────────────────────────────────────────────

export function NexDirectoryFeed(props: NexDirectoryFeedProps) {
  // categoryId retained as prop for future filter · not yet consumed here.
  const { categoryLabel, categoryIcon, city, listings, emptyState, attribution, discoveryCards, smartDiscovery } = props;
  const [query, setQuery] = useState("");
  const [activeDetail, setActiveDetail] = useState<AccommodationDetailData | null>(null);
  const [flippedRefs, setFlippedRefs] = useState<Set<string>>(() => new Set());

  const eligibleRefs = useMemo(() => Object.keys(smartDiscovery ?? {}), [smartDiscovery]);

  const handleFlip = useCallback((ref: string) => {
    setFlippedRefs((prev) => { const next = new Set(prev); next.add(ref); return next; });
  }, []);
  const handleUnflip = useCallback((ref: string) => {
    setFlippedRefs((prev) => { const next = new Set(prev); next.delete(ref); return next; });
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return listings;
    const q = query.trim().toLowerCase();
    return listings.filter((l) =>
      l.businessName.toLowerCase().includes(q) ||
      (l.district ?? "").toLowerCase().includes(q) ||
      (l.address ?? "").toLowerCase().includes(q) ||
      l.category.toLowerCase().includes(q) ||
      (l.categories ?? []).some((c) => c.toLowerCase().includes(q))
    );
  }, [listings, query]);

  return (
    <div className="relative min-h-screen bg-[#faf7f2]">
      {/* ── Sticky header · mirrors /food ── */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-[#faf7f2]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-2.5">
          <div className="text-sm font-semibold tracking-tight text-black">
            <span className="mr-1.5">{categoryIcon}</span>
            NEX {categoryLabel}
          </div>
          <div className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
            {city}
          </div>
          <div className="flex-1" />
          <div className="text-[11px] font-medium text-black/50">
            {listings.length} {listings.length === 1 ? "place" : "places"}
          </div>
        </div>
      </header>

      {/* ── Search hero · same shape as /food ── */}
      <section className="relative mx-4 mt-4 max-w-4xl rounded-[22px] border border-black/10 bg-white px-4 py-4 shadow-sm md:mx-auto">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-600">
          Discover {city} {categoryLabel.toLowerCase()}
        </div>
        <h2 className="mt-1 text-[22px] font-black leading-[1.08] tracking-tight text-black">
          {props.listings.length > 0
            ? `${props.listings.length} ${categoryLabel.toLowerCase()} in ${city} · verified evidence only.`
            : `${categoryLabel} in ${city} · coming soon.`}
        </h2>
        <div className="mt-3 flex items-center gap-2 rounded-full border border-black/10 bg-white pl-3.5 pr-1 py-1 shadow-sm">
          <input
            type="text"
            placeholder="Cari nama · daerah · kategori"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent py-2 text-[12px] text-black placeholder:text-black/45 outline-none"
          />
        </div>
      </section>

      {/* ── Main content · listings OR empty state ── */}
      <main className="mx-auto max-w-4xl px-4 py-6">
        {listings.length === 0 ? (
          <EmptyState
            categoryLabel={categoryLabel}
            categoryIcon={categoryIcon}
            city={city}
            emptyState={emptyState}
          />
        ) : (
          <DirectoryMasonry
            listings={filtered}
            discoveryCards={discoveryCards ?? []}
            smartDiscovery={smartDiscovery ?? {}}
            flippedRefs={flippedRefs}
            onFlipComplete={handleUnflip}
            onUserCancel={handleUnflip}
            onOpenDetails={(l) => setActiveDetail(l.detail ?? null)}
          />
        )}
      </main>

      {/* Smart Discovery controller · orchestrates 1-2 flips per session ·
          respects prefers-reduced-motion · never re-flips same card. */}
      {eligibleRefs.length > 0 && (
        <SmartDiscoveryController
          eligibleRefs={eligibleRefs}
          flippedRefs={flippedRefs}
          onFlip={handleFlip}
          onUnflip={handleUnflip}
        />
      )}

      {attribution && (
        <footer className="mx-auto max-w-4xl px-4 pb-6 text-[10px] leading-relaxed text-black/40">
          {attribution}
        </footer>
      )}

      {/* PART B (2026-08-24) · Details slider · rendered at feed level so it
          overlays the whole directory · closes cleanly · never causes grid jump. */}
      <AccommodationDetailSlider listing={activeDetail} onClose={() => setActiveDetail(null)} />
    </div>
  );
}

// ── Empty state · honest · admin-gate copy ──────────────────────────

function EmptyState(props: {
  categoryLabel: string;
  categoryIcon:  string;
  city:          string;
  emptyState?:   NexDirectoryFeedProps["emptyState"];
}) {
  const { categoryLabel, categoryIcon, city, emptyState } = props;
  const discovered = emptyState?.totalDiscovered ?? 0;
  const total      = emptyState?.totalUniverse ?? 0;

  return (
    <div className="mt-4 rounded-[22px] border border-black/10 bg-white px-6 py-10 text-center shadow-sm">
      <div className="text-4xl">{categoryIcon}</div>
      <h3 className="mt-3 text-[18px] font-black text-black">
        No {categoryLabel.toLowerCase()} listings yet in {city}.
      </h3>
      {total > 0 ? (
        <p className="mt-2 text-[13px] leading-relaxed text-black/60">
          NEX has discovered <strong>{discovered.toLocaleString("en-GB")}</strong> {categoryLabel.toLowerCase()} {discovered === 1 ? "candidate" : "candidates"} in {city} but none have been through admin verification yet. They stay invisible to customers until each listing passes evidence review.
        </p>
      ) : (
        <p className="mt-2 text-[13px] leading-relaxed text-black/60">
          NEX hasn&apos;t identified any {categoryLabel.toLowerCase()} inventory in {city} through its current sources yet. The category is registered · your NEX Brain understands it · listings will appear here as they are discovered and verified.
        </p>
      )}
      {emptyState?.ctaHref && (
        <Link
          href={emptyState.ctaHref}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-orange-600 px-4 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-orange-700"
        >
          {emptyState.ctaLabel ?? "Add your business"}
        </Link>
      )}
    </div>
  );
}

// ── CSS-columns masonry · matches /food's visual pattern ────────────

function DirectoryMasonry({
  listings, discoveryCards, smartDiscovery, flippedRefs, onFlipComplete, onUserCancel, onOpenDetails,
}: {
  listings: NexDirectoryListing[];
  discoveryCards: DiscoveryCardData[];
  smartDiscovery: Record<string, SmartDiscoverySignal>;
  flippedRefs: Set<string>;
  onFlipComplete: (ref: string) => void;
  onUserCancel: (ref: string) => void;
  onOpenDetails: (l: NexDirectoryListing) => void;
}) {
  // PART C · sparse insertion pattern · one discovery card every ~7 business
  // cards so the grid never feels ad-heavy. Cards are cycled through the
  // provided list · never fabricated.
  const CARD_EVERY = 7;
  const items: Array<{ kind: "business"; l: NexDirectoryListing } | { kind: "discovery"; c: DiscoveryCardData }> = [];
  let discoveryIdx = 0;
  listings.forEach((l, i) => {
    items.push({ kind: "business", l });
    if (discoveryCards.length > 0 && i > 0 && (i + 1) % CARD_EVERY === 0) {
      const c = discoveryCards[discoveryIdx % discoveryCards.length];
      items.push({ kind: "discovery", c });
      discoveryIdx++;
    }
  });

  return (
    <div className="[column-count:2] md:[column-count:3] lg:[column-count:4] [column-gap:12px]">
      {items.map((it, idx) => {
        if (it.kind === "discovery") {
          return (
            <div key={`discover-${idx}`} className="mb-3 break-inside-avoid">
              <NexDiscoveryCard card={it.c} />
            </div>
          );
        }
        const listing = it.l;
        const signal = smartDiscovery[listing.publicListingRef];
        const card = <NexBusinessCard listing={listing} onOpenDetails={onOpenDetails} />;
        if (!signal) {
          return (
            <div key={listing.publicListingRef} className="mb-3 break-inside-avoid">
              {card}
            </div>
          );
        }
        // Wrap Smart-Discovery-eligible cards with the flip surface. The
        // controller decides when isFlipped=true · the wrap does not change
        // layout when isFlipped=false so the grid never jumps.
        return (
          <div key={listing.publicListingRef} className="mb-3 break-inside-avoid">
            <SmartDiscoveryCard
              publicListingRef={listing.publicListingRef}
              signal={signal}
              isFlipped={flippedRefs.has(listing.publicListingRef)}
              onFlipComplete={() => onFlipComplete(listing.publicListingRef)}
              onUserCancel={() => onUserCancel(listing.publicListingRef)}
              onDetailsClick={() => onOpenDetails(listing)}
            >
              {card}
            </SmartDiscoveryCard>
          </div>
        );
      })}
    </div>
  );
}

// ── Generic card · vertical-agnostic · consumes NexDirectoryListing ─
// Food · Accommodation · Rentals · future verticals all render through this
// single card. Fields absent for a vertical (e.g. cuisine for accommodation)
// simply don't appear.

function NexBusinessCard({ listing, onOpenDetails }: { listing: NexDirectoryListing; onOpenDetails?: (l: NexDirectoryListing) => void }) {
  const initial = listing.businessName.charAt(0).toUpperCase();
  const canOpenDetail = Boolean(listing.detail && onOpenDetails);
  return (
    <article className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm transition hover:shadow-md">
      {/* Hero image OR letter-tile fallback */}
      {listing.heroImageUrl ? (
        <div className="aspect-[4/3] w-full overflow-hidden bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={listing.heroImageUrl}
            alt={listing.businessName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-orange-50 to-neutral-100">
          <span className="text-4xl font-black text-orange-500/30">{initial}</span>
        </div>
      )}

      {/* Body */}
      <div className="px-3.5 py-3">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="text-[13.5px] font-semibold leading-tight text-black">{listing.businessName}</h3>
          {listing.rating != null && (
            <span className="whitespace-nowrap text-[11px] font-semibold text-orange-600">
              ★ {listing.rating.toFixed(1)}
            </span>
          )}
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-black/55">
          <span className="rounded bg-black/[0.05] px-1.5 py-0.5 font-medium capitalize">{listing.category}</span>
          {listing.district && <span>· {listing.district}</span>}
          {listing.categoryBadges?.map((b, i) => (
            <span
              key={i}
              className={
                b.tone === "orange" ? "rounded bg-orange-100 px-1.5 py-0.5 font-medium text-orange-700" :
                b.tone === "green"  ? "rounded bg-green-100 px-1.5 py-0.5 font-medium text-green-700"   :
                                       "rounded bg-black/[0.05] px-1.5 py-0.5 font-medium"
              }
            >
              {b.label}
            </span>
          ))}
        </div>

        {listing.address && (
          <div className="mb-2 line-clamp-2 text-[11.5px] text-black/60">{listing.address}</div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {canOpenDetail && (
            <button
              type="button"
              onClick={() => onOpenDetails?.(listing)}
              className="rounded-full bg-orange-600 px-2.5 py-1 font-semibold text-white hover:bg-orange-700"
            >
              Details
            </button>
          )}
          {listing.whatsappNumber && (
            <a
              href={`https://wa.me/${listing.whatsappNumber.replace(/\D+/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-green-600 px-2.5 py-1 font-semibold text-white hover:bg-green-700"
            >
              WhatsApp
            </a>
          )}
          {listing.phone && !listing.whatsappNumber && (
            <a
              href={`tel:${listing.phone.replace(/\s+/g, "")}`}
              className="rounded-full border border-black/10 bg-white px-2.5 py-1 font-medium text-black/70 hover:bg-black/[0.03]"
            >
              Call
            </a>
          )}
          {listing.website && (
            <a
              href={listing.website}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-black/10 bg-white px-2.5 py-1 font-medium text-black/70 hover:bg-black/[0.03]"
            >
              Website
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
