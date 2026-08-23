// NEX Food Directory — Phase 1 visual orchestrator.
//
// Renders inside the conversation frame when the DIRECTORY corner's
// wheel selects Food. Per pinned Four Corners Functional Model, this
// is a STATE inside the chat area · NOT a separate route.
//
// Phase 1 (this file family):
//   · FOOD · YOGYAKARTA header
//   · natural-language search bar (client-side substring filter for V1)
//   · category chip filter row (All + 4 categories)
//   · mock listings feed (all categories mixed, filtered by chip + search)
//   · tap card → slides in FoodListingDetail (with menu if claimed)
//   · back arrow → returns to feed
//
// Deferred to Priority 4+ per pinned doctrine:
//   · real backend / Universal Listings Engine wiring
//   · real geo-distance / open-now / natural-language brain routing
//   · owner-claim flow, invitation-via-WhatsApp, dashboards
//   · real image upload

"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { NEX } from "@/lib/nexapp/tokens";
import { type FoodListing } from "@/lib/nexapp/foodListings";
import { useFoodListings } from "@/lib/nexapp/foodListingsRemote";
import { pickFoodCopy } from "./foodCopy";
import { FoodCategoryChips, type CategoryFilter } from "./FoodCategoryChips";
import { FoodSearchBar } from "./FoodSearchBar";
import { FoodListingCard } from "./FoodListingCard";
import { FoodListingDetail } from "./FoodListingDetail";

export function FoodDirectoryPanel({
  language,
  onClose,
}: {
  language: "en" | "id";
  onClose: () => void;
}) {
  const t = pickFoodCopy(language);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // `onClose` reserved for a future explicit-close affordance; today the
  // Food panel is dismissed by tapping the NEX corner (which returns to
  // the conversation) or by tapping Directory again (which reopens the
  // wheel). Silence the unused-var warning.
  void onClose;

  // Live listings from nex.food_business (Phase 4) · falls back to mock
  // data if the API is unreachable so UI always renders.
  const { listings, attribution, source } = useFoodListings();

  const filtered = useMemo<FoodListing[]>(() => {
    const q = query.trim().toLowerCase();
    return listings.filter((l) => {
      if (category !== "all" && l.category !== category) return false;
      if (!q) return true;
      const hay =
        l.name.toLowerCase() + " " +
        (l.description ?? "").toLowerCase() + " " +
        l.district.toLowerCase() + " " +
        l.category.toLowerCase();
      return hay.includes(q);
    });
  }, [listings, category, query]);

  const selectedListing = useMemo(
    () => (selectedId ? listings.find((l) => l.id === selectedId) : null),
    [listings, selectedId]
  );

  // ── Detail view · slides over the list ──
  if (selectedListing) {
    return (
      <div style={rootStyle}>
        <FoodListingDetail
          listing={selectedListing}
          onBack={() => setSelectedId(null)}
          language={language}
        />
      </div>
    );
  }

  // ── List view ──
  return (
    <div style={rootStyle}>
      <div style={titleStyle}>{t.headerCityLabel}</div>

      <div style={topControlsStyle}>
        <FoodSearchBar
          value={query}
          onChange={setQuery}
          onClear={() => setQuery("")}
          language={language}
        />
        <FoodCategoryChips
          active={category}
          onSelect={setCategory}
          language={language}
        />
      </div>

      <div className="nex-no-scrollbar" style={feedStyle}>
        {filtered.length === 0 ? (
          <div style={emptyWrapStyle}>
            <div style={emptyTitleStyle}>{t.emptyResultsTitle}</div>
            <div style={emptyHintStyle}>{t.emptyResultsHint}</div>
          </div>
        ) : (
          <>
            {filtered.map((l) => (
              <FoodListingCard
                key={l.id}
                listing={l}
                onTap={() => setSelectedId(l.id)}
                language={language}
              />
            ))}
            {source === "live" && attribution && (
              <div style={attributionStyle}>{attribution}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  position: "relative",
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "10px 8px 8px",
  overflow: "hidden",
};

const titleStyle: CSSProperties = {
  color: NEX.orange,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 2.5,
  textAlign: "center",
  padding: "2px 60px 4px",
  lineHeight: 1,
};

const topControlsStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "0 2px",
};

const feedStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  paddingRight: 2,
  paddingTop: 2,
};

const emptyWrapStyle: CSSProperties = {
  padding: "20px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  textAlign: "center",
};

const emptyTitleStyle: CSSProperties = {
  color: NEX.text,
  fontSize: 14,
  fontWeight: 600,
};

const emptyHintStyle: CSSProperties = {
  color: "rgba(255,255,255,0.55)",
  fontSize: 12,
  lineHeight: 1.5,
};

const attributionStyle: CSSProperties = {
  color: "rgba(255,255,255,0.35)",
  fontSize: 10,
  textAlign: "center",
  padding: "12px 4px 8px",
  letterSpacing: 0.2,
};
