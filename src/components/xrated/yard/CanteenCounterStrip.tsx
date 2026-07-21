"use client";

// CanteenCounterStrip — left-column second container, sits under the
// members inbox rail on canteen pages.
//
// Renders a compact live view of the platform-wide Counter — every
// canteen's `kind='counter'` and `kind='make-offer'` posts fanned into
// one cross-canteen marketplace stream. Turns dead space into a growth
// loop: viewer sees a listing → clicks → discovers another canteen →
// possibly joins → increases network liquidity.
//
// Data source: parent component passes in an already-loaded
// SideLanePost[] (same feed powering the right-column CanteenSideLane).
// Zero new DB queries — reuses the existing platformSideLaneFromDb().
//
// Empty state = primer: teaches what The Counter is, plus a host-only
// "Post to The Counter" CTA so a canteen with 0 offers still has a
// useful, actionable card in that slot.

import Link from "next/link";
import { useMemo, useState } from "react";
import { Radio, ArrowUpRight } from "lucide-react";
import { BRAND_YELLOW } from "@/lib/brand/tokens";
import type { SideLanePost } from "@/lib/canteens";
import { CounterListingSheet } from "@/components/xrated/yard/CounterListingSheet";

const CARD_BORDER = "rgba(139,69,19,0.15)";
const ROWS_TO_SHOW = 6;

export function CanteenCounterStrip({
  posts,
  isHost,
  canteenSlug
}: {
  posts:       SideLanePost[];
  isHost:      boolean;
  canteenSlug: string;
}) {
  const [activePost, setActivePost] = useState<SideLanePost | null>(null);
  // Only live listings; sort still respects boost order + recency but
  // we trim to the top N so the strip stays compact.
  const shown = useMemo(
    () => posts.filter((p) => p.state === "live").slice(0, ROWS_TO_SHOW),
    [posts]
  );

  return (
    <section
      className="rounded-2xl border bg-white shadow-sm"
      style={{ borderColor: CARD_BORDER }}
    >
      <div className="flex items-center justify-between gap-2 border-b p-3" style={{ borderColor: CARD_BORDER }}>
        <div className="inline-flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2 w-2 flex-shrink-0 animate-pulse rounded-full"
            style={{ backgroundColor: BRAND_YELLOW }}
          />
          <span className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
            The Counter · Live
          </span>
        </div>
        <Link
          href="/tc/trade-center?view=live"
          className="inline-flex items-center gap-0.5 text-[10px] font-black uppercase tracking-wider text-neutral-500 transition hover:text-neutral-900"
        >
          See all
          <ArrowUpRight size={10} strokeWidth={2.6}/>
        </Link>
      </div>

      {shown.length === 0 ? (
        <EmptyCounterPrimer isHost={isHost}/>
      ) : (
        <ul className="divide-y" style={{ borderColor: CARD_BORDER }}>
          {shown.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setActivePost(p)}
                className="flex w-full items-start gap-2.5 p-2.5 text-left transition hover:bg-neutral-50"
              >
                <span
                  className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100"
                  style={{
                    backgroundImage: p.imageUrl ? `url('${p.imageUrl}')` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center"
                  }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-1">
                    <p className="truncate text-[11.5px] font-black text-neutral-900">
                      {p.posterDisplayName}
                    </p>
                    {typeof p.priceGbp === "number" && (
                      <span className="flex-shrink-0 text-[10.5px] font-black tabular-nums" style={{ color: "#166534" }}>
                        £{p.priceGbp.toLocaleString("en-GB")}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-tight text-neutral-600">
                    {p.headline}
                  </p>
                  <p className="mt-0.5 text-[9.5px] text-neutral-400 tabular-nums">
                    {shortAgo(p.postedAt)}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <CounterListingSheet post={activePost} onClose={() => setActivePost(null)}/>
    </section>
  );
}

function EmptyCounterPrimer({ isHost }: { isHost: boolean }) {
  return (
    <div className="p-3">
      <div className="flex items-start gap-2">
        <Radio size={13} className="mt-0.5 text-neutral-500"/>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black text-neutral-900">Nothing live right now</p>
          <p className="mt-0.5 text-[10px] leading-snug text-neutral-500">
            The Counter is the platform-wide marketplace. Every canteen's
            offers land here.
          </p>
        </div>
      </div>
      {isHost && (
        <Link
          href="/tc/trade-center?view=live"
          className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1 rounded-md text-[10.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition active:scale-[0.97]"
          style={{ backgroundColor: BRAND_YELLOW }}
        >
          Post to The Counter
        </Link>
      )}
    </div>
  );
}

function shortAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1)   return "now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d ago`;
  const w = Math.floor(d / 7);
  return `${w}w ago`;
}
