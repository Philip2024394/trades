"use client";

// Reviews page client shell — hero with Bayesian aggregate + radar-
// style dimension breakdown, filter chips, sort dropdown, review list.
// Zero-rating protection built in: merchants with < 5 reviews render
// "Building reputation" instead of a low aggregate number.

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Star,
  Filter,
  ArrowUpDown,
  ShieldCheck,
  MessageCircle,
  ArrowLeft,
  Sparkles,
  Info,
  PenSquare
} from "lucide-react";
import type {
  TradeReview,
  ReviewFilter,
  ReviewSort,
  ReviewDimensionKey,
  ReputationBadge
} from "@/lib/reviews";
import { REVIEW_DIMENSIONS, filterReviews, sortReviews } from "@/lib/reviews";
import { TradeReviewCard } from "@/components/xrated/reviews/TradeReviewCard";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

const FILTER_LABELS: Record<ReviewFilter, string> = {
  "all": "All reviews",
  "verified-job": "Verified job",
  "with-photos": "With photos",
  "recent": "Recent · 90 days"
};

const SORT_LABELS: Record<ReviewSort, string> = {
  "relevance": "Most relevant",
  "newest": "Newest",
  "highest": "Highest rated",
  "lowest": "Lowest rated"
};

export function ReviewsShell({
  slug,
  merchantDisplayName,
  merchantTradeLabel,
  merchantCity,
  merchantAvatarUrl,
  reviews,
  aggregate,
  dimensions,
  badge,
  backHref,
  backLabel,
  bannerUrl,
  recovery
}: {
  slug: string;
  merchantDisplayName: string;
  merchantTradeLabel: string;
  merchantCity: string;
  merchantAvatarUrl: string | null;
  reviews: TradeReview[];
  aggregate: { rating: number | null; weightedCount: number; rawCount: number };
  dimensions: Record<ReviewDimensionKey, number | null>;
  badge: ReputationBadge;
  /** Where the breadcrumb + avatar route back to. Server resolves the
   *  merchant's hosted canteen slug when one exists, falling back to
   *  the /trade/{slug} route as a legacy path. */
  backHref: string;
  /** "canteen" | "profile" — one-word noun used in "Back to {name}'s
   *  {backLabel}" so the copy stays honest about the destination. */
  backLabel: string;
  /** Merchant banner — same asset used by the canteen page + profile
   *  focus. Rendered under a dark gradient overlay for text contrast.
   *  Falls back to the flat dark hero when null. */
  bannerUrl?: string | null;
  /** Admin-awarded Recovery status — renders as a public badge in
   *  the hero when present. Signals the merchant handled a dispute
   *  well. */
  recovery?: { awardedAt: string; reason: string } | null;
}) {
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [sort, setSort] = useState<ReviewSort>("relevance");

  const displayed = useMemo(() => sortReviews(filterReviews(reviews, filter), sort), [reviews, filter, sort]);

  const verifiedCount = reviews.filter((r) => r.status === "published" && r.jobVerification.kind === "job-tag").length;
  const withPhotosCount = reviews.filter((r) => r.status === "published" && r.photoUrls.length > 0).length;

  return (
    <div className="pb-16">
      {/* Hero — merchant banner with a dark gradient overlay when
          uploaded; falls back to solid dark when not. Same banner
          asset as the canteen page + profile focus so the three
          surfaces read as one brand. */}
      <section
        className="relative overflow-hidden border-b"
        style={{
          backgroundColor: BRAND_BLACK,
          borderColor: `${BRAND_YELLOW}33`,
          backgroundImage: bannerUrl
            ? `linear-gradient(160deg, rgba(10,10,10,0.72) 0%, rgba(42,26,10,0.78) 55%, rgba(10,10,10,0.88) 100%), url('${bannerUrl}')`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      >
        <div className="mx-auto max-w-4xl px-3 py-8 md:px-6 md:py-10">
          {/* Breadcrumb */}
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-400 hover:text-white"
          >
            <ArrowLeft size={11} strokeWidth={2.5}/>
            Back to {merchantDisplayName}'s {backLabel}
          </Link>

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
            {/* Left — merchant identity. Avatar is now a link so
                tapping the profile image routes back to the merchant's
                canteen (or /trade/{slug} legacy fallback). */}
            <div className="flex items-center gap-3">
              <Link
                href={backHref}
                aria-label={`Back to ${merchantDisplayName}'s ${backLabel}`}
                className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full border-2 shadow-lg transition hover:-translate-y-0.5"
                style={{
                  borderColor: BRAND_YELLOW,
                  backgroundImage: merchantAvatarUrl ? `url('${merchantAvatarUrl}')` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundColor: !merchantAvatarUrl ? BRAND_YELLOW : undefined
                }}
              >
                {!merchantAvatarUrl && (
                  <div className="flex h-full w-full items-center justify-center text-[20px] font-black" style={{ color: BRAND_BLACK }}>
                    {merchantDisplayName.charAt(0)}
                  </div>
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <div
                  className="text-[10px] font-black uppercase tracking-[0.24em]"
                  style={{ color: BRAND_YELLOW }}
                >
                  Reviews
                </div>
                <h1 className="text-[22px] font-black leading-tight text-white md:text-[26px]">
                  {merchantDisplayName}
                </h1>
                <div className="mt-0.5 text-[11px] font-bold text-neutral-400">
                  {merchantTradeLabel}{merchantCity ? ` · ${merchantCity}` : ""}
                </div>
              </div>
            </div>

            {/* Right — aggregate score card (varies by badge) */}
            <div className="md:min-w-[240px]">
              <AggregateCard badge={badge}/>
            </div>
          </div>

          {/* Dimension breakdown — 5 bars (or 6). Only shown when the
              badge is "early" or "established" (i.e., we have a rating). */}
          {badge.kind !== "building" && (
            <div
              className="mt-5 rounded-xl border p-4 backdrop-blur"
              style={{ borderColor: `${BRAND_YELLOW}44`, backgroundColor: "rgba(255,255,255,0.05)" }}
            >
              <div className="mb-3 flex items-center gap-1.5">
                <Sparkles size={11} color={BRAND_YELLOW} strokeWidth={2.5}/>
                <span
                  className="text-[10px] font-black uppercase tracking-[0.22em]"
                  style={{ color: BRAND_YELLOW }}
                >
                  Score breakdown
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {REVIEW_DIMENSIONS.filter((d) => d.key !== "trade_specific").map((dim) => {
                  const score = dimensions[dim.key];
                  return (
                    <HeroDimensionBar key={dim.key} label={dim.label} score={score}/>
                  );
                })}
              </div>
            </div>
          )}

          {/* Meta strip — verified counts + trust note */}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] font-bold text-neutral-400">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck size={11} color={BRAND_GREEN_DARK} strokeWidth={2.5}/>
              {verifiedCount} verified job{verifiedCount === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1 text-neutral-500">
              · {withPhotosCount} with photos
            </span>
            <span className="hidden sm:inline text-neutral-500">
              · Bayesian aggregate · Time-decayed
            </span>
          </div>

          {/* Recovery badge — admin-awarded public trust marker */}
          {recovery && (
            <div
              className="mt-4 inline-flex items-start gap-2 rounded-xl border p-3"
              style={{ borderColor: `${BRAND_GREEN_DARK}66`, backgroundColor: `${BRAND_GREEN_DARK}18` }}
            >
              <ShieldCheck size={14} color="#7EE7A5" strokeWidth={2.5} className="mt-0.5 flex-shrink-0"/>
              <div className="text-[11px] leading-snug text-neutral-200">
                <span className="font-black uppercase tracking-[0.22em]" style={{ color: "#7EE7A5" }}>Recovery status</span>
                <div className="mt-0.5 font-bold text-white">Awarded by admin for demonstrated dispute resolution.</div>
                <div className="mt-0.5 text-[10px] italic text-neutral-400">"{recovery.reason}"</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Filter + sort bar — sticky under the top nav */}
      <section
        className="sticky top-[64px] z-10 border-b bg-white/85 backdrop-blur"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2 px-3 py-3 md:px-6">
          <div className="flex items-center gap-1 pr-1 text-[10px] font-black uppercase tracking-wider text-neutral-500">
            <Filter size={11}/>
            Filter
          </div>
          {(Object.entries(FILTER_LABELS) as [ReviewFilter, string][]).map(([k, label]) => (
            <FilterChip
              key={k}
              active={filter === k}
              onClick={() => setFilter(k)}
              label={label}
            />
          ))}
          <label className="ml-auto flex flex-shrink-0 items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-neutral-600">
            <ArrowUpDown size={11}/>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as ReviewSort)}
              className="cursor-pointer rounded-full border bg-white px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-neutral-800 shadow-sm focus:outline-none"
              style={{ borderColor: `${BRAND_YELLOW}88` }}
            >
              {(Object.entries(SORT_LABELS) as [ReviewSort, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* Review list */}
      <section className="mx-auto max-w-4xl px-3 pt-6 md:px-6">
        {displayed.length === 0 ? (
          <EmptyState filter={filter} onReset={() => setFilter("all")}/>
        ) : (
          <ul className="flex flex-col gap-3">
            {displayed.map((r) => (
              <li key={r.id}>
                <TradeReviewCard review={r}/>
              </li>
            ))}
          </ul>
        )}

        {/* Trust footer — how Thenetworkers reviews work */}
        <div
          className="mt-6 rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: `${BRAND_YELLOW}44` }}
        >
          <div className="mb-2 flex items-center gap-1.5">
            <Info size={12} color={BRAND_BLACK} strokeWidth={2.5}/>
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
              How reviews work on Thenetworkers
            </span>
          </div>
          <ul className="grid grid-cols-1 gap-2 text-[12px] leading-snug text-neutral-700 md:grid-cols-2">
            <TrustPoint>Only Network members can review. WhatsApp-verified identity, real trade profiles.</TrustPoint>
            <TrustPoint>Every review requires a documented job — WhatsApp thread, job-tag, or invoice.</TrustPoint>
            <TrustPoint>Reviews under 4★ enter a 72h private response window before publishing.</TrustPoint>
            <TrustPoint>Admin can freeze, remove, or verify — every action is publicly logged. Never silent.</TrustPoint>
            <TrustPoint>Aggregate uses Bayesian smoothing + time-decay. Recent reviews weigh more.</TrustPoint>
            <TrustPoint>Zero-rating protection: profiles with under 5 reviews show "Building reputation".</TrustPoint>
          </ul>
        </div>

        {/* Leave-a-review CTA — gated to members */}
        <LeaveReviewCTA merchantSlug={slug} merchantDisplayName={merchantDisplayName}/>
      </section>
    </div>
  );
}

function AggregateCard({ badge }: { badge: ReputationBadge }) {
  if (badge.kind === "building") {
    return (
      <div
        className="rounded-2xl border-2 p-4 text-center shadow-md"
        style={{
          borderColor: BRAND_YELLOW,
          background: `linear-gradient(135deg, ${BRAND_YELLOW}22 0%, rgba(0,0,0,0.4) 60%)`,
          backdropFilter: "blur(4px)"
        }}
      >
        <div className="text-[9px] font-black uppercase tracking-[0.28em]" style={{ color: BRAND_YELLOW }}>
          Building reputation
        </div>
        <div className="mt-1 text-[24px] font-black leading-none text-white">
          {badge.reviewCount}
        </div>
        <div className="text-[11px] font-black uppercase tracking-wider text-neutral-300">
          review{badge.reviewCount === 1 ? "" : "s"} so far
        </div>
        <p className="mt-2 text-[10px] leading-snug text-neutral-400">
          Rating appears at 5 verified reviews. Zero-rating protection.
        </p>
      </div>
    );
  }
  return (
    <div
      className="rounded-2xl border-2 p-4 text-center shadow-md"
      style={{
        borderColor: BRAND_YELLOW,
        background: `linear-gradient(135deg, ${BRAND_YELLOW}22 0%, rgba(0,0,0,0.4) 60%)`,
        backdropFilter: "blur(4px)"
      }}
    >
      <div className="flex items-center justify-center gap-1">
        <Star size={20} fill={BRAND_YELLOW} color={BRAND_YELLOW} strokeWidth={0}/>
        <span className="text-[32px] font-black leading-none tabular-nums text-white">
          {badge.rating.toFixed(1)}
        </span>
      </div>
      <div className="mt-1 text-[11px] font-black uppercase tracking-wider text-neutral-300">
        {badge.reviewCount} verified review{badge.reviewCount === 1 ? "" : "s"}
      </div>
      {badge.kind === "early" && (
        <div className="mt-1 text-[9px] font-black uppercase tracking-wider" style={{ color: BRAND_YELLOW }}>
          · Early days
        </div>
      )}
    </div>
  );
}

function HeroDimensionBar({ label, score }: { label: string; score: number | null }) {
  const pct = score !== null ? Math.max(0, Math.min(100, (score / 5) * 100)) : 0;
  const color = score === null ? "#525252" : score >= 4 ? BRAND_YELLOW : score >= 3 ? "#F59E0B" : "#DC2626";
  return (
    <div className="flex items-center gap-2">
      <span className="w-32 flex-shrink-0 truncate text-[10px] font-black uppercase tracking-wider text-neutral-400">
        {label}
      </span>
      <div className="h-2 flex-1 rounded-full bg-white/10">
        {score !== null && (
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        )}
      </div>
      <span className="w-6 flex-shrink-0 text-right text-[10px] font-black tabular-nums text-white">
        {score !== null ? score.toFixed(1) : "—"}
      </span>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-black uppercase tracking-wider transition"
      style={
        active
          ? { backgroundColor: BRAND_YELLOW, borderColor: BRAND_YELLOW, color: BRAND_BLACK }
          : { backgroundColor: "#FFFFFF", borderColor: "rgba(139,69,19,0.20)", color: "#525252" }
      }
    >
      {label}
    </button>
  );
}

function EmptyState({
  filter,
  onReset
}: {
  filter: ReviewFilter;
  onReset: () => void;
}) {
  if (filter === "all") {
    return (
      <div
        className="mx-auto mt-6 max-w-md rounded-2xl border border-dashed p-8 text-center"
        style={{ borderColor: "rgba(139,69,19,0.25)", backgroundColor: "#FFFFFF" }}
      >
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${BRAND_YELLOW}22` }}
        >
          <Sparkles size={22} color={BRAND_BLACK} strokeWidth={2}/>
        </div>
        <p className="mt-3 text-[10px] font-black uppercase tracking-[0.28em] text-neutral-500">
          Building reputation
        </p>
        <h3 className="mt-1 text-[16px] font-black text-neutral-900">
          No reviews yet.
        </h3>
        <p className="mt-1.5 text-[12px] leading-snug text-neutral-500">
          Reviews build up as jobs complete. Ratings show at 5 verified reviews — until then, this merchant is "Building reputation".
        </p>
      </div>
    );
  }
  return (
    <div
      className="mx-auto mt-6 max-w-md rounded-2xl border border-dashed p-8 text-center"
      style={{ borderColor: "rgba(139,69,19,0.25)", backgroundColor: "#FFFFFF" }}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-neutral-500">
        No matches
      </p>
      <h3 className="mt-1 text-[16px] font-black text-neutral-900">
        No reviews match the filter.
      </h3>
      <button
        onClick={onReset}
        className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
        style={{ backgroundColor: BRAND_YELLOW }}
      >
        Show all reviews
      </button>
    </div>
  );
}

function TrustPoint({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-1.5">
      <ShieldCheck size={11} color={BRAND_GREEN_DARK} strokeWidth={2.5} className="mt-0.5 flex-shrink-0"/>
      <span>{children}</span>
    </li>
  );
}

function LeaveReviewCTA({
  merchantSlug,
  merchantDisplayName
}: {
  merchantSlug: string;
  merchantDisplayName: string;
}) {
  return (
    <div
      className="mt-4 overflow-hidden rounded-2xl border-2 shadow-md"
      style={{ borderColor: BRAND_YELLOW }}
    >
      <div
        className="p-5"
        style={{ background: `linear-gradient(135deg, ${BRAND_YELLOW}22 0%, #FFFFFF 60%)` }}
      >
        <div className="flex items-center gap-1.5">
          <PenSquare size={12} color={BRAND_BLACK} strokeWidth={2.5}/>
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
            Worked with {merchantDisplayName}?
          </span>
        </div>
        <h3 className="mt-2 text-[16px] font-black leading-tight text-neutral-900">
          Leave a review — help every trade after you.
        </h3>
        <p className="mt-1 text-[12px] leading-snug text-neutral-600">
          Only Network members can review. You'll need a verified job, WhatsApp thread, or invoice. Reviews under 4★ enter a 72h response window so the merchant can resolve issues before publishing.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/trade/${merchantSlug}/reviews/new`}
            className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.97]"
            style={{ backgroundColor: BRAND_YELLOW }}
          >
            <PenSquare size={12} strokeWidth={2.5}/>
            Write a review
          </Link>
          <Link
            href="/trade-off/signup"
            className="inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-[12px] font-black uppercase tracking-wider text-neutral-700 transition hover:bg-white"
            style={{ borderColor: "rgba(139,69,19,0.20)" }}
          >
            <MessageCircle size={12} strokeWidth={2.5}/>
            Not a member yet? Join free
          </Link>
        </div>
      </div>
    </div>
  );
}
