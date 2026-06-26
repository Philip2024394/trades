"use client";

// Single product tile inside ProductCardGrid. Clicking the whole card
// opens the ProductModal (image gallery + description + add-to-cart).

import { useState } from "react";
import type { HammerexXratedProduct } from "@/lib/supabase";
import { ProductModal } from "./ProductModal";
import { formatGbp } from "@/lib/xratedCart";

export function ProductCard({
  product,
  slug,
  siblings,
  themeColor
}: {
  product: HammerexXratedProduct;
  slug: string;
  siblings: HammerexXratedProduct[];
  themeColor: string;
}) {
  const [open, setOpen] = useState(false);
  const stockBadge = stockBadgeFor(product.stock_count);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
              className="h-full w-full object-cover transition group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
              No image
            </div>
          )}
          {stockBadge && (
            <span
              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-extrabold shadow-md"
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
              {formatGbp(product.price_pence)}
            </span>
          </div>
          {typeof product.dispatch_days === "number" && product.dispatch_days > 0 && (
            <p className="text-[13px] text-neutral-500">
              Ships in {product.dispatch_days}{" "}
              {product.dispatch_days === 1 ? "day" : "days"}
            </p>
          )}
        </div>
      </button>

      {open && (
        <ProductModal
          product={product}
          slug={slug}
          siblings={siblings}
          themeColor={themeColor}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
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
