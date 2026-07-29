// SearchBar — 48px-min touch target · filter · QR · view-toggle row.
// Purely presentational — controlled by the parent.

"use client";

import { Search, ChevronDown, ChevronRight, Filter, QrCode, List } from "lucide-react";
import { MT } from "../_tokens";

export function SearchBar({
  value,
  onChange,
  onFilterClick,
  onQrClick,
  onViewToggle,
  filterCount = 0,
  placeholder = "Search board no...",
}: {
  value: string;
  onChange: (v: string) => void;
  onFilterClick?: () => void;
  onQrClick?: () => void;
  onViewToggle?: () => void;
  filterCount?: number;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4">
      {/* Filters button */}
      <button
        type="button"
        onClick={onFilterClick}
        className="inline-flex h-12 items-center gap-1.5 px-3 text-[13px] font-semibold transition-transform active:scale-95"
        style={{ background: MT.card, border: `1px solid ${MT.border}`, color: MT.darkGrey, borderRadius: MT.radiusMd }}
      >
        <Filter size={16} strokeWidth={2} style={{ color: MT.secondaryGrey }} />
        <span>Filters</span>
        {filterCount > 0 && (
          <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: MT.primary, lineHeight: 1 }}>
            {filterCount}
          </span>
        )}
        <ChevronDown size={14} strokeWidth={2} style={{ color: MT.secondaryGrey }} />
      </button>

      {/* Search input */}
      <div className="relative flex-1">
        <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: MT.secondaryGrey }}>
          <Search size={16} strokeWidth={2} />
        </span>
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-12 w-full pl-10 pr-9 text-[13.5px] outline-none focus:ring-2"
          style={{ background: MT.card, border: `1px solid ${MT.border}`, color: MT.darkGrey, borderRadius: MT.radiusMd }}
        />
        <ChevronRight size={16} strokeWidth={2} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: MT.secondaryGrey }} />
      </div>

      {/* QR scan */}
      <button
        type="button"
        onClick={onQrClick}
        aria-label="Scan QR"
        className="grid h-12 w-12 place-items-center transition-transform active:scale-95"
        style={{ background: MT.card, border: `1px solid ${MT.border}`, borderRadius: MT.radiusMd, color: MT.darkGrey }}
      >
        <QrCode size={20} strokeWidth={1.9} />
      </button>

      {/* View toggle */}
      <button
        type="button"
        onClick={onViewToggle}
        aria-label="Toggle view"
        className="grid h-12 w-12 place-items-center transition-transform active:scale-95"
        style={{ background: MT.primary, color: "#FFFFFF", borderRadius: MT.radiusMd, boxShadow: "0 6px 14px -6px rgba(245,130,32,0.55)" }}
      >
        <List size={20} strokeWidth={2} />
      </button>
    </div>
  );
}
