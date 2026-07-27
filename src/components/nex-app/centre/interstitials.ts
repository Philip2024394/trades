// Interstitial tiles for the NEX Centre masonry feed.
//
// Three types of non-product cards are woven into the product grid to
// break up visual monotony and open up two new roles:
//   1. category  — small gray "section" chip (like tabs on the old feed)
//   2. tip       — NEX words-of-advice card (warm cream, sparkles icon)
//   3. ad        — sponsored slot for future paid inventory
//
// Data here is mock/canned for the demo phase. When real inventory
// exists (real category slugs, curated NEX tips, live ad server) these
// will be swapped for feed-generated tiles without changing the
// interleave logic below.

export type CategoryTile = {
  kind: "category";
  id: string;
  label: string;
  count: number; // approx items in this category
  emoji?: string;
};

export type TipTile = {
  kind: "tip";
  id: string;
  headline: string;
  body: string;
};

export type AdTile = {
  kind: "ad";
  id: string;
  brand: string;
  headline: string;
  sub: string;
  cta: string;
  image?: string;
  accent?: string; // hex or tailwind bg-{colour} class fragment
};

export type Interstitial = CategoryTile | TipTile | AdTile;

// Category chips — short, scannable, act as inline section labels.
export const MOCK_CATEGORIES: CategoryTile[] = [
  { kind: "category", id: "cat-staircase", label: "Staircase Parts", count: 128, emoji: "🪜" },
  { kind: "category", id: "cat-kitchen", label: "Kitchens & Worktops", count: 94, emoji: "🍳" },
  { kind: "category", id: "cat-roofing", label: "Roofing & Tiles", count: 61, emoji: "🏠" },
  { kind: "category", id: "cat-timber", label: "Timber & Beams", count: 143, emoji: "🪵" },
  { kind: "category", id: "cat-flooring", label: "Flooring", count: 87, emoji: "🟫" },
  { kind: "category", id: "cat-plumbing", label: "Plumbing & Heating", count: 76, emoji: "🚿" },
  { kind: "category", id: "cat-landscape", label: "Landscaping", count: 52, emoji: "🌿" },
];

// NEX words-of-advice — short, opinionated, useful. Warm cream card.
export const MOCK_TIPS: TipTile[] = [
  {
    kind: "tip",
    id: "tip-quotes",
    headline: "Get 3 quotes before you commit",
    body: "Even from merchants you trust — pricing swings 20-40% on identical spec.",
  },
  {
    kind: "tip",
    id: "tip-wras",
    headline: "Check WRAS approval on taps",
    body: "UK water regs require it. If a merchant can't show the certificate, walk away.",
  },
  {
    kind: "tip",
    id: "tip-oak-moisture",
    headline: "Ask oak's moisture content",
    body: "8-10% for interior joinery. Anything over 14% will warp indoors.",
  },
  {
    kind: "tip",
    id: "tip-slate-lifespan",
    headline: "Welsh slate outlasts concrete tile 3×",
    body: "100+ years vs 30. Higher upfront, cheaper lifetime.",
  },
  {
    kind: "tip",
    id: "tip-safe-payment",
    headline: "Never pay full deposit up front",
    body: "Standard trade practice is 20-30% deposit, staged payments on delivery.",
  },
  {
    kind: "tip",
    id: "tip-verified",
    headline: "Verified merchants have insurance on file",
    body: "NEX confirms their PLI + trade credentials before the badge appears.",
  },
];

// Ad slots — sponsored inline cards. Small, honest label ("Sponsored")
// so they never feel deceptive.
export const MOCK_ADS: AdTile[] = [
  {
    kind: "ad",
    id: "ad-farrow-ball",
    brand: "Farrow & Ball",
    headline: "Introducing India Yellow",
    sub: "Hand-mixed colour cards, delivered free.",
    cta: "Order sample",
    accent: "bg-amber-50",
  },
  {
    kind: "ad",
    id: "ad-blum",
    brand: "Blum UK",
    headline: "Legrabox drawer runners",
    sub: "50-year warranty. Trade prices for verified builders.",
    cta: "See catalogue",
    accent: "bg-neutral-50",
  },
  {
    kind: "ad",
    id: "ad-jewson",
    brand: "Jewson",
    headline: "Trade card holders — 5% off timber",
    sub: "Auto-applied at checkout when signed in.",
    cta: "Sign in",
    accent: "bg-emerald-50",
  },
  {
    kind: "ad",
    id: "ad-toolstation",
    brand: "Toolstation",
    headline: "Free next-day delivery over £25",
    sub: "1,000+ trade tools in stock nationwide.",
    cta: "Shop tools",
    accent: "bg-sky-50",
  },
];

/** Interleave interstitials into a product array at a fixed cadence.
 *  Rotates category → tip → ad → category → tip → ad …
 *  `every` controls how many products between each interstitial. */
export function interleaveInterstitials<T>(
  products: T[],
  every: number = 5
): Array<T | Interstitial> {
  const out: Array<T | Interstitial> = [];
  const rotation: Interstitial[] = [];
  const catQueue = [...MOCK_CATEGORIES];
  const tipQueue = [...MOCK_TIPS];
  const adQueue = [...MOCK_ADS];

  // Build a rotation queue big enough to interleave through the products
  const slots = Math.floor(products.length / every);
  for (let i = 0; i < slots; i++) {
    const bucket = i % 3;
    if (bucket === 0 && catQueue.length > 0) {
      rotation.push(catQueue.shift()!);
    } else if (bucket === 1 && tipQueue.length > 0) {
      rotation.push(tipQueue.shift()!);
    } else if (bucket === 2 && adQueue.length > 0) {
      rotation.push(adQueue.shift()!);
    }
  }

  let interIdx = 0;
  products.forEach((p, i) => {
    out.push(p);
    // Insert an interstitial AFTER every Nth product (not before the first)
    if ((i + 1) % every === 0 && interIdx < rotation.length) {
      out.push(rotation[interIdx++]);
    }
  });
  return out;
}
