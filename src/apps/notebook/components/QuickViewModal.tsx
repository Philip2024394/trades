// Quick View modal — Amazon / Shopify pattern.
//
// Opens over the Notebook page when a trade taps "View" on a card.
// Shows full product detail without navigating away: main image +
// thumbnails + name + price + spec + description + merchant + Order.
//
// Closed via backdrop click / ESC / Close button / after Order.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  X,
  ShoppingBag,
  History,
  MapPin,
  ExternalLink,
  Package
} from "lucide-react";
import { findProductDetails } from "@/apps/marketplace/data/productDetails";
import { formatMiles } from "@/apps/marketplace/lib/distance";
import type { NotebookItem } from "../data/notebook";
import type { NearestMatch } from "../lib/findNearestMerchant";

type Props = {
  open: boolean;
  onClose: () => void;
  item: NotebookItem | null;
  match: NearestMatch | null;
};

export function QuickViewModal({ open, onClose, item, match }: Props) {
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);

  const details = match ? findProductDetails(match.product.slug) : undefined;

  // Fallback gallery = merchant product image only.
  const gallery = details?.gallery
    ?? (match?.product.imageUrl
      ? [{ id: "fb", kind: "image" as const, url: match.product.imageUrl, alt: match.product.name }]
      : []);

  useEffect(() => {
    if (!open) return;
    setActiveImageUrl(gallery[0]?.url ?? null);
  }, [open, gallery]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !item || !match) return null;

  const hasOrderedBefore = Boolean(item.lastOrderedIso);
  const activeImage = activeImageUrl ?? gallery[0]?.url;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center p-3 md:items-center md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={match.product.name}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close quick view"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl md:max-h-[85vh] md:flex-row"
      >
        {/* Left: gallery */}
        <div className="flex flex-col gap-3 bg-neutral-50 p-4 md:min-w-[380px] md:max-w-[420px]">
          <div
            className="relative aspect-square w-full overflow-hidden rounded-xl border bg-white"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            {activeImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeImage}
                alt={match.product.name}
                className="absolute inset-0 h-full w-full object-contain p-4"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Package size={40} strokeWidth={1.5} className="text-neutral-400"/>
              </div>
            )}
          </div>

          {gallery.length > 1 && (
            <ul className="grid grid-cols-4 gap-2">
              {gallery.map((m) => {
                const isActive = m.url === activeImage;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setActiveImageUrl(m.url)}
                      aria-pressed={isActive}
                      aria-label={m.alt ?? match.product.name}
                      className="relative aspect-square w-full overflow-hidden rounded-md border-2 bg-white"
                      style={{
                        borderColor: isActive ? "#0A0A0A" : "rgba(139,69,19,0.15)"
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.url}
                        alt=""
                        className="absolute inset-0 h-full w-full object-contain p-1"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Right: detail + actions */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Close */}
          <div className="flex items-center justify-end border-b px-4 py-2" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
              aria-label="Close"
            >
              <X size={16}/>
            </button>
          </div>

          {/* Body — scrollable */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
              From your Notebook
            </div>
            <h2 className="mt-1 text-[18px] font-black leading-tight text-neutral-900 md:text-[22px]">
              {match.product.name}
            </h2>
            <p className="mt-1 text-[11.5px] text-neutral-600">
              {match.product.spec}
            </p>

            {/* Price + trade price */}
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-[26px] font-black text-neutral-900">
                £{match.product.priceGbp}
              </span>
              {match.product.tradePriceGbp && (
                <span
                  className="rounded-sm px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider"
                  style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
                >
                  Trade £{match.product.tradePriceGbp}
                </span>
              )}
            </div>

            {/* Merchant + distance */}
            <Link
              href={`/tc/trade-center/merchant/${match.merchant.slug}`}
              className="mt-3 flex items-center gap-2 rounded-lg border bg-neutral-50 p-2.5 hover:bg-neutral-100"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <span
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-black"
                style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
              >
                {match.merchant.logoInitials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-black text-neutral-900">
                  {match.merchant.displayName}
                </div>
                <div className="flex items-center gap-1 text-[10.5px] text-neutral-500">
                  <MapPin size={9}/>
                  {formatMiles(match.distanceMi)} · {match.merchant.homeCity}
                </div>
              </div>
              <ExternalLink size={12} className="text-neutral-500"/>
            </Link>

            {/* Key features */}
            {details?.keyFeatures && details.keyFeatures.length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                  Key features
                </div>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {details.keyFeatures.slice(0, 4).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11.5px] leading-snug text-neutral-700">
                      <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-neutral-500"/>
                      <span>
                        <strong className="text-neutral-900">{f.label}.</strong>{" "}
                        {f.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Specs */}
            {details?.specs && details.specs.length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                  Specification
                </div>
                <dl
                  className="mt-2 divide-y overflow-hidden rounded-lg border"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                >
                  {details.specs.slice(0, 6).map((s, i) => (
                    <div key={i} className="grid grid-cols-[110px_1fr] gap-2 bg-white px-3 py-1.5">
                      <dt className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                        {s.label}
                      </dt>
                      <dd className="text-[11px] font-bold text-neutral-800">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Notebook-specific meta */}
            <div
              className="mt-4 rounded-lg border-l-4 p-2.5 text-[10.5px]"
              style={{ backgroundColor: "#FEF3C7", borderColor: "#FFB300" }}
            >
              <strong className="text-neutral-900">You usually order {item.usualQty} {item.unit}.</strong>
              {item.lastOrderedIso && (
                <span className="text-neutral-700">
                  {" "}Last ordered {new Date(item.lastOrderedIso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.
                </span>
              )}
              {item.notes && (
                <div className="mt-1 italic text-neutral-700">&ldquo;{item.notes}&rdquo;</div>
              )}
            </div>
          </div>

          {/* Footer — primary action */}
          <div
            className="flex items-center justify-between gap-3 border-t bg-white p-4"
            style={{ borderColor: "rgba(139,69,19,0.10)" }}
          >
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                Total for {item.usualQty} {item.unit}
              </div>
              <div className="text-[16px] font-black text-neutral-900">
                £{(match.product.priceGbp * item.usualQty).toFixed(2)}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full px-6 text-[13px] font-black uppercase tracking-wider shadow-sm"
              style={{
                backgroundColor: hasOrderedBefore ? "#166534" : "#FFB300",
                color: hasOrderedBefore ? "#FFFFFF" : "#0A0A0A"
              }}
            >
              {hasOrderedBefore ? (
                <>
                  <History size={14}/>
                  Again
                </>
              ) : (
                <>
                  <ShoppingBag size={14}/>
                  Order
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
