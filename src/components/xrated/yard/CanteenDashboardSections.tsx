"use client";

// CanteenDashboardSections — three composed sections that sit directly
// under the CanteenHeader on the canteen page:
//
//   1. CanteenQuickActions   — 5 verb-forward icon buttons (owner-only)
//   2. CanteenTradeDeals     — soft-tan promo strip (all viewers)
//   3. CanteenTrendingRibbon — 4-tile category grid; when host context
//                              is provided, tiles open an Instagram
//                              Stories-style swipe sheet with the
//                              dual-button pattern (WhatsApp + TC).
//
// All three match the mockup pattern but ported to our off-white
// palette with warm-tan accent (#B8860B) instead of bright yellow so
// they read as calm, editorial cards — not attention-grabbing.

import { useState } from "react";
import Link from "next/link";
import {
  Mail,
  Home,
  Users,
  Palette,
  ShoppingCart,
  Tag,
  ChevronRight,
  Flame,
  Star
} from "lucide-react";
import { BRAND_BLACK } from "@/lib/brand/tokens";
import {
  CanteenTrendingSwipeSheet,
  type TrendingSwipeItem
} from "./CanteenTrendingSwipeSheet";
import {
  CanteenStyleShowcase,
  type StyleShowcaseItem
} from "./CanteenStyleShowcase";
import type { CanteenProductVariants } from "@/lib/canteens";

const TAN = "#B8860B";       // Warm gold, matches "Thenetworkers" wordmark
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
  // Trade-aware label for the designs quick-action tile. Matches the
  // same trade-aware label on the Designs tab in CanteenTabbedSection.
  // Kitchen fitter sees "Kitchens", bathroom fitter "Bathrooms", every
  // other trade "Projects".
  const designsLabel = tradeSlug === "kitchen-fitter"
    ? "Kitchens"
    : tradeSlug === "bathroom-fitter"
      ? "Bathrooms"
      : "Projects";
  const items = [
    { icon: <Home size={18} strokeWidth={2.3}/>,           label: "Home",        href: `#tab-feed` },
    { icon: <Mail size={18} strokeWidth={2.3}/>,           label: "Contact us",  href: `#tab-contact` },
    { icon: <Users size={18} strokeWidth={2.3}/>,          label: "Find Trades", href: `#tab-trades` },
    { icon: <Palette size={18} strokeWidth={2.3}/>,        label: designsLabel,  href: `#tab-designs` },
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
            <div className="text-[11px] font-bold leading-tight text-neutral-700 md:text-[11px]">
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
  tradeSlug = null,
  hostSlug,
  hostFirstName,
  reviews = null,
  inline = false
}: {
  canteenSlug: string;
  tradeLabel: string;
  /** Trade slug — drives the container tone. Landscape family
   *  (landscaper / garden-designer / luxury-garden-designer) uses
   *  an earthy topsoil brown instead of the default amber yellow,
   *  per Philip's brief: brown reads as garden soil, aligns with
   *  the tactile outdoor trade. */
  tradeSlug?: string | null;
  hostSlug?: string;
  hostFirstName?: string;
  /** Host review aggregate — sub-copy adapts based on count. */
  reviews?: { avg: number; count: number } | null;
  inline?: boolean;
}) {
  const isLandscapeFamily =
    tradeSlug === "landscaper" ||
    tradeSlug === "garden-designer" ||
    tradeSlug === "luxury-garden-designer";
  const containerBg = isLandscapeFamily ? "#7A4E2A" : "#FFB300";
  const containerBorder = isLandscapeFamily
    ? "rgba(58,32,12,0.35)"
    : "rgba(184,134,11,0.30)";
  const titleClass = isLandscapeFamily ? "text-white" : "text-neutral-900";
  const subCopyClass = isLandscapeFamily ? "text-amber-50/85" : "text-neutral-700";
  const starFill = isLandscapeFamily ? "#F5D66A" : TAN;
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
      className="flex items-center gap-2 overflow-hidden rounded-2xl border py-1 pl-0 pr-3 shadow-md transition hover:brightness-105 active:scale-[0.99] md:py-1.5 md:pr-4"
      style={{
        backgroundColor: containerBg,
        borderColor: containerBorder
      }}
    >
      {/* Illustrated graphic — customers-say-it-best. Flush to the
          left edge (no left padding, negative margin for extra pull)
          so the character reads as breaking out of the container. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://ik.imagekit.io/9mrgsv2rp/Untitledsdadaaa-removebg-preview.png"
        alt=""
        aria-hidden
        loading="lazy"
        className="-ml-2 h-20 w-20 flex-shrink-0 object-contain md:h-24 md:w-24"
      />
      <div className="min-w-0 flex-1">
        <div className={`flex items-center gap-1.5 text-[20px] font-black leading-tight tracking-tight md:text-[24px] ${titleClass}`}>
          Customers say it best
          <Star size={14} strokeWidth={0} fill={starFill} style={{ color: starFill }}/>
        </div>
        <p className={`mt-1 line-clamp-1 text-[11px] leading-snug md:text-[12px] ${subCopyClass}`}>
          {subCopy}
        </p>
      </div>
      <span
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white shadow-md"
        style={{ backgroundColor: "#0A0A0A" }}
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
  /** Optional short description shown in the full-screen showcase
   *  view when the merchant is running the style-showcase (rather
   *  than product-match) trending flow. 2-3 lines max. */
  description?: string;
  /** Optional starting price shown on the showcase card. Merchants
   *  can leave both from/to blank; showcase then shows only the
   *  Enquire Now CTA with no price. */
  priceFromGbp?: number;
  /** Optional ceiling price. When both from + to are set the card
   *  reads "£X – £Y"; from-only reads "from £X"; neither = no price. */
  priceToGbp?: number;
};

const HL = "https://ik.imagekit.io/9mrgsv2rp"; // hero library base

// Per-trade heading noun for the trending ribbon. Keeps each trade's
// header sounding natural — a kitchen fitter shows "Kitchen Designs"
// while an electrician shows "Electrical Work", etc.
const TRENDING_HEADING_BY_TRADE: Record<string, string> = {
  "kitchen-fitter":  "Trending Kitchen Style",
  "bathroom-fitter": "Trending Bathroom Designs",
  "electrician":     "Example of Services",
  "plumber":         "Example of Services",
  "bricklayer":      "Trending Brickwork",
  "scaffolder":      "Trending Scaffolding Setups",
  "roofer":          "Trending Roofing Jobs",
  "landscaper":            "Trending Landscape Designs",
  "luxury-garden-designer": "Trending Landscape Designs",
  "carpenter":       "Trending Carpentry Builds",
  "painter-decorator": "Trending Paint & Decor",
  "tiler":           "Trending Tile Work",
  "plasterer":       "Trending Plaster Finishes"
};

const TRENDING_BY_TRADE: Record<string, TrendingItem[]> = {
  // Kitchen fitter trending — refreshed 2026-07-14 to 6 kitchen STYLE
  // categories with cache-busted ImageKit URLs (the plain-URL variants
  // were missing on some CDN edges). Style-led browsing matches how
  // homeowners actually pick a kitchen. Prices are indicative supply
  // + install ranges — merchants can override to any range or leave
  // both blank for enquire-only.
  "kitchen-fitter": [
    { slug: "african-walnut", label: "African Walnut", keywords: ["walnut", "dark", "black wood"],       fallback: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2010_41_55%20PM.png?updatedAt=1783957337092", description: "Dark African walnut cabinets with deep-grain figure. Bespoke doors, soft-close, waterfall island option.", priceFromGbp: 8500, priceToGbp: 14500 },
    { slug: "brushed-steel",  label: "Brushed Steel",  keywords: ["steel", "stainless", "industrial"],   fallback: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2011_11_45%20PM.png?updatedAt=1783959123974", description: "Full brushed-stainless cabinets and worktop. Commercial-grade, hygienic. Ideal for open-plan loft kitchens.",   priceFromGbp: 12000, priceToGbp: 22000 },
    { slug: "mahogany",       label: "Mahogany",       keywords: ["mahogany", "red wood", "rich"],       fallback: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2011_23_27%20PM.png?updatedAt=1783959824125", description: "Rich mahogany with brass hardware. Traditional stiles and rails. Ideal for period and Georgian homes.",     priceFromGbp: 9500,  priceToGbp: 16000 },
    { slug: "blue-shaker",    label: "Blue Shaker",    keywords: ["shaker", "blue", "navy", "handleless"], fallback: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2011_06_40%20PM.png?updatedAt=1783958815981", description: "Deep navy shaker doors, brass or nickel handles, quartz worktops. Modern-classic — the most-requested style right now.", priceFromGbp: 7500, priceToGbp: 13000 },
    { slug: "cottage-cream",  label: "Cottage Cream",  keywords: ["cream", "cottage", "farmhouse"],      fallback: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2010_53_37%20PM.png?updatedAt=1783958037322", description: "Soft cream farmhouse look, painted timber, butler sink option. Warm feel for cottages and traditional builds.", priceFromGbp: 6500, priceToGbp: 11500 },
    { slug: "walnut",         label: "Walnut",         keywords: ["walnut", "light wood", "traditional"], fallback: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2013,%202026,%2010_47_54%20PM.png?updatedAt=1783957696517", description: "Classic mid-tone walnut with clean lines. Warm grain, timeless. Works with quartz, granite, or timber worktop.",   priceFromGbp: 7500, priceToGbp: 13500 }
  ],
  "plumber": [
    { slug: "boilers",     label: "Boilers",     keywords: ["boiler", "combi", "worcester"],        fallback: `${HL}/ChatGPT%20Image%20Jul%206,%202026,%2002_03_04%20PM.png`,                                        description: "Boiler installs — Worcester Bosch 4000 or Vaillant ecoTec Plus combi/system boilers. Includes flue, magnetic filter, thermostat, powerflush if needed, Gas Safe commissioning. 10-year manufacturer warranty.", priceFromGbp: 2200,  priceToGbp: 3800 },
    { slug: "bathrooms",   label: "Bathrooms",   keywords: ["bathroom", "shower", "bath"],          fallback: `${HL}/ChatGPT%20Image%20Jul%2015,%202026,%2012_05_53%20AM.png`,                                       description: "Full bathroom refurb — strip out, re-plumb, install new bath / shower / toilet / basin / vanity, tile walls + floor. Coordinates with tiler, plasterer, and electrician. Typical duration 5-8 working days.",   priceFromGbp: 3500,  priceToGbp: 8500 },
    { slug: "heating",     label: "Heating",     keywords: ["central heating", "rad", "radiator"],  fallback: `${HL}/ChatGPT%20Image%20Jul%205,%202026,%2001_41_39%20AM.png`,                                        description: "Full central heating install — boiler + radiators sized per room, all pipework, TRVs, programmer, magnetic filter. Suits new builds, extensions, or conversions from electric. Building Control notification handled.", priceFromGbp: 4800,  priceToGbp: 8200 },
    { slug: "powerflush",  label: "Powerflush",  keywords: ["powerflush", "flush", "sludge"],       fallback: `${HL}/ChatGPT%20Image%20Jul%2015,%202026,%2012_05_53%20AM.png`,                                       description: "Powerflush removes sludge, rust, and limescale from your central heating. Restores efficiency, fixes cold-spot radiators, cuts running costs. Kamco pump + Fernox chemical + X100 inhibitor top-up.",       priceFromGbp: 450,   priceToGbp: 650 },
    { slug: "leaks",       label: "Leaks",       keywords: ["leak", "burst", "drip"],               fallback: `${HL}/ChatGPT%20Image%20Jul%206,%202026,%2002_03_04%20PM.png`,                                        description: "Leak detection + repair — pipework, radiator valves, toilet cisterns, tap connections, waste seals. Same-day callout in Nottingham. Insurance-ready written reports on request. £120/hr with 1-hour minimum.", priceFromGbp: 120,   priceToGbp: 380 },
    { slug: "taps",        label: "Taps",        keywords: ["tap", "kitchen tap", "mixer"],         fallback: `${HL}/ChatGPT%20Image%20Jul%206,%202026,%2002_01_34%20PM.png`,                                        description: "Kitchen + bathroom tap install — mixer, mono-block, or boiling water tap (Quooker / Fohën). Includes isolators, flexi connectors, and old tap removal. Undermount stone-worktop installs quoted on visit.",  priceFromGbp: 120,   priceToGbp: 320 },
    { slug: "emergency",   label: "Emergency",   keywords: ["emergency", "callout", "24/7"],        fallback: `${HL}/ChatGPT%20Image%20Jul%2015,%202026,%2012_05_53%20AM.png`,                                       description: "24/7 emergency callout within 20 miles of Nottingham. Burst pipe, no heating, no hot water, uncontained leak. £95 callout + £75/hr (1hr min). Out-of-hours surcharge on weekends and bank holidays.",       priceFromGbp: 95,    priceToGbp: 350 }
  ],
  "electrician": [
    { slug: "rewires",       label: "Surround Sound", keywords: ["sound", "speaker", "surround", "audio"],       fallback: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_42_53%20AM.png",           description: "Surround sound installation — in-ceiling or wall-mounted speakers, multi-room streaming, home cinema wiring, and AV rack setup. Sonos, Denon, Yamaha compatible. First-fix cabling during a rewire or retrofit after plaster.", priceFromGbp: 950,   priceToGbp: 3800 },
    { slug: "ev",            label: "Alarms",       keywords: ["alarm", "intruder", "security", "burglar"],      fallback: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_22_23%20AM.png",           description: "Installation of alarm systems — wireless intruder alarm supply + fit. Yale Sync or Texecom Ricochet. External sounder, keypad, PIR sensors, door contacts, and smartphone control. Grade 2 rated for insurance discount.", priceFromGbp: 480,   priceToGbp: 1500 },
    { slug: "boards",        label: "Fuse Board",   keywords: ["board", "fuse", "consumer unit"],                fallback: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_24_56%20AM.png",           description: "Fuse board upgrade + supply — 18th-edition compliant consumer unit with 10-way RCBO, SPD, main switch. All labour, testing, EIC certificate, and building control notification included.",           priceFromGbp: 550,   priceToGbp: 850 },
    { slug: "lighting",      label: "Lighting",     keywords: ["light", "spot", "pendant"],                      fallback: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_14_15%20AM.png",           description: "Lighting install + upgrades — internal downlights, pendant swaps, outdoor security floods, garden bollards. Fire-rated IP65 LEDs standard, dimmer-compatible. Chandelier and feature-piece install quoted on visit.", priceFromGbp: 75,    priceToGbp: 900 },
    { slug: "sockets",       label: "Sockets",      keywords: ["socket", "usb", "outlet"],                       fallback: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_33_44%20AM.png",           description: "Add single or double sockets on existing rings. MK Logic Plus / LAP branded accessories in white, chrome or brushed steel. USB-C variants available. Multi-socket jobs discounted on visit.",       priceFromGbp: 85,    priceToGbp: 220 },
    { slug: "gates",         label: "Gates",        keywords: ["gate", "gates", "driveway", "entrance"],         fallback: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2012_43_50%20AM.png",           description: "Wire in and install powered driveway or entrance gates — motor, control board, photocells, safety edge, and remote fobs. Single-leaf or double, sliding or swing. BFT, Came or Nice motors, safety-edge compliant.", priceFromGbp: 2800,  priceToGbp: 5500 },
    // Everything below shows ONLY in the swipe sheet (index > 5).
    // The trending home-page grid caps at 6 tiles (see .slice(0, 6)
    // in the render). Merchants can add more services without cluttering
    // the home grid — extras become browsable via swipe.
    { slug: "first-fix",     label: "First Fix",    keywords: ["first fix", "first-fix", "chase", "back box"],   fallback: `${HL}/ChatGPT%20Image%20Jul%205,%202026,%2001_23_54%20AM.png`,                                        description: "First-fix electrical for house extensions, garages and new builds — chases, back boxes, cable runs to consumer unit, and pre-plaster testing. Ready for the plasterer. Coordinates with your builder timeline.",   priceFromGbp: 750,   priceToGbp: 2800 }
  ],
  "carpenter": [
    { slug: "doors",       label: "Doors",       keywords: ["door", "hinge"],                fallback: `${HL}/ChatGPT%20Image%20Jul%205,%202026,%2010_48_25%20PM.png` },
    { slug: "staircases",  label: "Stairs",      keywords: ["stair", "step", "handrail"],    fallback: `${HL}/ChatGPT%20Image%20Jul%205,%202026,%2012_34_37%20AM.png` },
    { slug: "wardrobes",   label: "Wardrobes",   keywords: ["wardrobe", "cupboard", "fit"],  fallback: `${HL}/ChatGPT%20Image%20Jul%205,%202026,%2001_09_30%20AM.png` },
    { slug: "worktops",    label: "Worktops",    keywords: ["worktop", "oak", "surface"],    fallback: `${HL}/ChatGPT%20Image%20Jun%2030,%202026,%2006_38_39%20PM.png` },
    { slug: "trim",        label: "Trim",        keywords: ["skirting", "trim", "moulding"], fallback: `${HL}/ChatGPT%20Image%20Jul%205,%202026,%2012_15_38%20AM.png` }
  ],
  "landscaper": [
    { slug: "modern-curves",   label: "Modern Curves",   keywords: ["modern", "curves", "topiary", "front garden"], fallback: `${HL}/d3dc4fdf62da6e575ccea46862b68527d.jpg`,             description: "Sweeping curved lawn, boxwood topiary balls, black-mulch beds and grey paver walkway. Contemporary front or back garden with strong lines and low-maintenance planting.",           priceFromGbp: 8500,  priceToGbp: 18000 },
    { slug: "lit-cobble-path", label: "Lit Cobble Path", keywords: ["lit path", "cobblestone", "lighting", "walkway"], fallback: `${HL}/9171141622dfafc52f0217ecc79a5157d.jpg`,           description: "S-curved cobblestone path with warm-white LED strip edging, flanked by rose and hydrangea borders. Transforms an existing garden with an evening ambience upgrade.",                priceFromGbp: 4200,  priceToGbp: 9500 },
    { slug: "hillside-stairs", label: "Hillside Stairs", keywords: ["hillside", "sloped", "steps", "stairs", "retaining"], fallback: `${HL}/0ae6e49699c2601f34bc0d58a699e767.jpg`,       description: "Sloped-site solution — curved stone-slab stairs with LED underlighting, dry-stone retaining wall, ornamental grass + boulder planting. Structural + lighting + planting integrated.", priceFromGbp: 12000, priceToGbp: 28000 },
    { slug: "deck-and-lounge", label: "Deck & Lounge",   keywords: ["deck", "lounge", "outdoor living", "composite decking"], fallback: `${HL}/feac4e23c6247b09fbda160e3f6230e2.jpg`,   description: "Curved composite deck with LED skirt lighting flowing past a raised outdoor lounge platform. Sells the finished garden room — deck, sofa, planting and lighting as one build.",     priceFromGbp: 9500,  priceToGbp: 22000 },
    { slug: "luxury-pebbled",  label: "Luxury Pebbled",  keywords: ["luxury", "pebble", "rill", "water feature", "flagship"], fallback: `${HL}/7edc29b91ecb6c8ddd2b855e73a77b60.jpg`,  description: "Signature nighttime garden — contrasting white + black pebble beds, boxwood topiary, steel water rill, bronze orb feature. Flagship project for luxury landscape designers.",       priceFromGbp: 25000, priceToGbp: 65000 },
    { slug: "water-ring",      label: "Water Ring",      keywords: ["water feature", "corten", "rain curtain", "sculpture"], fallback: `${HL}/8b3797f4409966845e872b6dee2c879a.jpg`,   description: "Bespoke circular Corten-steel rain curtain on a hardwood deck. One-piece sculptural water feature — pairs with tropical planting and evening lighting for a statement centrepiece.",   priceFromGbp: 4500,  priceToGbp: 12500 },
    { slug: "waterfall-wall",  label: "Waterfall Wall",  keywords: ["waterfall", "wall feature", "hardscape", "slate wall"], fallback: `${HL}/9be8dabe58dd9281570518c7b8f0be41.jpg`,    description: "Slate waterfall wall mounted between stacked-stone piers, spilling onto LED-lit paver landings with black planters. Hardscape + water + lighting bundled as one installation.",       priceFromGbp: 6500,  priceToGbp: 15000 }
  ],
  // Luxury garden designer uses the same trending set as landscaper —
  // shared landscape-design portfolio. Aliased below the landscaper
  // entry so both trades render the trending-landscape-designs images.
  "luxury-garden-designer": [
    { slug: "luxury-pebbled",  label: "Luxury Pebbled",  keywords: ["luxury", "pebble", "rill", "water feature", "flagship"], fallback: `${HL}/7edc29b91ecb6c8ddd2b855e73a77b60.jpg`,  description: "Signature nighttime garden — contrasting white + black pebble beds, boxwood topiary, steel water rill, bronze orb feature. Flagship project.",                    priceFromGbp: 35000, priceToGbp: 85000 },
    { slug: "water-ring",      label: "Water Ring",      keywords: ["water feature", "corten", "rain curtain", "sculpture"], fallback: `${HL}/8b3797f4409966845e872b6dee2c879a.jpg`,   description: "Bespoke circular Corten-steel rain curtain on hardwood deck. One-piece sculptural centrepiece paired with tropical planting and evening lighting.",              priceFromGbp: 6500,  priceToGbp: 18000 },
    { slug: "waterfall-wall",  label: "Waterfall Wall",  keywords: ["waterfall", "wall feature", "hardscape", "slate wall"], fallback: `${HL}/9be8dabe58dd9281570518c7b8f0be41.jpg`,    description: "Slate waterfall wall between stacked-stone piers, spilling onto LED-lit paver landings. Hardscape + water + lighting bundled as one installation.",                priceFromGbp: 9500,  priceToGbp: 22000 },
    { slug: "deck-and-lounge", label: "Deck & Lounge",   keywords: ["deck", "lounge", "outdoor living", "composite decking"], fallback: `${HL}/feac4e23c6247b09fbda160e3f6230e2.jpg`,  description: "Curved composite deck with LED skirt lighting past a raised lounge platform. Complete garden-room build — deck, sofa area, planting and lighting as one.",           priceFromGbp: 14000, priceToGbp: 32000 },
    { slug: "hillside-stairs", label: "Hillside Stairs", keywords: ["hillside", "sloped", "steps", "stairs", "retaining"], fallback: `${HL}/0ae6e49699c2601f34bc0d58a699e767.jpg`,      description: "Sloped-site engineering — curved stone-slab stairs, LED underlighting, dry-stone retaining walls, ornamental grass + boulder planting.",                          priceFromGbp: 18000, priceToGbp: 45000 },
    { slug: "lit-cobble-path", label: "Lit Cobble Path", keywords: ["lit path", "cobblestone", "lighting", "walkway"], fallback: `${HL}/9171141622dfafc52f0217ecc79a5157d.jpg`,          description: "S-curved cobblestone path with warm-white LED strip edging, flanked by rose and hydrangea borders. Evening ambience upgrade for premium gardens.",                 priceFromGbp: 6500,  priceToGbp: 14000 },
    { slug: "modern-curves",   label: "Modern Curves",   keywords: ["modern", "curves", "topiary", "front garden"], fallback: `${HL}/d3dc4fdf62da6e575ccea46862b68527d.jpg`,            description: "Sweeping curved lawn, boxwood topiary balls, black-mulch beds and grey paver walkway. Contemporary architectural garden with strong lines.",                       priceFromGbp: 12000, priceToGbp: 28000 }
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
  /** Price in GBP — powers the swipe sheet price line. Optional so old
   *  callers still compile; defaults to 0 → "Price on request". */
  priceGbp?: number;
  /** Short one-liner shown under the name in the swipe sheet. */
  blurb?: string;
  /** When set + `sendToTradeCenter` is true on the merchant, the swipe
   *  sheet renders a "Buy on Trade Center" button that deep-links to
   *  the TC listing. */
  tradeCenterListingId?: string;
  /** Variant shape — when present, the swipe sheet renders the shared
   *  CanteenVariantPicker below the price. */
  variants?: CanteenProductVariants;
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

/** Return every product whose name matches at least one of the
 *  category's keywords. Used by the swipe sheet to build a filtered
 *  list of items for that category. Falls back to an empty array (the
 *  sheet then shows an empty state). */
function productsForCategory(
  category: TrendingItem,
  products: TrendingProduct[]
): TrendingSwipeItem[] {
  return products
    .filter((p) => {
      const name = p.name.toLowerCase();
      return category.keywords.some((k) => name.includes(k.toLowerCase()));
    })
    .map((p) => ({
      id:                    p.id,
      name:                  p.name,
      imageUrl:              p.imageUrl,
      priceGbp:              p.priceGbp ?? 0,
      blurb:                 p.blurb,
      tradeCenterListingId:  p.tradeCenterListingId,
      hrefPath:              p.hrefPath,
      variants:              p.variants
    }));
}

export function CanteenTrendingRibbon({
  tradeLabel,
  tradeSlug,
  products = [],
  compact = false,
  canteenSlug,
  hostSlug,
  hostFirstName,
  hostDisplayName,
  hostWhatsapp = null,
  hostCity,
  sendToTradeCenter = false,
  paletteDark = false
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
  /** When these are provided, tapping a tile opens the Instagram
   *  Stories-style swipe sheet filtered to products in that category
   *  instead of navigating to a product URL. If omitted, ribbon falls
   *  back to the plain-Link behavior (used on standalone pages that
   *  don't have host context). */
  canteenSlug?: string;
  hostSlug?: string;
  hostFirstName?: string;
  hostDisplayName?: string;
  hostWhatsapp?: string | null;
  hostCity?: string | null;
  sendToTradeCenter?: boolean;
  /** Dark palette flag — flips the section heading to white so it
   *  reads on Iron / other dark palettes where the ribbon sits
   *  directly on the page's black background. */
  paletteDark?: boolean;
}) {
  const categories = (tradeSlug && TRENDING_BY_TRADE[tradeSlug]) || FALLBACK_TRENDING;
  // Per-trade heading noun. Falls back to the generic "in {trade}"
  // phrasing when no mapping exists.
  const trendingHeading = TRENDING_HEADING_BY_TRADE[tradeSlug ?? ""]
    ?? `Trending in ${tradeLabel} today`;

  // Swipe-sheet mode is only active when the host context props are
  // present. Without them we can't build a WhatsApp message or key the
  // sheet to a merchant, so the ribbon stays link-only.
  const swipeMode = Boolean(canteenSlug && hostFirstName);
  const [openCategoryIdx, setOpenCategoryIdx] = useState<number | null>(null);
  const openCategory = openCategoryIdx != null ? categories[openCategoryIdx] : null;
  const swipeItems = openCategory
    ? productsForCategory(openCategory, products)
    : [];

  return (
    <section className={`mx-auto max-w-6xl px-3 md:px-6 ${compact ? "pt-3" : "pt-4 md:pt-6"}`}>
      <div className="mb-3 px-1">
        <h2
          className={`font-black leading-tight tracking-tight ${compact ? "text-[20px] md:text-[22px]" : "text-[22px] md:text-[26px]"}`}
          style={{ color: paletteDark ? "#F5F5F5" : "#171717" }}
        >
          {trendingHeading}
        </h2>
      </div>
      {/* 3-col grid, 6 portrait tiles — showcase kitchen STYLES (not
          utility categories). aspect-[4/5] gives the "slightly taller
          than wide" shape merchants asked for so the style photography
          breathes. Each tile carries the style image bg + label. */}
      <div className={`grid grid-cols-3 ${compact ? "gap-1.5 md:gap-2 max-w-md" : "gap-2 md:gap-3"}`}>
        {categories.slice(0, 6).map((cat, i) => {
          // Style categories (those carrying `description` — the flag
          // that also drives CanteenStyleShowcase) must always show the
          // category's own style photograph, never a keyword-matched
          // product image. Otherwise the tile drifts from the image
          // the user sees after tapping in.
          const match = cat.description
            ? { imageUrl: cat.fallback, hrefPath: null as string | null }
            : matchProductForCategory(cat, products);
          const commonProps = {
            className:
              "relative flex aspect-[4/5] w-full overflow-hidden rounded-xl border bg-neutral-100 shadow-sm transition active:scale-[0.97]",
            style: {
              borderColor: i === 0 ? TAN : "rgba(139,69,19,0.12)"
            } as React.CSSProperties
          };
          // <img> instead of background-image so rounded-xl clips
          // cleanly against the border. Background-image blurred sub-
          // pixel at the corners producing a "glittery" edge on both
          // mobile + desktop; img+object-cover renders sharp.
          const content = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={match.imageUrl}
                alt={cat.label}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-3/5"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.80) 15%, rgba(0,0,0,0.30) 60%, transparent 100%)" }}
              />
              <span className={`relative z-10 mt-auto w-full text-center font-black leading-none text-white drop-shadow-md ${compact ? "px-1 pb-1 text-[11px] md:text-[11px]" : "px-2 pb-2 text-[12px] md:text-[14px]"}`}>
                {cat.label}
              </span>
            </>
          );

          // Swipe-mode: tile is a <button> that opens the swipe sheet.
          if (swipeMode) {
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => setOpenCategoryIdx(i)}
                aria-label={`Open ${cat.label} trending`}
                {...commonProps}
              >
                {content}
              </button>
            );
          }
          // Legacy mode: tile is a <Link> when we have a product match,
          // else a passive <div>.
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

      {/* Style showcase — mounts when the trade's trending items are
          STYLE cards (they carry `description` fields) rather than
          utility categories. Full-screen Tinder-style swipe view with
          Enquire Now CTA. Used by kitchen-fitter today; every future
          trade that adopts style-showcase gets it automatically. */}
      {swipeMode && openCategory && openCategory.description && (
        <CanteenStyleShowcase
          open={openCategoryIdx != null}
          onClose={() => setOpenCategoryIdx(null)}
          items={categories.map<StyleShowcaseItem>((c) => ({
            slug: c.slug,
            label: c.label,
            imageUrl: c.fallback,
            description: c.description,
            priceFromGbp: c.priceFromGbp,
            priceToGbp: c.priceToGbp
          }))}
          initialIndex={openCategoryIdx ?? 0}
          categoryLabel={trendingHeading}
          hostSlug={hostSlug ?? canteenSlug ?? ""}
          hostFirstName={hostFirstName!}
          hostDisplayName={hostDisplayName ?? hostFirstName!}
          hostWhatsapp={hostWhatsapp}
          tradeLabel={tradeLabel}
          hostCity={hostCity}
          canteenSlug={canteenSlug}
        />
      )}
      {/* Product-match swipe sheet — the older flow. Only mounts when
          NOT in style-showcase mode (i.e. the tapped category has no
          description, so we fall back to matching against the host's
          products). */}
      {swipeMode && openCategory && !openCategory.description && (
        <CanteenTrendingSwipeSheet
          open={openCategoryIdx != null}
          onClose={() => setOpenCategoryIdx(null)}
          items={swipeItems}
          categoryLabel={openCategory.label}
          canteenSlug={canteenSlug!}
          hostSlug={hostSlug ?? canteenSlug!}
          hostFirstName={hostFirstName!}
          hostDisplayName={hostDisplayName ?? hostFirstName!}
          hostWhatsapp={hostWhatsapp}
          tradeLabel={tradeLabel}
          hostCity={hostCity}
          sendToTradeCenter={sendToTradeCenter}
        />
      )}
    </section>
  );
}
