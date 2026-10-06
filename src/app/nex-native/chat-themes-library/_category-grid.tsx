// src/app/nex-native/chat-themes-library/_category-grid.tsx
//
// Category Landing Grid · Step 1B (sealed 2026-10-06).
//
// Renders one tile per registered category. The LANDING level of the
// Theme Library. Tapping a tile navigates to the showcase route for
// that category:
//
//   /nex-native/chat-themes-library/category/[categoryId]
//
// Load-bearing architectural rules:
//
//   · This component is DATA-DRIVEN · it iterates
//     `listCategories()` and renders a uniform tile for every entry.
//     Zero per-category UI branches · no `if cat.id === "ocean"`.
//     Adding a new category to the registry automatically produces a
//     new tile here with no code change.
//   · Zero-member categories are HIDDEN from the landing · users
//     should not navigate into an empty room. The showcase route
//     still handles zero-member categories gracefully for deep-link
//     correctness (tested).
//   · The Explore collection is a general / uncategorised bucket ·
//     presented as a tile but NEVER described as a visual family.
//     The tile description + the showcase header both lean on
//     EXPLORE_CATEGORY_ID so a future rename of the display name
//     ripples automatically.
//   · The tile is a server-rendered <Link> · no client JS needed to
//     navigate. The Library's existing CSS variables / fonts carry
//     through from the parent `page.tsx`.

import * as React from "react";
import Link from "next/link";
import {
  EXPLORE_CATEGORY_ID,
  listCategories,
} from "@/lib/nex-native/theme-category/registry";
import type { ThemeCategory } from "@/lib/nex-native/theme-category/types";

const NEX = {
  bg: "#020914",
  cyan: "#00AFFF",
  orange: "#FF7800",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
};

export interface CategoryGridProps {
  /** The merged theme collection · one BrowserThemeRow per theme
   *  across code-registered live-worlds + DB themes. Used only to
   *  compute member counts per category. The grid does not render
   *  the themes themselves · the showcase route does. */
  memberCounts: Readonly<Record<string, number>>;
}

export function CategoryGrid({
  memberCounts,
}: CategoryGridProps): React.JSX.Element {
  // Universal rule · iterate the registry · one tile per entry · hide
  // categories with zero worlds. No per-category conditionals.
  const categoriesWithMembers = listCategories()
    .map((cat) => ({ category: cat, count: memberCounts[cat.id] ?? 0 }))
    .filter(({ count }) => count > 0);

  return (
    <div
      data-nex-category-grid
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 14,
        marginTop: 14,
      }}
    >
      {categoriesWithMembers.map(({ category, count }) => (
        <CategoryTile key={category.id} category={category} count={count} />
      ))}
    </div>
  );
}

/** A single category tile · universal · identical shape for every
 *  category. */
function CategoryTile({
  category,
  count,
}: {
  category: ThemeCategory;
  count: number;
}): React.JSX.Element {
  const isExplore = category.id === EXPLORE_CATEGORY_ID;
  return (
    <Link
      href={`/nex-native/chat-themes-library/category/${category.id}`}
      prefetch={false}
      data-nex-category-tile
      data-nex-category-id={category.id}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "18px 18px 16px",
        borderRadius: 14,
        background:
          "linear-gradient(165deg, rgba(16,30,52,0.75) 0%, rgba(4,10,20,0.90) 100%)",
        border: `1px solid ${isExplore ? "rgba(139,169,209,0.26)" : "rgba(0,175,255,0.28)"}`,
        color: NEX.text,
        textDecoration: "none",
        boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
        minHeight: 128,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          minWidth: 0,
        }}
      >
        {category.icon && (
          <span
            aria-hidden
            style={{
              fontSize: 28,
              lineHeight: 1,
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))",
            }}
          >
            {category.icon}
          </span>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: NEX.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {category.name}
          </div>
          <div
            data-nex-category-member-count
            style={{
              fontSize: 11,
              color: NEX.textMute,
              marginTop: 2,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {count} {count === 1 ? "world" : "worlds"}
          </div>
        </div>
      </div>
      {category.tagline && (
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: NEX.textDim,
            // Explore gets a soft disclaimer so the user understands
            // its contents are a general collection, not a visual
            // family. The copy comes from the registry so a future
            // reword stays in one place.
          }}
        >
          {category.tagline}
        </div>
      )}
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          color: isExplore ? NEX.textMute : NEX.cyan,
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        Enter →
      </div>
    </Link>
  );
}
