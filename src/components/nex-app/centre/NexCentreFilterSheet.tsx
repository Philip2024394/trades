"use client";

// NexCentreFilterSheet — bottom sheet with real filter controls
// for the Trade Centre masonry / list feed. Lifted state stays in
// the parent; the sheet just presents controls + emits changes.

import { useEffect } from "react";
import { X, RotateCcw, SlidersHorizontal, ShieldCheck } from "lucide-react";
import type { FeedKindLabel, CentreFilters, SortOrder } from "./NexPinterestFeed";

const T = {
  bg:           "var(--nex-cream)",
  card:         "#FFFFFF",
  primary:      "#F68A1E",
  lightOrange:  "#FFE6C7",
  text:         "#202124",
  textSoft:     "#6F7280",
  border:       "#ECECEC",
  gradient:     "linear-gradient(135deg, #F68A1E 0%, #FFB15A 100%)"
};

const CATEGORY_OPTIONS: FeedKindLabel[] = ["Products", "Suppliers", "Services", "Projects", "Deals"];

const SORT_OPTIONS: { id: SortOrder; label: string }[] = [
  { id: "relevance", label: "Best match" },
  { id: "nearest",   label: "Nearest first" },
  { id: "newest",    label: "Newest" },
  { id: "popular",   label: "Most viewed" },
  { id: "price-asc", label: "Price · low to high" },
  { id: "price-desc",label: "Price · high to low" }
];

export function NexCentreFilterSheet({
  open, filters, onChange, onReset, onClose
}: {
  open: boolean;
  filters: CentreFilters;
  onChange: (f: CentreFilters) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function toggleCategory(c: FeedKindLabel) {
    const next = new Set(filters.categories);
    if (next.has(c)) next.delete(c); else next.add(c);
    onChange({ ...filters, categories: next });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Filter Trade Centre feed"
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{
        background: "rgba(10, 8, 4, 0.45)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)"
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-t-3xl px-5 pb-8 pt-3"
        style={{
          background: T.bg,
          borderTop: `1px solid ${T.border}`,
          boxShadow: "0 -20px 60px -18px rgba(246,138,30,0.30)",
          maxHeight: "88vh",
          color: T.text
        }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: T.border }} aria-hidden />

        {/* Header */}
        <header className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <span
              className="grid h-8 w-8 place-items-center rounded-full text-white"
              style={{ background: T.gradient }}
            >
              <SlidersHorizontal size={14} strokeWidth={2.25} />
            </span>
            <h2 className="text-[15px] font-black tracking-tight" style={{ color: T.text }}>
              Filters
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold"
              style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }}
            >
              <RotateCcw size={12} strokeWidth={2} />
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-full"
              style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </header>

        <div className="overflow-y-auto pr-1" style={{ maxHeight: "72vh" }}>
          {/* Categories */}
          <Section label="Categories">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map((c) => {
                const active = filters.categories.has(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCategory(c)}
                    className="rounded-full px-3 py-1.5 text-[11.5px] font-bold transition-transform active:scale-95"
                    style={{
                      background: active ? T.gradient : T.card,
                      color: active ? "#FFFFFF" : T.text,
                      border: active ? "none" : `1px solid ${T.border}`,
                      boxShadow: active ? "0 6px 14px -6px rgba(246,138,30,0.5)" : "none"
                    }}
                    aria-pressed={active}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Distance */}
          <Section label="Distance" hint={`${filters.maxDistanceKm} km`}>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={filters.maxDistanceKm}
              onChange={(e) => onChange({ ...filters, maxDistanceKm: Number(e.target.value) })}
              className="w-full accent-[color:var(--nex-accent-500,#F68A1E)]"
              aria-label="Maximum distance in kilometres"
              style={{ accentColor: T.primary }}
            />
            <div className="mt-1 flex items-center justify-between text-[10.5px]" style={{ color: T.textSoft }}>
              <span>1 km</span><span>100 km</span>
            </div>
          </Section>

          {/* Verified only */}
          <Section label="Trust">
            <button
              type="button"
              onClick={() => onChange({ ...filters, verifiedOnly: !filters.verifiedOnly })}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-transform active:scale-[0.99]"
              style={{
                background: T.card,
                border: `1px solid ${filters.verifiedOnly ? T.primary : T.border}`,
                boxShadow: filters.verifiedOnly ? "0 6px 14px -8px rgba(246,138,30,0.35)" : "none"
              }}
              aria-pressed={filters.verifiedOnly}
            >
              <span
                className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-white"
                style={{ background: filters.verifiedOnly ? T.gradient : T.lightOrange, color: filters.verifiedOnly ? "#FFFFFF" : T.primary }}
              >
                <ShieldCheck size={16} strokeWidth={2.25} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-black" style={{ color: T.text }}>NEX Verified only</div>
                <div className="text-[11px]" style={{ color: T.textSoft }}>
                  Identity + trading history verified by NEX
                </div>
              </div>
              <span
                className="grid h-6 w-11 items-center rounded-full p-0.5"
                style={{ background: filters.verifiedOnly ? T.primary : T.border }}
                aria-hidden
              >
                <span
                  className="h-5 w-5 rounded-full bg-white transition-transform"
                  style={{ transform: filters.verifiedOnly ? "translateX(20px)" : "translateX(0)" }}
                />
              </span>
            </button>
          </Section>

          {/* Price range */}
          <Section label="Price range" hint={`£${filters.minPrice} — £${filters.maxPrice === null ? "any" : filters.maxPrice}`}>
            <div className="grid grid-cols-2 gap-2">
              <PriceInput
                label="Min"
                value={filters.minPrice}
                onChange={(v) => onChange({ ...filters, minPrice: v })}
              />
              <PriceInput
                label="Max"
                value={filters.maxPrice}
                onChange={(v) => onChange({ ...filters, maxPrice: v })}
              />
            </div>
          </Section>

          {/* Sort */}
          <Section label="Sort by">
            <div className="flex flex-col gap-1.5">
              {SORT_OPTIONS.map((s) => {
                const active = filters.sort === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onChange({ ...filters, sort: s.id })}
                    className="flex items-center justify-between rounded-2xl px-3.5 py-2.5 text-left transition-transform active:scale-[0.99]"
                    style={{
                      background: active ? T.lightOrange : T.card,
                      border: `1px solid ${active ? T.primary : T.border}`,
                      color: T.text
                    }}
                    aria-pressed={active}
                  >
                    <span className="text-[12.5px] font-bold">{s.label}</span>
                    {active && (
                      <span
                        className="grid h-5 w-5 place-items-center rounded-full text-white"
                        style={{ background: T.gradient }}
                        aria-hidden
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                          <polyline points="5 12 10 17 20 7" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Section>
        </div>

        {/* Apply CTA */}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3 text-[12.5px] font-black text-white transition-transform active:scale-[0.99]"
          style={{
            background: T.gradient,
            boxShadow: "0 12px 32px -8px rgba(246,138,30,0.55)"
          }}
        >
          Show results
        </button>
      </div>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────
function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <header className="mb-2 flex items-baseline justify-between">
        <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: T.textSoft }}>
          {label}
        </div>
        {hint && <div className="text-[11px]" style={{ color: T.text }}>{hint}</div>}
      </header>
      {children}
    </section>
  );
}

function PriceInput({
  label, value, onChange
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label
      className="flex flex-col gap-1 rounded-2xl px-3 py-2.5"
      style={{ background: T.card, border: `1px solid ${T.border}` }}
    >
      <span className="text-[9.5px] font-black uppercase tracking-widest" style={{ color: T.textSoft }}>
        {label}
      </span>
      <span className="flex items-center gap-1">
        <span className="text-[13px] font-bold" style={{ color: T.textSoft }}>£</span>
        <input
          type="number"
          min={0}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          placeholder="any"
          className="min-w-0 flex-1 bg-transparent text-[13px] font-black outline-none"
          style={{ color: T.text }}
        />
      </span>
    </label>
  );
}
