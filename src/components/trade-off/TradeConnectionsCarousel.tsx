"use client";

// TradeConnectionsCarousel — local trades who install/work with this
// product's category. Lives at the bottom of every product PDP on a
// merchant whose `trade_connections` add-on is on (default-on for
// every Merchant Pro app).
//
// LAYOUT — renders as a focused GRID (top 3, max 4) of the highest-
// ranked trades. Verified first, then highest rating, then nearest.
// Previous auto-scroll marquee was dropped per merchant feedback —
// a small grid of the best trades drives more taps than an endlessly
// scrolling row of 12+ candidates.
//
// CTAs per card: View → (opens trade profile). Call (only if phone
// on file). WhatsApp is intentionally NOT on the card — the customer
// must view the trade's full app first, where WhatsApp lives alongside
// reviews + project history.
//
// Each profile link carries ?from=<merchantSlug>&fromProduct=<slug>
// so the FloatingBackToMerchant chip on the trade's app knows where
// to return the customer.
//
// Disclaimer above the grid is the legal shield + honesty move per UK
// consumer-platform conventions.

import Link from "next/link";
import type { TradeCard } from "@/lib/tradeConnections";

const TRADE_LABEL_PRETTY: Record<string, string> = {
  bricklayer: "Bricklayer",
  "block-layer": "Block layer",
  stonemason: "Stonemason",
  tiler: "Tiler",
  "bathroom-fitter": "Bathroom fitter",
  plasterer: "Plasterer",
  drywaller: "Drywaller",
  "taper-and-finisher": "Drywall finisher",
  painter: "Painter / Decorator",
  carpenter: "Carpenter",
  joiner: "Joiner",
  "trim-carpenter": "Trim carpenter",
  "flooring-installer": "Flooring installer",
  roofer: "Roofer",
  "lead-worker": "Lead worker",
  renderer: "Renderer",
  "fencing-installer": "Fencing installer",
  landscaper: "Landscaper",
  "garden-designer": "Garden designer",
  "garden-room-installer": "Garden room installer",
  "driveway-installer": "Driveway installer",
  groundworker: "Groundworker",
  "concrete-finisher": "Concrete finisher",
  "concrete-specialist": "Concrete specialist",
  formworker: "Formworker",
  "insulation-installer": "Insulation installer"
};

export function TradeConnectionsCarousel({
  cards,
  merchantSlug,
  merchantName,
  productSlug
}: {
  cards: TradeCard[];
  merchantSlug: string;
  merchantName: string;
  productSlug: string;
}) {
  if (cards.length === 0) return null;

  // Cap to 3 by default. If exactly 4 show, render 2×2 on tablet for
  // visual balance; otherwise 3-across on desktop / 1-up on mobile.
  const top = cards.slice(0, 4);
  const gridCols =
    top.length === 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : top.length === 3
        ? "sm:grid-cols-3"
        : top.length === 2
          ? "sm:grid-cols-2"
          : "sm:grid-cols-1";

  return (
    <section
      className="mt-10 border-t border-neutral-200 bg-neutral-50"
      aria-label="Local trades who install this product"
    >
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-8 sm:px-6">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
          Trade Connections
        </p>
        <h2 className="mt-1 text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Local trades who install this kind of product
        </h2>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-neutral-600">
          These are independent businesses —{" "}
          <span className="font-bold text-neutral-900">
            not employed, vetted or verified by {merchantName}
          </span>
          . Please research each trade yourself, read their reviews, and request
          a written quote before any work begins. {merchantName} takes no
          responsibility for the quality of work carried out by trades listed
          here.
        </p>

        <div className={`mt-5 grid gap-3 grid-cols-1 ${gridCols}`}>
          {top.map((c) => (
            <TradeCardItem
              key={c.id}
              card={c}
              merchantSlug={merchantSlug}
              productSlug={productSlug}
            />
          ))}
        </div>

        <div className="mt-4 flex justify-center">
          <Link
            href={`/find-trades?from=${encodeURIComponent(merchantSlug)}&fromProduct=${encodeURIComponent(productSlug)}`}
            className="inline-flex h-11 items-center rounded-lg border border-neutral-300 bg-white px-5 text-[13px] font-extrabold text-neutral-900 transition hover:border-[#FFB300] hover:text-[#FFB300]"
          >
            View all local trades →
          </Link>
        </div>
      </div>
    </section>
  );
}

function TradeCardItem({
  card,
  merchantSlug,
  productSlug
}: {
  card: TradeCard;
  merchantSlug: string;
  productSlug: string;
}) {
  // Public profile lives at /<slug> (the /trade/<slug> path 308-redirects
  // here). Use the canonical URL directly to avoid the extra hop.
  const profileHref = `/${encodeURIComponent(card.slug)}?from=${encodeURIComponent(
    merchantSlug
  )}&fromProduct=${encodeURIComponent(productSlug)}`;
  const phoneDigits = (card.phone ?? "").replace(/\D/g, "");
  const tradeLabel =
    TRADE_LABEL_PRETTY[card.primary_trade] ??
    card.primary_trade.replace(/[-_]/g, " ");

  // Track the click before navigating — fire-and-forget POST so the
  // navigation doesn't wait. The /api/trade-off/trade-connections/track
  // endpoint is rate-limited per IP. WhatsApp tracking removed alongside
  // the in-card WhatsApp CTA — customers must open the trade's profile
  // first, which is where the WhatsApp button lives.
  function trackClick(action: "view_trade" | "call_trade") {
    try {
      navigator.sendBeacon?.(
        "/api/trade-off/trade-connections/track",
        new Blob(
          [
            JSON.stringify({
              merchant_slug: merchantSlug,
              trade_slug: card.slug,
              product_slug: productSlug,
              action
            })
          ],
          { type: "application/json" }
        )
      );
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex w-full flex-col rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {card.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.avatar_url}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full border border-neutral-200 object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-[14px] font-extrabold text-neutral-500">
            {(card.display_name[0] ?? "?").toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-extrabold text-neutral-900">
            {card.display_name}
          </p>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#FFB300]">
            {tradeLabel}
          </p>
        </div>
        {card.is_verified && (
          <span className="shrink-0 rounded-full bg-[#0F7A3F] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white">
            ✓
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
        <span>📍 {card.city || "—"}</span>
        <span>· {card.distance_km} km away</span>
        {card.rating_avg !== null && (
          <span>
            · {card.rating_avg.toFixed(1)} ★
            {card.review_count > 0 && ` (${card.review_count})`}
          </span>
        )}
      </div>
      {card.accepting_jobs && (
        <p className="mt-1 inline-flex w-fit items-center rounded-full bg-[#0F7A3F]/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-[#0F7A3F]">
          ● Available now
        </p>
      )}

      {/* WhatsApp CTA removed from the card — customers must view the
       *  trade's full profile first (the WhatsApp button lives there,
       *  alongside the trade's gallery, reviews and project history).
       *  Phone Call stays as the single optional emergency-style CTA;
       *  if the user wants Call removed too the same trackClick logic
       *  applies. */}
      <div className={`mt-3 grid gap-1.5 ${phoneDigits ? "grid-cols-2" : "grid-cols-1"}`}>
        {phoneDigits && (
          <a
            href={`tel:${phoneDigits}`}
            onClick={() => trackClick("call_trade")}
            className="inline-flex h-9 items-center justify-center rounded-md bg-neutral-900 text-[11px] font-bold text-white"
            aria-label={`Call ${card.display_name}`}
          >
            Call
          </a>
        )}
        <Link
          href={profileHref}
          onClick={() => trackClick("view_trade")}
          className="inline-flex h-9 items-center justify-center rounded-md bg-[#FFB300] text-[11px] font-extrabold text-neutral-900"
        >
          View →
        </Link>
      </div>
    </div>
  );
}
