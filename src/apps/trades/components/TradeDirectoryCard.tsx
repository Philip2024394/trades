// Trade card for the directory / search results. Compact — the customer
// scans a list, picks a candidate, clicks through to the profile.

import Link from "next/link";
import { MapPin, Star, Clock, ShieldCheck } from "lucide-react";
import { findTradeIdentity, countVerifiedLayers } from "@/apps/identity/data/tradeIdentities";
import type { TradePublicProfile } from "../data/tradeProfiles";

type Props = {
  profile: TradePublicProfile;
};

export function TradeDirectoryCard({ profile }: Props) {
  const identity = findTradeIdentity(profile.ownerTradeSlug);
  if (!identity) return null;

  const reviewCount = profile.testimonials.length;
  const avgStars = reviewCount === 0
    ? 0
    : profile.testimonials.reduce((sum, t) => sum + t.starRating, 0) / reviewCount;
  const verifiedLayers = countVerifiedLayers(identity);

  return (
    <Link
      href={`/tc/trade/${identity.slug}`}
      className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md md:flex-row md:items-start"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      {/* Avatar */}
      <div
        className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-[15px] font-black"
        style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
        aria-hidden
      >
        {identity.headshotInitials}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <div className="text-[14px] font-black text-neutral-900">{identity.displayName}</div>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider"
            style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
          >
            <ShieldCheck size={9} strokeWidth={2.5}/>
            Verified · {verifiedLayers}/8
          </span>
        </div>
        <div className="mt-0.5 text-[11.5px] text-neutral-600">
          {identity.tradeType}
        </div>
        <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-neutral-700">
          {profile.headline}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-600">
          {reviewCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Star size={10} className="text-amber-500" fill="currentColor"/>
              <span className="font-bold text-neutral-900">{avgStars.toFixed(1)}</span>
              <span className="text-neutral-500">({reviewCount})</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <MapPin size={10}/> {identity.homeCity}
            {profile.serviceAreaCities.length > 1 && (
              <span className="text-neutral-500">+ {profile.serviceAreaCities.length - 1}</span>
            )}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock size={10}/> Replies within {profile.responseTimeHoursMedian}h
          </span>
          {profile.acceptingWork && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-green-800">
              Accepting work
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
