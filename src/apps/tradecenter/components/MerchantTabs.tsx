// Merchant tab strip.
// Visual-only for Week 6b — the tabs are declared surfaces the App
// will fill in later waves. "All Products" is the only active surface
// at this stage.

"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

type TabKey = "all-products" | "about" | "reviews" | "shipping" | "policies";

type Props = {
  reviewCount: number;
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "all-products", label: "All Products" },
  { key: "about", label: "About Us" },
  { key: "reviews", label: "Reviews" },
  { key: "shipping", label: "Shipping & Returns" },
  { key: "policies", label: "Store Policies" }
];

export function MerchantTabs({ reviewCount }: Props) {
  const [active, setActive] = useState<TabKey>("all-products");

  return (
    <div
      className="mt-4 flex items-center justify-between border-b"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <nav
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scroll-smooth"
        style={{ WebkitOverflowScrolling: "touch" }}
        role="tablist"
      >
        {TABS.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.key)}
              className="relative flex-shrink-0 whitespace-nowrap px-3 py-2 text-[12px] font-bold transition"
              style={{ color: isActive ? "#0A0A0A" : "#525252" }}
            >
              <span className="flex items-center gap-1.5">
                {t.label}
                {t.key === "reviews" && (
                  <span className="text-[10.5px] text-neutral-400">
                    ({reviewCount.toLocaleString()})
                  </span>
                )}
              </span>
              {isActive && (
                <span
                  className="absolute inset-x-2 -bottom-[1px] h-[2px]"
                  style={{ backgroundColor: "#0A0A0A" }}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </nav>
      <button
        type="button"
        className="ml-2 hidden flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-black uppercase tracking-wider text-neutral-600 transition hover:bg-neutral-100 sm:inline-flex"
      >
        <Share2 size={12}/>
        <span className="hidden md:inline">Share Store</span>
      </button>
    </div>
  );
}
