"use client";

// Review card — the atomic display unit of a single TradeReview on
// the reviews page (and eventually anywhere reviews appear).
//
// Layout:
//   Header row: reviewer avatar → name+trade+city → verified badge + timestamp
//   Overall score strip: big star + 5-dimension mini bars
//   Written body
//   Photo strip (if any)
//   Owner's public response (indented, brand-yellow left border)
//   Community sentiment ("Was this helpful?" thumb)
//
// Reviewer name is ALWAYS clickable → their Network profile. This is
// the accountability layer — anyone reading a review can one-click to
// see who wrote it, their own reviews history, and their trade
// standing. Airbnb's accountability principle.

import { useState } from "react";
import Link from "next/link";
import {
  Star,
  ShieldCheck,
  MessageCircle,
  ThumbsUp,
  Image as ImageIcon,
  FileCheck2,
  MessageSquare
} from "lucide-react";
import type { TradeReview } from "@/lib/reviews";
import { overallForReview, REVIEW_DIMENSIONS } from "@/lib/reviews";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

export function TradeReviewCard({
  review,
  showDimensionBars = true
}: {
  review: TradeReview;
  /** When false, the 5-dimension mini-bar breakdown is hidden and the
   *  card falls back to the reviewer + overall score + body. Used on
   *  the canteen profile focus embed where the hero already carries a
   *  prominent overall rating chip and the visual density of bars in
   *  every card reads as noise. Default true — dedicated reviews
   *  page keeps the bars. */
  showDimensionBars?: boolean;
}) {
  const overall = overallForReview(review.scores);
  const overallDisplay = overall.toFixed(1);
  const jobVerified = review.jobVerification.kind === "job-tag";

  return (
    <article
      className="overflow-hidden rounded-2xl border bg-white shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      {/* Header — reviewer identity + verified badge + timestamp */}
      <header className="flex items-start gap-3 p-4">
        <Link
          href={`/reviewer/${review.reviewer.slug}`}
          className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-full border-2 shadow-sm"
          style={{
            borderColor: BRAND_YELLOW,
            backgroundImage: review.reviewer.avatarUrl ? `url('${review.reviewer.avatarUrl}')` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundColor: !review.reviewer.avatarUrl ? BRAND_YELLOW : undefined
          }}
        >
          {!review.reviewer.avatarUrl && (
            <div className="flex h-full w-full items-center justify-center text-[14px] font-black" style={{ color: BRAND_BLACK }}>
              {review.reviewer.displayName.charAt(0)}
            </div>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <Link
              href={`/reviewer/${review.reviewer.slug}`}
              className="text-[13px] font-black text-neutral-900 hover:underline"
            >
              {review.reviewer.displayName}
            </Link>
            {review.reviewer.weight >= 1.5 && (
              <span
                className="inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[8px] font-black uppercase tracking-wider text-white"
                style={{ backgroundColor: BRAND_GREEN_DARK }}
                title="Verified reviewer — job + identity confirmed"
              >
                <ShieldCheck size={8} strokeWidth={2.5}/>
                Verified
              </span>
            )}
          </div>
          <div className="text-[11px] font-bold text-neutral-500">
            {review.reviewer.tradeLabel} · {review.reviewer.city}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {jobVerified && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                style={{ backgroundColor: `${BRAND_GREEN_DARK}18`, color: BRAND_GREEN_DARK }}
              >
                <FileCheck2 size={9} strokeWidth={2.5}/>
                {review.jobVerification.label}
              </span>
            )}
            {!jobVerified && review.jobVerification.kind && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                style={{ backgroundColor: "#F3F4F6", color: "#525252" }}
              >
                <FileCheck2 size={9} strokeWidth={2.5}/>
                {review.jobVerification.label}
              </span>
            )}
            <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">
              · {formatAgo(review.createdAt)}
            </span>
          </div>
        </div>

        {/* Overall score chip — top-right */}
        <div className="flex flex-shrink-0 flex-col items-center gap-0.5">
          <div className="flex items-center gap-1">
            <Star size={13} fill={BRAND_YELLOW} color={BRAND_YELLOW} strokeWidth={0}/>
            <span className="text-[16px] font-black tabular-nums text-neutral-900">
              {overallDisplay}
            </span>
          </div>
          <span className="text-[8px] font-black uppercase tracking-wider text-neutral-400">
            Overall
          </span>
        </div>
      </header>

      {/* Dimension mini-bars — 5 (or 6) rows, one per category. Bars
          are the honest visual: buyers see WHERE the merchant is
          strong and weak, not just a single star. Hidden on embedded
          contexts (e.g. canteen profile focus) where a prominent
          overall rating chip already sits above and the visual
          density of bars in every card reads as noise. */}
      {showDimensionBars && (
        <div
          className="border-t px-4 py-3"
          style={{ borderColor: "rgba(139,69,19,0.08)", backgroundColor: "#FAFAFA" }}
        >
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {REVIEW_DIMENSIONS.filter((d) => d.key !== "trade_specific").map((dim) => (
              <DimensionBar
                key={dim.key}
                label={dim.label}
                score={review.scores[dim.key] ?? 0}
              />
            ))}
            {typeof review.scores.trade_specific === "number" && (
              <DimensionBar
                label="Trade-specific"
                score={review.scores.trade_specific}
                accent
              />
            )}
          </div>
        </div>
      )}

      {/* Written body */}
      <div className="px-4 py-3">
        <p className="text-[13px] leading-relaxed text-neutral-800">
          {review.body}
        </p>

        {/* Photo strip */}
        {review.photoUrls.length > 0 && (
          <div className="mt-3 flex gap-2">
            {review.photoUrls.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border shadow-sm transition hover:scale-105"
                style={{
                  borderColor: "rgba(139,69,19,0.15)",
                  backgroundImage: `url('${url}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center"
                }}
              >
                <div className="absolute inset-0 flex items-end justify-end p-1">
                  <ImageIcon size={10} color="#FFFFFF" strokeWidth={2.5} className="drop-shadow"/>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Owner's public response — indented, brand-yellow left border */}
      {review.ownerResponse && review.ownerResponse.kind === "public-reply" && (
        <div
          className="mx-4 mb-3 rounded-r-lg border-l-4 bg-neutral-50 p-3"
          style={{ borderColor: BRAND_YELLOW }}
        >
          <div className="mb-1 flex items-center gap-1.5">
            <MessageSquare size={11} color={BRAND_BLACK} strokeWidth={2.5}/>
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
              Merchant response
            </span>
            <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">
              · {formatAgo(review.ownerResponse.respondedAt)}
            </span>
          </div>
          <p className="text-[12.5px] leading-relaxed text-neutral-700">
            "{review.ownerResponse.body}"
          </p>
        </div>
      )}

      {/* Dispute timeline chevron — only when there was a resolution
          exchange worth surfacing. This is where the trust magic
          lives: buyers can see HOW the merchant handled an issue. */}
      {review.disputeTimeline && review.disputeTimeline.length > 0 && (
        <button
          type="button"
          className="flex w-full items-center gap-1.5 border-t px-4 py-2 text-left transition hover:bg-neutral-50"
          style={{ borderColor: "rgba(139,69,19,0.08)" }}
        >
          <ShieldCheck size={11} color={BRAND_GREEN_DARK} strokeWidth={2.5}/>
          <span className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: BRAND_GREEN_DARK }}>
            How this was resolved
          </span>
          <span className="text-[10px] font-black text-neutral-500">
            · {review.disputeTimeline.length} events
          </span>
        </button>
      )}

      {/* Footer — helpful thumbs + admin action (if any) */}
      <footer
        className="flex items-center justify-between border-t px-4 py-2.5"
        style={{ borderColor: "rgba(139,69,19,0.08)" }}
      >
        <HelpfulButton reviewId={review.id} initialCount={review.helpfulCount}/>
        {review.adminAction && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
            style={{
              backgroundColor: review.adminAction.kind === "verified" ? `${BRAND_GREEN_DARK}18` : "#F3F4F6",
              color: review.adminAction.kind === "verified" ? BRAND_GREEN_DARK : "#525252"
            }}
            title={review.adminAction.reason}
          >
            <ShieldCheck size={9} strokeWidth={2.5}/>
            Admin: {review.adminAction.kind}
          </span>
        )}
      </footer>
    </article>
  );
}

function HelpfulButton({
  reviewId,
  initialCount
}: {
  reviewId: string;
  initialCount: number;
}) {
  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(false);
  const [pending, setPending] = useState(false);

  async function vote() {
    if (pending || voted) return;
    setPending(true);
    // Optimistic — the endpoint enforces one-vote-per-cookie
    // idempotence, so the worst case is our optimistic count is
    // rolled back when the response says alreadyVoted.
    setCount((c) => c + 1);
    setVoted(true);
    try {
      const res = await fetch(`/api/reviews/moderate/${reviewId}/helpful`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setCount(initialCount);
        setVoted(false);
        return;
      }
      // Sync with server truth in case another tab/user voted.
      if (typeof data.helpfulCount === "number") setCount(data.helpfulCount);
      if (data.alreadyVoted) setVoted(true);
    } catch {
      setCount(initialCount);
      setVoted(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={vote}
      disabled={pending}
      className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider transition disabled:opacity-60"
      style={{ color: voted ? BRAND_GREEN_DARK : "#737373" }}
    >
      <ThumbsUp size={11} strokeWidth={2.5} fill={voted ? BRAND_GREEN_DARK : "none"}/>
      Helpful · {count}
    </button>
  );
}

function DimensionBar({
  label,
  score,
  accent = false
}: {
  label: string;
  score: number;
  accent?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (score / 5) * 100));
  const barColor = accent
    ? BRAND_YELLOW
    : score >= 4
      ? BRAND_GREEN_DARK
      : score >= 3
        ? "#F59E0B"
        : "#DC2626";
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 flex-shrink-0 truncate text-[10px] font-black uppercase tracking-wider text-neutral-500">
        {label}
      </span>
      <div className="h-1.5 flex-1 rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <span className="w-6 flex-shrink-0 text-right text-[10px] font-black tabular-nums text-neutral-700">
        {score}
      </span>
    </div>
  );
}

function formatAgo(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
