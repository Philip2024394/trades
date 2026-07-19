"use client";

// TradeCategoryTiles — homeowner-facing category quick-picks that
// appear above the Trade Circle grid when the directory grows past
// ~60 entries. Solves the scale problem: as trade count grows,
// homeowners want to narrow to their specific category in one tap
// (Amazon / Etsy / Yelp pattern).
//
// Tiles show plain-English names (never "Sparks" — always
// "Electricians"), a friendly Lucide icon, and a live count of
// active canteens in that trade.
//
// Behaviour:
//   - Rendered only when canteens.length >= AUTO_TILES_THRESHOLD OR
//     ?tiles=1 preview override present
//   - Tap → sets tradeFilter to the tile's slug (grid updates)
//   - Active tile pulled up + coloured; "See all" resets the filter
//   - Top 12 by count; if more categories exist, "See all N trades"
//     link expands full taxonomy

import {
  Hammer, Zap, Droplets, Home as HomeIcon, Trees, Wrench,
  Paintbrush, Grid3x3, Square, Layers, Flame, Key,
  Truck, HardHat, LifeBuoy, Sparkles as SparklesIcon
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

const BRAND_YELLOW = "#FFB300";

/** Rendered only once canteen count crosses this threshold. Below
 *  the threshold the flat grid + search is enough and tiles would
 *  waste vertical real estate. Bump if the grid still reads well
 *  above this number. */
export const AUTO_TILES_THRESHOLD = 60;

/** Plain-English category labels — never trade jargon. Homeowners
 *  don't know what a "spark" is. Maps trade_slug → homeowner label. */
const CATEGORY_LABEL: Record<string, string> = {
  plumber:               "Plumbers",
  electrician:           "Electricians",
  carpenter:             "Carpenters",
  joiner:                "Joiners",
  builder:               "Builders",
  bricklayer:            "Bricklayers",
  tiler:                 "Tilers",
  plasterer:             "Plasterers",
  painter:               "Painters",
  landscaper:            "Landscapers",
  roofer:                "Roofers",
  scaffolder:            "Scaffolders",
  glazier:               "Glaziers",
  drywaller:             "Drywallers",
  "kitchen-fitter":      "Kitchen fitters",
  "bathroom-fitter":     "Bathroom fitters",
  "gas-engineer":        "Gas engineers",
  "heating-engineer":    "Heating engineers",
  locksmith:             "Locksmiths",
  "interior-designer":   "Interior designers",
  "stone-mason":         "Stone masons",
  "tool-belts-kit":      "Tools & site kit",
  demolition:            "Demolition",
  pest:                  "Pest control",
  "solar-battery":       "Solar & battery",
  "ev-charging":         "EV charging",
  concrete:              "Concrete finishing",
  flooring:              "Flooring",
  ironmongery:           "Ironmongery",
  welfare:               "Site welfare",
  waste:                 "Skip & waste",
  "plant-hire":          "Plant hire",
  thermal:               "Thermal & insulation",
  windows:               "Windows",
  merchant:              "Builders' merchants"
};

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const CATEGORY_ICON: Record<string, Icon> = {
  plumber:               Droplets,
  electrician:           Zap,
  carpenter:             Hammer,
  joiner:                Hammer,
  builder:               HomeIcon,
  bricklayer:            HomeIcon,
  tiler:                 Grid3x3,
  plasterer:             Layers,
  painter:               Paintbrush,
  landscaper:            Trees,
  roofer:                Layers,
  scaffolder:            HardHat,
  glazier:               Square,
  drywaller:             Layers,
  "kitchen-fitter":      HomeIcon,
  "bathroom-fitter":     Droplets,
  "gas-engineer":        Flame,
  "heating-engineer":    Flame,
  locksmith:             Key,
  "interior-designer":   SparklesIcon,
  "stone-mason":         HomeIcon,
  "tool-belts-kit":      Wrench,
  "plant-hire":          Truck,
  concrete:              Layers,
  flooring:              Grid3x3,
  ironmongery:           Wrench,
  welfare:               LifeBuoy,
  waste:                 Truck,
  demolition:            HardHat,
  windows:               Square
};

function labelFor(slug: string, fallback: string): string {
  return CATEGORY_LABEL[slug] || fallback;
}

function iconFor(slug: string): Icon {
  return CATEGORY_ICON[slug] || Wrench;
}

export function TradeCategoryTiles({
  categories,
  activeSlug,
  onPick,
  totalTrades
}: {
  categories: Array<{ slug: string; label: string; count: number }>;
  activeSlug: string | null;
  onPick:     (slug: string | null) => void;
  totalTrades: number;
}) {
  // Top 12 by count for the tile grid
  const top = [...categories].sort((a, b) => b.count - a.count).slice(0, 12);
  const hasMore = categories.length > 12;

  return (
    <section className="mb-4 rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
          Popular right now
        </p>
        {activeSlug && (
          <button
            type="button"
            onClick={() => onPick(null)}
            className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500 transition hover:text-neutral-900"
          >
            Clear filter · see all {totalTrades} trades
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {top.map((cat) => {
          const Icon    = iconFor(cat.slug);
          const label   = labelFor(cat.slug, cat.label);
          const active  = activeSlug === cat.slug;
          return (
            <button
              key={cat.slug}
              type="button"
              onClick={() => onPick(active ? null : cat.slug)}
              className={
                "group flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-3 text-center transition " +
                (active ? "shadow-md" : "hover:-translate-y-0.5 hover:shadow-sm")
              }
              style={{
                borderColor:     active ? BRAND_YELLOW  : "rgba(0,0,0,0.08)",
                backgroundColor: active ? "#FFF7ED"     : "white"
              }}
              aria-pressed={active}
            >
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-full"
                style={{
                  backgroundColor: active ? BRAND_YELLOW : "rgba(255,179,0,0.12)",
                  color:           active ? "#0A0A0A"    : "#B45309"
                }}
              >
                <Icon width={16} height={16} strokeWidth={2.4}/>
              </span>
              <span className="text-[11.5px] font-black leading-tight text-neutral-900">
                {label}
              </span>
              <span className="text-[10px] font-bold text-neutral-500 tabular-nums">
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {hasMore && !activeSlug && (
        <p className="mt-3 text-center text-[11px] text-neutral-500">
          Showing top 12 of {categories.length} trades — use the search bar for anything else.
        </p>
      )}
    </section>
  );
}
