// NEX Directory landscape cards · 2026-08-23.
// Doctrine: project_nex_communication_hub_final_direction_2026_08_23 ·
// "Discovery Drawer · directory landscape cards".
//
// Rendered inside NexSideDrawer when Discovery satellite is tapped.
// One horizontal card per active directory vertical NEX supports.
// Tapping a card navigates to the existing static directory route
// (which handles its own country-scoped listing under the hood).
//
// Directory Factory · Phase 0 refactor (2026-08-23) · Item 4b of
// docs/nex/directory-factory-phase-0-plan.md.
// The card list is now sourced from the canonical Category Registry
// (via getCategory + activeCategoriesForCountry) instead of a local
// hardcoded array. That satisfies Doctrine Decision #4 ("wheel must
// consume ONLY the canonical registry"). Display order + description
// text remain colocated here because Registry sort_order + description
// fields are deferred to Phase 1 (D8 + D9).
//
// Byte-invariance (Phase 0 Item 8): the rendered card list is
// identical to the previous hardcoded version — same 6 cards, same
// order (food · accommodation · hotel · kos · hostel · guesthouse),
// same visuals. If Registry deactivates a listed category, it
// disappears from the drawer safely.
//
// Truth Invariant: only categories the app actually supports appear
// here — Registry `active=true` is the guard.

"use client";

import { useRouter } from "next/navigation";
import { NEX } from "@/lib/nexapp/tokens";
import {
  activeCategoriesForCountry,
  getCategory,
  type CategoryEntry,
} from "@/lib/nex/category-registry";

// Display order + inline description live here in Phase 0 (Registry
// sort_order + description fields deferred to Phase 1 per D8 + D9).
// The DISPLAY_ORDER array is a whitelist AND an ordering. Categories
// not listed here (e.g. villa · homestay · resort · apartment · trade
// thin rows) don't appear even if they become active.
const DISPLAY_ORDER: readonly string[] = [
  "food",
  "accommodation",
  "hotel",
  "kos",
  "hostel",
  "guesthouse",
];

const DESCRIPTIONS: Record<string, string> = {
  food:          "Restaurants · warungs · cafés · street food",
  accommodation: "All stays · hotels · guesthouses · homestays",
  hotel:         "Premium and budget hotels",
  kos:           "Monthly rentals for locals + travellers",
  hostel:        "Backpacker-friendly stays",
  guesthouse:    "Homely small stays",
};

// Card initial uses the second letter for hostel ("Ho") to
// disambiguate from hotel ("H"). Otherwise: first letter uppercased.
const INITIAL_OVERRIDES: Record<string, string> = {
  hostel: "Ho",
};

function cardInitial(entry: CategoryEntry): string {
  return INITIAL_OVERRIDES[entry.id] ?? entry.displayName.en.charAt(0).toUpperCase();
}

/** Returns the ordered, active card list sourced from the Registry.
 *  Exported for testability + potential reuse. */
export function getDirectoryCardsForCountry(country: string): CategoryEntry[] {
  const activeSet = new Set(
    activeCategoriesForCountry(country).map((c) => c.id),
  );
  const cards: CategoryEntry[] = [];
  for (const id of DISPLAY_ORDER) {
    if (!activeSet.has(id)) continue;
    const entry = getCategory(id);
    if (entry) cards.push(entry);
  }
  return cards;
}

export function NexDirectoryCards({
  onNavigate,
  country = "ID",
}: {
  onNavigate?: () => void;
  country?: string;
}) {
  const router = useRouter();
  const cards = getDirectoryCardsForCountry(country);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {cards.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => {
            onNavigate?.();
            router.push(cat.route);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            background: NEX.bgSurface,
            border: `1px solid ${NEX.borderMuted}`,
            borderRadius: 14,
            color: NEX.text,
            textAlign: "left",
            cursor: "pointer",
            width: "100%",
            transition: "background 180ms ease, border-color 180ms ease, transform 180ms ease",
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              minWidth: 46,
              borderRadius: 12,
              background: `linear-gradient(180deg, rgba(249,115,22,0.18) 0%, rgba(249,115,22,0.06) 100%)`,
              border: `1px solid rgba(249, 115, 22, 0.35)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: NEX.orange,
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: 0.3,
            }}
            aria-hidden
          >
            {cardInitial(cat)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 2,
                color: NEX.text,
                letterSpacing: -0.1,
              }}
            >
              {cat.id === "food"
                ? "Food"
                : cat.id === "accommodation"
                ? "Accommodation"
                : cat.id === "hotel"
                ? "Hotels"
                : cat.id === "kos"
                ? "Kos"
                : cat.id === "hostel"
                ? "Hostels"
                : cat.id === "guesthouse"
                ? "Guesthouses"
                : cat.displayName.en}
            </div>
            <div
              style={{
                fontSize: 11,
                color: NEX.textMuted,
                lineHeight: 1.35,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {DESCRIPTIONS[cat.id] ?? cat.displayName.en}
            </div>
          </div>
          <div style={{ color: NEX.textFaint, fontSize: 14, lineHeight: 1 }} aria-hidden>
            ›
          </div>
        </button>
      ))}
    </div>
  );
}
