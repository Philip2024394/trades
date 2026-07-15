"use client";

// Product-focus feed mode for the canteen. When a product is selected
// from CanteenProductPanel, the canteen main feed collapses into this
// view: full product info + Q&A thread scoped to just this product.
//
// Sticky "Back to canteen chat" pill at the top so the user always
// knows how to escape the context.

import Link from "next/link";
import {
  ArrowLeft,
  Store,
  Users,
  MessageSquare,
  ShoppingCart,
  ShieldCheck,
  Star,
  PenSquare
} from "lucide-react";
import type { CanteenProduct } from "@/lib/canteens";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

export function CanteenProductFocus({
  product,
  hostDisplayName,
  hostSlug,
  hostRating,
  onBack,
  returnHref,
  returnLabel
}: {
  product: CanteenProduct;
  hostDisplayName: string;
  /** Merchant slug — used to route the review chip into
   *  `/trade/{hostSlug}/reviews`. Null when the merchant hasn't been
   *  resolved yet (edge case, chip hides). */
  hostSlug?: string | null;
  /** Merchant's reviews aggregate. Null when the merchant is under
   *  the 5-review protection floor (chip renders as "Write the first
   *  review" invitation instead of a stat). */
  hostRating?: { avg: number; count: number } | null;
  /** Called when the buyer taps "Back to canteen chat" — closes
   *  product-focus and returns to the canteen feed in-place. */
  onBack: () => void;
  /** Optional external return destination. When set, an ADDITIONAL
   *  yellow primary pill "Back to {returnLabel}" appears above the
   *  canteen-chat back button so buyers who arrived from Trade Center
   *  / Yard / Warehouse can return to their browse position. */
  returnHref?: string;
  returnLabel?: string;
}) {
  return (
    <div className="mb-3">
      {/* Sticky back pills. When the buyer arrived from an external
          surface (Trade Center browse etc.) the primary pill returns
          them there; canteen-chat back stays as a secondary link. */}
      <div className="mb-3 sticky top-[64px] z-10 flex flex-wrap items-center gap-2">
        {returnHref && (
          <Link
            href={returnHref}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.97]"
            style={{ backgroundColor: BRAND_YELLOW }}
          >
            <ArrowLeft size={12} strokeWidth={2.5} />
            Back to {returnLabel ?? "browse"}
          </Link>
        )}
        <button
          onClick={onBack}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-white px-3 text-[11px] font-black uppercase tracking-wider text-neutral-800 shadow-md transition hover:bg-neutral-50"
          style={{ borderColor: `${BRAND_YELLOW}` }}
        >
          <ArrowLeft size={12} strokeWidth={2.5} />
          {returnHref ? "Canteen chat" : "Back to canteen chat"}
        </button>
      </div>

      {/* Product hero card */}
      <article
        className="overflow-hidden rounded-xl border bg-white shadow-sm"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <div
          className="relative aspect-video"
          style={{
            backgroundImage: `url('${product.imageUrl}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundColor: "#F3F4F6"
          }}
        >
          {/* Bottom-left host chip */}
          <div
            className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 shadow-md backdrop-blur"
          >
            <Store size={11} className="text-neutral-700" />
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-800">
              Sold by {hostDisplayName}
            </span>
          </div>
          {/* Trade Center chip removed — this focus view IS the
              canonical Trade Center product-detail surface, so a
              cross-link would just point back to itself. */}
        </div>

        <div className="p-4">
          {product.ref && (
            <div className="mb-1 inline-flex items-center rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em]"
              style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
              title="Product reference — quote when contacting the merchant"
            >
              Item · {product.ref}
            </div>
          )}
          <h2 className="text-[18px] font-black leading-tight text-neutral-900 sm:text-[20px]">
            {product.name}
          </h2>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[12px] font-bold text-neutral-500">{product.blurb}</span>
            <span className="text-[24px] font-black text-neutral-900">
              £{product.priceGbp}
            </span>
          </div>

          {/* Bulk-buy progress bar */}
          {product.bulkBuy && (
            <div
              className="mt-3 rounded-lg border p-2.5"
              style={{ borderColor: `${BRAND_GREEN_DARK}66`, backgroundColor: `${BRAND_GREEN_DARK}0F` }}
            >
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider" style={{ color: BRAND_GREEN_DARK }}>
                <span>Bulk-buy · {product.bulkBuy.committedCount}/{product.bulkBuy.targetCount} committed</span>
                <span>£{product.bulkBuy.discountedPriceGbp} each unlocked</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-white">
                <div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: BRAND_GREEN_DARK,
                    width: `${Math.min(100, (product.bulkBuy.committedCount / product.bulkBuy.targetCount) * 100)}%`
                  }}
                />
              </div>
              <div className="mt-1.5 text-[10px] leading-snug text-neutral-600">
                Commit to buy · price drops for everyone when the target is reached.
              </div>
            </div>
          )}

          {/* Description */}
          <p className="mt-4 text-[13px] leading-relaxed text-neutral-700">
            {product.description}
          </p>

          {/* Specs */}
          {product.specs && (
            <div className="mt-3">
              <div className="mb-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                Specs · What's in the box
              </div>
              <ul className="flex flex-col gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                {product.specs.map((s) => (
                  <li key={s} className="text-[12px] leading-snug text-neutral-700">
                    · {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CTA row — single primary CTA. "Buy on Trade Center" was
              removed because this IS the Trade Center PDP now (per
              the canonical-product-detail-surface architecture). */}
          <div className="mt-4">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Interested in ${product.name} (£${product.priceGbp}).`)}`}
              target="_blank"
              rel="noreferrer noopener"
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full text-[13px] font-black uppercase tracking-wider text-white shadow-md"
              style={{ backgroundColor: BRAND_GREEN_DARK }}
            >
              <ShoppingCart size={13} strokeWidth={2.5} />
              Buy on WhatsApp
            </a>
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-[10px] leading-snug text-neutral-500">
            <ShieldCheck size={11} className="text-neutral-400" />
            Verified merchant · buyer-protected rails only. Seller confirms availability on WhatsApp before payment.
          </div>

          {/* Merchant trust strip — rating + write-one CTA. Only
              renders when we know the host's slug. Shows the review
              chip in-context on the PDP so buyers can check the
              merchant without leaving the product. */}
          {hostSlug && (
            <div
              className="mt-3 flex items-center justify-between rounded-lg border p-2.5"
              style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FAFAFA" }}
            >
              <Link
                href={`/trade/${hostSlug}/reviews`}
                className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-black text-neutral-800 hover:underline"
              >
                <Store size={11} className="flex-shrink-0 text-neutral-400"/>
                <span className="truncate">About {hostDisplayName}</span>
                {hostRating && (
                  <>
                    <span className="mx-0.5 text-neutral-300">·</span>
                    <Star size={11} fill={BRAND_YELLOW} color={BRAND_YELLOW} strokeWidth={0}/>
                    <span>{hostRating.avg}</span>
                    <span className="text-neutral-400">({hostRating.count})</span>
                  </>
                )}
              </Link>
              <Link
                href={`/trade/${hostSlug}/reviews/new`}
                className="inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition active:scale-[0.97]"
                style={{ backgroundColor: BRAND_YELLOW }}
              >
                <PenSquare size={10} strokeWidth={2.5}/>
                Write one
              </Link>
            </div>
          )}
        </div>
      </article>

      {/* Q&A thread — canteen conversation scoped to this product */}
      <section className="mt-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            <MessageSquare size={11} className="text-neutral-400" />
            Q&A · {MOCK_QUESTIONS.length} threads
          </div>
          <button
            className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[10px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
            style={{ backgroundColor: BRAND_YELLOW }}
          >
            Ask a question
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {MOCK_QUESTIONS.map((q) => (
            <li
              key={q.who}
              className="rounded-xl border bg-white p-3 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.12)" }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black"
                  style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                >
                  {q.who.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-black text-neutral-900">{q.who}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    {q.role} · {q.postedAgo}
                  </div>
                </div>
                {q.replies > 0 && (
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                    <Users size={10} className="mr-0.5 inline"/>
                    {q.replies} replies
                  </span>
                )}
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-neutral-700">{q.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const MOCK_QUESTIONS = [
  {
    who: "Rachel Simms",
    role: "Kitchen Fitter",
    postedAgo: "2d",
    body: "How long from order to delivery on the 3m lengths? Got a job going in on the 22nd.",
    replies: 4
  },
  {
    who: "Tom Fisher",
    role: "Kitchen Fitter",
    postedAgo: "5d",
    body: "Did the pack-of-3 shaker doors two weeks back. Paint finish held up perfectly to a scuff test, no cracking on the panel corners. Would order again.",
    replies: 2
  },
  {
    who: "Craig McDermott",
    role: "Electrician",
    postedAgo: "1w",
    body: "Any chance of a run of narrower carcasses (400mm) as a bulk-buy? Got 6 flats needing pantries.",
    replies: 6
  }
];
