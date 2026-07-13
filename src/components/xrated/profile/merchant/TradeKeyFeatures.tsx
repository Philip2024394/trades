// TradeKeyFeatures — trades-themed port of Hammerex's KeyFeatures.
//
// Reads product.features (string[]) from hammerex_xrated_products and
// renders an icon-anchored bullet grid above the fold — the same "at a
// glance" surface hammerexdirect uses to sell a product's benefits
// without forcing the shopper to read the whole description.
//
// Icon assignment is heuristic on the feature text (keywords → glyph);
// unmatched features fall back to a bolt glyph. This keeps the JSON on
// the product row a plain string[] (no per-feature icon column needed)
// while still giving each row its own visual anchor.

import type { ReactNode } from "react";

const YELLOW = "#FFB300";
const INK = "#1B1A17";

type IconKey =
  | "bolt"
  | "shield"
  | "truck"
  | "wrench"
  | "leaf"
  | "clock"
  | "star"
  | "layers"
  | "ruler"
  | "check";

// Heuristic feature → icon mapping. Ordered by specificity — longer
// keyword matches win. Kept small on purpose; new keywords should
// slot in here rather than expanding the icon set.
function pickIcon(text: string): IconKey {
  const s = text.toLowerCase();
  if (/(warranty|guarantee|guaranteed|insured|certified)/.test(s))
    return "shield";
  if (/(delivery|shipping|dispatch|next-day|nationwide|uk-wide)/.test(s))
    return "truck";
  if (/(install|fit|fitted|service|maintenance|repair)/.test(s))
    return "wrench";
  if (/(eco|sustainable|recycled|low-carbon|green|natural)/.test(s))
    return "leaf";
  if (/(hour|minute|fast|instant|quick|same-day|48-hour)/.test(s))
    return "clock";
  if (/(premium|luxury|award|top-rated|5-star|professional)/.test(s))
    return "star";
  if (/(size|dimensions|length|width|volume|capacity|litre|kg)/.test(s))
    return "ruler";
  if (/(layer|coats|stackable|modular|multi-)/.test(s)) return "layers";
  if (/(waterproof|weatherproof|frost|heat|non-slip|safe)/.test(s))
    return "check";
  return "bolt";
}

const icons: Record<IconKey, ReactNode> = {
  bolt: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  shield: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l9 4v6c0 5.25-3.75 10-9 12-5.25-2-9-6.75-9-12V6l9-4z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  ),
  truck: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="7" width="13" height="9" rx="1" />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  ),
  wrench: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a4 4 0 0 0-5.7 5.7L3 18l3 3 6-6a4 4 0 0 0 5.7-5.7l-2.7 2.7-2.3-2.3 2.7-2.7z" />
    </svg>
  ),
  leaf: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 4C10 4 4 10 4 20c10 0 16-6 16-16z" />
      <path d="M4 20L14 10" />
    </svg>
  ),
  clock: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </svg>
  ),
  star: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15 9 22 10 17 15 18 22 12 19 6 22 7 15 2 10 9 9 12 2" />
    </svg>
  ),
  layers: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 22 8 12 14 2 8 12 2" />
      <polyline points="2 12 12 18 22 12" />
      <polyline points="2 16 12 22 22 16" />
    </svg>
  ),
  ruler: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 4L4 20l-1-1 16-16 1 1z" />
      <path d="M8 12l2 2M12 8l2 2M6 14l2 2M14 6l2 2" />
    </svg>
  ),
  check: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 12 10 18 20 6" />
    </svg>
  )
};

export function TradeKeyFeatures({
  features
}: {
  features: string[] | null;
}) {
  if (!features?.length) return null;
  return (
    <section
      id="features"
      className="border-t border-[#1B1A17]/10 bg-[#FBF6EC] py-10"
    >
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <h2 className="mb-6 text-[18px] font-black text-[#1B1A17] md:text-[22px]">
          Key features
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((label, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-2xl border border-[#1B1A17]/10 bg-white p-4 shadow-sm"
            >
              <span
                aria-hidden
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                style={{ background: `${YELLOW}22`, color: INK }}
              >
                {icons[pickIcon(label)]}
              </span>
              <span className="text-[13.5px] leading-[1.45] text-[#1B1A17]">
                {label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
