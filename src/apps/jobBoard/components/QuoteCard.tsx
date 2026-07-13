// Quote card on a job posting detail — shows the trade's identity +
// quote amount + duration + note + a "Message this trade" CTA.
//
// Constitution: quotes are rendered in submission order. Trade Center
// never re-ranks by margin, boost, or sponsorship.

import Link from "next/link";
import { Clock, PoundSterling, MessageSquare, Star, ShieldCheck } from "lucide-react";
import { findTradeIdentity, countVerifiedLayers } from "@/apps/identity/data/tradeIdentities";
import { findTradeProfile } from "@/apps/trades/data/tradeProfiles";
import type { JobQuote } from "../data/jobPostings";

type Props = {
  quote: JobQuote;
};

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / (60 * 24))}d ago`;
}

export function QuoteCard({ quote }: Props) {
  const identity = findTradeIdentity(quote.tradeSlug);
  const profile = findTradeProfile(quote.tradeSlug);
  const verifiedLayers = identity ? countVerifiedLayers(identity) : 0;
  const reviewCount = profile?.testimonials.length ?? 0;
  const avgStars = reviewCount === 0
    ? 0
    : (profile?.testimonials.reduce((s, t) => s + t.starRating, 0) ?? 0) / reviewCount;

  return (
    <article
      className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm md:flex-row md:items-start"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      {/* Trade identity */}
      <div className="flex items-center gap-3 md:min-w-[220px] md:flex-shrink-0">
        <Link
          href={identity ? `/tc/trade/${identity.slug}` : "#"}
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-black"
          style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
          aria-label={identity?.displayName ?? quote.tradeSlug}
        >
          {identity?.headshotInitials ?? "?"}
        </Link>
        <div className="min-w-0">
          <Link
            href={identity ? `/tc/trade/${identity.slug}` : "#"}
            className="line-clamp-1 text-[13px] font-black text-neutral-900 hover:underline"
          >
            {identity?.displayName ?? quote.tradeSlug}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-neutral-600">
            <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider" style={{ backgroundColor: "#166534", color: "#FFFFFF" }}>
              <ShieldCheck size={9} strokeWidth={2.5}/>
              {verifiedLayers}/8
            </span>
            {reviewCount > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Star size={9} className="text-amber-500" fill="currentColor"/>
                {avgStars.toFixed(1)} ({reviewCount})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quote body */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-3">
            <div className="inline-flex items-baseline gap-1 text-[22px] font-black text-neutral-900">
              <PoundSterling size={16}/>
              {quote.amountGbp.toLocaleString()}
            </div>
            <div className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10.5px] font-bold text-neutral-700">
              <Clock size={10}/>
              {quote.estimatedDurationDays} day{quote.estimatedDurationDays === 1 ? "" : "s"}
            </div>
          </div>
          <div className="text-[10px] text-neutral-500">
            Quoted {timeAgo(quote.submittedAtIso)}
          </div>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-neutral-700">
          {quote.note}
        </p>
        <div className="mt-3">
          <Link
            href={`/tc/messages?compose=${quote.tradeSlug}`}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-white shadow-sm"
            style={{ backgroundColor: "#166534" }}
          >
            <MessageSquare size={12}/>
            Message this trade
          </Link>
        </div>
      </div>
    </article>
  );
}
