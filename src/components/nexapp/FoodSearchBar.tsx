// NEX Food Directory · natural-language search bar.
//
// V1: reads like a natural-language search (placeholder shows examples
// like "coffee near Malioboro") but the underlying filter is a simple
// case-insensitive substring match against listing name + description +
// category + district. When Priority 4+ backend lands, swap the parent
// filter function for real brain routing — this component's contract
// (value + onChange) stays the same.

"use client";

import { useRef, type CSSProperties } from "react";
import { NEX } from "@/lib/nexapp/tokens";
import { pickFoodCopy } from "./foodCopy";

export function FoodSearchBar({
  value,
  onChange,
  onClear,
  language,
}: {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
  language: "en" | "id";
}) {
  const t = pickFoodCopy(language);
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div style={wrapStyle}>
      <span aria-hidden style={searchIconStyle}>
        {/* Magnifying glass */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.searchPlaceholder}
        style={inputStyle}
        spellCheck={false}
        aria-label="Search food and cafés"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => { onClear(); inputRef.current?.focus(); }}
          aria-label="Clear search"
          style={clearBtnStyle}
        >
          ×
        </button>
      )}
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(255,255,255,0.04)",
  border: `1px solid rgba(255,255,255,0.10)`,
  borderRadius: 999,
  padding: "8px 12px 8px 14px",
};

const searchIconStyle: CSSProperties = {
  color: "rgba(255,255,255,0.45)",
  display: "flex",
  alignItems: "center",
  flex: "0 0 auto",
};

const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: "transparent",
  border: "none",
  outline: "none",
  color: NEX.text,
  fontSize: 13,
  padding: "4px 0",
};

const clearBtnStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "rgba(255,255,255,0.55)",
  fontSize: 18,
  lineHeight: 1,
  cursor: "pointer",
  padding: "0 2px",
  flex: "0 0 auto",
};
