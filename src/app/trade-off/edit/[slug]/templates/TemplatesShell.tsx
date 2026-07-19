"use client";

// Merchant mobile app palette picker. Renders one card per palette
// (Chalk, Iron, Oak, ...) — each is the same layout in a different
// colour pack. Tapping "Apply" writes the palette slug onto
// hammerex_trade_off_listings.palette_slug for the signed-in merchant.
//
// The `hammerex_app_templates` catalogue + apply-template endpoint
// still exist but are dormant — layout is currently fixed at one
// design and only the palette varies. Reactivate them if a second
// layout ever ships.

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, ExternalLink, Eye, Lock, Monitor, Sparkles, X } from "lucide-react";
import {
  PALETTES,
  PALETTE_ORDER,
  READY_PALETTES,
  type PaletteSlug,
  type PaletteTokens
} from "@/lib/paletteTokens";
import { MOCK_CANTEENS, type Canteen } from "@/lib/canteens";
import { ThemeControls } from "./ThemeControls";
import { PhoneMockupPreview } from "./PhoneMockupPreview";
import type { FeedTileLibraryEntry } from "@/lib/canteenFeedTileLibrary.server";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK = "#0A0A0A";

// ─── [DEV BUTTON] Colour tuning helpers ─────────────────────────
//
// Live palette-accent tuner overlay on each template card. Lets
// Philip iterate on hex values without editing paletteTokens.ts by
// hand. Ships wrapped in [DEV BUTTON] markers so `grep DEV BUTTON`
// finds every insertion when the tuning phase completes and we
// strip the feature. Do NOT rely on this in production — the
// override_accent query param on canteen pages is also gated by
// the same [DEV BUTTON] marker in page.tsx.
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(clean)) return null;
  return {
    r: parseInt(clean.slice(1, 3), 16),
    g: parseInt(clean.slice(3, 5), 16),
    b: parseInt(clean.slice(5, 7), 16)
  };
}
function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const h = (v: number) => clamp(v).toString(16).padStart(2, "0").toUpperCase();
  return `#${h(r)}${h(g)}${h(b)}`;
}
/** Shift a hex colour lighter/darker by `amount` in the range -1..1.
 *  Positive = mix with white, negative = mix with black. Simple linear
 *  blend — good enough for eyeball tuning, not perceptually uniform. */
function shiftLightness(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  if (amount >= 0) {
    return rgbToHex(
      rgb.r + (255 - rgb.r) * amount,
      rgb.g + (255 - rgb.g) * amount,
      rgb.b + (255 - rgb.b) * amount
    );
  }
  const t = -amount;
  return rgbToHex(rgb.r * (1 - t), rgb.g * (1 - t), rgb.b * (1 - t));
}
// ─── [/DEV BUTTON] ──────────────────────────────────────────────

// One entry per palette — each is the same layout tuned to a
// different trade. When its demo canteen ships, drop the image URL
// in and update PREVIEW_CANTEEN_SLUG for that palette; until then the
// card renders a "Screenshot on the way" placeholder AND still links
// "View live app" back to Mike Watson's canteen with the palette
// overridden via `?preview_palette=<slug>`. Layout inheritance means
// editing CanteenHeroWow.tsx / CanteenLiveFeedWow.tsx updates EVERY
// palette's canteen — no per-palette layout code.
type PaletteReference = {
  /** Trade the palette is designed with in mind — shown on the card
   *  as "Reference trade · X". Aspirational until that trade's demo
   *  canteen ships. */
  tradeLabel: string;
  /** Static screenshot inside the phone frame. Null while the palette's
   *  own hand-drawn mockup hasn't been generated yet — card falls
   *  back to a "Screenshot on the way" dashed placeholder. */
  image:      string | null;
  /** When true, wrap the image in a CSS iPhone chassis (dynamic island,
   *  home indicator, bezel). Use for raw photos or screenshots without
   *  a baked-in phone frame. Skip for ChatGPT-generated mockups that
   *  already include a phone drawn inside the image (Chalk). */
  wrapInPhoneChassis?: boolean;
  /** Live iframe URL — when set, renders the actual live canteen page
   *  inside the CSS phone chassis instead of a static image. Overrides
   *  `image`. Use for palettes where a real demo canteen exists and
   *  we want to show the ACTUAL running app. */
  livePreviewUrl?: string;
};

// Reference trade per palette, drawn from the canonical catalog at
// docs/trade-palette-catalog.md — each palette shows ONE representative
// trade on its card ("Reference trade · X"). Full 20-palette set locked
// in 2026-07-15. Images are optional; every card falls back to a live
// iframe of the reference canteen with `?preview_palette=<slug>` so
// merchants see the ACTUAL running app in that palette without waiting
// for a static screenshot.
const PALETTE_REFERENCES: Record<PaletteSlug, PaletteReference> = {
  // — Light warm (6) —
  chalk: {
    tradeLabel: "Kitchen Fitter",
    image:      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2009_45_57%20PM.png"
  },
  oak:       { tradeLabel: "Carpenter",              image: null },
  blush:     { tradeLabel: "Interior Designer",      image: null },
  sandstone: { tradeLabel: "Heritage Stone Mason",   image: null },
  brick:     { tradeLabel: "Roofer",                 image: null },
  copper:    { tradeLabel: "Coppersmith",            image: null },

  // — Light cool (5) —
  slate: {
    // Slate uses live iframe (not static image). Renders James Holt's
    // plumber canteen (a real Slate-native demo) inside the phone
    // chassis so merchants see Slate on actual working plumber data
    // rather than a static hero photo screenshot.
    tradeLabel: "Plumber",
    image: null
  },
  aqua:    { tradeLabel: "Pool Builder",        image: null },
  moss:    { tradeLabel: "Landscaper",          image: null },
  emerald: { tradeLabel: "Luxury Landscaper",   image: null },
  steel:   { tradeLabel: "Welder / Fabricator", image: null },

  // — Light neutral (3) —
  ink:      { tradeLabel: "Architect",           image: null },
  concrete: { tradeLabel: "Concrete Specialist", image: null },
  mortar:   { tradeLabel: "Bricklayer",          image: null },

  // — Dark (5) —
  iron: {
    tradeLabel: "Electrician",
    image:      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2015,%202026,%2003_19_54%20AM.png"
  },
  charcoal: { tradeLabel: "Prestige Builder",    image: null },
  timber:   { tradeLabel: "Bespoke Joiner",      image: null },
  marine:   { tradeLabel: "Marina Builder",      image: null },
  storm:    { tradeLabel: "Emergency Repair",    image: null },

  // — Signal (1) —
  "hi-vis": { tradeLabel: "Groundworker", image: null }
};

/** Per-palette reference canteen path. Every one of the 20 palettes
 *  has its own dedicated demo canteen (2026-07-15 Phase 3 seeding)
 *  so the picker shows 20 distinct app previews — different hero,
 *  different merchant name, different trade — not one canteen re-
 *  coloured 20 times. When a merchant clicks Live on the Timber card,
 *  they see Edward Halliwell's bespoke joinery canteen; on Blush they
 *  see Rebecca Ashworth's interior design canteen; etc. */
const PREVIEW_CANTEEN_PATH: Partial<Record<PaletteSlug, string>> = {
  // — Light warm —
  chalk:     "/trade-off/yard/canteens/uk-kitchen-fitters",
  oak:       "/trade-off/yard/canteens/uk-master-carpenters",
  blush:     "/trade-off/yard/canteens/uk-interior-designers",
  sandstone: "/trade-off/yard/canteens/uk-heritage-stone",
  brick:     "/trade-off/yard/canteens/uk-tile-roofers",
  copper:    "/trade-off/yard/canteens/uk-coppersmiths",
  // — Light cool —
  slate:     "/trade-off/yard/canteens/uk-verified-plumbers",
  aqua:      "/trade-off/yard/canteens/uk-pool-builders",
  moss:      "/trade-off/yard/canteens/uk-landscapers",
  emerald:   "/trade-off/yard/canteens/uk-garden-designers",
  steel:     "/trade-off/yard/canteens/uk-metal-fabricators",
  // — Light neutral —
  ink:       "/trade-off/yard/canteens/uk-architects",
  concrete:  "/trade-off/yard/canteens/uk-concrete-specialists",
  mortar:    "/trade-off/yard/canteens/uk-bricklayers",
  // — Dark —
  iron:      "/trade-off/yard/canteens/uk-rated-electricians",
  charcoal:  "/trade-off/yard/canteens/uk-prestige-builders",
  timber:    "/trade-off/yard/canteens/uk-bespoke-joiners",
  marine:    "/trade-off/yard/canteens/uk-marina-builders",
  storm:     "/trade-off/yard/canteens/uk-emergency-repairs",
  // — Signal —
  "hi-vis":  "/trade-off/yard/canteens/uk-groundworkers"
};
const PREVIEW_CANTEEN_FALLBACK = "/trade-off/yard/canteens/uk-kitchen-fitters";

function livePreviewUrl(
  pSlug: PaletteSlug,
  overrideAccent?: string | null,
  heroShade?: number | null,
  canteenPath?: string,
  themeMode?: "light" | "dark" | null
): string {
  // When a canteen path is supplied (canteen-driven cards), always
  // append ?preview_palette so the target canteen renders in the card's
  // palette regardless of its own persisted paletteSlug. The chalk
  // special-case (skip preview_palette when it matches the app default)
  // only applies to the legacy palette-driven fallback path.
  const path = canteenPath ?? PREVIEW_CANTEEN_PATH[pSlug];
  let url: string;
  if (canteenPath) {
    url = `${canteenPath}?preview_palette=${pSlug}`;
  } else {
    url = path
      ? (pSlug === "chalk" ? path : `${path}?preview_palette=${pSlug}`)
      : `${PREVIEW_CANTEEN_FALLBACK}?preview_palette=${pSlug}`;
  }
  // Enforce embed=1 on EVERY template preview URL (Philip 2026-07-16
  // — "never ever have this showing on templates"). The canteen page
  // + GlobalHeader both key their chrome-suppression off this param;
  // every template card becomes a bare hero-only preview. If any new
  // preview code path forgets to route through this builder, that
  // preview WILL show the header — this is the choke point.
  {
    const sep = url.includes("?") ? "&" : "?";
    if (!url.includes("embed=1")) url = `${url}${sep}embed=1`;
  }
  // [DEV BUTTON] Append override_accent + hero_shade when tuner set.
  if (overrideAccent && /^#[0-9A-Fa-f]{6}$/.test(overrideAccent)) {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}override_accent=${encodeURIComponent(overrideAccent)}`;
  }
  if (heroShade != null && Number.isFinite(heroShade) && heroShade >= 0 && heroShade <= 100 && heroShade !== 100) {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}hero_shade=${heroShade}`;
  }
  if (themeMode === "dark") {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}theme_mode=dark`;
  }
  // [/DEV BUTTON]
  return url;
}

// Every canteen with a palette becomes one card in the picker. Multiple
// canteens can share a palette (Oak has 5 reference trades — carpenters,
// furniture makers, wood restorers, tree house builders, canopy specs;
// Timber has 3; Copper has 2; Mortar has 3; Aqua has 2). Installing any
// card writes that card's palette to the merchant — cards sharing a
// palette all resolve to the same install action but differ in trade
// name, host, and hero preview. Ordering follows MOCK_CANTEENS so
// palette families stay grouped visually.
function derivePickerCanteens(): Canteen[] {
  const paletteSet = new Set<string>(PALETTE_ORDER as readonly string[]);
  return MOCK_CANTEENS.filter(
    (c) => typeof c.paletteSlug === "string" && paletteSet.has(c.paletteSlug)
  );
}
const PICKER_CANTEENS: Canteen[] = derivePickerCanteens();

// Template → reference canteen slug map. Each DB template row in
// hammerex_app_templates corresponds to one demo canteen; the card
// links to that canteen for the live preview iframe. Add new entries
// here in lockstep with the migration that inserts the DB row.
const TEMPLATE_REFERENCE_CANTEEN: Record<string, string> = {
  "template-1":  "uk-kitchen-fitters",
  "template-2":  "uk-rated-electricians",
  "template-3":  "uk-plasterers",
  "template-4":  "uk-furniture-makers",
  "template-5":  "uk-wood-carvers",
  "template-6":  "uk-wood-restorers",
  "template-7":  "uk-wood-stainers",
  "template-8":  "uk-tree-house-builders",
  "template-9":  "uk-water-feature-specialists",
  "template-10": "uk-guttering-downpipes",
  "template-11": "uk-copper-flashing-specialists",
  "template-12": "uk-canopy-specialists"
};

type AppTemplateCard = {
  slug:             string;
  name:             string;
  themeName:        string;
  themeBgColor:     string;
  themeAccentColor: string;
  themeInkColor:    string;
  previewImageUrl:  string | null;
  description:      string | null;
};

export function TemplatesShell({
  slug,
  appliedPaletteSlug,
  templates = [],
  myCanteen = null,
  feedTileLibrary = []
}: {
  slug: string;
  appliedPaletteSlug: PaletteSlug;
  /** Full template catalogue from `hammerex_app_templates`. Rendered
   *  as the "Featured Templates" strip above the palette grid so
   *  merchants see every shipped template, not just the 20 palette
   *  variations. */
  templates?: AppTemplateCard[];
  /** The current merchant's own canteen (loaded server-side from
   *  hammerex_canteens by slug). Powers the "Your canteen" strip at
   *  the top of the picker — merchant sees THEIR canteen in the
   *  currently-installed template with View app + Go Live CTAs.
   *  Null when the slug has no DB row (fixture / demo merchant). */
  myCanteen?: {
    slug:             string;
    name:             string;
    tradeSlug:        string | null;
    headerBgUrl:      string | null;
    templateSlug:     string;
    paletteSlug:      string;
    themeMode:        "light" | "dark";
    paletteIntensity: "bold" | "standard" | "subtle";
    heroShade:        number;
    feedTileColor:    string | null;
    feedTileImageUrl: string | null;
    baseHue:          "yellow" | "orange" | "red" | "green" | "teal" | "blue" | "purple" | "neutral" | null;
    lightness:        number | null;
    feedTileHue:      "yellow" | "orange" | "red" | "green" | "teal" | "blue" | "purple" | "neutral" | null;
    feedTileLightness: number | null;
  } | null;
  /** DB-loaded Live Feed Tile library. Passed down to ThemeControls
   *  so the Library tab renders live entries (managed at /admin/
   *  feed-tile-library) instead of the static seed. */
  feedTileLibrary?: FeedTileLibraryEntry[];
}) {
  const [palette, setPalette] = useState<PaletteSlug>(appliedPaletteSlug);
  // Bumped on every successful theme save so the live phone preview
  // iframe reloads and shows the merchant's latest choice.
  const [previewRefreshTick, setPreviewRefreshTick] = useState(0);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // [DEV BUTTON] Per-palette accent overrides for the dev colour tuner.
  // Map palette slug → { picked hex, lightness shift -1..1 }. When the
  // merchant tunes a slider or picker on a card, its live iframe re-
  // renders via ?override_accent=<computed hex>. Empty map = no tuning
  // = original palette hex from paletteTokens.ts. Clear by pressing
  // Reset. Save copies the computed hex to clipboard.
  const [devAccent, setDevAccent] = useState<
    Partial<Record<PaletteSlug, { base: string; shift: number }>>
  >({});
  // Hero shade tuner — 0-100 per palette. 100 = current palette bg
  // fully applied, 0 = neutral cream (palette tint disappears from
  // the hero entirely). Absence in the map means 100 (default).
  const [devHeroShade, setDevHeroShade] = useState<Partial<Record<PaletteSlug, number>>>({});
  // Dark-mode toggle — per palette. When "dark", the iframe canteen
  // renders with page bg swapped from cream (#FBF6EC) to near-black
  // and the hero cream veil swapped to a black veil. The unshaded
  // portion of the hero photo stays clear (no overlay). Absence =
  // light (cream) mode. Per Philip 2026-07-15: gives every palette a
  // one-click dark variant preview without a whole second palette.
  const [devThemeMode, setDevThemeMode] = useState<Partial<Record<PaletteSlug, "light" | "dark">>>({});
  const [devToast, setDevToast] = useState<string | null>(null);
  // [/DEV BUTTON]
  // Live-preview modal state. Carries BOTH the palette (drives Install)
  // and the canteen slug (drives iframe URL) so the modal previews the
  // specific canteen the merchant tapped — not a generic per-palette
  // canteen. Null = closed. This is the "App Store screenshot preview"
  // pattern — tapping Live on a card zooms the iPhone frame into a
  // fullscreen iframe so the merchant can scroll / tap / experience the
  // palette on real data BEFORE tapping Install. Escape key + backdrop
  // tap both close.
  const [livePreviewEntry, setLivePreviewEntry] = useState<
    { palette: PaletteSlug; canteenSlug: string } | null
  >(null);
  useEffect(() => {
    if (!livePreviewEntry) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLivePreviewEntry(null);
    };
    window.addEventListener("keydown", onKey);
    // Prevent scroll on body while modal is open so the iframe scroll
    // doesn't compete with page scroll on mobile.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [livePreviewEntry]);

  async function applyPalette(next: PaletteSlug) {
    if (next === palette || submitting) return;
    if (!READY_PALETTES.includes(next)) return;   // Chip disabled — no-op
    setSubmitting(`palette:${next}`);
    setError(null);
    // Optimistic swap so the chip lights up immediately; revert on error.
    const previous = palette;
    setPalette(next);
    try {
      const res = await fetch(`/api/merchant/${encodeURIComponent(slug)}/apply-palette`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paletteSlug: next })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setPalette(previous);
        setError(
          data.error === "not-signed-in"
            ? "Please sign in as this merchant."
            : "Palette change failed — please try again."
        );
      }
    } catch {
      setPalette(previous);
      setError("Network error — please try again.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <main className="templates-shell-root mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-6 md:pt-10">
      {/* Hide the browser scrollbar on the templates page — Philip
          2026-07-17. Scroll still works; just no visible chrome.
          Scoped via a page-local class so this doesn't leak into
          other pages. */}
      <style>{`
        html:has(.templates-shell-root) { scrollbar-width: none; -ms-overflow-style: none; }
        html:has(.templates-shell-root)::-webkit-scrollbar { display: none; width: 0; height: 0; }
        body:has(.templates-shell-root) { scrollbar-width: none; -ms-overflow-style: none; }
        body:has(.templates-shell-root)::-webkit-scrollbar { display: none; width: 0; height: 0; }
        .templates-shell-root ::-webkit-scrollbar { display: none; }
      `}</style>
      <div className="mb-6">
        <Link
          href={`/trade-off/edit/${slug}`}
          className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft size={12} strokeWidth={2.5}/>
          Back to dashboard
        </Link>
      </div>

      {/* Header — moved to TOP of page per Philip 2026-07-17.
          "Mobile app themes / Choose your palette" + intro copy
          + Brian Talton designer credit sit above the merchant
          controls so the page reads: intro → your canteen → tools. */}
      <header className="mb-6 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Mobile app themes
          </div>
          <h1
            className="mt-1 text-[28px] font-black leading-tight text-neutral-900 md:text-[34px]"
            style={{ fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif' }}
          >
            Choose your palette
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-neutral-600">
            {PICKER_CANTEENS.length} trade demos, {PALETTE_ORDER.length} palettes, one layout. Every card is a real canteen you can preview live in your <b>mobile app</b> AND on the <b>canteen page</b> — same colours, both surfaces. Tap <b>Live</b> to zoom in, <b>Canteen page</b> to open the full-width version in a new tab, then <b>Install</b> the palette that fits your trade. Reversible any time; your content (products, services, posts, projects) never changes.
          </p>

          {/* Designer credit — Brian Talton is the layout + palette
              author. Trust signal: real engineer, not a stock template. */}
          <DesignerCredit
            avatarUrl="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2014,%202026,%2011_18_25%20PM.png"
            name="Brian Talton"
            role="Design Engineer"
            organisation="The Networkers"
            designerNote=""
          />
        </div>
      </header>

      {/* Your canteen strip + theme controls — the "logged-in
          merchant" panels below the intro. Only render when the URL
          slug matches a real DB canteen.
          Two-column layout on lg+: controls left, live phone
          preview right. Preview iframe auto-reloads after every
          save so merchants see their choice in real time. */}
      {myCanteen && (
        <>
          <YourCanteenStrip slug={slug} canteen={myCanteen} />
          <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6">
            <ThemeControls
              slug={slug}
              tradeSlug={myCanteen.tradeSlug}
              feedTileLibrary={feedTileLibrary}
              initialPalette={myCanteen.paletteSlug as PaletteSlug}
              initialMode={myCanteen.themeMode}
              initialIntensity={myCanteen.paletteIntensity}
              initialHeroShade={myCanteen.heroShade}
              initialFeedTileColor={myCanteen.feedTileColor}
              initialFeedTileImageUrl={myCanteen.feedTileImageUrl}
              initialBaseHue={myCanteen.baseHue}
              initialLightness={myCanteen.lightness}
              initialFeedTileHue={myCanteen.feedTileHue}
              initialFeedTileLightness={myCanteen.feedTileLightness}
              onSaved={() => setPreviewRefreshTick((t) => t + 1)}
            />
            <PhoneMockupPreview
              slug={slug}
              refreshTick={previewRefreshTick}
            />
          </div>
        </>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-[12px] font-black uppercase tracking-wider text-red-700">
          {error}
        </div>
      )}

      {/* Featured Templates / App Store strip removed per Philip
          2026-07-17. Single-layout architecture — no template
          browsing needed. ThemeControls is the only choice surface. */}
      {false && templates.length > 0 && (
        <section className="mb-10">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                App Store
              </div>
              <h2 className="mt-0.5 text-[18px] font-black leading-tight text-neutral-900 md:text-[20px]">
                All Templates ({templates.length})
              </h2>
            </div>
            <div className="text-[10px] font-bold text-neutral-500">
              Live template library
            </div>
          </div>
          <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
            {templates.map((tpl) => {
              const canteenSlug = TEMPLATE_REFERENCE_CANTEEN[tpl.slug];
              const previewHref = canteenSlug
                ? `/trade-off/yard/canteens/${canteenSlug}`
                : `/trade-off/edit/${slug}/templates`;
              return (
                <Link
                  key={tpl.slug}
                  href={previewHref}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group flex-shrink-0 snap-start overflow-hidden rounded-2xl border bg-white shadow-md transition hover:shadow-lg"
                  style={{
                    width: "180px",
                    borderColor: "rgba(139,69,19,0.15)"
                  }}
                >
                  {/* Preview thumbnail */}
                  <div
                    className="relative w-full overflow-hidden"
                    style={{
                      aspectRatio: "4 / 5",
                      backgroundColor: tpl.themeBgColor
                    }}
                  >
                    {tpl.previewImageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={tpl.previewImageUrl}
                        alt=""
                        aria-hidden
                        loading="lazy"
                        className="block h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : null}
                    {/* Palette-accent bottom stripe so the theme colour
                        reads at a glance even on abstract preview shots. */}
                    <div
                      aria-hidden
                      className="absolute bottom-0 left-0 right-0 h-1.5"
                      style={{ backgroundColor: tpl.themeAccentColor }}
                    />
                  </div>
                  {/* Meta strip */}
                  <div className="flex items-center gap-2 px-3 py-2">
                    <span
                      className="h-3 w-3 flex-shrink-0 rounded-full shadow-sm"
                      style={{ backgroundColor: tpl.themeAccentColor }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-black uppercase tracking-wider text-neutral-500">
                        {tpl.slug}
                      </div>
                      <div className="truncate text-[13px] font-black text-neutral-900">
                        {tpl.name}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Legacy 20-card palette grid — hidden when the merchant has
          a real DB canteen (myCanteen != null). The new ThemeControls
          panel above replaces this UI. Grid kept in the DOM only for
          fixture/demo merchants without a DB row so the picker still
          renders something for them. Delete this whole block in a
          follow-up cleanup pass once fixture merchants migrate. */}
      {!myCanteen && (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {PICKER_CANTEENS.map((canteen, idx) => {
          const pSlug = canteen.paletteSlug as PaletteSlug;
          const p = PALETTES[pSlug];
          const ref = PALETTE_REFERENCES[pSlug];
          const canteenPath = `/trade-off/yard/canteens/${canteen.slug}`;
          // Only the "primary" canteen for a palette (the one wired into
          // PREVIEW_CANTEEN_PATH) uses the hand-drawn ChatGPT mockup
          // (Chalk kitchen fitters / Iron rated electricians). Secondary
          // canteens that share the palette always render the live
          // iframe so they show their own hero + host, not the primary
          // canteen's mockup.
          const isPrimaryForPalette = PREVIEW_CANTEEN_PATH[pSlug] === canteenPath;
          const staticImage = isPrimaryForPalette ? ref.image : null;
          const isReady = READY_PALETTES.includes(pSlug);
          const isSelected = pSlug === palette;
          const isPending = submitting === `palette:${pSlug}`;
          const cardNumber = String(idx + 1).padStart(2, "0");
          return (
            <article
              // Multiple canteens can share a palette (mortar has 3,
              // oak has 5) so keying by palette slug produces duplicate
              // keys. Canteen slug is unique per card and stable across
              // re-renders — the right identity here.
              key={canteen.slug}
              className="flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition"
              style={{
                borderColor: isSelected ? BRAND_YELLOW : "rgba(139,69,19,0.15)",
                boxShadow: isSelected ? `0 0 0 2px ${BRAND_YELLOW}55` : undefined
              }}
            >
              {/* Preview area — full-bleed palette-coloured gradient
                  behind the screenshot (or the placeholder). Gradient
                  uses the palette's own bg so the card FEELS like the
                  theme even before its screenshot lands. */}
              <div
                className="relative flex items-center justify-center p-2"
                style={{
                  // Preview area background — always offwhite (Chalk
                  // cream). Every palette's phone frame sits on the
                  // same neutral backdrop so the phone chassis + its
                  // screen colour do the differentiation, not a
                  // themed card gradient. Padding trimmed to p-2 so
                  // the card wraps tighter around the phone image.
                  background: "#FBF6EC"
                }}
              >
                {/* Every card renders a LIVE iframe by default. Static
                    `ref.image` (Chalk + Iron ChatGPT mockups) still
                    render as images when available — they're higher
                    fidelity than iframe. Every other palette gets the
                    actual running canteen with `?preview_palette=<slug>`
                    injected, scaled inside the CSS iPhone chassis. Zero
                    per-palette work needed for new palettes.
                    [DEV BUTTON] When the colour tuner is active on this
                    palette (devAccent[pSlug] set), we FORCE iframe mode
                    so the tuned accent renders live — the static image
                    can't reflect palette changes. */}
                {(() => {
                  const tuning = devAccent[pSlug];
                  const tunedHex = tuning
                    ? shiftLightness(tuning.base, tuning.shift)
                    : null;
                  const shadeVal = devHeroShade[pSlug];
                  const shadeActive = shadeVal != null && shadeVal !== 100;
                  const modeVal = devThemeMode[pSlug] ?? "light";
                  const modeActive = modeVal === "dark";
                  const useIframe = Boolean(tuning) || shadeActive || modeActive || !staticImage;
                  return (
                    <IphoneFrame
                      previewImageUrl={useIframe ? undefined : (staticImage ?? undefined)}
                      wrapInPhoneChassis={ref.wrapInPhoneChassis || useIframe}
                      livePreviewUrl={
                        useIframe
                          ? livePreviewUrl(pSlug, tunedHex, shadeVal ?? null, canteenPath, modeVal)
                          : undefined
                      }
                    />
                  );
                })()}
                {!staticImage && (
                  /* Subtle "Live" pip in the corner so merchants know
                     the phone is running the actual app, not a mockup. */
                  <span
                    className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8.5px] font-black uppercase tracking-[0.14em] shadow-sm"
                    style={{ backgroundColor: "rgba(0,0,0,0.65)", color: "#FFFFFF", backdropFilter: "blur(4px)" }}
                  >
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: "#10B981" }}
                    />
                    Live
                  </span>
                )}
                {pSlug === "chalk" && isPrimaryForPalette && !isSelected && (
                  <span
                    className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] shadow-md"
                    style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
                  >
                    <Sparkles size={10} strokeWidth={2.6}/>
                    Default
                  </span>
                )}
              </div>

              {/* [DEV BUTTON] Vibe-preset preview — palette 14 (Poppy)
                  only, so Philip can see the concept live before we
                  commit to a merchant-facing "Vibe" feature. Three
                  chips: Subtle / Standard / Bold. Each applies a
                  preset combo of accent shift + hero shade via the
                  same devAccent + devHeroShade state the DEV tuner
                  uses, so the live iframe re-renders instantly. */}
              {pSlug === "mortar" && (
                <div
                  className="flex items-center gap-1.5 border-t bg-neutral-900 px-3 py-2 text-[10px]"
                  style={{ borderColor: "rgba(0,0,0,0.20)" }}
                >
                  <span className="text-[8.5px] font-black uppercase tracking-[0.14em] text-white/60">
                    Vibe
                  </span>
                  {(() => {
                    const presets: Array<{
                      label: string;
                      shade: number;
                      shift: number;
                      description: string;
                    }> = [
                      // Subtle = colour only, hero stays untouched at
                      // 100% shade. Just softens the accent — light red
                      // instead of deep red. Per Philip 2026-07-15:
                      // "subtle we need without the hero edit — just
                      // concentrate on the color."
                      { label: "Subtle",   shade: 100, shift: 0.30,  description: "Softer pink accent, hero untouched" },
                      { label: "Standard", shade: 100, shift: 0.00,  description: "Default — full red hero + Poppy #DC2626" },
                      { label: "Bold",     shade: 100, shift: -0.20, description: "Deep red hero + darker accent — maximum brand" }
                    ];
                    return presets.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          // Defensive: always start from the palette's
                          // ORIGINAL accent, not any DEV-picker override
                          // the user may have set earlier. Prevents
                          // compound shifts (e.g. Bold applied to an
                          // already-darkened accent produces mud).
                          const originalAccent =
                            PALETTES[pSlug]?.accent ?? p.accent;
                          setDevAccent((prev) => ({
                            ...prev,
                            [pSlug]: { base: originalAccent, shift: preset.shift }
                          }));
                          setDevHeroShade((prev) => ({
                            ...prev,
                            [pSlug]: preset.shade
                          }));
                        }}
                        className="flex-1 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-white/10 active:scale-[0.97]"
                        style={{ borderColor: "rgba(255,255,255,0.30)" }}
                        title={preset.description}
                      >
                        {preset.label}
                      </button>
                    ));
                  })()}
                </div>
              )}
              {/* [/DEV BUTTON] */}

              {/* [DEV BUTTON] Colour tuner strip — lets Philip pick a
                  base colour + shift its lightness, live-previews on
                  the iframe above, Save copies the final hex to the
                  clipboard so he can paste it into paletteTokens.ts.
                  Reset clears the override for this palette. Marked
                  with [DEV BUTTON] comment for one-command removal
                  when tuning is complete. */}
              {(() => {
                const tuning = devAccent[pSlug] ?? { base: p.accent, shift: 0 };
                const finalHex = shiftLightness(tuning.base, tuning.shift);
                const shiftPct = Math.round(tuning.shift * 100);
                const isTuning = Boolean(devAccent[pSlug]);
                return (
                  <div
                    className="flex items-center gap-1.5 border-y bg-yellow-50/70 px-3 py-1.5 text-[10px]"
                    style={{ borderColor: "rgba(184,134,11,0.30)" }}
                  >
                    <span className="text-[8.5px] font-black uppercase tracking-[0.14em] text-neutral-500">DEV</span>
                    <input
                      type="color"
                      value={tuning.base}
                      onChange={(e) =>
                        setDevAccent((prev) => ({
                          ...prev,
                          [pSlug]: { base: e.target.value.toUpperCase(), shift: tuning.shift }
                        }))
                      }
                      className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                      title="Pick base hex"
                    />
                    <input
                      type="range"
                      min={-50}
                      max={50}
                      step={1}
                      value={shiftPct}
                      onChange={(e) =>
                        setDevAccent((prev) => ({
                          ...prev,
                          [pSlug]: { base: (prev[pSlug]?.base ?? p.accent), shift: Number(e.target.value) / 100 }
                        }))
                      }
                      className="h-1 flex-1 cursor-pointer accent-neutral-700"
                      title={`Lightness ${shiftPct > 0 ? "+" : ""}${shiftPct}%`}
                    />
                    <span className="font-mono text-[10px] text-neutral-800">{finalHex}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(finalHex);
                          setDevToast(`Copied ${finalHex} to clipboard — paste into paletteTokens.ts`);
                          window.setTimeout(() => setDevToast(null), 3200);
                        } catch {
                          setDevToast(`Copy failed — hex is ${finalHex}`);
                          window.setTimeout(() => setDevToast(null), 4000);
                        }
                      }}
                      className="inline-flex h-6 items-center rounded px-2 text-[9px] font-black uppercase tracking-wider shadow-sm active:scale-95"
                      style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                      title="Copy final hex to clipboard"
                    >
                      Save
                    </button>
                    {isTuning && (
                      <button
                        type="button"
                        onClick={() =>
                          setDevAccent((prev) => {
                            const next = { ...prev };
                            delete next[pSlug];
                            return next;
                          })
                        }
                        className="text-[9px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
                        title="Reset to original palette hex"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                );
              })()}
              {/* Dark-mode toggle — sits directly under the colour
                  picker, per Philip 2026-07-15. Flips the iframe canteen
                  from cream page bg + cream hero veil to near-black
                  equivalents. The hero photo itself stays unshaded
                  (no overlay) where the palette veil isn't drawn. Uses
                  ?theme_mode=dark on the iframe URL — canteen page.tsx
                  reads the flag and threads a dark background through
                  to CanteenPageShell. Reversible per-card; other cards
                  keep their own mode. */}
              {(() => {
                const modeVal = devThemeMode[pSlug] ?? "light";
                const isDark = modeVal === "dark";
                return (
                  <div
                    className="flex items-center gap-1.5 border-b bg-yellow-50/70 px-3 py-1.5 text-[10px]"
                    style={{ borderColor: "rgba(184,134,11,0.30)" }}
                  >
                    <span className="text-[8.5px] font-black uppercase tracking-[0.14em] text-neutral-500">MODE</span>
                    <button
                      type="button"
                      onClick={() =>
                        setDevThemeMode((prev) => ({
                          ...prev,
                          [pSlug]: isDark ? "light" : "dark"
                        }))
                      }
                      className="inline-flex h-6 flex-1 items-center justify-center gap-1 rounded-full border px-2 text-[9.5px] font-black uppercase tracking-wider shadow-sm active:scale-[0.97]"
                      style={{
                        backgroundColor: isDark ? BRAND_BLACK : "#FFFFFF",
                        color: isDark ? BRAND_YELLOW : BRAND_BLACK,
                        borderColor: isDark ? BRAND_BLACK : "rgba(0,0,0,0.20)"
                      }}
                      title={isDark ? "Switch back to cream (light) background" : "Switch page + hero veil to black"}
                    >
                      {isDark ? "Dark ON" : "Dark OFF"}
                    </button>
                    {isDark && (
                      <button
                        type="button"
                        onClick={() =>
                          setDevThemeMode((prev) => {
                            const next = { ...prev };
                            delete next[pSlug];
                            return next;
                          })
                        }
                        className="text-[9px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
                        title="Reset to light mode"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                );
              })()}
              {/* Hero shade slider — 100 = full palette bg on hero,
                  0 = neutral cream (palette tint fades out entirely).
                  Sits directly under the accent tuner row so both
                  controls read as one dev panel. */}
              {(() => {
                const shadeVal = devHeroShade[pSlug] ?? 100;
                const isTuningShade = devHeroShade[pSlug] != null && shadeVal !== 100;
                return (
                  <div
                    className="flex items-center gap-1.5 border-b bg-yellow-50/70 px-3 py-1.5 text-[10px]"
                    style={{ borderColor: "rgba(184,134,11,0.30)" }}
                  >
                    <span className="text-[8.5px] font-black uppercase tracking-[0.14em] text-neutral-500">SHADE</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={shadeVal}
                      onChange={(e) =>
                        setDevHeroShade((prev) => ({
                          ...prev,
                          [pSlug]: Number(e.target.value)
                        }))
                      }
                      className="h-1 flex-1 cursor-pointer accent-neutral-700"
                      title={`Hero shade intensity ${shadeVal}%`}
                    />
                    <span className="font-mono text-[10px] tabular-nums text-neutral-800">{shadeVal}%</span>
                    {isTuningShade && (
                      <button
                        type="button"
                        onClick={() =>
                          setDevHeroShade((prev) => {
                            const next = { ...prev };
                            delete next[pSlug];
                            return next;
                          })
                        }
                        className="text-[9px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
                        title="Reset hero shade to 100%"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                );
              })()}
              {/* [/DEV BUTTON] */}

              {/* Card body */}
              <div className="flex flex-1 flex-col gap-3 border-t p-4" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
                    Trade · {cardNumber}
                  </div>
                  <h3 className="mt-1 text-[17px] font-black leading-tight text-neutral-900">
                    {canteen.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-neutral-500">
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 rounded-full border border-neutral-300"
                      style={{ backgroundColor: p.chip }}
                    />
                    {p.displayName} palette · Hosted by {canteen.hostDisplayName}
                  </div>
                </div>

                <p className="line-clamp-3 flex-1 text-[12.5px] leading-relaxed text-neutral-700">
                  {canteen.tagline}
                </p>

                {/* Button row — App Store pattern.
                    "Live" (left): opens fullscreen modal preview so the
                      merchant can scroll / tap / experience the palette
                      on real canteen data before committing.
                    "Install" (right): commits — writes palette to the
                      merchant's listing row. Reversible from this page
                      any time by installing a different one.
                    "View live" (below): opens the full preview in a new
                      tab as an escape hatch for merchants who want a
                      real browser tab (deep-link, share). */}
                <div className="flex items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => setLivePreviewEntry({ palette: pSlug, canteenSlug: canteen.slug })}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border px-3 text-[11.5px] font-black uppercase tracking-wider text-neutral-800 transition hover:bg-neutral-50 active:scale-[0.97]"
                    style={{ borderColor: "rgba(139,69,19,0.30)" }}
                  >
                    <Eye size={13} strokeWidth={2.6}/>
                    Live
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPalette(pSlug)}
                    disabled={!isReady || isSelected || isPending}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[11.5px] font-black uppercase tracking-wider shadow-md transition active:scale-[0.97] disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: !isReady
                        ? "#E5E7EB"
                        : isSelected
                          ? "#E5E7EB"
                          : BRAND_YELLOW,
                      color: !isReady || isSelected ? "#6B7280" : BRAND_BLACK
                    }}
                  >
                    {!isReady ? (
                      <>
                        <Lock size={12} strokeWidth={2.6}/>
                        Soon
                      </>
                    ) : isSelected ? (
                      <>
                        <Check size={12} strokeWidth={2.6}/>
                        Installed
                      </>
                    ) : isPending ? (
                      "Installing…"
                    ) : (
                      <>
                        Install
                      </>
                    )}
                  </button>
                </div>

                {/* Canteen page button — promotes the merchant's OTHER
                    surface (the desktop-friendly public canteen at
                    thenetworkers.app/<slug>). The Live modal above
                    shows the phone app; this button opens the full
                    canteen page in a new tab. Merchants get BOTH
                    surfaces when they install a palette — the card
                    needs to communicate that so they understand what
                    they're buying. Added 2026-07-15 per Philip.
                    Uses <a target="_blank"> not the modal so the
                    browser renders the desktop breakpoint at real
                    viewport width (iframe would force mobile). */}
                <a
                  href={livePreviewUrl(pSlug, null, null, canteenPath, devThemeMode[pSlug] ?? "light")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border px-3 text-[11.5px] font-black uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-50 active:scale-[0.97]"
                  style={{ borderColor: "rgba(139,69,19,0.30)" }}
                  title="Open the full-width canteen page in a new tab"
                >
                  <Monitor size={13} strokeWidth={2.6}/>
                  Canteen page
                  <ExternalLink size={11} strokeWidth={2.5} className="opacity-60"/>
                </a>
              </div>
            </article>
          );
        })}

        {/* Legacy sparkles slot — kept for the "have a palette idea?"
            outreach hook. Encourages merchants to email suggestions. */}
        <article
          className="flex flex-col overflow-hidden rounded-2xl border-2 border-dashed p-6 text-center"
          style={{ borderColor: "rgba(139,69,19,0.20)" }}
        >
          <div className="flex flex-1 flex-col items-center justify-center gap-2">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: `${BRAND_YELLOW}22` }}
            >
              <Sparkles size={20} strokeWidth={2.2} style={{ color: BRAND_YELLOW }}/>
            </div>
            <div className="text-[13px] font-black text-neutral-900">
              Got a palette in mind?
            </div>
            <p className="max-w-xs text-[11.5px] leading-relaxed text-neutral-500">
              Suggest a colour pack you&apos;d want for your trade at{" "}
              <a
                href="mailto:thenetworkers.app@gmail.com"
                className="font-black text-neutral-800 underline decoration-neutral-400 underline-offset-2 hover:decoration-neutral-900"
              >
                thenetworkers.app@gmail.com
              </a>.
            </p>
          </div>
        </article>
      </div>
      )}

      {/* Footer note */}
      <footer className="mt-8 rounded-xl border bg-white p-4 text-[11.5px] leading-relaxed text-neutral-600 shadow-sm"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <strong>Your content stays with you.</strong> Switching a template only changes theme + layout — your products, services, kitchen designs, posts, jobs, and reviews are unchanged. Your URL <span className="font-mono text-[11px] text-neutral-900">thenetworkers.app/{slug}</span> stays the same forever.
      </footer>

      {/* [DEV BUTTON] Colour-tuner toast — floats bottom-centre with the
          "Copied #XXXXXX to clipboard" confirmation after Save. */}
      {devToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[200] -translate-x-1/2 rounded-full px-4 py-2 text-[11.5px] font-black shadow-2xl"
          style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
        >
          {devToast}
        </div>
      )}
      {/* [/DEV BUTTON] */}

      {/* Fullscreen live-preview modal — opens when merchant taps
          "Live" on a card. Renders the actual canteen inside an iPhone
          chassis with the palette applied via `?preview_palette=<slug>`.
          Install button at the bottom commits the palette; Close (X or
          backdrop tap or Escape key) dismisses without committing.
          Pattern mirrors the Apple App Store screenshot zoom. */}
      {livePreviewEntry && (
        <LivePreviewModal
          palette={PALETTES[livePreviewEntry.palette]}
          previewUrl={livePreviewUrl(
            livePreviewEntry.palette,
            null,
            null,
            `/trade-off/yard/canteens/${livePreviewEntry.canteenSlug}`,
            devThemeMode[livePreviewEntry.palette] ?? "light"
          )}
          isSelected={livePreviewEntry.palette === palette}
          isReady={READY_PALETTES.includes(livePreviewEntry.palette)}
          isPending={submitting === `palette:${livePreviewEntry.palette}`}
          onInstall={() => {
            applyPalette(livePreviewEntry.palette);
            // Modal stays open so merchant sees the "Installed" state
            // land — closes automatically on next render if selected
            // matches (handled by effect below).
          }}
          onClose={() => setLivePreviewEntry(null)}
        />
      )}
    </main>
  );
}

// ─── Designer credit chip ────────────────────────────────────
//
// Circular avatar + author + role + org, optionally followed by a
// short designer note. Shown under the "Choose your palette" intro
// so merchants see the human behind the design. Falls back to an
// initial letter chip when no avatar URL is supplied.

function DesignerCredit({
  avatarUrl,
  name,
  role,
  organisation,
  designerNote
}: {
  avatarUrl:     string | null;
  name:          string;
  role:          string;
  organisation:  string;
  designerNote:  string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="mt-5 flex max-w-2xl items-start gap-3">
      <div
        className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full shadow-sm"
        style={{ backgroundColor: "#F5E9D3" }}
        aria-hidden
      >
        {avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={avatarUrl}
            alt={name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span
            className="text-[16px] font-black"
            style={{ color: "#B8860B" }}
          >
            {initial}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="text-[13px] font-black text-neutral-900">
          Designed by {name}
        </div>
        <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-neutral-500">
          {role} · {organisation}
        </div>
        {designerNote && (
          <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-700">
            {designerNote}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Template preview ────────────────────────────────────────
//
// Two rendering modes, chosen per palette via `wrapInPhoneChassis`:
//
//   1. Plain image (default) — for ChatGPT-generated mockups that
//      already have a phone frame drawn INSIDE the artwork (Chalk /
//      Template 1). Adding a CSS chassis around them creates phone-
//      inside-a-phone which reads as a bug.
//
//   2. CSS iPhone chassis wrapping the image — for raw photos /
//      screenshots that need the phone frame added around them (Iron /
//      Template 2 uses the canteen hero photo). Draws a black bezel,
//      dynamic island, and home indicator around the image so the
//      card reads as "app on a phone" rather than "photo on a card".

function IphoneFrame({
  previewImageUrl,
  wrapInPhoneChassis = false,
  livePreviewUrl
}: {
  previewImageUrl: string | undefined;
  wrapInPhoneChassis?: boolean;
  livePreviewUrl?: string;
}) {
  if (!previewImageUrl && !livePreviewUrl) {
    return (
      <div
        className="mx-auto flex items-center justify-center text-center text-[10px] font-black uppercase tracking-wider text-neutral-500"
        style={{ aspectRatio: "9 / 19.5", width: "300px" }}
      >
        Preview coming soon
      </div>
    );
  }
  if (wrapInPhoneChassis || livePreviewUrl) {
    return (
      <div
        className="relative mx-auto overflow-hidden bg-neutral-950 shadow-2xl"
        style={{
          aspectRatio: "9 / 19.5",
          width: "300px",
          borderRadius: "42px",
          border: "7px solid #0A0A0A",
          boxShadow:
            "0 30px 60px -20px rgba(0,0,0,0.55), 0 0 0 1.5px rgba(255,255,255,0.06) inset"
        }}
      >
        {/* Dynamic Island */}
        <div
          aria-hidden
          className="absolute left-1/2 top-2 z-30 h-4 w-20 -translate-x-1/2 rounded-full bg-black"
        />
        {/* Home indicator */}
        <div
          aria-hidden
          className="absolute bottom-2 left-1/2 z-30 h-1 w-20 -translate-x-1/2 rounded-full bg-white/40"
        />
        {/* Screen — inner curve (~35px) clips content cleanly. */}
        <div
          className="absolute bg-black"
          style={{
            inset: "0",
            borderRadius: "35px",
            overflow: "hidden",
            isolation: "isolate"
          }}
        >
          {livePreviewUrl ? (
            // Live iframe — renders the actual canteen mobile view
            // scaled down to fit the phone screen. iframe viewport
            // is 390px wide (real iPhone 12-14 width) so mobile CSS
            // breakpoints fire correctly, then scaled to fit the
            // ~286px screen inside the chassis via scale(0.73).
            <div
              style={{
                transform: "scale(0.73)",
                transformOrigin: "top left",
                width:  "137%",   // 100 / 0.73
                height: "137%",
                overflow: "hidden",
                willChange: "transform"
              }}
            >
              <iframe
                src={livePreviewUrl}
                title="Live app preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                loading="lazy"
                onLoad={(e) => {
                  // Force scroll-to-top on load. Iframes remember their
                  // scrollY across re-renders (React key changes) and
                  // Chromium restores scroll on same-origin nav; without
                  // this the preview can show a half-scrolled canteen.
                  try {
                    e.currentTarget.contentWindow?.scrollTo(0, 0);
                  } catch { /* cross-origin safety */ }
                }}
                className="block border-0"
                style={{ width: "calc(100% + 17px)", height: "100%" }}
              />
            </div>
          ) : previewImageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={previewImageUrl}
              alt="Template preview"
              loading="lazy"
              className="block h-full w-full object-contain"
            />
          ) : null}
        </div>
      </div>
    );
  }
  // Fixed box so every template card renders at identical
  // dimensions regardless of the source image's exact aspect ratio.
  // Object-contain fits the mockup inside without stretching; small
  // aspect differences show as thin letterbox bars on the cream
  // backdrop rather than as different card heights across the grid.
  //
  // The `?tr=w-600` ImageKit transform serves a 600px-wide image (2×
  // the 300px display width) so retina displays render crisp instead
  // of soft. Ignored gracefully for URLs that already include a
  // `?updatedAt=...` cache-buster (ImageKit accepts both).
  const src = previewImageUrl.includes("?")
    ? previewImageUrl
    : `${previewImageUrl}?tr=w-600`;
  return (
    <div
      className="mx-auto"
      style={{ width: "220px", aspectRatio: "9 / 19.5" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Template preview"
        loading="lazy"
        className="block h-full w-full object-contain"
      />
    </div>
  );
}

// ─── Live preview modal ─────────────────────────────────────────
//
// Fullscreen zoomed preview. Rendered as a fixed overlay that darkens
// the page and centres a larger iPhone chassis running the actual
// canteen with the palette applied. Design intent = the moment where
// the merchant thinks "yes, this is my brand." Big, uncluttered,
// interactive.
//
// Layout:
//   ┌─────────────────────────────────────────┐
//   │  [×]                                     │  ← close (top-right)
//   │                                          │
//   │            ┌────────────┐                │
//   │            │ [ iPhone ] │  ← live app    │
//   │            │            │    scrollable  │
//   │            │            │    tappable    │
//   │            └────────────┘                │
//   │                                          │
//   │       Palette · Trade                    │
//   │       [ Install this palette ]           │
//   └─────────────────────────────────────────┘
//
// Backdrop tap outside the phone frame closes the modal (matches iOS
// dismissal expectations). Escape key also closes (wired at parent).

function LivePreviewModal({
  palette,
  previewUrl,
  isSelected,
  isReady,
  isPending,
  onInstall,
  onClose
}: {
  palette:     PaletteTokens;
  previewUrl:  string;
  isSelected:  boolean;
  isReady:     boolean;
  isPending:   boolean;
  onInstall:   () => void;
  onClose:     () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between overflow-y-auto"
      style={{ backgroundColor: "rgba(10,10,10,0.85)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Top bar — close button on the right so it's thumb-reachable */}
      <div className="flex w-full items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full border border-white/40"
            style={{ backgroundColor: palette.chip }}
          />
          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-white/70">
            Live preview · {palette.displayName}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/10"
          aria-label="Close preview"
        >
          <X size={20} strokeWidth={2.4}/>
        </button>
      </div>

      {/* Phone frame — larger than the card thumbnails, ~340px wide.
          Stop propagation so clicking the phone doesn't close the
          modal (only the surrounding dark backdrop closes). */}
      <div
        className="my-2 flex-1 flex items-center justify-center px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative overflow-hidden bg-neutral-950 shadow-2xl"
          style={{
            aspectRatio: "9 / 19.5",
            width:       "min(340px, 82vw)",
            borderRadius: "48px",
            border:       "8px solid #0A0A0A",
            boxShadow:    "0 30px 60px -20px rgba(0,0,0,0.65), 0 0 0 1.5px rgba(255,255,255,0.06) inset"
          }}
        >
          {/* Dynamic Island */}
          <div
            aria-hidden
            className="absolute left-1/2 top-2 z-30 h-4 w-24 -translate-x-1/2 rounded-full bg-black"
          />
          {/* Home indicator */}
          <div
            aria-hidden
            className="absolute bottom-2 left-1/2 z-30 h-1 w-24 -translate-x-1/2 rounded-full bg-white/40"
          />
          {/* Screen — inner rounded clip for the iframe */}
          <div
            className="absolute bg-black"
            style={{
              inset:        "0",
              borderRadius: "40px",
              overflow:     "hidden",
              isolation:    "isolate"
            }}
          >
            <iframe
              src={previewUrl}
              title={`Live preview · ${palette.displayName}`}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              className="block h-full w-full border-0"
            />
          </div>
        </div>
      </div>

      {/* Bottom bar — Install CTA. Stop propagation so tapping the
          button doesn't also close the modal via backdrop click. */}
      <div
        className="flex w-full items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onInstall}
          disabled={!isReady || isSelected || isPending}
          className="inline-flex h-14 min-w-[240px] items-center justify-center gap-2 rounded-full px-6 text-[13px] font-black uppercase tracking-wider shadow-2xl transition active:scale-[0.97] disabled:cursor-not-allowed"
          style={{
            backgroundColor: !isReady
              ? "#525252"
              : isSelected
                ? "#10B981"
                : BRAND_YELLOW,
            color: !isReady ? "#A3A3A3" : isSelected ? "#FFFFFF" : BRAND_BLACK
          }}
        >
          {!isReady ? (
            <>
              <Lock size={14} strokeWidth={2.6}/>
              Coming soon
            </>
          ) : isSelected ? (
            <>
              <Check size={14} strokeWidth={2.6}/>
              Installed
            </>
          ) : isPending ? (
            "Installing…"
          ) : (
            <>Install {palette.displayName}</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Your Canteen strip ──────────────────────────────────────
//
// Prominent card at the top of the picker showing the merchant's
// own canteen (loaded server-side by slug). Displays the canteen
// name, header image thumbnail, current template chip, and two
// CTAs: View app (opens the canteen in a new tab with the current
// template rendered), Go Live (routes to /trade-off/packages to
// upgrade + activate the merchant's thenetworkers.app/{slug} URL).
//
// This is the "logged-in as merchant" surface Philip specified —
// the data flows from canteen → template automatically. Changing
// the merchant's canteen data (products, name, image) updates what
// this card previews; changing template = updates the layout.
function YourCanteenStrip({
  slug,
  canteen
}: {
  slug: string;
  canteen: {
    slug: string;
    name: string;
    headerBgUrl: string | null;
    templateSlug: string;
  };
}) {
  const TEMPLATE_LABEL: Record<string, string> = {
    "template-1-chalk":  "Template 1 · Chalk",
    "template-2-iron":   "Template 2 · Iron",
    "template-3-canvas": "Template 3 · Canvas"
  };
  const templateLabel = TEMPLATE_LABEL[canteen.templateSlug] ?? canteen.templateSlug;
  const viewAppUrl = `/trade-off/yard/canteens/${canteen.slug}`;
  const goLiveUrl  = "/trade-off/packages";

  return (
    <section
      className="mb-6 overflow-hidden rounded-2xl border shadow-md"
      style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FFFFFF" }}
    >
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:gap-4 md:p-5">
        {/* Header image thumbnail */}
        <div
          className="h-20 w-32 flex-shrink-0 overflow-hidden rounded-xl border md:h-24 md:w-40"
          style={{
            borderColor: "rgba(139,69,19,0.15)",
            backgroundColor: "#F3F4F6",
            ...(canteen.headerBgUrl ? {
              backgroundImage: `url('${canteen.headerBgUrl}')`,
              backgroundSize: "cover",
              backgroundPosition: "center"
            } : {})
          }}
          aria-hidden
        />
        {/* Copy */}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Your canteen
          </div>
          <div className="mt-0.5 text-[18px] font-black leading-tight text-neutral-900 md:text-[20px]">
            {canteen.name}
          </div>
          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
            style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
            title="Currently applied template"
          >
            {templateLabel}
          </div>
          <p className="mt-2 text-[12px] leading-snug text-neutral-600">
            Data flows from your canteen into whichever template you install. Change your products / posts / header image on your canteen — the template auto-reflects.
          </p>
        </div>
        {/* CTAs */}
        <div className="flex flex-shrink-0 flex-col gap-2 md:w-40">
          <a
            href={viewAppUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md px-4 text-[12px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition active:scale-[0.97]"
            style={{ backgroundColor: "#FFB300" }}
          >
            View app
          </a>
          <Link
            href={goLiveUrl}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md px-4 text-[12px] font-black uppercase tracking-wider text-white shadow-sm transition active:scale-[0.97]"
            style={{ backgroundColor: "#166534" }}
            title="Upgrade + publish your canteen at thenetworkers.app/your-slug"
          >
            Go Live · Get URL
          </Link>
          <span className="mt-0.5 text-center text-[10px] text-neutral-500">
            thenetworkers.app/{slug}
          </span>
        </div>
      </div>
    </section>
  );
}
