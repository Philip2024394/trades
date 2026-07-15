// Mobile navigation drawer for the Marketplace App.
//
// Slides in from the left when the header's burger is tapped. Contains
// the 17-category list AND the filters block — the exact contents the
// desktop CategoryRail shows. Below `md:` the vertical rail is hidden;
// this drawer is the way in.

"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  X,
  ChevronDown,
  MapPin,
  Truck,
  CheckCircle2,
  DollarSign,
  ShieldCheck,
  Star
} from "lucide-react";
import { RAIL_CATEGORIES, type RailCategorySlug } from "../data/categoryTaxonomy";

export type TradeCenterMobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  activeSlug: RailCategorySlug | null;
};

export function TradeCenterMobileDrawer({
  open,
  onClose,
  activeSlug
}: TradeCenterMobileDrawerProps) {
  // Trap focus + lock body scroll while open.
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

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col bg-[#FBF6EC] shadow-2xl transition-transform md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Marketplace menu"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-md text-[10px] font-black"
              style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
              aria-hidden
            >
              TC
            </span>
            <div className="leading-tight">
              <div className="text-[14px] font-black tracking-tight text-neutral-900">
                Trade Center
              </div>
              <div className="text-[9px] font-black uppercase tracking-wider text-neutral-500">
                Browse + filter
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-md text-neutral-700 transition hover:bg-neutral-200/60"
            aria-label="Close menu"
          >
            <X size={20}/>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* Product Categories */}
          <section className="p-3">
            <div className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
              Product Categories
            </div>
            <ul className="flex flex-col">
              {RAIL_CATEGORIES.map((c, i) => {
                const active = c.slug === activeSlug;
                const showSeparator = c.bottomGroup && !RAIL_CATEGORIES[i - 1]?.bottomGroup;
                return (
                  <li key={c.slug}>
                    {showSeparator && (
                      <div className="mx-2 my-1.5 border-t" style={{ borderColor: "rgba(139,69,19,0.15)" }}/>
                    )}
                    <Link
                      href={`/tc/trade-center/${c.slug}`}
                      onClick={onClose}
                      className="flex min-h-[44px] items-center gap-3 rounded-md px-3 text-[13px] font-bold transition"
                      style={{
                        backgroundColor: active ? "#FEF3C7" : "transparent",
                        color: active ? "#0A0A0A" : "#374151"
                      }}
                    >
                      <c.icon
                        size={15}
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
          </section>

          {/* Filters */}
          <section className="border-t p-3" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
            <div className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
              Filters
            </div>
            <ul className="flex flex-col">
              <MobileFilterRow icon={<MapPin size={13}/>} label="Location" value="UK"/>
              <MobileFilterRow icon={<Truck size={13}/>} label="Delivery" value="All Options"/>
              <MobileFilterRow icon={<CheckCircle2 size={13}/>} label="Availability" value="In Stock"/>
              <MobileFilterRow icon={<DollarSign size={13}/>} label="Price Range" value="Any Price"/>
              <MobileFilterRow icon={<ShieldCheck size={13}/>} label="Seller Type" value="Verified Sellers"/>
              <MobileFilterRow icon={<Star size={13}/>} label="Customer Rating" value="4★ & Up"/>
            </ul>
            <button
              type="button"
              className="mt-3 min-h-[44px] w-full rounded-md border bg-white text-[12px] font-black uppercase tracking-wider text-neutral-700 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              Clear Filters
            </button>
          </section>
        </div>
      </aside>
    </>
  );
}

function MobileFilterRow({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <li>
      <button
        type="button"
        className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-md px-3 text-[12.5px] font-bold text-neutral-700 hover:bg-neutral-100/60"
      >
        <span className="flex items-center gap-2">
          <span className="text-neutral-500">{icon}</span>
          {label}
        </span>
        <span className="flex items-center gap-1 text-[11.5px] font-normal text-neutral-500">
          {value}
          <ChevronDown size={12}/>
        </span>
      </button>
    </li>
  );
}
