// src/components/nexapp/DirectoryPanel.tsx
//
// NEX Directory Panel · shell for the CategoryConstellation experience.
//
// Country Foundation Step 7 Part B · Phase 7B.2 (2026-08-23) · REWRITTEN.
// The old vertical CategoryWheel + legacy CATEGORIES array is GONE. The panel
// now renders the Registry-driven CategoryConstellation, which handles the
// discovery view AND the in-panel focused conversation view internally.
//
// Doctrine anchors:
//   project_nex_category_wheel_experience_doctrine_2026_08_22 (Step 7 Part B · Direction A)
//   project_nex_country_foundation_phased_plan_2026_08_22 (Step 7)
//   project_nex_truth_invariant_2026_08_22
//   project_nex_should_know_not_ask_2026_08_21 (minimal · no country picker)

"use client";

import type { CSSProperties } from "react";
import { NEX } from "@/lib/nexapp/tokens";
import { CategoryConstellation } from "./CategoryConstellation";
import type { NexState } from "@/lib/nexapp/nex-state";

export function DirectoryPanel({
  activeCategorySlug,
  onSelectCategory,
  onClose,
  language,
  userCountry,
  nexState,
  recognizedCategoryId,
}: {
  activeCategorySlug: string | null;
  onSelectCategory: (slug: string | null) => void;
  onClose: () => void;
  language: "en" | "id";
  /** ISO 3166-1 alpha-2 · Four-Country doctrine · usually identity.countryCode. */
  userCountry: string;
  /** NEX ambient state · constellation breathes with the surrounding NEX energy. */
  nexState: NexState;
  /** OPTIONAL · Brain-derived recognized category id · null in Phase 7B.2 · wired later. */
  recognizedCategoryId?: string | null;
}) {
  // Panel remains minimal per Philip 2026-08-21 · DISCOVER title above the
  // constellation · no close-X (the NEX corner returns you to conversation).
  return (
    <div style={rootStyle}>
      <div style={titleStyle}>DISCOVER</div>

      <CategoryConstellation
        userCountry={userCountry}
        nexState={nexState}
        activeCategorySlug={activeCategorySlug}
        onSelectCategory={onSelectCategory}
        recognizedCategoryId={recognizedCategoryId ?? null}
      />
    </div>
  );
}

// ─── Styles ───

const rootStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  justifyContent: "flex-start",
  gap: 8,
  padding: "10px 8px 8px",
  overflow: "hidden",
};

// DISCOVER title · minimal orange kicker between corner buttons + constellation.
const titleStyle: CSSProperties = {
  color: NEX.orange,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 2.5,
  textAlign: "center",
  padding: "2px 60px 2px",
  lineHeight: 1,
};
