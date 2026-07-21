"use client";

// CounterListingSheet — slide-out detail view for a Counter listing.
//
// Best-practice pattern (Airbnb / Instagram Shop / StockX detail view):
//   • Desktop → sheet slides in from the right (600px wide)
//   • Mobile  → sheet slides up from the bottom (full width, 92vh)
//   • URL syncs to ?id=<postId> so the detail view is shareable +
//     back button closes it (no lost browse state)
//   • Actions: Message seller (WhatsApp / in-canteen), View seller's
//     canteen (secondary), Share, Close
//
// Reused across /counter and every canteen's Counter strip so the
// experience is identical regardless of entry surface.

import { useEffect } from "react";
import { X, MessageCircle, ArrowUpRight, Share2 } from "lucide-react";
import Link from "next/link";
import { BRAND_YELLOW, BRAND_GREEN_DARK } from "@/lib/brand/tokens";
import type { SideLanePost } from "@/lib/canteens";

export function CounterListingSheet({
  post,
  onClose
}: {
  post:    SideLanePost | null;
  onClose: () => void;
}) {
  // Body scroll lock while the sheet is open + Escape-to-close.
  useEffect(() => {
    if (!post) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [post, onClose]);

  if (!post) return null;

  // Route to the trade's public profile page — always exists for every
  // listing (`/[slug]` root route). Prevents 404s when the poster is a
  // trade listing without a full canteen row (most demo trades). The
  // canteen page is a superset that only exists when the trade has
  // opted in; the profile page is universal.
  const posterHref  = `/${post.posterSlug}`;
  const shareUrl    = typeof window !== "undefined" ? `${window.location.origin}/counter?id=${encodeURIComponent(post.id)}` : "";

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: post!.posterDisplayName,
          text:  post!.headline,
          url:   shareUrl
        });
      } catch { /* user cancelled */ }
    } else if (typeof navigator !== "undefined") {
      try { await navigator.clipboard.writeText(shareUrl); } catch { /* silent */ }
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Listing: ${post.posterDisplayName}`}
      className="fixed inset-0 z-[100] flex items-end justify-end md:items-stretch"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close listing"
        onClick={onClose}
        className="absolute inset-0 bg-neutral-950/70 backdrop-blur-sm"
      />
      {/* Sheet */}
      <div
        className="relative flex h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl md:h-full md:w-[600px] md:max-w-[85vw] md:rounded-l-2xl md:rounded-t-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close chip */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-neutral-700 shadow-md hover:bg-white"
          aria-label="Close"
        >
          <X size={18} strokeWidth={2.4}/>
        </button>

        {/* Image */}
        <div
          className="aspect-[4/3] w-full flex-shrink-0 bg-neutral-100"
          style={{
            backgroundImage: post.imageUrl ? `url('${post.imageUrl}')` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center"
          }}
          aria-hidden
        />

        {/* Body — scrolls if content exceeds sheet height */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 pt-4">
          {/* Live tag + posted-ago */}
          <div className="mb-2 flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: BRAND_YELLOW }}/>
            <span className="text-[9.5px] font-black uppercase tracking-[0.18em] text-neutral-500">
              The Counter · Live · {shortAgo(post.postedAt)}
            </span>
          </div>

          {/* Poster + price row */}
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-[18px] font-black leading-tight text-neutral-900 md:text-[20px]">
              {post.posterDisplayName}
            </h1>
            {typeof post.priceGbp === "number" && (
              <span className="flex-shrink-0 text-[18px] font-black tabular-nums" style={{ color: BRAND_GREEN_DARK }}>
                £{post.priceGbp.toLocaleString("en-GB")}
              </span>
            )}
          </div>

          {/* Headline / description */}
          <p className="mt-3 whitespace-pre-line text-[13.5px] leading-relaxed text-neutral-800">
            {post.headline}
          </p>

          {/* Secondary actions */}
          <div className="mt-6 flex items-center gap-2">
            <Link
              href={posterHref}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border px-3 py-2 text-[11.5px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50"
              style={{ borderColor: "rgba(0,0,0,0.12)" }}
            >
              View {post.posterDisplayName.split(/\s+/)[0]}'s profile
              <ArrowUpRight size={12} strokeWidth={2.6}/>
            </Link>
            <button
              type="button"
              onClick={share}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-neutral-500 hover:bg-neutral-50"
              style={{ borderColor: "rgba(0,0,0,0.12)" }}
              aria-label="Share listing"
              title="Share"
            >
              <Share2 size={14} strokeWidth={2.4}/>
            </button>
          </div>
        </div>

        {/* Sticky footer — primary CTA. Message seller. */}
        <div
          className="border-t bg-white px-5 py-3"
          style={{ borderColor: "rgba(0,0,0,0.08)" }}
        >
          <a
            href={posterHref}
            className="flex h-12 items-center justify-center gap-1.5 rounded-lg text-[13px] font-black uppercase tracking-wider text-white shadow-md active:scale-[0.97]"
            style={{ backgroundColor: BRAND_GREEN_DARK }}
          >
            <MessageCircle size={15} strokeWidth={2.6}/>
            Message {post.posterDisplayName.split(/\s+/)[0]}
          </a>
        </div>
      </div>
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
  return `${Math.floor(d / 7)}w ago`;
}
