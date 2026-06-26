"use client";

// Single service tile inside ServicesPricedGrid / ServicesPricedSection.
// Tapping the tile opens the ServiceModal (image + description + unit +
// dual CTA: Enquire on WhatsApp / Add to cart). Designed to mirror the
// ProductCard visual rhythm so the two grids look related — but with a
// yellow per-unit pill at the top of the cover image and the unit small
// next to the price instead of stock/dispatch text.

import { useState } from "react";
import type {
  HammerexTradeOffListing,
  HammerexXratedProduct
} from "@/lib/supabase";
import { ServiceModal } from "./ServiceModal";
import { formatGbp } from "@/lib/xratedCart";

export function ServiceCard({
  service,
  listing
}: {
  service: HammerexXratedProduct;
  listing: HammerexTradeOffListing;
}) {
  const [open, setOpen] = useState(false);
  const unitLabel = service.unit?.trim() || null;
  const category = service.category?.trim() || null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left transition hover:border-[#FFB300] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#FFB300]"
        aria-label={`View ${service.name}`}
      >
        <div className="relative aspect-square w-full overflow-hidden bg-neutral-100">
          {service.cover_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={service.cover_url}
              alt={service.name}
              loading="lazy"
              className="h-full w-full object-cover transition group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
              No image
            </div>
          )}
          {unitLabel && (
            <span
              className="absolute left-2 top-2 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-neutral-900 shadow-md"
              style={{ background: "#FFB300" }}
            >
              {unitLabel}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1 p-3 sm:p-3.5">
          <p
            className="line-clamp-2 text-[13px] font-extrabold leading-tight text-neutral-900 sm:text-sm"
            style={{ minHeight: "2.4em" }}
          >
            {service.name}
          </p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-[15px] font-extrabold text-neutral-900 sm:text-base">
              {formatGbp(service.price_pence)}
            </span>
            {unitLabel && (
              <span className="text-[13px] text-neutral-500">{unitLabel}</span>
            )}
          </div>
          {category && (
            <span className="mt-auto inline-flex w-fit items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-neutral-600">
              {category}
            </span>
          )}
        </div>
      </button>

      {open && (
        <ServiceModal
          service={service}
          listing={listing}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
