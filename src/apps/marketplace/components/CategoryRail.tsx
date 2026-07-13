// Marketplace — Category Rail + Filters block.
//
// Fixed-width vertical sidebar per mock. 17 category rows at top,
// Filters block below, Clear Filters at the bottom. Category row for
// the active slug renders with amber accent. Filters are UI-only
// scaffolds for now — real filtering wired in a follow-up.

"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, MapPin, Truck, CheckCircle2, DollarSign, ShieldCheck, Star, LayoutGrid } from "lucide-react";
import { RAIL_CATEGORIES, type RailCategorySlug } from "../data/categoryTaxonomy";

export type CategoryRailProps = {
  activeSlug: RailCategorySlug | null;
};

export function CategoryRail({ activeSlug }: CategoryRailProps) {
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(true);

  return (
    <aside
      className="hidden w-[220px] flex-shrink-0 flex-col gap-4 border-r py-4 md:flex"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
      aria-label="Marketplace category rail"
    >
      {/* Product Categories block */}
      <section>
        <button
          type="button"
          onClick={() => setCategoriesOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-700"
        >
          Product Categories
          {categoriesOpen ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
        </button>
        {categoriesOpen && (
          <ul className="mt-1 flex flex-col">
            {/* "All Products" sits above the taxonomy — landing default. */}
            <li>
              <Link
                href="/tc/trade-center"
                className="mx-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-bold transition"
                style={{
                  backgroundColor: activeSlug === null ? "#FEF3C7" : "transparent",
                  color: activeSlug === null ? "#0A0A0A" : "#374151"
                }}
              >
                <LayoutGrid
                  size={13}
                  strokeWidth={1.9}
                  className="flex-shrink-0"
                  style={{ color: activeSlug === null ? "#0A0A0A" : "#6B7280" }}
                  aria-hidden
                />
                <span className="truncate">All Products</span>
              </Link>
              <div className="mx-3 my-1 border-t" style={{ borderColor: "rgba(139,69,19,0.15)" }}/>
            </li>
            {RAIL_CATEGORIES.map((c, i) => {
              const active = c.slug === activeSlug;
              const showSeparator = c.bottomGroup && !RAIL_CATEGORIES[i - 1]?.bottomGroup;
              return (
                <li key={c.slug}>
                  {showSeparator && (
                    <div className="mx-3 my-1 border-t" style={{ borderColor: "rgba(139,69,19,0.15)" }}/>
                  )}
                  <Link
                    href={`/tc/trade-center/${c.slug}`}
                    className="mx-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-bold transition"
                    style={{
                      backgroundColor: active ? "#FEF3C7" : "transparent",
                      color: active ? "#0A0A0A" : "#374151"
                    }}
                  >
                    <c.icon
                      size={13}
                      strokeWidth={1.9}
                      className="flex-shrink-0"
                      style={{ color: active ? "#0A0A0A" : "#6B7280" }}
                      aria-hidden
                    />
                    <span className="truncate">{c.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Filters block */}
      <section>
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-700"
        >
          Filters
          {filtersOpen ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
        </button>
        {filtersOpen && (
          <ul className="mt-1 flex flex-col">
            <FilterRow icon={<MapPin size={12}/>} label="Location" value="UK"/>
            <FilterRow icon={<Truck size={12}/>} label="Delivery" value="All Options"/>
            <FilterRow icon={<CheckCircle2 size={12}/>} label="Availability" value="In Stock"/>
            <FilterRow icon={<DollarSign size={12}/>} label="Price Range" value="Any Price"/>
            <FilterRow icon={<ShieldCheck size={12}/>} label="Seller Type" value="Verified Sellers"/>
            <FilterRow icon={<Star size={12}/>} label="Customer Rating" value="4★ & Up"/>
          </ul>
        )}
      </section>

      {/* Clear filters */}
      <div className="px-3">
        <button
          type="button"
          className="w-full rounded-md border bg-white py-1.5 text-[11px] font-black uppercase tracking-wider text-neutral-700 shadow-sm transition hover:bg-neutral-50"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          Clear Filters
        </button>
      </div>
    </aside>
  );
}

function FilterRow({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <li className="mx-1 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[11.5px] transition hover:bg-neutral-100/50">
      <span className="flex items-center gap-1.5 font-bold text-neutral-700">
        <span className="text-neutral-500">{icon}</span>
        {label}
      </span>
      <span className="flex items-center gap-1 text-[11px] text-neutral-500">
        {value}
        <ChevronDown size={10}/>
      </span>
    </li>
  );
}
