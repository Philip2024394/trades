"use client";

// TcPdpBody — client half of the Trade Center Product Detail Page.
// Renders the variant picker + resolves effective price/image/URLs
// from the URL `?v=` combo key (pre-selection from the referring
// canteen page or trending swipe sheet) + emits the WhatsApp deep
// link and the "Add to basket" CTA (Safe Trade checkout when live).
//
// Mobile-first layout:
//   - Below md: image full-width top, details full-width below
//   - md+     : image on left (55%), details on right (45%)
//
// State:
//   - variantState resolved by CanteenVariantPicker
//   - initial selection can be seeded from ?v=<combo> when present

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, MessageCircle, ShoppingBag, Star, Store } from "lucide-react";
import type { CanteenProduct } from "@/lib/canteens";
import { CanteenVariantPicker, type VariantSelectionState } from "@/components/xrated/yard/CanteenVariantPicker";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";

export function TcPdpBody({
  product,
  hostDisplayName,
  tradeLabel,
  canteenSlug,
  hostWhatsapp
}: {
  product: CanteenProduct;
  hostDisplayName: string;
  tradeLabel: string;
  canteenSlug: string;
  hostWhatsapp: string | null;
}) {
  const [variantState, setVariantState] = useState<VariantSelectionState | null>(null);
  const searchParams = useSearchParams();
  const referrer = searchParams.get("from");
  const referrerSlug = searchParams.get("slug");
  const initialComboKey = searchParams.get("v");

  // Effective values from variant selection (or base product).
  const effectivePriceGbp = variantState?.priceGbp ?? product.priceGbp;
  const effectiveImageUrl = variantState?.imageUrl || product.imageUrl;
  const variantLabel = variantState?.label;
  const isOutOfStock = variantState?.isOutOfStock ?? false;

  const gallery = useMemo(() => {
    const arr = [effectiveImageUrl, ...(product.galleryUrls ?? [])];
    return arr.filter((v, i, all) => v && all.indexOf(v) === i);
  }, [effectiveImageUrl, product.galleryUrls]);
  const [activeImage, setActiveImage] = useState(effectiveImageUrl);

  // Re-seat the main image whenever the effective image changes (variant
  // swap OR gallery-thumb click). Priority: variant image if selected,
  // else the last thumb the buyer clicked.
  useEffect(() => {
    setActiveImage(effectiveImageUrl);
  }, [effectiveImageUrl]);

  const hostFirstName = hostDisplayName.split(/\s+/)[0] || hostDisplayName;
  const variantSuffix = variantLabel ? ` (${variantLabel})` : "";
  const outOfStockNote = isOutOfStock ? " — is this variant back in stock?" : "";

  const waUrl = hostWhatsapp
    ? `https://wa.me/${hostWhatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
        `Hi ${hostFirstName}, I'm on Trade Center looking at "${product.name}${variantSuffix}"${outOfStockNote}. Can you tell me more?`
      )}`
    : null;

  // Back link — if the buyer arrived from a canteen page, we send them
  // back there; otherwise the Trade Center landing.
  const backHref = referrer === "canteen" && referrerSlug
    ? `/trade-off/yard/canteens/${referrerSlug}`
    : "/trade-off/trade-center";
  const backLabel = referrer === "canteen" && referrerSlug
    ? `${hostFirstName}'s canteen`
    : "Trade Center";

  return (
    <main className="min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      {/* Persistent Trade Center header — burger + identity chip +
          basket. Signed-in merchants get their account menu; signed-out
          visitors get the Sign in / Join Free pair. Same header used on
          every /tc/* page for consistency. */}
      <TradeCenterHeader/>

      {/* Back link */}
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 pt-4 md:px-6 md:pt-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
        >
          <ArrowLeft size={14} strokeWidth={2.4}/>
          {backLabel}
        </Link>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.22em] text-amber-700">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#FFB300" }}/>
          Trade Center
        </span>
      </div>

      {/* Body — single column on mobile, two-column at md+ */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-3 pb-32 pt-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-8 md:px-6 md:pt-6">
        {/* Left column: image + thumbnails */}
        <div className="flex flex-col gap-3">
          <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-[#E5D9BD] bg-neutral-50">
            {activeImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeImage}
                alt={product.name}
                className="h-full w-full object-contain p-4"
              />
            ) : (
              <div className="text-[#1B1A17]/30">
                <Store size={40} strokeWidth={1.6}/>
              </div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {gallery.slice(0, 5).map((g, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveImage(g)}
                  aria-label={`View image ${i + 1}`}
                  className={`relative aspect-square overflow-hidden rounded-lg border bg-white ${
                    activeImage === g
                      ? "border-[#FFB300]"
                      : "border-[#E5D9BD] hover:border-neutral-400"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g} alt="" className="h-full w-full object-contain p-1"/>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right column: title + price + picker + CTAs + specs */}
        <div className="flex flex-col gap-3">
          <h1 className="text-[22px] font-black leading-tight text-[#1B1A17] md:text-[28px]">
            {product.name}
          </h1>

          {/* Sold by chip — always link to the canteen. */}
          <Link
            href={`/trade-off/yard/canteens/${canteenSlug}`}
            className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#E5D9BD] bg-white px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-[#1B1A17] hover:bg-[#FFF8E6]"
          >
            <Store size={11} strokeWidth={2.4}/>
            {hostDisplayName} · {tradeLabel}
          </Link>

          {/* Price line — updates live with variant selection */}
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="text-[26px] font-black leading-none text-[#1B1A17] md:text-[30px]">
              {effectivePriceGbp > 0 ? `£${effectivePriceGbp}` : (
                <span className="italic text-[#1B1A17]/60">Price on request</span>
              )}
            </span>
            {variantLabel && (
              <span className="rounded-full bg-[#FFF8E6] px-2 py-0.5 text-[10.5px] font-black uppercase tracking-wider text-amber-800">
                {variantLabel}
              </span>
            )}
          </div>

          {product.blurb && (
            <p className="text-[12.5px] leading-relaxed text-[#1B1A17]/70">
              {product.blurb}
            </p>
          )}

          {/* Variant picker */}
          {product.variants && (
            <div className="mt-2">
              <CanteenVariantPicker
                variants={product.variants}
                basePriceGbp={product.priceGbp}
                baseImageUrl={product.imageUrl}
                initialComboKey={initialComboKey}
                onChange={setVariantState}
              />
            </div>
          )}

          {/* CTA row — Safe Trade checkout (dark green) primary,
              WhatsApp (yellow) secondary. Sticky bottom bar on mobile
              via a fixed variant below. */}
          <div className="mt-3 flex flex-col gap-2 md:flex-row">
            <Link
              href={`/tc/checkout/canteen/${product.tradeCenterListingId ?? product.id}${variantState?.comboKey ? `?v=${encodeURIComponent(variantState.comboKey)}` : ""}`}
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full px-6 text-[12px] font-black uppercase tracking-wider text-white shadow-md active:scale-[0.98]"
              style={{ backgroundColor: "#166534" }}
            >
              <ShoppingBag size={14} strokeWidth={2.6}/>
              Buy on Trade Center
              {effectivePriceGbp > 0 && (
                <span className="ml-0.5 rounded-full bg-white/15 px-2 py-0.5 text-[11px]">
                  £{effectivePriceGbp}
                </span>
              )}
            </Link>
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full px-6 text-[12px] font-black uppercase tracking-wider text-[#0A0A0A] shadow-md active:scale-[0.98]"
                style={{ backgroundColor: "#FFB300" }}
              >
                <MessageCircle size={14} strokeWidth={2.6}/>
                Ask on WhatsApp
              </a>
            )}
          </div>

          {/* Zero-commission trust chip — mirrors the browse banner */}
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-900">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"/>
            0% commission · Bandwidth is on us
          </div>

          {/* Full description */}
          {product.description && (
            <details className="mt-3 rounded-xl border border-[#E5D9BD] bg-white p-3" open>
              <summary className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-[#1B1A17]/60">
                Description
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-[#1B1A17]">
                {product.description}
              </p>
            </details>
          )}

          {/* Specs */}
          {product.specs && product.specs.length > 0 && (
            <details className="rounded-xl border border-[#E5D9BD] bg-white p-3">
              <summary className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-[#1B1A17]/60">
                Specs
              </summary>
              <ul className="mt-2 flex flex-col gap-1.5 text-[12px] leading-snug text-[#1B1A17]">
                {product.specs.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Star size={9} className="mt-1 flex-shrink-0 text-amber-500" strokeWidth={0} fill="currentColor"/>
                    {s}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Category-specific item specifics (Aspects) */}
          {product.categoryAspects && Object.keys(product.categoryAspects).length > 0 && (
            <details className="rounded-xl border border-[#E5D9BD] bg-white p-3">
              <summary className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-[#1B1A17]/60">
                Item specifics
              </summary>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px]">
                {Object.entries(product.categoryAspects).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="font-black uppercase tracking-wider text-[#1B1A17]/50">
                      {k}
                    </dt>
                    <dd className="font-bold text-[#1B1A17]">{v}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </div>
      </div>

      {/* Sticky mobile CTA bar — primary Buy button always reachable */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E5D9BD] bg-[#FBF6EC]/95 px-3 py-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-bold text-[#1B1A17]/60">
              {product.name}
            </div>
            <div className="text-[14px] font-black text-[#1B1A17]">
              {effectivePriceGbp > 0 ? `£${effectivePriceGbp}` : "Price on request"}
            </div>
          </div>
          <Link
            href={`/tc/checkout/canteen/${product.tradeCenterListingId ?? product.id}${variantState?.comboKey ? `?v=${encodeURIComponent(variantState.comboKey)}` : ""}`}
            className="inline-flex h-11 flex-shrink-0 items-center justify-center gap-1 rounded-full px-4 text-[11.5px] font-black uppercase tracking-wider text-white shadow-md"
            style={{ backgroundColor: "#166534" }}
          >
            <ShoppingBag size={13} strokeWidth={2.6}/>
            Buy
          </Link>
        </div>
      </div>
    </main>
  );
}
