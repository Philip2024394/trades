// TradeClearanceCarousel — horizontal scroll strip of clearance /
// end-of-line products from the merchants the trade already uses.
//
// Scoping rule (per Constitution): NEVER a global "Deals" wall.
// Only pulls from merchants that appear on the trade's notebook, so
// the strip stays personal — same suppliers, just their overstock.
//
// Clearance criteria (fixture-mode):
//   - trade price is ≥15% below retail, OR
//   - stock state is "low" (end-of-line)

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Send, Check, Package } from "lucide-react";
import type { TradeCenterProduct } from "@/apps/tradecenter/types";
import { PRODUCT_FIXTURES } from "@/apps/tradecenter/data/products";
import { findMerchant } from "@/apps/tradecenter/data/merchants";
import { useQuoteBasket } from "../lib/quoteBasket";
import { CountdownTimer } from "./CountdownTimer";

type ServerClearanceItem = {
  productId: string;
  productSlug: string;
  productName: string;
  spec: string;
  imageUrl: string | null;
  priceGbp: number;
  comparePriceGbp: number | null;
  savingPct: number;
  stockCount: number | null;
  lowStock: boolean;
  merchantSlug: string;
  merchantName: string;
  postedAtIso?: string;
  expiresAtIso?: string;
};

type Props = {
  /** Merchants the trade already uses (from notebook matches). */
  merchantSlugs: string[];
};

type ClearanceCard = {
  product: TradeCenterProduct;
  merchantName: string;
  merchantSlug: string;
  savingPct: number;
  expiresAtIso?: string;
};

function scoreClearance(p: TradeCenterProduct): number | null {
  if (p.stockState === "out") return null;
  if (p.tradePriceGbp !== undefined && p.priceGbp > 0) {
    const pct = ((p.priceGbp - p.tradePriceGbp) / p.priceGbp) * 100;
    if (pct >= 15) return pct;
  }
  if (p.stockState === "low") return 10; // low-stock = end-of-line signal
  return null;
}

export function TradeClearanceCarousel({ merchantSlugs }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const basket = useQuoteBasket();
  const [serverItems, setServerItems] = useState<ServerClearanceItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (merchantSlugs.length === 0) {
      setServerItems([]);
      return;
    }
    const qs = new URLSearchParams({ merchants: merchantSlugs.join(",") }).toString();
    fetch(`/api/apps/notebook/clearance?${qs}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((json: { items?: ServerClearanceItem[] }) => {
        if (!cancelled) setServerItems(json.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setServerItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [merchantSlugs]);

  // Fixture fallback so the strip is never blank in dev / when the
  // merchant catalog table is empty.
  const fixtureCards = useMemo<ClearanceCard[]>(() => {
    const slugs = new Set(merchantSlugs);
    const out: ClearanceCard[] = [];
    for (const p of PRODUCT_FIXTURES) {
      if (!slugs.has(p.merchantSlug)) continue;
      const savingPct = scoreClearance(p);
      if (savingPct === null) continue;
      const merchant = findMerchant(p.merchantSlug);
      if (!merchant) continue;
      out.push({
        product: p,
        merchantName: merchant.displayName,
        merchantSlug: merchant.slug,
        savingPct
      });
    }
    out.sort((a, b) => b.savingPct - a.savingPct);
    return out.slice(0, 12);
  }, [merchantSlugs]);

  const serverCards = useMemo<ClearanceCard[] | null>(() => {
    if (serverItems === null) return null;
    return serverItems.map((s) => ({
      product: {
        id:             s.productId,
        slug:           s.productSlug,
        name:           s.productName,
        spec:           s.spec,
        category:       "hand-tools",
        subCategory:    "",
        merchantSlug:   s.merchantSlug,
        priceGbp:       s.comparePriceGbp ?? s.priceGbp,
        tradePriceGbp:  s.comparePriceGbp ? s.priceGbp : undefined,
        currency:       "GBP",
        imageUrl:       s.imageUrl ?? undefined,
        stockState:     s.lowStock ? "low" : "in",
        stockQty:       s.stockCount ?? undefined,
        deliveryPromise: "",
        collectAvailable: true,
        starRating:     0,
        reviewCount:    0
      } as TradeCenterProduct,
      merchantName: s.merchantName,
      merchantSlug: s.merchantSlug,
      savingPct:    s.savingPct,
      expiresAtIso: s.expiresAtIso
    }));
  }, [serverItems]);

  // Prefer real data when we have it; fall back to fixtures for dev.
  const cards = serverCards && serverCards.length > 0 ? serverCards : fixtureCards;

  if (cards.length === 0) return null;

  function scrollBy(px: number) {
    scrollRef.current?.scrollBy({ left: px, behavior: "smooth" });
  }

  return (
    <section
      className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.12)" }}
    >
      {/* Header */}
      <div className="flex items-end justify-between gap-3 border-b p-3 md:p-4" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
        <div>
          <div className="text-[9.5px] font-black uppercase tracking-[0.16em]" style={{ color: "#B45309" }}>
            TC · Trade Deals & Clearance
          </div>
          <h3 className="mt-0.5 text-[14px] font-black leading-tight text-neutral-900 md:text-[16px]">
            Live deals from your merchants
          </h3>
          <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
            Every live discount, clearance line and end-of-line offer from verified merchants already
            on your notebook. Five-day countdown — after that, merchants have to re-post.
          </p>
        </div>
        <div className="hidden flex-shrink-0 items-center gap-1 md:flex">
          <button
            type="button"
            onClick={() => scrollBy(-320)}
            aria-label="Scroll left"
            className="flex h-8 w-8 items-center justify-center rounded-full border bg-white text-neutral-700 hover:bg-neutral-50"
            style={{ borderColor: "rgba(139,69,19,0.18)" }}
          >
            <ChevronLeft size={14}/>
          </button>
          <button
            type="button"
            onClick={() => scrollBy(320)}
            aria-label="Scroll right"
            className="flex h-8 w-8 items-center justify-center rounded-full border bg-white text-neutral-700 hover:bg-neutral-50"
            style={{ borderColor: "rgba(139,69,19,0.18)" }}
          >
            <ChevronRight size={14}/>
          </button>
        </div>
      </div>

      {/* Carousel */}
      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto p-3 md:p-4"
        style={{ scrollbarWidth: "thin" }}
      >
        {cards.map(({ product, merchantName, savingPct, expiresAtIso }) => {
          const inQuote = basket.has(`clearance-${product.id}`);
          const displayPrice = product.tradePriceGbp ?? product.priceGbp;
          function toggle() {
            const key = `clearance-${product.id}`;
            if (inQuote) {
              basket.remove(key);
              return;
            }
            basket.add({
              itemId: key,
              productName: product.name,
              spec: product.spec,
              imageUrl: product.imageUrl,
              qty: 1,
              unit: "each",
              merchantSlug: product.merchantSlug,
              merchantName,
              productSlug: product.slug,
              unitPriceGbp: displayPrice
            });
          }
          return (
            <article
              key={product.id}
              className="flex w-[160px] flex-shrink-0 snap-start flex-col overflow-hidden rounded-xl border bg-white sm:w-[180px]"
              style={{ borderColor: "rgba(139,69,19,0.12)" }}
            >
              {/* Image */}
              <div
                className="relative aspect-square w-full overflow-hidden"
                style={{ backgroundColor: "#F5F0E4" }}
              >
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrl} alt="" className="h-full w-full object-contain"/>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Package size={22} className="text-neutral-400"/>
                  </div>
                )}
                <span
                  className="absolute left-2 top-2 inline-flex items-center rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-sm"
                  style={{ backgroundColor: "#B45309", color: "#FFFFFF" }}
                >
                  −{Math.round(savingPct)}%
                </span>
                {expiresAtIso && (
                  <div className="absolute right-2 top-2">
                    <CountdownTimer expiresAtIso={expiresAtIso}/>
                  </div>
                )}
                {product.stockState === "low" && (
                  <span
                    className="absolute bottom-2 left-2 inline-flex items-center rounded-sm px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider shadow-sm"
                    style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
                  >
                    Low stock
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="flex flex-1 flex-col gap-1 p-2.5">
                <div className="line-clamp-2 text-[11.5px] font-black leading-tight text-neutral-900">
                  {product.name}
                </div>
                <div className="line-clamp-1 text-[10px] text-neutral-500">
                  {merchantName}
                </div>
                <div className="mt-auto flex items-baseline gap-1.5">
                  {product.tradePriceGbp !== undefined && (
                    <span className="text-[10px] text-neutral-400 line-through">£{product.priceGbp}</span>
                  )}
                  <span className="text-[13px] font-black text-neutral-900">£{displayPrice}</span>
                </div>
                <button
                  type="button"
                  onClick={toggle}
                  aria-pressed={inQuote}
                  className="mt-1 inline-flex h-8 w-full items-center justify-center gap-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm"
                  style={{
                    backgroundColor: inQuote ? "#166534" : "#0A0A0A",
                    color: inQuote ? "#FFFFFF" : "#FFB300"
                  }}
                >
                  {inQuote ? (
                    <>
                      <Check size={11}/>
                      In quote
                    </>
                  ) : (
                    <>
                      <Send size={11}/>
                      Add to quote
                    </>
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
