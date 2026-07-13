// Merchant Product Grid — reuses the Marketplace ProductCard v2
// exactly as declared per Philip's directive ("the product page must
// be the exact same as the original page we had").
//
// Same primitive, same visual signature. What changes on the merchant
// page is the CONTAINER (hero above / tabs / right sidebar / trust
// band below), not the grid.

"use client";

import { useState } from "react";
import { Grid, List, LayoutGrid, ChevronDown } from "lucide-react";
import { ProductCard } from "./ProductCard";
import { askAI } from "@/platform/shell/WorkspaceShell";
import type { MarketplaceProduct } from "../types";
import type { MarketplaceMerchant } from "../data/merchants";

type Props = {
  merchant: MarketplaceMerchant;
  products: MarketplaceProduct[];
};

export function MerchantProductGrid({ merchant, products }: Props) {
  const [density, setDensity] = useState<"grid" | "list" | "compact">("grid");
  const [compareIds, setCompareIds] = useState<string[]>([]);

  function toggleCompare(id: string) {
    setCompareIds((prev) =>
      prev.includes(id)
        ? prev.filter((p) => p !== id)
        : prev.length >= 4
          ? prev
          : [...prev, id]
    );
  }

  return (
    <section className="mt-4">
      {/* Header row — matches marketplace category header shape.
          Stacks on mobile so title + toolbar don't cramp. */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="flex flex-wrap items-baseline gap-2 text-[16px] font-black text-neutral-900">
          All Products
          <span className="text-[11.5px] font-normal text-neutral-500">
            {products.length} products
          </span>
        </h2>
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className="hidden items-center gap-0.5 rounded-md border p-0.5 sm:flex"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <DensityButton kind="grid" active={density === "grid"} onClick={() => setDensity("grid")}/>
            <DensityButton kind="list" active={density === "list"} onClick={() => setDensity("list")}/>
            <DensityButton kind="compact" active={density === "compact"} onClick={() => setDensity("compact")}/>
          </div>
          <button
            type="button"
            className="flex items-center gap-1 rounded-md border bg-white px-3 py-1.5 text-[11.5px] font-bold text-neutral-700 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <span className="hidden sm:inline">Sort by:&nbsp;</span>
            <span className="text-neutral-900">Popular</span>
            <ChevronDown size={11}/>
          </button>
        </div>
      </div>

      {/* Grid — identical to marketplace grid */}
      {products.length === 0 ? (
        <div
          className="rounded-xl border-2 border-dashed p-8 text-center text-[11.5px] text-neutral-500"
          style={{ borderColor: "rgba(139,69,19,0.20)" }}
        >
          {merchant.displayName} has no products listed yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              merchant={merchant}
              viewerTier="paid"
              onCompareToggle={toggleCompare}
              isInCompare={compareIds.includes(p.id)}
              onAskAI={askAI}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DensityButton({
  kind,
  active,
  onClick
}: {
  kind: "grid" | "list" | "compact";
  active: boolean;
  onClick: () => void;
}) {
  const Icon = kind === "grid" ? Grid : kind === "list" ? List : LayoutGrid;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded transition"
      style={{
        backgroundColor: active ? "#FEF3C7" : "transparent",
        color: active ? "#0A0A0A" : "#525252"
      }}
      aria-label={`${kind} view`}
      title={`${kind} view`}
    >
      <Icon size={13}/>
    </button>
  );
}
