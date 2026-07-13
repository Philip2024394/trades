// Trade Counter listing card. Used on the browse page + as a compact
// preview elsewhere. Kind pill (For Sale · Offer · Free) at top-left,
// author + location at bottom.

import Link from "next/link";
import { MapPin, Package, ArrowRight, Truck, Handshake, Gift, PoundSterling } from "lucide-react";
import { findTradeIdentity } from "@/apps/identity/data/tradeIdentities";
import type { TradeCounterListing, TradeCounterListingKind } from "../data/listings";

type Props = {
  listing: TradeCounterListing;
};

function kindVisual(k: TradeCounterListingKind) {
  switch (k) {
    case "for-sale":  return { label: "For Sale", Icon: PoundSterling, bg: "#0A0A0A", fg: "#FFB300" };
    case "offer":     return { label: "Swap / Offer", Icon: Handshake,   bg: "#FFB300", fg: "#0A0A0A" };
    case "free":      return { label: "Free",     Icon: Gift,          bg: "#166534", fg: "#FFFFFF" };
  }
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return "just now";
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  const days = Math.floor(mins / (60 * 24));
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function ListingCard({ listing }: Props) {
  const author = findTradeIdentity(listing.authorSlug);
  const v = kindVisual(listing.kind);

  return (
    <Link
      href={`/tc/trade-counter/${listing.slug}`}
      className="flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      {/* Image / placeholder */}
      <div
        className="relative aspect-[4/3] w-full overflow-hidden"
        style={{ backgroundColor: "#F5F0E4" }}
      >
        {listing.photoUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.photoUrls[0]} alt="" className="h-full w-full object-cover"/>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package size={32} strokeWidth={1.5} className="text-neutral-400"/>
          </div>
        )}
        <span
          className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider shadow-sm"
          style={{ backgroundColor: v.bg, color: v.fg }}
        >
          <v.Icon size={9} strokeWidth={2.5}/>
          {v.label}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="line-clamp-2 text-[13px] font-black leading-tight text-neutral-900">
          {listing.title}
        </div>

        {/* Price / swap-for / free */}
        <div className="flex items-baseline gap-2">
          {listing.kind === "for-sale" && listing.askingGbp !== undefined && (
            <span className="text-[17px] font-black text-neutral-900">£{listing.askingGbp}</span>
          )}
          {listing.kind === "free" && (
            <span className="text-[15px] font-black" style={{ color: "#166534" }}>Free</span>
          )}
          {listing.kind === "offer" && listing.swapForLabel && (
            <span className="line-clamp-1 text-[11px] leading-snug text-neutral-700">
              Wants: {listing.swapForLabel}
            </span>
          )}
          <span className="text-[10.5px] text-neutral-500">
            × {listing.quantityAvailable}
          </span>
        </div>

        {/* Author + location */}
        <div className="mt-auto flex items-center gap-2 border-t pt-2" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <span
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-black"
            style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
          >
            {author?.headshotInitials ?? "?"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="line-clamp-1 text-[10.5px] font-black text-neutral-800">
              {author?.displayName ?? listing.authorSlug}
            </div>
            <div className="flex items-center gap-1 text-[9.5px] text-neutral-500">
              <MapPin size={9}/>
              {listing.locationCity}
              <span>·</span>
              {timeAgo(listing.postedAtIso)}
              {listing.deliveryPossible && (
                <>
                  <span>·</span>
                  <Truck size={9}/> delivery ok
                </>
              )}
            </div>
          </div>
          <ArrowRight size={12} className="flex-shrink-0 text-neutral-400"/>
        </div>
      </div>
    </Link>
  );
}
