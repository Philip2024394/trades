"use client";

// CanteenDashboardSections — three composed sections that sit directly
// under the CanteenHeader on the canteen page:
//
//   1. CanteenQuickActions   — 5 verb-forward icon buttons (owner-only)
//   2. CanteenTradeDeals     — soft-tan promo strip (all viewers)
//   3. CanteenTrendingRibbon — horizontal scroll of category tiles
//
// All three match the mockup pattern but ported to our off-white
// palette with warm-tan accent (#B8860B) instead of bright yellow so
// they read as calm, editorial cards — not attention-grabbing.

import Link from "next/link";
import {
  Mail,
  Home,
  Users,
  ClipboardList,
  ShoppingCart,
  Tag,
  ChevronRight,
  Flame,
  Quote,
  Star
} from "lucide-react";
import { BRAND_BLACK } from "@/lib/brand/tokens";

const TAN = "#B8860B";       // Warm gold, matches "The Network" wordmark
const TAN_SOFT = "#F5E9D3";  // Soft peach/tan card background
const TAN_LIGHT = "#FBF6EC"; // Cream

// ─── Quick Actions ─────────────────────────────────────────

export function CanteenQuickActions({ canteenSlug, tradeSlug, inline = false }: { canteenSlug: string; tradeSlug?: string | null; inline?: boolean }) {
  const findTradesHref = tradeSlug
    ? `/trade-off/find-trades?fromTrade=${encodeURIComponent(tradeSlug)}`
    : `/trade-off/find-trades`;
  // Products + My Jobs use in-page hash routing (#tab-products / #tab-jobs)
  // so they switch the tabbed section instead of navigating away. All
  // other actions go to their own pages. Hash-only URLs mean the
  // section already on the same page just re-reads the hash.
  // Home uses the same in-page bridge as the other Quick Actions —
  // resets the tabbed section to "feed" and scrolls the page to top.
  // Previously it was a Link to the canteen URL, which did nothing
  // visible because the user is already on that URL.
  const items = [
    { icon: <Home size={18} strokeWidth={2.3}/>,           label: "Home",        href: `#tab-feed` },
    { icon: <Mail size={18} strokeWidth={2.3}/>,           label: "Contact us",  href: `#tab-contact` },
    { icon: <Users size={18} strokeWidth={2.3}/>,          label: "Find Trades", href: `#tab-trades` },
    { icon: <ClipboardList size={18} strokeWidth={2.3}/>,  label: "My Jobs",     href: `#tab-jobs` },
    { icon: <ShoppingCart size={18} strokeWidth={2.3}/>,   label: "Products",    href: `#tab-products` }
  ];
  const grid = (
    <div className="grid grid-cols-5 gap-1 md:gap-3">
      {items.map((item) => {
        const isHash = item.href.startsWith("#");
        const inner = (
          <>
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md md:h-11 md:w-11"
              style={{ backgroundColor: BRAND_BLACK }}
            >
              {item.icon}
            </div>
            <div className="text-[10px] font-bold leading-tight text-neutral-700 md:text-[11px]">
              {item.label}
            </div>
          </>
        );
        // Hash-only hrefs use a raw <a> tag with a bulletproof custom
        // event — hashchange dispatch was flaky across browsers so
        // switching tabs uses `canteen:set-tab` which the tabbed
        // section listens to directly.
        if (isHash) {
          return (
            <a
              key={item.label}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                if (typeof window === "undefined") return;
                // Extract the tab slug: "#tab-contact" → "contact"
                const target = item.href.replace(/^#tab-/, "");
                // Update the URL for shareability + refresh persistence.
                window.history.replaceState(null, "", `#tab-${target}`);
                // Fire a custom event the tabbed section listens for.
                window.dispatchEvent(new CustomEvent("canteen:set-tab", {
                  detail: { tab: target }
                }));
                // Home = scroll to top of page; every other tab
                // = scroll the tabbed section into view.
                if (target === "feed") {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                } else {
                  document.getElementById("canteen-tabbed")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                  });
                }
              }}
              className="flex flex-col items-center gap-1.5 rounded-lg py-1 text-center transition active:scale-[0.95]"
            >
              {inner}
            </a>
          );
        }
        return (
          <Link
            key={item.label}
            href={item.href}
            className="flex flex-col items-center gap-1.5 rounded-lg py-1 text-center transition active:scale-[0.95]"
          >
            {inner}
          </Link>
        );
      })}
    </div>
  );
  if (inline) return grid;
  return (
    <div className="mx-auto -mt-2 max-w-6xl px-3 md:px-6">
      <div className="rounded-2xl border bg-white p-3 shadow-md md:p-4" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
        {grid}
      </div>
    </div>
  );
}

// ─── Trade Deals promo strip ───────────────────────────────

export function CanteenTradeDeals({
  canteenSlug,
  tradeLabel: _tradeLabel,
  hostSlug,
  hostFirstName,
  reviews = null,
  inline = false
}: {
  canteenSlug: string;
  tradeLabel: string;
  hostSlug?: string;
  hostFirstName?: string;
  /** Host review aggregate — sub-copy adapts based on count. */
  reviews?: { avg: number; count: number } | null;
  inline?: boolean;
}) {
  // Opens the Reviews tab of the in-page tabbed section (same bridge
  // pattern as Quick Actions). Falls back to the canteen's about page
  // on the (rare) desktop-only surfaces that don't mount the tabbed
  // section.
  const reviewsHref = `#tab-reviews`;
  const subCopy = reviews && reviews.count >= 5
    ? `See what ${hostFirstName ?? "our"} customers say — ${reviews.avg.toFixed(1)}★ from ${reviews.count} verified reviews.`
    : `Read every honest word from ${hostFirstName ?? "the"} team's customers.`;
  const banner = (
    <a
      href={reviewsHref}
      onClick={(e) => {
        e.preventDefault();
        // Update hash + fire the bridge event the tabbed section
        // listens to. Scroll into view so the user sees the reviews.
        window.history.replaceState(null, "", `#tab-reviews`);
        window.dispatchEvent(new CustomEvent("canteen:set-tab", {
          detail: { tab: "reviews" }
        }));
        document.getElementById("canteen-tabbed")?.scrollIntoView({ behavior: "smooth", block: "start" });
        // Suppress the unused-var warning without exposing hostSlug leak.
        void hostSlug;
      }}
      className="flex items-center gap-3 overflow-hidden rounded-2xl border p-3 shadow-md transition hover:brightness-105 active:scale-[0.99] md:p-4"
      style={{
        backgroundImage: `linear-gradient(90deg, ${TAN_SOFT} 0%, #FDF3E0 100%)`,
        borderColor: "rgba(184,134,11,0.20)"
      }}
    >
      {/* Big serif quotation-mark tile — matches the editorial pull
          quote language used elsewhere on the page. */}
      <div
        className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl shadow-md md:h-20 md:w-20"
        style={{ backgroundColor: "#FFFFFF", color: TAN }}
        aria-hidden
      >
        <Quote size={30} strokeWidth={2.2}/>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[13px] font-black text-neutral-900 md:text-[14px]">
          Customers say it best
          <Star size={11} strokeWidth={0} fill={TAN} style={{ color: TAN }}/>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-neutral-600 md:text-[11px]">
          {subCopy}
        </p>
      </div>
      <span
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white shadow-md"
        style={{ backgroundColor: TAN }}
        aria-hidden
      >
        <ChevronRight size={16} strokeWidth={2.5}/>
      </span>
    </a>
  );
  if (inline) return banner;
  return (
    <div className="mx-auto max-w-6xl px-3 pt-4 md:px-6 md:pt-6">
      {banner}
    </div>
  );
}

// ─── Trending Trades ribbon ────────────────────────────────

import {
  Grid, Table, Grip, Droplet, Lamp, Wrench, Flame as FlameIcon, Zap,
  Home as HomeIcon, Layers, Package, Hammer, PaintBucket, Cog, Compass,
  Ruler, Brush, TreePine, Truck, Anchor
} from "lucide-react";

// Trade-specific "Trending" categories. Each trade shows the 5 topics
// their customers most frequently ask about. `keywords` are used to
// match host products by name — if a product name contains any
// keyword, its imageUrl becomes the category tile's image. `fallback`
// is a hero-library URL used when the host has no matching product.
type TrendingItem = {
  slug: string;
  label: string;
  keywords: string[];
  fallback: string;
};

const HL = "https://ik.imagekit.io/9mrgsv2rp"; // hero library base

const TRENDING_BY_TRADE: Record<string, TrendingItem[]> = {
  "kitchen-fitter": [
    { slug: "cabinets",  label: "Cabinets",  keywords: ["cabinet", "carcass", "unit"],       fallback: `${HL}/ChatGPT%20Image%20Jul%205,%202026,%2011_04_56%20PM.png` },
    { slug: "worktops",  label: "Worktops",  keywords: ["worktop", "counter", "surface"],    fallback: `${HL}/ChatGPT%20Image%20Jun%2030,%202026,%2006_38_39%20PM.png` },
    { slug: "tiling",    label: "Tiling",    keywords: ["tile", "splashback", "ceramic"],    fallback: `${HL}/ChatGPT%20Image%20Jul%203,%202026,%2008_44_32%20AM.png` },
    { slug: "sinks",     label: "Sinks",     keywords: ["sink", "tap", "basin"],             fallback: `${HL}/ChatGPT%20Image%20Jul%206,%202026,%2002_03_04%20PM.png` },
    { slug: "lighting",  label: "Lighting",  keywords: ["light", "pendant", "lamp"],         fallback: `${HL}/ChatGPT%20Image%20Jul%205,%202026,%2001_00_58%20AM.png` }
  ],
  "plumber": [
    { slug: "boilers",   label: "Boilers",   keywords: ["boiler", "combi", "worcester"],     fallback: `${HL}/ChatGPT%20Image%20Jul%206,%202026,%2002_03_04%20PM.png` },
    { slug: "radiators", label: "Radiators", keywords: ["radiator", "rad"],                  fallback: `${HL}/ChatGPT%20Image%20Jul%206,%202026,%2002_01_34%20PM.png` },
    { slug: "bathrooms", label: "Bathrooms", keywords: ["bathroom", "shower", "bath"],       fallback: `${HL}/ChatGPT%20Image%20Jul%206,%202026,%2002_04_52%20PM.png` },
    { slug: "sinks",     label: "Sinks",     keywords: ["sink", "tap", "basin"],             fallback: `${HL}/ChatGPT%20Image%20Jul%206,%202026,%2002_01_34%20PM.png` },
    { slug: "leaks",     label: "Leaks",     keywords: ["leak", "burst", "drip"],            fallback: `${HL}/ChatGPT%20Image%20Jul%206,%202026,%2002_03_04%20PM.png` }
  ],
  "electrician": [
    { slug: "rewires",   label: "Rewires",   keywords: ["rewire", "wiring", "cable"],        fallback: `${HL}/ChatGPT%20Image%20Jul%205,%202026,%2001_23_54%20AM.png` },
    { slug: "ev",        label: "EV",        keywords: ["ev", "charger", "zappi"],           fallback: `${HL}/ChatGPT%20Image%20Jul%205,%202026,%2001_26_18%20AM.png` },
    { slug: "boards",    label: "Boards",    keywords: ["board", "fuse", "consumer unit"],   fallback: `${HL}/ChatGPT%20Image%20Jul%205,%202026,%2001_41_39%20AM.png` },
    { slug: "lighting",  label: "Lighting",  keywords: ["light", "spot", "pendant"],         fallback: `${HL}/ChatGPT%20Image%20Jul%205,%202026,%2001_00_58%20AM.png` },
    { slug: "sockets",   label: "Sockets",   keywords: ["socket", "usb", "outlet"],          fallback: `${HL}/ChatGPT%20Image%20Jul%205,%202026,%2001_23_54%20AM.png` }
  ],
  "carpenter": [
    { slug: "doors",       label: "Doors",       keywords: ["door", "hinge"],                fallback: `${HL}/ChatGPT%20Image%20Jul%205,%202026,%2010_48_25%20PM.png` },
    { slug: "staircases",  label: "Stairs",      keywords: ["stair", "step", "handrail"],    fallback: `${HL}/ChatGPT%20Image%20Jul%205,%202026,%2012_34_37%20AM.png` },
    { slug: "wardrobes",   label: "Wardrobes",   keywords: ["wardrobe", "cupboard", "fit"],  fallback: `${HL}/ChatGPT%20Image%20Jul%205,%202026,%2001_09_30%20AM.png` },
    { slug: "worktops",    label: "Worktops",    keywords: ["worktop", "oak", "surface"],    fallback: `${HL}/ChatGPT%20Image%20Jun%2030,%202026,%2006_38_39%20PM.png` },
    { slug: "trim",        label: "Trim",        keywords: ["skirting", "trim", "moulding"], fallback: `${HL}/ChatGPT%20Image%20Jul%205,%202026,%2012_15_38%20AM.png` }
  ],
  "roofer": [
    { slug: "slate",     label: "Slate",     keywords: ["slate"],                            fallback: `${HL}/ChatGPT%20Image%20Jul%206,%202026,%2001_44_51%20PM.png` },
    { slug: "tiles",     label: "Tiles",     keywords: ["tile", "clay"],                     fallback: `${HL}/ChatGPT%20Image%20Jul%205,%202026,%2010_44_14%20PM.png` },
    { slug: "flat",      label: "Flat",      keywords: ["flat", "epdm", "felt"],             fallback: `${HL}/ChatGPT%20Image%20Jul%205,%202026,%2010_41_29%20PM.png` },
    { slug: "gutters",   label: "Gutters",   keywords: ["gutter", "downpipe"],               fallback: `${HL}/ChatGPT%20Image%20Jul%206,%202026,%2001_44_51%20PM.png` },
    { slug: "flashings", label: "Flashings", keywords: ["flashing", "lead", "chimney"],      fallback: `${HL}/ChatGPT%20Image%20Jul%206,%202026,%2001_44_51%20PM.png` }
  ]
};

const FALLBACK_TRENDING: TrendingItem[] = [
  { slug: "quotes",    label: "Quotes",    keywords: ["quote"],   fallback: `${HL}/ChatGPT%20Image%20Jul%203,%202026,%2002_34_38%20PM.png` },
  { slug: "materials", label: "Materials", keywords: ["material"], fallback: `${HL}/ChatGPT%20Image%20Jul%202,%202026,%2002_36_48%20PM.png` },
  { slug: "tools",     label: "Tools",     keywords: ["tool"],    fallback: `${HL}/ChatGPT%20Image%20Jul%205,%202026,%2010_44_14%20PM.png` },
  { slug: "jobs",      label: "Jobs",      keywords: ["job"],     fallback: `${HL}/ChatGPT%20Image%20Jul%203,%202026,%2008_56_55%20AM.png` },
  { slug: "advice",    label: "Advice",    keywords: ["advice"],  fallback: `${HL}/ChatGPT%20Image%20Jul%203,%202026,%2003_08_19%20PM.png` }
];

export type TrendingProduct = {
  id: string;
  name: string;
  imageUrl: string;
  hrefPath: string;
};

/** Match a category to one of the host's products by keyword.
 *  Returns { imageUrl, hrefPath } from the matching product, or null
 *  when the host has nothing matching that category. */
function matchProductForCategory(
  category: TrendingItem,
  products: TrendingProduct[]
): { imageUrl: string; hrefPath: string | null } {
  const p = products.find((p) => {
    const name = p.name.toLowerCase();
    return category.keywords.some((k) => name.includes(k.toLowerCase()));
  });
  if (p) return { imageUrl: p.imageUrl, hrefPath: p.hrefPath };
  return { imageUrl: category.fallback, hrefPath: null };
}

export function CanteenTrendingRibbon({
  tradeLabel,
  tradeSlug,
  products = [],
  compact = false
}: {
  tradeLabel: string;
  tradeSlug?: string;
  /** Host's real products. Category tiles try to match each
   *  category's keywords against product names — if a match is found
   *  the tile shows THAT product's image (same one that renders in
   *  the product carousel below). No match → hero-library fallback
   *  image, still on-brand for the category. */
  products?: TrendingProduct[];
  /** Compact variant — smaller square tiles + tighter header. Used on
   *  the /products page where the ribbon sits directly under the hero
   *  as a "smaller square" navigator. */
  compact?: boolean;
}) {
  const categories = (tradeSlug && TRENDING_BY_TRADE[tradeSlug]) || FALLBACK_TRENDING;
  return (
    <section className={`mx-auto max-w-6xl px-3 md:px-6 ${compact ? "pt-3" : "pt-4 md:pt-6"}`}>
      <div className="mb-2 px-1">
        <span className={`font-black text-neutral-900 ${compact ? "text-[11px] uppercase tracking-[0.14em]" : "text-[14px] md:text-[15px]"}`}>
          Trending in {tradeLabel} today
        </span>
      </div>
      {/* Fixed 4-col grid — larger square tiles for higher visual
          impact. Each tile carries a category image bg and a single
          word label overlaid at the bottom. */}
      <div className={`grid grid-cols-4 ${compact ? "gap-1.5 md:gap-2 max-w-md" : "gap-2 md:gap-3"}`}>
        {categories.slice(0, 4).map((cat, i) => {
          const match = matchProductForCategory(cat, products);
          const TileTag = match.hrefPath ? Link : "div";
          const commonProps = {
            className:
              "relative flex aspect-square w-full overflow-hidden rounded-xl border shadow-sm transition active:scale-[0.97]",
            style: {
              borderColor: i === 0 ? TAN : "rgba(139,69,19,0.12)",
              backgroundImage: `url('${match.imageUrl}')`,
              backgroundSize: "cover",
              backgroundPosition: "center"
            } as React.CSSProperties
          };
          const content = (
            <>
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-3/5"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.80) 15%, rgba(0,0,0,0.30) 60%, transparent 100%)" }}
              />
              <span className={`relative z-10 mt-auto w-full text-center font-black leading-none text-white drop-shadow-md ${compact ? "px-1 pb-1 text-[9px] md:text-[10px]" : "px-2 pb-2 text-[12px] md:text-[14px]"}`}>
                {cat.label}
              </span>
            </>
          );
          return match.hrefPath ? (
            <Link key={cat.slug} href={match.hrefPath} {...commonProps}>
              {content}
            </Link>
          ) : (
            <div key={cat.slug} {...commonProps}>
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
