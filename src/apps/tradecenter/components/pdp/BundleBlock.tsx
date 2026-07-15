// Bundle & Save — collapsible accordion showing "current product + 2 more"
// at a discounted total. Ports Hammerex's BundleBlock pattern.

"use client";

import { useState } from "react";
import { ChevronDown, Package, Plus, ShoppingCart } from "lucide-react";
import { PRODUCT_FIXTURES } from "../../data/products";
import type { TradeCenterProduct } from "../../types";
import type { ProductBundle } from "../../data/productDetails";

type Props = {
  anchor: TradeCenterProduct;
  bundle: ProductBundle;
};

export function BundleBlock({ anchor, bundle }: Props) {
  const [open, setOpen] = useState(true);

  const bundleProducts = [
    { p: anchor, qty: 1 },
    ...bundle.items
      .map((it) => ({ p: PRODUCT_FIXTURES.find((x) => x.slug === it.productSlug), qty: it.qty }))
      .filter((x): x is { p: TradeCenterProduct; qty: number } => Boolean(x.p))
  ];

  const listTotal = bundleProducts.reduce((sum, x) => sum + x.p.priceGbp * x.qty, 0);
  const bundleTotal = listTotal * (1 - bundle.discountPct / 100);
  const saving = listTotal - bundleTotal;

  return (
    <section className="border-t py-6" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
      <div className="mx-auto max-w-6xl px-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 rounded-xl border bg-white p-4 text-left shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
              >
                Save {bundle.discountPct}%
              </span>
              <h2 className="text-[15px] font-black text-neutral-900">{bundle.title}</h2>
            </div>
            <div className="mt-1 text-[11.5px] text-neutral-600">
              {bundleProducts.length} items · £{bundleTotal.toFixed(0)}
              <span className="ml-2 text-neutral-400 line-through">£{listTotal.toFixed(0)}</span>
              <span className="ml-2 font-black" style={{ color: "#166534" }}>
                you save £{saving.toFixed(0)}
              </span>
            </div>
          </div>
          <ChevronDown
            size={18}
            className="flex-shrink-0 text-neutral-500 transition"
            style={{ transform: open ? "rotate(180deg)" : undefined }}
          />
        </button>

        {open && (
          <div
            className="mt-3 rounded-xl border bg-white p-4 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <ul className="flex flex-wrap items-stretch gap-3">
              {bundleProducts.map(({ p, qty }, i) => (
                <li key={p.slug} className="flex items-center gap-3">
                  <div
                    className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white"
                    style={{ borderColor: "rgba(139,69,19,0.15)" }}
                  >
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.name} className="h-full w-full object-contain p-2"/>
                    ) : (
                      <Package size={22} strokeWidth={1.5} className="text-neutral-400"/>
                    )}
                  </div>
                  <div className="min-w-[130px] max-w-[180px]">
                    <div className="line-clamp-2 text-[12px] font-black text-neutral-900">{p.name}</div>
                    <div className="mt-0.5 text-[11px] text-neutral-500">
                      {qty > 1 ? `${qty}× · ` : ""}£{p.priceGbp}
                    </div>
                  </div>
                  {i < bundleProducts.length - 1 && (
                    <Plus size={16} className="flex-shrink-0 text-neutral-400" aria-hidden/>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-[22px] font-black text-neutral-900">£{bundleTotal.toFixed(0)}</span>
                <span className="text-[11.5px] text-neutral-400 line-through">£{listTotal.toFixed(0)}</span>
              </div>
              <button
                type="button"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-5 text-[12px] font-black uppercase tracking-wider text-white shadow-sm"
                style={{ backgroundColor: "#166534" }}
              >
                <ShoppingCart size={14}/>
                Add bundle to cart
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
