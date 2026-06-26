// Xrated Trades — curated trade-service icon library.
//
// Hand-picked from Phosphor Icons (MIT, the same set used by Vercel /
// Cloudflare design systems) plus a few custom additions for trades
// Phosphor doesn't carry cleanly. All icons are 24×24, stroke="currentColor"
// at 1.75-2px stroke width so they read crisply at the 24-48px sizes we
// render them at. Filled variants are used for visual depth on the
// "active" tile of the services row.
//
// Add new icons here — keep the same 24×24 viewBox + currentColor pattern.

import type { ReactNode } from "react";

const Stroke = ({ children }: { children: ReactNode }) => (
  <svg
    width="100%"
    height="100%"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const TRADE_ICONS: Record<string, ReactNode> = {
  // Drywall / plaster / skim
  trowel: (
    <Stroke>
      <path d="M14 3 21 10l-7 7L7 10l7-7Z" />
      <path d="m7 17 3 3" />
      <path d="m10 14 4 4" />
    </Stroke>
  ),
  // Bricklaying / masonry
  bricks: (
    <Stroke>
      <rect x="3" y="6" width="6" height="4" />
      <rect x="9" y="6" width="6" height="4" />
      <rect x="15" y="6" width="6" height="4" />
      <rect x="6" y="10" width="6" height="4" />
      <rect x="12" y="10" width="6" height="4" />
      <rect x="3" y="14" width="6" height="4" />
      <rect x="9" y="14" width="6" height="4" />
      <rect x="15" y="14" width="6" height="4" />
    </Stroke>
  ),
  // Painting / decorating
  paintRoller: (
    <Stroke>
      <rect x="3" y="3" width="18" height="6" rx="1" />
      <path d="M12 9v3a2 2 0 0 1-2 2H4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3" />
    </Stroke>
  ),
  paintBucket: (
    <Stroke>
      <path d="M19 11 11.5 3.5a2.121 2.121 0 0 0-3 0L4 8l8 8 7-5Z" />
      <path d="m5 2 5 5" />
      <path d="M22 18a2 2 0 0 1-2 2 2 2 0 0 1-2-2c0-1.5 2-3.5 2-3.5s2 2 2 3.5Z" />
    </Stroke>
  ),
  // Plumbing
  wrench: (
    <Stroke>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
    </Stroke>
  ),
  pipe: (
    <Stroke>
      <path d="M4 11h6a2 2 0 0 1 2 2v8" />
      <path d="M20 4h-8a2 2 0 0 0-2 2v5" />
      <path d="M4 8v6" />
      <path d="M20 1v6" />
      <rect x="2" y="8" width="4" height="6" />
      <rect x="18" y="1" width="4" height="6" />
    </Stroke>
  ),
  // Electrical
  plug: (
    <Stroke>
      <path d="M9 2v6" />
      <path d="M15 2v6" />
      <path d="M8 8h8v3a4 4 0 0 1-4 4 4 4 0 0 1-4-4V8Z" />
      <path d="M12 15v7" />
    </Stroke>
  ),
  bolt: (
    <Stroke>
      <path d="m13 2-3 7h6l-3 13 3-7H10l3-13Z" fill="currentColor" />
    </Stroke>
  ),
  // Carpentry / joinery
  hammer: (
    <Stroke>
      <path d="m15 12-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9" />
      <path d="m17.64 15 3.36-3.36a2 2 0 0 0 0-2.83l-6.81-6.81a2 2 0 0 0-2.83 0L8 5.36" />
      <path d="m18 8 1 1" />
    </Stroke>
  ),
  saw: (
    <Stroke>
      <path d="M3 17 8 7l2 2 2-2 2 2 2-2 2 2 2-2 1 10" />
      <path d="M3 17h18" />
      <path d="M5 17v3" />
      <path d="M19 17v3" />
    </Stroke>
  ),
  // Tiling
  tiles: (
    <Stroke>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </Stroke>
  ),
  // Flooring
  planks: (
    <Stroke>
      <rect x="3" y="4" width="18" height="4" />
      <rect x="3" y="10" width="18" height="4" />
      <rect x="3" y="16" width="18" height="4" />
      <path d="M8 4v4" />
      <path d="M15 10v4" />
      <path d="M11 16v4" />
    </Stroke>
  ),
  // Roofing
  roof: (
    <Stroke>
      <path d="M3 12 12 4l9 8" />
      <path d="M5 11v9a1 1 0 0 0 1 1h4v-7h4v7h4a1 1 0 0 0 1-1v-9" />
    </Stroke>
  ),
  // Insulation / drywall fitting
  wall: (
    <Stroke>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M3 9h18" />
      <path d="M3 14h18" />
      <path d="M9 4v5" />
      <path d="M15 9v5" />
      <path d="M9 14v6" />
    </Stroke>
  ),
  // Heating / gas / boiler
  flame: (
    <Stroke>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.38 0 2.5-1.12 2.5-2.5 0-1.43-1.5-2-2-3.5-.34-.99-.7-1.86-.5-2.5 0 0-2 1-2 4 0 .5.5 1 .5 2 0 1-1 1.5-1 2.5Z" />
      <path d="M14.5 11c0-3.5-2.5-7-7-7 1 4-1 6-3 8s-2 4-1.5 6.5C3.5 21 6 22 8.5 22s4-1 5-2.5c.5-1 .5-2 .5-3" />
    </Stroke>
  ),
  // Radiator
  radiator: (
    <Stroke>
      <rect x="4" y="6" width="3" height="14" />
      <rect x="9" y="6" width="3" height="14" />
      <rect x="14" y="6" width="3" height="14" />
      <rect x="19" y="6" width="3" height="14" />
      <path d="M2 4h20" />
    </Stroke>
  ),
  // Locksmith
  key: (
    <Stroke>
      <circle cx="8" cy="15" r="4" />
      <path d="M12 12 21 3" />
      <path d="m17 7 2 2" />
      <path d="m21 3-2 6" />
    </Stroke>
  ),
  lock: (
    <Stroke>
      <rect x="4" y="11" width="16" height="11" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </Stroke>
  ),
  // Glazing / windows
  window: (
    <Stroke>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M12 3v18" />
      <path d="M4 12h16" />
    </Stroke>
  ),
  // Scaffolding
  scaffold: (
    <Stroke>
      <path d="M3 3v18" />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
      <path d="M21 3v18" />
      <path d="M3 7h18" />
      <path d="M3 12h18" />
      <path d="M3 17h18" />
    </Stroke>
  ),
  // Cleaning
  spray: (
    <Stroke>
      <path d="M7 7v13a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7" />
      <path d="M6 7h11" />
      <path d="M10 5V2h3v3" />
      <path d="M19 3h2" />
      <path d="M19 6h2" />
      <path d="M19 9h2" />
    </Stroke>
  ),
  // Cleaning sparkle
  sparkle: (
    <Stroke>
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M5 12H2" />
      <path d="M22 12h-3" />
      <path d="M19 5l-2 2" />
      <path d="m5 19 2-2" />
      <path d="M19 19l-2-2" />
      <path d="m5 5 2 2" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </Stroke>
  ),
  // Construction
  hardHat: (
    <Stroke>
      <path d="M2 18h20" />
      <path d="M4 18v-3a8 8 0 0 1 16 0v3" />
      <path d="M8 11V7h8v4" />
    </Stroke>
  ),
  drill: (
    <Stroke>
      <path d="M3 9h6v6H3z" />
      <path d="M9 12h4" />
      <path d="M13 9h4v6h-4z" />
      <path d="M17 12h2v-2" />
      <path d="M5 15v6" />
    </Stroke>
  ),
  // HVAC / fan
  fan: (
    <Stroke>
      <path d="M12 12c0-3 2.5-5 5-5s5 2 5 5-2 5-5 5h-5" />
      <path d="M12 12c-3 0-5-2.5-5-5s2-5 5-5 5 2 5 5v5" />
      <path d="M12 12c0 3-2.5 5-5 5s-5-2-5-5 2-5 5-5h5" />
      <path d="M12 12c3 0 5 2.5 5 5s-2 5-5 5-5-2-5-5v-5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </Stroke>
  ),
  // Demolition
  pickaxe: (
    <Stroke>
      <path d="M14 8 4 18l2 2L16 10" />
      <path d="M20 8a8 8 0 0 1-8-4 8 8 0 0 1 4 8 8 8 0 0 1 8-4Z" />
    </Stroke>
  ),
  // Welding
  spark: (
    <Stroke>
      <path d="M9 4 7 9l-5 1 4 3-1 5 4-2 4 2-1-5 4-3-5-1-2-5Z" />
    </Stroke>
  ),
  // Garden / landscaping
  leaf: (
    <Stroke>
      <path d="M11 20a8 8 0 0 0 8-8c0-5-2-9-2-9s-9 0-13 4-4 13 7 13Z" />
      <path d="M2 22 11 13" />
    </Stroke>
  ),
  shovel: (
    <Stroke>
      <path d="M6 2 18 2 18 8 6 8z" />
      <path d="M12 8v8" />
      <path d="M9 16h6l-3 6Z" />
    </Stroke>
  ),
  // Concrete / mixer
  mixer: (
    <Stroke>
      <circle cx="9" cy="13" r="5" />
      <path d="M14 8 21 3" />
      <path d="M21 3v6h-6" />
      <path d="M4 22l5-4" />
    </Stroke>
  ),
  // Fencing
  fence: (
    <Stroke>
      <path d="M3 8h2v13H3z" />
      <path d="M7 4h2v17H7z" />
      <path d="M11 8h2v13h-2z" />
      <path d="M15 4h2v17h-2z" />
      <path d="M19 8h2v13h-2z" />
      <path d="M3 10h18" />
      <path d="M3 14h18" />
    </Stroke>
  ),
  // Driveway / paving
  paving: (
    <Stroke>
      <path d="m4 20 4-8 8 8" />
      <path d="m8 20 4-8 4 8" />
      <path d="m12 4 2 4-2 0-2-4 2 0Z" />
      <path d="M3 20h18" />
    </Stroke>
  ),
  // Skip hire / waste
  skip: (
    <Stroke>
      <path d="M3 8h18l-2 12H5L3 8Z" />
      <path d="M9 8V5h6v3" />
    </Stroke>
  ),
  // Generic service fallback
  toolbox: (
    <Stroke>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M8 7V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3" />
      <path d="M2 13h20" />
      <path d="M10 13v3" />
      <path d="M14 13v3" />
    </Stroke>
  )
};

// Keyword → icon-key mapping. First match wins, so order matters — put
// more-specific keywords before the generic catch-alls. All keywords
// match case-insensitively against the service name; word boundaries
// are NOT enforced so partial matches work (e.g. "skim" hits "skim",
// "skim-coat" and "level-5 skim finish").
const KEYWORD_MAP: { keywords: string[]; icon: string }[] = [
  { keywords: ["skim", "plaster", "drywall", "mud-pan", "knife tap", "taping", "render", "patch"], icon: "trowel" },
  { keywords: ["brick", "block", "masonry", "stonework", "stone work", "mortar", "pointing"], icon: "bricks" },
  { keywords: ["paint", "decorat", "spray finish"], icon: "paintRoller" },
  { keywords: ["wallpaper"], icon: "paintBucket" },
  { keywords: ["plumb", "leak", "tap fit", "drain"], icon: "wrench" },
  { keywords: ["pipe", "soil stack", "copper"], icon: "pipe" },
  { keywords: ["socket", "consumer unit", "rewire", "wiring", "electric"], icon: "plug" },
  { keywords: ["light fit", "downlight", "spotlight", "earth bond"], icon: "bolt" },
  { keywords: ["carpent", "joiner", "skirting", "architrave", "stud"], icon: "hammer" },
  { keywords: ["cut to size", "saw", "trim", "joist"], icon: "saw" },
  { keywords: ["tile", "grout", "mosaic", "ceramic", "porcelain", "marble"], icon: "tiles" },
  { keywords: ["floor", "lvt", "laminate", "engineered", "vinyl", "carpet"], icon: "planks" },
  { keywords: ["roof", "tile roof", "slate", "felt", "ridge"], icon: "roof" },
  { keywords: ["partition", "insulat", "stud wall", "wall fit", "boarding"], icon: "wall" },
  { keywords: ["boiler", "gas", "combi", "lpg"], icon: "flame" },
  { keywords: ["radiator", "rad fit", "thermostat"], icon: "radiator" },
  { keywords: ["key cut", "lock fit"], icon: "key" },
  { keywords: ["lock", "deadbolt", "euro cylinder"], icon: "lock" },
  { keywords: ["window", "double glazed", "upvc", "glazier", "glass"], icon: "window" },
  { keywords: ["scaffold", "tower hire", "edge protect"], icon: "scaffold" },
  { keywords: ["clean", "wash", "jetwash", "pressure wash"], icon: "spray" },
  { keywords: ["polish", "deep clean", "after-build"], icon: "sparkle" },
  { keywords: ["build", "extension", "construction", "loft conversion"], icon: "hardHat" },
  { keywords: ["drill", "fix", "anchor", "bolt down"], icon: "drill" },
  { keywords: ["ventilat", "extract", "hvac", "air con"], icon: "fan" },
  { keywords: ["demoli", "strip out", "rip out", "soft strip"], icon: "pickaxe" },
  { keywords: ["weld", "metal work", "fabricat"], icon: "spark" },
  { keywords: ["landscap", "garden", "turf", "hedge"], icon: "leaf" },
  { keywords: ["dig", "trench", "excavat", "groundwork"], icon: "shovel" },
  { keywords: ["concrete", "screed", "foundation", "footing"], icon: "mixer" },
  { keywords: ["fenc", "post and rail"], icon: "fence" },
  { keywords: ["paving", "patio", "block paving", "driveway"], icon: "paving" },
  { keywords: ["skip hire", "waste", "rubbish removal"], icon: "skip" }
];

/**
 * Pick the best icon key for a service name by keyword matching.
 * Falls back to "toolbox" so every tile always gets an icon.
 */
export function matchIcon(serviceName: string): string {
  const lower = serviceName.toLowerCase();
  for (const entry of KEYWORD_MAP) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) return entry.icon;
    }
  }
  return "toolbox";
}

export function TradeIcon({ name }: { name: string }) {
  const key = matchIcon(name);
  return TRADE_ICONS[key] ?? TRADE_ICONS.toolbox;
}
