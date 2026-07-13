// Sticky mobile-first bottom buy bar that appears after the top buy column
// scrolls out of view. Ports Hammerex StickyBuyBar pattern.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Package, Check } from "lucide-react";
import { useGuestBasket } from "../../lib/useGuestBasket";
import { findMerchant } from "../../data/merchants";
import type { MarketplaceProduct } from "../../types";

type Props = {
  product: MarketplaceProduct;
};

export function StickyBuyBar({ product }: Props) {
  const [visible, setVisible] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const cart = useGuestBasket();
  const router = useRouter();

  useEffect(() => {
    const sentinel = document.getElementById("pdp-buy-sentinel");
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => setVisible(!entries[0].isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 p-3 shadow-lg backdrop-blur"
      style={{
        borderColor: "rgba(139,69,19,0.15)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)"
      }}
      role="region"
      aria-label="Sticky purchase bar"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        {/* Thumb */}
        <div
          className="hidden h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-md sm:flex"
          style={{ backgroundColor: "#F5F0E4" }}
          aria-hidden
        >
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt="" className="h-full w-full object-contain p-1"/>
          ) : (
            <Package size={18} strokeWidth={1.5} className="text-neutral-400"/>
          )}
        </div>

        {/* Name + price */}
        <div className="min-w-0 flex-1">
          <div className="line-clamp-1 text-[12px] font-black text-neutral-900">{product.name}</div>
          <div className="text-[13px] font-black text-neutral-900">
            £{product.priceGbp}
            <span className="ml-2 text-[10.5px] font-normal text-neutral-500">
              {product.deliveryPromise}
            </span>
          </div>
        </div>

        {/* Add to cart — writes to the shared cart store. Second tap
            after the confirmation flash routes to /tc/cart so the
            buyer can check out. */}
        <button
          type="button"
          onClick={() => {
            if (justAdded) {
              router.push("/tc/cart");
              return;
            }
            const merchant = findMerchant(product.merchantSlug);
            cart.add({
              productId:    product.id,
              productSlug:  product.slug,
              productName:  product.name,
              imageUrl:     product.imageUrl,
              qty:          1,
              unitPriceGbp: product.priceGbp,
              merchantSlug: product.merchantSlug,
              merchantName: merchant?.displayName ?? product.merchantSlug
            });
            setJustAdded(true);
            window.setTimeout(() => setJustAdded(false), 2200);
          }}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-4 text-[12px] font-black uppercase tracking-wider text-white shadow-sm transition sm:px-6"
          style={{ backgroundColor: justAdded ? "#0A0A0A" : "#166534" }}
        >
          {justAdded ? (
            <>
              <Check size={14}/>
              <span className="hidden sm:inline">View cart</span>
              <span className="sm:hidden">Cart</span>
            </>
          ) : (
            <>
              <ShoppingCart size={14}/>
              <span className="hidden sm:inline">Add to cart</span>
              <span className="sm:hidden">Add</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
