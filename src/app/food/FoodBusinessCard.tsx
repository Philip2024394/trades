"use client";

// FoodBusinessCard · masonry-card clone of NexCentreLiveFeed's product card.
// rounded-2xl white surface · hero image · title · category · location ·
// verified badge · orange "View Details" CTA. Promoted pill for paying tier.

import Link from "next/link";
import { MapPin, MessageSquare, Sparkles, Star } from "lucide-react";
import type { FoodListing } from "@/lib/nexapp/foodListings";
import { FOOD_CATEGORIES } from "@/lib/nexapp/foodListings";

// Deterministic aspect-ratio bucket for masonry variety (mirrors /nex-app/centre).
function cardAspect(ref: string): string {
  let hash = 0;
  for (let i = 0; i < ref.length; i++) hash = (hash * 31 + ref.charCodeAt(i)) | 0;
  const bucket = Math.abs(hash) % 4;
  return ["3/4", "4/5", "1/1", "5/6"][bucket]!;
}

export function FoodBusinessCard({
  listing,
  promoted = false,
}: {
  listing: FoodListing;
  promoted?: boolean;
}) {
  const category = FOOD_CATEGORIES.find((c) => c.slug === listing.category);
  const aspect = cardAspect(listing.publicListingRef);
  const isMember = listing.claimStatus === "claimed";
  const isInvited = listing.claimStatus === "invited";
  const isDiscovered = (listing as { rawClaimStatus?: string }).rawClaimStatus === "discovered";
  const detailHref = `/food/${listing.publicListingRef.replace(/^#FL-/, "")}`;

  return (
    <article className="group mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Hero image · deterministic aspect ratio for masonry variety */}
      <Link
        href={detailHref}
        aria-label={`View ${listing.name}`}
        className="relative block w-full overflow-hidden"
        style={{ aspectRatio: aspect }}
      >
        {listing.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.heroImageUrl}
            alt={listing.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-100 via-amber-50 to-neutral-100 text-3xl" aria-hidden>
            {category?.emoji ?? "🍽️"}
          </div>
        )}

        {/* Promoted pill · only paying tier */}
        {promoted && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[9px] font-semibold text-white shadow-sm">
            <Sparkles className="h-2.5 w-2.5" strokeWidth={2.5} />
            Promoted
          </span>
        )}

        {/* Membership pip · top-right · three states: NEX Member (verified) · Invited · Discovered (unclaimed) */}
        {isMember ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-green-600 px-2 py-0.5 text-[9px] font-semibold text-white shadow-sm">
            NEX Member
          </span>
        ) : isInvited ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-600 px-2 py-0.5 text-[9px] font-semibold text-white shadow-sm">
            Invited
          </span>
        ) : isDiscovered ? (
          <span
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/85 px-2 py-0.5 text-[9px] font-medium text-neutral-600 shadow-sm ring-1 ring-inset ring-neutral-300"
            title="Ditemukan oleh NEX · pemilik belum klaim"
          >
            Belum diklaim
          </span>
        ) : null}
      </Link>

      <div className="p-3">
        <Link
          href={detailHref}
          className="block w-full text-left text-sm font-semibold leading-tight text-black line-clamp-2 hover:underline"
        >
          {listing.name}
        </Link>

        {/* Rating · only when present (no fabricated data) */}
        {typeof listing.rating === "number" && (
          <div className="mt-1.5 flex items-center gap-1">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
            <span className="text-[11px] font-semibold text-black">{listing.rating.toFixed(1)}</span>
            {listing.reviewCount != null && (
              <span className="text-[10px] text-black/50">({listing.reviewCount})</span>
            )}
          </div>
        )}

        {/* Meta pills · category + location */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {category && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-black/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-black/60">
              <span aria-hidden>{category.emoji}</span>
              {category.labelEn}
            </span>
          )}
          <span className="inline-flex items-center gap-0.5 rounded-full bg-black/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-black/60">
            <MapPin className="h-2 w-2" />
            {listing.district}
          </span>
        </div>

        <Link
          href={detailHref}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-orange-500 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:bg-orange-600"
        >
          <MessageSquare className="h-3 w-3" strokeWidth={2.5} />
          View Details
        </Link>
      </div>
    </article>
  );
}
