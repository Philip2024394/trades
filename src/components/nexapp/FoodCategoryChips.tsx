// NEX Food Directory · category filter chip row.
// Small horizontally-scrollable row of category chips including "All".
// Adding a new category = one row in `foodListings.FOOD_CATEGORIES` ·
// this component maps over that constant.

"use client";

import type { CSSProperties } from "react";
import { NEX } from "@/lib/nexapp/tokens";
import { FOOD_CATEGORIES, type FoodCategory } from "@/lib/nexapp/foodListings";
import { pickFoodCopy } from "./foodCopy";

export type CategoryFilter = "all" | FoodCategory;

export function FoodCategoryChips({
  active,
  onSelect,
  language,
}: {
  active: CategoryFilter;
  onSelect: (filter: CategoryFilter) => void;
  language: "en" | "id";
}) {
  const t = pickFoodCopy(language);
  return (
    <div className="nex-no-scrollbar" style={rowStyle}>
      <Chip
        active={active === "all"}
        onClick={() => onSelect("all")}
        label={t.categoryAll}
      />
      {FOOD_CATEGORIES.map((c) => (
        <Chip
          key={c.slug}
          active={active === c.slug}
          onClick={() => onSelect(c.slug)}
          label={`${c.emoji} ${language === "id" ? c.labelId : c.labelEn}`}
        />
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={chipStyle(active)}
    >
      {label}
    </button>
  );
}

const rowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  overflowX: "auto",
  paddingBottom: 4,
  paddingRight: 4,
  scrollSnapType: "x proximity",
};

function chipStyle(active: boolean): CSSProperties {
  return {
    flex: "0 0 auto",
    background: active ? NEX.orange as string : "rgba(255,255,255,0.04)",
    color: active ? "#0a0a0a" : "rgba(255,255,255,0.75)",
    border: active
      ? "none"
      : `1px solid rgba(255,255,255,0.10)`,
    borderRadius: 999,
    padding: "8px 14px",
    fontSize: 12.5,
    fontWeight: active ? 700 : 500,
    letterSpacing: -0.1,
    cursor: "pointer",
    scrollSnapAlign: "start",
    transition: "background 140ms ease, color 140ms ease, border-color 140ms ease",
    whiteSpace: "nowrap",
  };
}
