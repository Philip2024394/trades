"use client";

// src/app/nex-native/cover/CoverCatalog.tsx
//
// Category Tabs + Pagination · sealed 2026-09-30 · updated 2026-09-30.
// -----------------------------------------------------------------------------
// Drop-in replacement for <CoverProductGrid> that renders the shop's
// one-word category tabs above a filtered, paginated grid.
//
// Doctrine (see category_tabs_doctrine_2026_09_30.md):
//   · 0-1 sections  → tab bar hidden (tabs primitive returns null)
//   · 2-3 sections  → up to 3 tabs · NO "All" tab · FIRST tab is
//     highlighted on arrival (founder direction 2026-09-30) · tap
//     the highlighted tab to clear the filter (shows every product)
//   · Uncategorised (section_id === null) → visible when no tab active
//
// Pagination (founder direction 2026-09-30):
//   · pageSize defaults to 4 cards per page
//   · Controls beneath the grid: [← prev] [1] [2] [3] [next →]
//   · Auto-hidden when the filtered result fits on one page
//   · Changing the active tab resets to page 1

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
  pageSize = 4,
}: {
  sections: CoverSection[];
  products: CoverProduct[];
  peerAccountId: string;
  columns?: 1 | 2 | 3;
  /** Cards per page in the paginated grid. Default 4 per founder
   *  ruling 2026-09-30. */
  pageSize?: number;
}): React.JSX.Element {
  // Founder direction 2026-09-30 · FIRST tab active on arrival · not
  // empty. Buyer lands filtered to the seller's first category, sees
  // its underline, taps it again (toggle) if they want to see all.
  const firstSectionId = React.useMemo(() => {
    if (sections.length === 0) return "";
    const ordered = [...sections].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
    return ordered[0].id;
  }, [sections]);
  const [activeId, setActiveId] = React.useState<string>(firstSectionId);
  const [page, setPage] = React.useState(0);

  // Reset to page 1 whenever the filter changes.
  React.useEffect(() => {
    setPage(0);
  }, [activeId]);

  const filtered = React.useMemo(() => {
    if (activeId === "" || activeId === ALL_TAB_ID) return products;
    return products.filter((p) => p.section_id === activeId);
  }, [activeId, products]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  const handleTabSelect = React.useCallback(
    (nextId: string) => {
      // Toggle: tapping the highlighted tab clears the filter so the
      // buyer can see every product without needing an "All" tab.
      setActiveId((prev) => (prev === nextId ? "" : nextId));
    },
    [],
  );

  return (
    <div>
      <CoverCategoryTabs
        sections={sections}
        activeId={activeId}
        onSelect={handleTabSelect}
      />
      <CoverProductGrid
        products={visible}
        peerAccountId={peerAccountId}
        columns={columns}
        activeSectionId={ALL_TAB_ID}
      />
      {totalPages > 1 && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          onSelect={setPage}
        />
      )}
    </div>
  );
}

// ─── Pagination controls · themed via CSS vars ──────────────────────

function Pagination({
  page,
  totalPages,
  onSelect,
}: {
  page: number;
  totalPages: number;
  onSelect: (page: number) => void;
}) {
  const canPrev = page > 0;
  const canNext = page < totalPages - 1;
  const pages = React.useMemo(
    () => Array.from({ length: totalPages }, (_, i) => i),
    [totalPages],
  );

  return (
    <div
      role="navigation"
      aria-label="Product pages"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        marginTop: 18,
        flexWrap: "wrap",
      }}
    >
      <PageArrow
        direction="prev"
        disabled={!canPrev}
        onClick={() => canPrev && onSelect(page - 1)}
      />
      {pages.map((p) => {
        const isActive = p === page;
        return (
          <button
            key={p}
            type="button"
            aria-label={`Page ${p + 1}`}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onSelect(p)}
            style={{
              appearance: "none",
              minWidth: 32,
              height: 32,
              padding: "0 10px",
              borderRadius: 10,
              // Founder direction 2026-09-30 · borders removed from
              // every pagination button · reads as pure text pills.
              border: "none",
              background: isActive
                ? "var(--nex-accent, #06b6d4)"
                : "transparent",
              color: isActive
                ? "#03101D"
                : "var(--nex-text-dim, rgba(148,163,184,0.9))",
              fontFamily: "var(--nex-font-body, inherit)",
              fontSize: 13,
              fontWeight: isActive ? 800 : 600,
              cursor: "pointer",
              transition: "background 140ms ease, color 140ms ease",
            }}
          >
            {p + 1}
          </button>
        );
      })}
      <PageArrow
        direction="next"
        disabled={!canNext}
        onClick={() => canNext && onSelect(page + 1)}
      />
    </div>
  );
}

function PageArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  // Founder direction 2026-09-30 · arrow chevrons render in solid black
  // so they stand off the accent-tinted pagination row · matches the
  // higher-contrast affordance the founder wants for the prev/next
  // controls (numbered pills stay accent-coloured for the active state).
  return (
    <button
      type="button"
      aria-label={direction === "prev" ? "Previous page" : "Next page"}
      onClick={onClick}
      disabled={disabled}
      style={{
        appearance: "none",
        width: 32,
        height: 32,
        borderRadius: 10,
        border: "none",
        background: "transparent",
        color: "#000000",
        fontFamily: "var(--nex-font-body, inherit)",
        fontSize: 18,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.35 : 1,
        display: "grid",
        placeItems: "center",
        transition: "opacity 140ms ease",
      }}
    >
      {direction === "prev" ? "‹" : "›"}
    </button>
  );
}
