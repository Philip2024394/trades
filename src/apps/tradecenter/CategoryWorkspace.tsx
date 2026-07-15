// Marketplace — Category workspace.
//
// Renders a grid of ProductCards for a given category. Sub-category
// chip row filters client-side. Density comfortable / compact reads
// from workspace state (Wave 2 wires this — Week 3 defaults to
// comfortable).

"use client";

import { useMemo, useState } from "react";
import type { TradeCenterProduct, ProductCategorySlug } from "./types";
import { findMerchant } from "./data/merchants";
import { ProductCard, type ViewerTier } from "./components/ProductCard";
import { askAI } from "@/platform/shell/WorkspaceShell";

type Props = {
  categorySlug: ProductCategorySlug;
  products: TradeCenterProduct[];
  viewerTier?: ViewerTier;
  viewerHasBusinessAccount?: boolean;
};

const CATEGORY_LABELS: Record<ProductCategorySlug, string> = {
  "hand-tools": "Hand tools",
  "power-tools": "Power tools",
  "site-materials": "Site materials",
  "safety-ppe": "Safety + PPE"
};

export function CategoryWorkspace({
  categorySlug,
  products,
  viewerTier = "paid",
  viewerHasBusinessAccount = false
}: Props) {
  const label = CATEGORY_LABELS[categorySlug] ?? categorySlug;
  const [activeSubCat, setActiveSubCat] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const subCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      counts.set(p.subCategory, (counts.get(p.subCategory) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [products]);

  const filtered = useMemo(
    () => (activeSubCat ? products.filter((p) => p.subCategory === activeSubCat) : products),
    [products, activeSubCat]
  );

  function toggleCompare(id: string): void {
    setCompareIds((prev) =>
      prev.includes(id)
        ? prev.filter((p) => p !== id)
        : prev.length >= 4
          ? prev
          : [...prev, id]
    );
  }

  return (
    <div className="px-6 py-8">
      {/* Category header */}
      <div className="mb-4">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
          Marketplace
        </div>
        <h1 className="mt-1 text-[26px] font-black leading-tight text-neutral-900">
          {label}
        </h1>
        <div className="mt-1 text-[12px] text-neutral-500">
          {products.length} products found · {subCategories.length} sub-categories
        </div>
      </div>

      {/* Sub-category chip row */}
      {subCategories.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSubCat(null)}
            className="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider transition"
            style={{
              backgroundColor: activeSubCat === null ? "#0A0A0A" : "transparent",
              color: activeSubCat === null ? "#FFB300" : "#525252",
              border: `1px solid ${activeSubCat === null ? "#0A0A0A" : "rgba(139,69,19,0.20)"}`
            }}
          >
            All · {products.length}
          </button>
          {subCategories.map(([sc, count]) => {
            const active = activeSubCat === sc;
            return (
              <button
                key={sc}
                type="button"
                onClick={() => setActiveSubCat(active ? null : sc)}
                className="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider transition"
                style={{
                  backgroundColor: active ? "#0A0A0A" : "transparent",
                  color: active ? "#FFB300" : "#525252",
                  border: `1px solid ${active ? "#0A0A0A" : "rgba(139,69,19,0.20)"}`
                }}
              >
                {sc.replace("-", " ")} · {count}
              </button>
            );
          })}
        </div>
      )}

      {/* Compare bar */}
      {compareIds.length > 0 && (
        <div
          className="mb-4 flex items-center justify-between rounded-lg border p-3 text-[12px]"
          style={{
            borderColor: "#F59E0B",
            backgroundColor: "#FEF3C7"
          }}
        >
          <span className="font-bold">
            Comparing {compareIds.length} product{compareIds.length === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCompareIds([])}
              className="text-neutral-600 underline"
            >
              Clear
            </button>
            <button
              type="button"
              className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white"
              style={{ backgroundColor: "#166534" }}
            >
              Open compare drawer
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-8 text-center text-[12px] text-neutral-500">
          No products match this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => {
            const merchant = findMerchant(p.merchantSlug);
            if (!merchant) return null;
            return (
              <ProductCard
                key={p.id}
                product={p}
                merchant={merchant}
                viewerTier={viewerTier}
                viewerHasBusinessAccount={viewerHasBusinessAccount}
                onCompareToggle={toggleCompare}
                isInCompare={compareIds.includes(p.id)}
                onAskAI={askAI}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
