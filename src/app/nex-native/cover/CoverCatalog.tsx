"use client";

// src/app/nex-native/cover/CoverCatalog.tsx
//
// Category Tabs · sealed 2026-09-30
// -----------------------------------------------------------------------------
// Drop-in replacement for <CoverProductGrid> that renders the shop's
// one-word category tabs above a filtered grid.
//
// Doctrine (see category_tabs_doctrine_2026_09_30.md):
//   · 0-1 sections  → tab bar hidden (tabs primitive returns null)
//   · 2-3 sections  → "All" + up to 3 tabs, underline on active
//   · 4+ sections   → "All" + first 3 by sort_order (legacy menu sections)
//   · Uncategorised (section_id === null) → visible under "All" only
//
// This component owns the useState for the active tab. Layouts wire
// it in where CoverProductGrid used to sit.

import * as React from "react";
import {
  ALL_TAB_ID,
  CoverCategoryTabs,
  CoverProductGrid,
  type CoverProduct,
  type CoverSection,
} from "./primitives";

export function CoverCatalog({
  sections,
  products,
  peerAccountId,
  columns = 2,
  limit,
}: {
  sections: CoverSection[];
  products: CoverProduct[];
  peerAccountId: string;
  columns?: 1 | 2 | 3;
  /**
   * Optional cap on visible cards after filtering. Useful for hero cuts
   * like "Featured today". Omit to show every match.
   */
  limit?: number;
}): React.JSX.Element {
  const [activeId, setActiveId] = React.useState<string>(ALL_TAB_ID);

  const filtered =
    activeId === ALL_TAB_ID
      ? products
      : products.filter((p) => p.section_id === activeId);
  const visible = typeof limit === "number" ? filtered.slice(0, limit) : filtered;

  return (
    <div>
      <CoverCategoryTabs
        sections={sections}
        activeId={activeId}
        onSelect={setActiveId}
      />
      <CoverProductGrid
        products={visible}
        peerAccountId={peerAccountId}
        columns={columns}
        activeSectionId={ALL_TAB_ID}
      />
    </div>
  );
}
