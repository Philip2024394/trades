/**
 * @fileoverview MERCHANT-ONLY component.
 * @merchantOnly Only renders when isStorefrontOn(listing) === true.
 * Importing this from a service-trade context is a code smell — use
 * the service/ siblings instead.
 */

// Storefront variant of ProductCard — anchor-jumps to the per-product
// page at /<slug>/shop/<product-slug> instead of opening the modal.
//
// Visual rhythm matches ProductCard exactly (same yellow hover ring,
// same stock badge, same bulk-tier pill) so the customer doesn't notice
// they've switched containers — only the interaction model changes.
//
// Server-renderable: no state, no useEffect — Next can stream this as
// part of the storefront page shell. Optional `stats` prop renders a tiny
// stars row + "(N)" count next to the bottom-right View pill. Passed
// from the PDP's batch-fetched review map (see SiblingsWithCompare);
// when omitted (storefront grid / shop teaser), the card silently skips
// the row.

import type { HammerexXratedProduct } from "@/lib/supabase";
import { formatGbp } from "@/lib/xratedCart";

export function ProductCardLink({
  product,
  slug,
  stats
}: {
  product: HammerexXratedProduct;
  slug: string;
  /** Optional review-aggregate. Only renders when count > 0. */
  stats?: { rating: number | null; count: number };
}) {
  const stockBadge = stockBadgeFor(product.stock_count);
  const hasBulkTiers =
    Array.isArray(product.bulk_tiers) && product.bulk_tiers.length > 0;
  // Fall back to the product UUID-prefix when the slug column is NULL
  // (a defensive safety net — the upsert API always derives one, but
  // existing legacy rows or rows with name='🛠️' alone could land here).
  const href = product.slug
    ? `/${slug}/shop/${product.slug}`
    : `/${slug}/shop`;

  return (
    <a
      href={href}
      className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left transition hover:border-[#FFB300] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#FFB300]"
      aria-label={`View ${product.name}`}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-neutral-100">
        {product.cover_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.cover_url}
            alt={product.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[13px] text-neutral-400">
            No image
          </div>
        )}
        {stockBadge && (
          <span
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[13px] font-extrabold shadow-md"
            style={{ background: stockBadge.bg, color: stockBadge.fg }}
          >
            {stockBadge.label}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-3.5">
        <p
          className="line-clamp-2 text-[13px] font-extrabold leading-tight text-neutral-900 sm:text-sm"
          style={{ minHeight: "2.4em" }}
        >
          {product.name}
        </p>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-[15px] font-extrabold text-neutral-900 sm:text-base">
            {product.product_kind === "install" ? "From " : ""}
            {formatGbp(product.price_pence)}
          </span>
        </div>
        {/* VAT meta line — 11px is a deliberate exception to the 13px floor
            because this is non-primary meta on a grid card; the customer's
            decision driver is the price + name above. */}
        <p className="text-[11px] text-neutral-500">
          {vatShortLabel(product)}
        </p>
        {typeof product.dispatch_days === "number" && product.dispatch_days > 0 && (
          <p className="text-[13px] text-neutral-500">
            Ships in {product.dispatch_days}{" "}
            {product.dispatch_days === 1 ? "day" : "days"}
          </p>
        )}
        {hasBulkTiers && (
          /* Single pill — same minimal pattern as the Hammerex storefront.
             Actual interactive tier rows live on the PDP via BulkTierTable. */
          <span
            className="mt-1 inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[13px] font-extrabold"
            style={{
              background: "#FFB30022",
              color: "#0A0A0A",
              borderColor: "#FFB300"
            }}
          >
            Bulk tiers available
          </span>
        )}
        {/* Bottom row — stars + count on the LEFT (when stats present)
            and the decorative yellow View pill on the RIGHT. The whole
            card is already an anchor, so the pill is pointer-events-none.
            mt-auto pins the row to the bottom regardless of card height. */}
        <div className="mt-auto flex items-center justify-between gap-2">
          {stats && stats.count > 0 ? (
            <MiniStarsRow
              rating={stats.rating ?? 0}
              count={stats.count}
            />
          ) : (
            <span aria-hidden="true" />
          )}
          <span
            aria-hidden="true"
            className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 pointer-events-none"
            style={{ background: "#FFB300" }}
          >
            View
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </span>
        </div>
      </div>
    </a>
  );
}

// Tiny inline stars row — 5 SVG stars (h-3 w-3) with a width-clipped
// gold overlay matching rating/5. Used on small product cards where the
// full StarsRating component would dominate. "(N)" count beside is the
// only place we allow 11px copy on the card (the count is meta, not
// primary decision data).
const MINI_STAR_PATH =
  "M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";

function MiniStarsRow({
  rating,
  count
}: {
  rating: number;
  count: number;
}) {
  const clamped = Math.max(0, Math.min(5, Number.isFinite(rating) ? rating : 0));
  const pct = (clamped / 5) * 100;
  return (
    <div className="flex items-center gap-1">
      <div
        className="relative shrink-0"
        role="img"
        aria-label={`Rated ${clamped.toFixed(1)} out of 5 from ${count} review${count === 1 ? "" : "s"}`}
      >
        <MiniStarRow filled={false} />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ width: `${pct}%` }}
        >
          <MiniStarRow filled={true} />
        </div>
      </div>
      <span className="text-[11px] text-neutral-500">({count})</span>
    </div>
  );
}

function MiniStarRow({ filled }: { filled: boolean }) {
  return (
    <div aria-hidden="true" className="flex shrink-0 gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg
          key={i}
          width={12}
          height={12}
          viewBox="0 0 24 24"
          fill={filled ? "#FFB300" : "none"}
          stroke={filled ? "#FFB300" : "#D4D4D4"}
          strokeWidth={1.8}
          strokeLinejoin="round"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d={MINI_STAR_PATH} />
        </svg>
      ))}
    </div>
  );
}

function vatShortLabel(product: HammerexXratedProduct): string {
  if (product.vat_rate_pct === null || product.vat_inclusive === null) {
    return "no VAT";
  }
  return product.vat_inclusive ? "inc VAT" : "exc VAT";
}

function stockBadgeFor(
  stock: number | null
): { label: string; bg: string; fg: string } | null {
  if (stock === null) return null;
  if (stock <= 0) {
    return { label: "Out of stock", bg: "#DC2626", fg: "#FFFFFF" };
  }
  if (stock <= 5) {
    return {
      label: `${stock} left`,
      bg: "#F97316",
      fg: "#FFFFFF"
    };
  }
  return { label: "In stock", bg: "#FFB300", fg: "#0A0A0A" };
}
