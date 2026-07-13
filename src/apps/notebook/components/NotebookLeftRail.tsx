// Left sub-nav rail for the Notebook workspace.
//
// Facebook / Gmail / Amazon Business pattern. Category tree + status
// counts + section links (Offers / Bulk quotes / Templates / Trending).
// Scales to 500+ items — every category shows its own count so trades
// can drill straight to what they need.

"use client";

import Link from "next/link";
import {
  Notebook as NotebookIcon,
  ShoppingBag,
  Tag,
  Receipt,
  FileText,
  Radio,
  Package,
  Hammer,
  ShieldAlert,
  Repeat,
  Layers,
  ChevronRight,
  ChevronDown
} from "lucide-react";
import { useState } from "react";

export type NotebookSection =
  | "regulars"
  | "past-orders"
  | "offers"
  | "quotes"
  | "substitutes"
  | "templates"
  | "trending";

type Props = {
  active: NotebookSection;
  onSelect: (s: NotebookSection) => void;
  counts: {
    regulars: number;
    regularsLow: number;
    regularsOut: number;
    pastOrders: number;
    offers: number;
    quotes: number;
    templates: number;
  };
  activeCategory: string | null;
  onCategoryChange: (c: string | null) => void;
  categoryCounts: Record<string, number>;
};

const SECTIONS: Array<{
  key: NotebookSection;
  label: string;
  Icon: typeof NotebookIcon;
  countKey: keyof Props["counts"];
}> = [
  { key: "regulars",    label: "My Regulars",   Icon: NotebookIcon, countKey: "regulars"   },
  { key: "past-orders", label: "Past Orders",   Icon: ShoppingBag,  countKey: "pastOrders" },
  { key: "offers",      label: "Offers",        Icon: Tag,          countKey: "offers"     },
  { key: "quotes",      label: "Bulk Quotes",   Icon: Receipt,      countKey: "quotes"     },
  { key: "substitutes", label: "Substitutes",   Icon: Repeat,       countKey: "regulars"   },
  { key: "templates",   label: "Job Templates", Icon: FileText,     countKey: "templates"  },
  { key: "trending",    label: "Trending",      Icon: Radio,        countKey: "regulars"   }
];

const CATEGORY_ICONS: Record<string, typeof Package> = {
  plastering: Layers,
  drywall:    Layers,
  tools:      Hammer,
  materials:  Package,
  fixings:    ShieldAlert
};

export function NotebookLeftRail({
  active,
  onSelect,
  counts,
  activeCategory,
  onCategoryChange,
  categoryCounts
}: Props) {
  const [regularsOpen, setRegularsOpen] = useState(true);
  const categories = Object.keys(categoryCounts).sort();

  return (
    <aside
      className="flex flex-col gap-3 rounded-xl border bg-white p-3 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      {/* Section links */}
      <ul className="flex flex-col gap-0.5">
        {SECTIONS.map((s) => {
          const isRegulars = s.key === "regulars";
          const isActive = active === s.key;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => {
                  onSelect(s.key);
                  if (isRegulars) setRegularsOpen(true);
                }}
                aria-pressed={isActive}
                className="flex min-h-[40px] w-full items-center justify-between gap-2 rounded-md px-2 text-left transition"
                style={{
                  backgroundColor: isActive ? "#0A0A0A" : "transparent",
                  color: isActive ? "#FFB300" : "#374151"
                }}
              >
                <span className="flex items-center gap-2 text-[12px] font-black">
                  <s.Icon size={13} strokeWidth={2}/>
                  {s.label}
                </span>
                <span
                  className="rounded-full px-1.5 py-0.5 text-[9.5px] font-black"
                  style={{
                    backgroundColor: isActive ? "#FFB300" : "#F5F0E4",
                    color: isActive ? "#0A0A0A" : "#525252"
                  }}
                >
                  {counts[s.countKey]}
                </span>
              </button>

              {/* Regulars sub-tree — status + categories */}
              {isRegulars && isActive && (
                <ul className="mt-1.5 flex flex-col gap-0.5 pl-2">
                  {/* Status filters */}
                  <li>
                    <button
                      type="button"
                      onClick={() => setRegularsOpen((o) => !o)}
                      className="flex w-full items-center gap-1 rounded px-2 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:bg-neutral-50"
                    >
                      {regularsOpen ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}
                      By status
                    </button>
                    {regularsOpen && (
                      <ul className="mt-0.5 flex flex-col gap-0.5 pl-3">
                        <StatusRow label="All items"     value={counts.regulars}    active={activeCategory === null}    onSelect={() => onCategoryChange(null)}/>
                        <StatusRow label="Running low"    value={counts.regularsLow} colour="#B45309"                    onSelect={() => onCategoryChange("__low")} active={activeCategory === "__low"}/>
                        <StatusRow label="Out of stock"   value={counts.regularsOut} colour="#B91C1C"                    onSelect={() => onCategoryChange("__out")} active={activeCategory === "__out"}/>
                      </ul>
                    )}
                  </li>

                  {/* Category tree */}
                  {categories.length > 0 && (
                    <li className="mt-1.5">
                      <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-500">
                        By category
                      </div>
                      <ul className="mt-0.5 flex flex-col gap-0.5 pl-3">
                        {categories.map((c) => {
                          const Icon = CATEGORY_ICONS[c] ?? Package;
                          const isCatActive = activeCategory === c;
                          return (
                            <li key={c}>
                              <button
                                type="button"
                                onClick={() => onCategoryChange(isCatActive ? null : c)}
                                aria-pressed={isCatActive}
                                className="flex min-h-[32px] w-full items-center justify-between gap-1.5 rounded px-2 text-left transition"
                                style={{
                                  backgroundColor: isCatActive ? "#FEF3C7" : "transparent",
                                  color: "#0A0A0A"
                                }}
                              >
                                <span className="flex items-center gap-1.5 text-[11px] font-bold capitalize">
                                  <Icon size={10} className="text-neutral-500"/>
                                  {c.replace("-", " ")}
                                </span>
                                <span className="text-[9.5px] font-black text-neutral-500">
                                  {categoryCounts[c]}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {/* Footer — add item CTA */}
      <div className="mt-2 border-t pt-3" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
        <Link
          href="/tc/trade-center/plastering"
          className="flex min-h-[40px] items-center justify-center gap-1 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider shadow-sm"
          style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
        >
          + Add item
        </Link>
      </div>
    </aside>
  );
}

function StatusRow({
  label,
  value,
  active,
  onSelect,
  colour
}: {
  label: string;
  value: number;
  active?: boolean;
  onSelect: () => void;
  colour?: string;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className="flex min-h-[32px] w-full items-center justify-between gap-2 rounded px-2 text-left transition"
        style={{
          backgroundColor: active ? "#FEF3C7" : "transparent",
          color: "#0A0A0A"
        }}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-bold">
          {colour && (
            <span
              className="h-2 w-2 flex-shrink-0 rounded-full"
              style={{ backgroundColor: colour }}
              aria-hidden
            />
          )}
          {label}
        </span>
        <span className="text-[9.5px] font-black text-neutral-500">{value}</span>
      </button>
    </li>
  );
}
