"use client";

// The Counter — the marketing river. Renders on the right column of a
// canteen page (desktop) and as a horizontal-scroll strip on mobile.
// Merchant / Trade-Center-product / member-listing / service-inquiry
// posts flow through here; click-to-open opens the post privately for
// the viewer (private-view feature — schema wired in a follow-up).
//
// Never longer than 90 days per post; 30-day baseline with engagement-
// based +15-day extension.
//
// Scroll model (2026-07-14): switched from CSS marquee to JS-controlled
// scroll so the merchant can nudge ±3 cards with the Back / Forward
// chips if they miss a banner. Auto-drift is slow (~30 px/sec), pauses
// on hover, and resumes after any button interaction times out.

import { useEffect, useRef, useState } from "react";
import {
  Store,
  Tag,
  Package,
  Clock,
  Sparkles,
  Info,
  Plus
} from "lucide-react";
import type { SideLanePost } from "@/lib/canteens";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";
import { CounterComposerModal } from "@/components/xrated/yard/CounterComposerModal";

// Banner assets — transparent-bg PNGs pinned to the top-right of the
// card image. Make-me-offer is the seller's invitation; Sold replaces
// it during the 7-day sold-visibility tail after the sale is agreed.
const BANNER_MAKE_OFFER = "https://ik.imagekit.io/9mrgsv2rp/Untitledfdfsdfsdffdfd-removebg-preview.png";
const BANNER_SOLD       = "https://ik.imagekit.io/9mrgsv2rp/Untitleddfsdfdfsdf-removebg-preview.png";

// Drift speed for the auto-scroll (pixels per second). ~30 = slow
// enough to read a card's headline in one pass; matches the merchant
// feedback that the old 240s CSS marquee felt too fast.
const DRIFT_PX_PER_SEC = 30;

function timeLeftLabel(expiresAt: string): string {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  const days = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
  if (days === 0) return "expires today";
  if (days === 1) return "1 day left";
  if (days <= 30) return `${days} days left`;
  return `${Math.floor(days / 7)}w left`;
}

function kindMeta(kind: SideLanePost["kind"]) {
  switch (kind) {
    case "trade-center-product":
      return { label: "Trade Center", Icon: Store, color: BRAND_YELLOW };
    case "merchant-marketing":
      return { label: "Merchant", Icon: Tag, color: "#8B4513" };
    case "member-listing":
      return { label: "Member", Icon: Package, color: BRAND_GREEN_DARK };
  }
}

export function CanteenSideLane({
  posts,
  onOpenPost,
  onKnowTheFlow: _onKnowTheFlow,
  isHost = false
}: {
  posts: SideLanePost[];
  /** Fires when a live card is clicked. The parent is responsible for
   *  rendering the in-place private view inside the main feed column
   *  (no more modal popup). */
  onOpenPost: (postId: string) => void;
  /** Fires when the "Know The Flow?" chip is clicked. Parent replaces
   *  the main canteen feed with the in-place explainer. */
  onKnowTheFlow: () => void;
  /** When true, renders the owner-only "+ Post" pill on the header
   *  line. Opens the CounterComposerModal (same composer as /counter
   *  and the SideStrip primer). Silent for visitors. */
  isHost?: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Duplicate the list so scrollTop wrap-around loops seamlessly.
  const looped = [...posts, ...posts];

  // Slow auto-drift. Uses requestAnimationFrame for smooth 60fps
  // increments. Wraps the scrollTop at half-height so the seam between
  // the two copies is invisible.
  useEffect(() => {
    if (paused) return;
    let raf = 0;
    let lastTs = performance.now();
    const step = (ts: number) => {
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;
      const el = listRef.current;
      if (el) {
        const half = el.scrollHeight / 2;
        if (half > 0) {
          if (el.scrollTop >= half) el.scrollTop -= half;
          else el.scrollTop += DRIFT_PX_PER_SEC * dt;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [paused]);

  // Cleanup pending resume timer on unmount.
  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  return (
    <aside className="mt-6 w-full">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5">
          <span
            className="h-1 w-1 animate-pulse rounded-full"
            style={{ backgroundColor: BRAND_YELLOW }}
            aria-hidden="true"
          />
          <div className="text-[8px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Live listings
          </div>
        </div>
        {isHost && (
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="inline-flex h-6 items-center gap-0.5 rounded-full px-2 text-[9.5px] font-black uppercase tracking-wider shadow-sm transition active:scale-[0.97]"
            style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
            title="Post to The Counter"
          >
            <Plus size={10} strokeWidth={2.6}/>
            Post
          </button>
        )}
      </div>
      <CounterComposerModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPosted={() => { window.location.reload(); }}
      />

      {posts.length === 0 ? (
        <div
          className="rounded-xl border border-dashed p-4 text-center text-[11px] text-neutral-500"
          style={{ borderColor: "rgba(139,69,19,0.2)" }}
        >
          No live listings yet.
        </div>
      ) : (
        <div
          ref={listRef}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => {
            // Only unpause if there isn't a manual-scroll timer running
            if (!resumeTimerRef.current) setPaused(false);
          }}
          className="relative overflow-y-scroll rounded-xl h-[min(38vh,320px)] lg:h-[min(70vh,620px)] [&::-webkit-scrollbar]:hidden"
          style={{
            maskImage: "linear-gradient(to bottom, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)",
            scrollbarWidth: "none"
          }}
        >
          <ul className="flex flex-col gap-2">
            {looped.map((p, i) => (
              <li key={`${p.id}-${i}`}>
                <SideLaneCard post={p} onOpen={() => onOpenPost(p.id)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

/** Full-bleed image card. No white footer — headline + poster + price
 *  overlay directly on the image with a dark gradient for legibility. */
function SideLaneCard({ post: p, onOpen }: { post: SideLanePost; onOpen: () => void }) {
  const { label, Icon, color } = kindMeta(p.kind);
  const sold = p.state === "sold";
  const isSponsored = p.boost && new Date(p.boost.expiresAt) > new Date();
  return (
    <button
      onClick={() => !sold && onOpen()}
      disabled={sold}
      className="group relative block aspect-[16/9] w-full overflow-hidden rounded-xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
      style={{
        backgroundColor: p.imageUrl ? undefined : BRAND_BLACK,
        borderColor: sold ? "rgba(0,0,0,0.08)" : "rgba(139,69,19,0.15)"
      }}
    >
      {p.imageUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={p.imageUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {/* Bottom-up dark gradient for text legibility */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0.85) 100%)"
        }}
      />

      {/* Kind chip top-left */}
      <span
        className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-sm px-1 py-0.5 text-[8px] font-black uppercase tracking-wider shadow-md"
        style={{ backgroundColor: color, color: color === BRAND_YELLOW ? BRAND_BLACK : "#FFFFFF" }}
      >
        <Icon size={8} strokeWidth={2.5}/>
        {label}
      </span>

      {/* Sponsored chip — sits directly beneath the kind chip so both
          stay in the top-left group. Honest disclosure per UK ASA rules. */}
      {isSponsored && (
        <span
          className="absolute left-1.5 top-7 rounded-sm bg-white/95 px-1 py-0.5 text-[8px] font-black uppercase tracking-wider text-neutral-700 shadow-md backdrop-blur"
        >
          Sponsored
        </span>
      )}

      {/* Top-right banner — priority: Sold > Make-me-offer > More Info
          (service inquiry) > Hot chip. Sold and Make-me-offer are
          transactional signals so they beat the informational chips. */}
      {sold ? (
        <img
          src={BANNER_SOLD}
          alt="Sold"
          className="absolute right-0 top-0 h-16 w-auto"
          style={{ pointerEvents: "none" }}
        />
      ) : p.mood === "make-me-offer" ? (
        <img
          src={BANNER_MAKE_OFFER}
          alt="Make me an offer"
          className="absolute right-0 top-0 h-16 w-auto"
          style={{ pointerEvents: "none" }}
        />
      ) : p.serviceInquiry ? (
        <span
          className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[8px] font-black uppercase tracking-wider shadow-md"
          style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
        >
          <Info size={7} strokeWidth={2.6}/>
          More Info
        </span>
      ) : p.clicksTrailing7d > 20 ? (
        <span
          className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow-md"
          style={{ backgroundColor: "#DC2626" }}
        >
          <Sparkles size={7} strokeWidth={2.5}/>
          Hot
        </span>
      ) : null}

      {/* Text overlay bottom */}
      <div className="absolute inset-x-0 bottom-0 p-2.5 text-left">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-bold text-white/85 drop-shadow-sm">
            {p.posterDisplayName}
          </span>
          {p.priceGbp !== undefined && (
            <span
              className="flex-shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] font-black shadow-md"
              style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
            >
              £{p.priceGbp}
            </span>
          )}
        </div>
        <div className="text-[12px] font-black leading-snug text-white drop-shadow-md line-clamp-2">
          {p.headline}
        </div>
        <div className="mt-1 flex items-center gap-1 text-[9px] font-semibold text-white/70 drop-shadow-sm">
          <Clock size={9}/>
          {sold ? "sold" : timeLeftLabel(p.expiresAt)}
        </div>
      </div>
    </button>
  );
}
