// Customer-facing hero at the top of a trade's public profile.
// Composes R07 identity signals with trade-specific meta.

import Link from "next/link";
import {
  ShieldCheck,
  Star,
  Clock,
  MapPin,
  Calendar,
  MessageSquare,
  CheckCircle2,
  AtSign
} from "lucide-react";
import { VerifiedTradeIdentityBadge } from "@/apps/identity/components/VerifiedTradeIdentityBadge";
import { FollowButton } from "@/apps/social/components/FollowButton";
import { FavouriteButton } from "@/apps/favourites/components/FavouriteButton";
import type { VerifiedTradeIdentity } from "@/apps/identity/data/tradeIdentities";
import type { TradePublicProfile } from "../data/tradeProfiles";

type Props = {
  identity: VerifiedTradeIdentity;
  profile: TradePublicProfile;
  reviewCount: number;
  averageStars: number;
};

export function TradeProfileHero({ identity, profile, reviewCount, averageStars }: Props) {
  const nextAvail = profile.nextAvailableDateIso
    ? new Date(profile.nextAvailableDateIso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : null;

  return (
    <section
      className="relative overflow-hidden rounded-2xl border shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)", minHeight: "260px" }}
    >
      {/* Banner background — reuse the trade's first gallery image if any */}
      <div className="absolute inset-0" aria-hidden>
        {profile.gallery[0] ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={profile.gallery[0].imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(10,10,10,0.85) 0%, rgba(10,10,10,0.65) 50%, rgba(10,10,10,0.35) 100%)"
              }}
            />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(135deg, #0A0A0A 0%, #14211A 55%, #0A0A0A 100%)" }}
          />
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col gap-5 p-5 md:p-7">
        {/* Top row: avatar + identity */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-5">
          <div
            className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-full shadow-lg ring-2 ring-white/40 text-[16px] font-black"
            style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
            aria-hidden
          >
            {identity.headshotInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] font-black leading-tight text-white drop-shadow md:text-[28px]">
                {identity.displayName}
              </h1>
              <VerifiedTradeIdentityBadge trade={identity} href="/tc/identity"/>
            </div>
            <div className="mt-1 text-[13px] text-white/90">
              {identity.tradeType} · {identity.legalName}
            </div>
            <p className="mt-1 text-[12.5px] leading-snug text-white/85">
              {profile.headline}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-white/80">
              <span className="inline-flex items-center gap-1">
                <Star size={11} className="text-amber-400" fill="currentColor"/>
                <span className="font-black">{averageStars.toFixed(1)}</span>
                <span>({reviewCount} customer-signed reviews)</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin size={11}/> {identity.homeCity} · {profile.serviceRadiusMiles} mi radius
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={11}/> Replies within {profile.responseTimeHoursMedian}h
              </span>
              {nextAvail && profile.acceptingWork && (
                <span className="inline-flex items-center gap-1">
                  <Calendar size={11}/> Next avail {nextAvail}
                </span>
              )}
            </div>
          </div>

          {/* Desktop primary CTA */}
          <div className="hidden flex-shrink-0 flex-col gap-2 md:flex md:items-end">
            <Link
              href={`/tc/messages?compose=${identity.slug}`}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-black uppercase tracking-wider shadow-md"
              style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
            >
              <MessageSquare size={13} strokeWidth={2.5}/>
              Get a quote
            </Link>
            <FollowButton
              targetSlug={identity.slug}
              targetName={identity.displayName}
              targetType="trade"
              showCount={false}
            />
            <FavouriteButton
              kind="trade"
              targetSlug={identity.slug}
              variant="labelled"
            />
            {profile.socials?.instagram && (
              <a
                href={`https://instagram.com/${profile.socials.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11.5px] font-black uppercase tracking-wider text-white backdrop-blur"
                style={{ borderColor: "rgba(255,255,255,0.35)", backgroundColor: "rgba(255,255,255,0.10)" }}
              >
                <AtSign size={12}/>
                @{profile.socials.instagram}
              </a>
            )}
          </div>
        </div>

        {/* Trust callouts row */}
        <div
          className="grid grid-cols-2 gap-3 rounded-lg p-3 md:grid-cols-4 md:p-4"
          style={{ backgroundColor: "rgba(10,10,10,0.55)", backdropFilter: "blur(4px)" }}
        >
          <Callout Icon={ShieldCheck} label="Verified Trade" value={`${Object.values(identity.layers).filter((l) => l.status === "verified").length}/8 layers`}/>
          <Callout Icon={CheckCircle2} label="Companies House" value={`${identity.yearsTrading} yrs`}/>
          <Callout Icon={Clock} label="Response time" value={`< ${profile.responseTimeHoursMedian}h`}/>
          <Callout Icon={Calendar} label="Typical job" value={`${profile.averageJobTurnaroundDays} days`}/>
        </div>

        {/* Mobile CTA */}
        <div className="flex flex-col gap-2 md:hidden">
          <Link
            href={`/tc/messages?compose=${identity.slug}`}
            className="flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[13px] font-black uppercase tracking-wider shadow-md"
            style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
          >
            <MessageSquare size={14} strokeWidth={2.5}/>
            Get a quote
          </Link>
        </div>
      </div>
    </section>
  );
}

function Callout({
  Icon,
  label,
  value
}: {
  Icon: typeof ShieldCheck;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[9.5px] font-black uppercase tracking-wider" style={{ color: "rgba(255,179,0,0.7)" }}>
        <Icon size={10}/>
        {label}
      </div>
      <div className="mt-0.5 text-[13.5px] font-black text-white">{value}</div>
    </div>
  );
}
