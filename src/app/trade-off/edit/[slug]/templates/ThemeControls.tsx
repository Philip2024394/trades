"use client";

// ThemeControls — the merchant-facing theme customization panel.
//
// Four rows in this order (Philip 2026-07-17):
//   1. Palette   → colour identity (12 swatches)
//   2. Intensity → bold | standard | subtle (sits directly under
//                  palette so it modifies the colour just picked)
//   3. Mode      → Light Mode | Dark Mode (page bg + hero veil)
//   4. Hero Shade → 0-100 slider (hero veil opacity — 100 = full
//                  cream/black wash, 0 = clear hero photo through)
//
// Every control auto-saves via POST /api/canteens/[slug]/theme with
// optimistic UI. Failure shows the actual server error verbatim.

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { BASE_HUES, hueChipHex, hueDisplayName, accentAtLightness, type BaseHue } from "@/lib/paletteHsl";

// Inline SVGs for the two icons the feed-tile-image row needs.
// Avoids a fresh lucide-react named-import that Turbopack HMR
// sometimes fails to resolve after multiple hot reloads.
function ImagePlusIcon({ size = 20 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/>
      <path d="M14 3h7v7"/>
      <path d="m5 21 5-5 3 3 8-8"/>
      <path d="M17 3v6"/>
      <path d="M14 6h6"/>
    </svg>
  );
}
function XIcon({ size = 11 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18"/>
      <path d="m6 6 12 12"/>
    </svg>
  );
}
import { PALETTES, type PaletteSlug } from "@/lib/paletteTokens";
import { filterByTrade, STATIC_FEED_TILE_LIBRARY } from "@/lib/canteenFeedTileLibrary";
import type { FeedTileLibraryEntry } from "@/lib/canteenFeedTileLibrary.server";
// Preset kits + Quick styles removed 2026-07-17 (Philip) — the
// hue-cards system replaced both. Corresponding module deleted:
// @/lib/canteenThemePresets. See ThemeControls history if needed.

type Mode = "light" | "dark";
type Intensity = "bold" | "standard" | "subtle";
type FeedTileTab = "color" | "library" | "upload";

// Legacy 20-swatch grid (kept for backward compat on the Feed Tile
// Colour picker which still uses named palette accents). The main
// palette picker now uses BASE_HUES (8 chips) + lightness slider —
// see the "Base hue" section in the render below.
const PICKER_PALETTES: PaletteSlug[] = [
  "chalk", "blush", "sandstone", "mortar",
  "oak", "timber", "brick", "copper",
  "moss", "emerald", "aqua", "marine",
  "slate", "steel", "storm", "concrete",
  "ink", "charcoal", "iron", "hi-vis"
];

export function ThemeControls({
  slug,
  tradeSlug = null,
  feedTileLibrary = [],
  initialPalette,
  initialMode,
  initialIntensity,
  initialHeroShade,
  initialFeedTileColor,
  initialFeedTileImageUrl,
  initialBaseHue,
  initialLightness,
  initialFeedTileHue,
  initialFeedTileLightness,
  onSaved
}: {
  slug: string;
  /** Merchant's trade slug. Drives the Library tab image filter — an
   *  unknown trade shows the empty state. */
  tradeSlug?: string | null;
  /** DB-loaded feed-tile library (server-provided). When empty (dev
   *  or DB down) the picker falls back to the static seed. */
  feedTileLibrary?: FeedTileLibraryEntry[];
  initialPalette: PaletteSlug;
  initialMode: Mode;
  initialIntensity: Intensity;
  initialHeroShade: number;
  initialFeedTileColor: string | null;
  initialFeedTileImageUrl: string | null;
  initialBaseHue: BaseHue | null;
  initialLightness: number | null;
  initialFeedTileHue: BaseHue | null;
  initialFeedTileLightness: number | null;
  onSaved?: () => void;
}) {
  const [palette, setPalette] = useState<PaletteSlug>(initialPalette);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [intensity, setIntensity] = useState<Intensity>(initialIntensity);
  const [heroShade, setHeroShade] = useState<number>(initialHeroShade);
  const [feedTileColor, setFeedTileColor] = useState<string | null>(initialFeedTileColor);
  const [feedTileImageUrl, setFeedTileImageUrl] = useState<string | null>(initialFeedTileImageUrl);
  const [baseHue, setBaseHue] = useState<BaseHue | null>(initialBaseHue);
  // Default to 100 (solid pure colour) when merchant hasn't set
  // a lightness — matches Philip's "100% = solid" expectation.
  const [lightness, setLightness] = useState<number>(initialLightness ?? 100);
  const [feedTileHue, setFeedTileHue] = useState<BaseHue | null>(initialFeedTileHue);
  const [feedTileLightness, setFeedTileLightness] = useState<number>(initialFeedTileLightness ?? 100);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Feed tile picker — initial tab. Auto-selects based on what's
  // currently saved so the merchant lands where they last left off:
  //   • Image URL is a library entry → Library tab
  //   • Image URL is a custom upload → Upload tab
  //   • Otherwise                    → Colour tab (default)
  //
  // Library source: prefer the DB-loaded prop passed from
  // TemplatesPage; fall back to the static seed baked into the
  // canteenFeedTileLibrary module when the DB is empty/unreachable.
  const librarySource = feedTileLibrary.length > 0 ? feedTileLibrary : STATIC_FEED_TILE_LIBRARY;
  const libraryImages = filterByTrade(librarySource, tradeSlug);
  const initialTab: FeedTileTab = (() => {
    if (!initialFeedTileImageUrl) return "color";
    // Check the FULL library source (across all trades), not just the
    // merchant's own — so a library image tagged to a different trade
    // still opens on the Library tab, not Upload. Bug caught 2026-07-17.
    const isLibrary = librarySource.some((img) => img.url === initialFeedTileImageUrl);
    return isLibrary ? "library" : "upload";
  })();
  const [feedTileTab, setFeedTileTab] = useState<FeedTileTab>(initialTab);
  // Library category selector — a specific trade slug or "all".
  // Defaults to the merchant's own trade; dropdown in the Library
  // tab lets them switch to any other trade or "all".
  const [libraryCategory, setLibraryCategory] = useState<string>(tradeSlug ?? "all");

  async function uploadFeedTileImage(file: File) {
    setUploadError(null);
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/canteens/${encodeURIComponent(slug)}/feed-tile-image`, {
        method: "POST",
        body: fd
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setUploadError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setFeedTileImageUrl(data.url);
      onSaved?.();
    } catch (err) {
      setUploadError((err as Error).message ?? "network");
    } finally {
      setUploadingImage(false);
    }
  }

  async function selectLibraryImage(url: string) {
    setUploadError(null);
    try {
      const res = await fetch(`/api/canteens/${encodeURIComponent(slug)}/theme`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ feedTileImageUrl: url })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setUploadError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setFeedTileImageUrl(url);
      onSaved?.();
    } catch (err) {
      setUploadError((err as Error).message ?? "network");
    }
  }

  async function clearFeedTileImage() {
    setUploadError(null);
    setUploadingImage(true);
    try {
      const res = await fetch(`/api/canteens/${encodeURIComponent(slug)}/feed-tile-image?clear=1`, {
        method: "POST"
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setUploadError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setFeedTileImageUrl(null);
      onSaved?.();
    } catch (err) {
      setUploadError((err as Error).message ?? "network");
    } finally {
      setUploadingImage(false);
    }
  }
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(patch: {
    paletteSlug?: PaletteSlug;
    themeMode?: Mode;
    paletteIntensity?: Intensity;
    heroShade?: number;
    feedTileColor?: string | null;
    baseHue?: BaseHue | null;
    lightness?: number | null;
    feedTileHue?: BaseHue | null;
    feedTileLightness?: number | null;
  }) {
    setSaving(Object.keys(patch)[0] ?? null);
    setError(null);
    try {
      const res = await fetch(`/api/canteens/${encodeURIComponent(slug)}/theme`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const reason = data.error ?? `HTTP ${res.status}`;
        setError(`Save failed: ${reason}`);
      } else {
        onSaved?.();
      }
    } catch (err) {
      setError(`Network error: ${(err as Error).message ?? "unknown"}`);
    } finally {
      setSaving(null);
    }
  }

  // Live-state chips shown in each card header so the merchant can
  // see current values at a glance without focusing on the controls.
  // Card 1 now owns hue + mode (hue card halves = light/dark);
  // Card 2 owns only hero shade.
  const colourThemeStateChip = baseHue
    ? `${hueDisplayName(baseHue)} · ${mode === "dark" ? "Dark" : "Light"}`
    : "Not set";
  const heroPhotoStateChip = `${heroShade}%`;
  const feedTileStateChip = (() => {
    if (feedTileImageUrl) return "Image";
    if (feedTileHue)      return `${hueDisplayName(feedTileHue)} · L${feedTileLightness}`;
    return "Match palette";
  })();

  return (
    <section className="mb-6 space-y-4">
      {/* ── CARD 1 · COLOUR THEME ─────────────────────────
           Groups base hue + lightness + light/dark mode. This is
           the merchant's identity choice — how their mobile app
           looks. Ships as one card so the three controls read as
           one decision, not three. */}
      <SectionCard
        label="Colour theme"
        oneLiner="Your mobile app's identity colour and its lightness / vividness."
        stateChip={colourThemeStateChip}
        saving={saving === "baseHue" || saving === "lightness"}
      >
      {/* Preset kits row removed 2026-07-17 (Philip) — the hue-cards
          grid below covers the same job with less visual noise. */}

      {/* ── Hue cards with Light/Dark split ─────────────────
           Replaces the old round chip + slider combo (Philip 2026-
           07-17). Each hue is a container; user picks a hue then
           taps the LEFT half (Light mode) or RIGHT half (Dark
           mode). One tap saves hue + sensible lightness + mode. */}
      <HueCards
        activeHue={baseHue}
        activeMode={mode}
        onPick={(patch) => {
          setBaseHue(patch.hue);
          setLightness(patch.lightness);
          setMode(patch.mode);
          setFeedTileHue(patch.hue);
          setFeedTileLightness(patch.lightness);
          setFeedTileColor(null);
          save({
            baseHue:            patch.hue,
            lightness:          patch.lightness,
            themeMode:          patch.mode,
            feedTileHue:        patch.hue,
            feedTileLightness:  patch.lightness,
            feedTileColor:      null
          });
        }}
      />

      {/* Old round-chip + slider + depth + preview-dots block kept
          here wrapped in {false && (<>...</>)} so the code path is
          easy to restore if the new hue-cards UX doesn't land.
          Delete in a follow-up once the new design is validated. */}
      {false && (<>
      <div className="mb-4">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
            Base Hue
          </div>
          {baseHue && (
            <span className="text-[10px] font-black tabular-nums text-neutral-700">
              {hueDisplayName(baseHue)} · L{lightness}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {BASE_HUES.map((h) => {
            // Dynamic chip color — renders each hue at the CURRENT
            // lightness so the chip shows exactly what the merchant
            // will get. All 8 chips shift together as the slider
            // drags — Framer / Figma pattern. Fixes the mismatch
            // where chips showed vivid colors but the slider output
            // was muted. Philip 2026-07-17.
            const chipHex = accentAtLightness(h, lightness, intensity);
            const active = baseHue === h;
            return (
              <button
                key={h}
                type="button"
                onClick={() => {
                  // Sync the feed tile hue + lightness to match
                  // the new top palette (Philip 2026-07-17 —
                  // "both palettes follow each other at first
                  // selection"). Merchant can still diverge the
                  // feed tile via Row 6 after — this only fires
                  // when the TOP palette changes.
                  setBaseHue(h);
                  setFeedTileHue(h);
                  setFeedTileLightness(lightness);
                  setFeedTileColor(null);
                  save({
                    baseHue:           h,
                    lightness,
                    feedTileHue:       h,
                    feedTileLightness: lightness,
                    feedTileColor:     null
                  });
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full transition"
                style={{
                  backgroundColor: chipHex,
                  boxShadow: active
                    ? `0 0 0 2px #FFFFFF, 0 0 0 4px ${chipHex}`
                    : "0 0 0 1px rgba(0,0,0,0.12)"
                }}
                aria-pressed={active}
                title={hueDisplayName(h)}
              />
            );
          })}
        </div>
      </div>

      {/* ── Row 1b · Lightness slider + colour preview dots ──
           Slider goes 0 (wash) → 100 (solid pure colour). Six
           coloured preview circles below show the accent hex at
           0/20/40/60/80/100 — user sees the transition live +
           taps any dot to jump the slider (Philip 2026-07-17). */}
      <div className="mb-4">
        {/* Lightness header — value only. Light/Dark toggle moved
            to the Hero Photo card (Philip 2026-07-17) because
            dark/light is about the overall hero surface treatment,
            not the accent's saturation. */}
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
            Lightness
          </div>
          <div className="text-[10px] font-black tabular-nums text-neutral-700">
            {lightness}%
          </div>
        </div>
        {/* Depth quick chips — 4 named jumps that snap the slider to
            a preset lightness. Removes the "which number do I want"
            problem for merchants who just want a vibe. Active chip
            (within ±10 of the target) gets an amber ring. Philip
            2026-07-17 with the wider L formula rebalance. */}
        {baseHue && (
          <div className="mb-3 grid grid-cols-4 gap-1.5">
            {[
              { slug: "pastel",   name: "Pastel",   value: 15 },
              { slug: "standard", name: "Standard", value: 40 },
              { slug: "bold",     name: "Bold",     value: 65 },
              { slug: "deep",     name: "Deep",     value: 95 }
            ].map((depth) => {
              const active = Math.abs(lightness - depth.value) <= 10;
              const hex = accentAtLightness(baseHue, depth.value, intensity);
              return (
                <button
                  key={depth.slug}
                  type="button"
                  onClick={() => {
                    setLightness(depth.value);
                    setFeedTileLightness(depth.value);
                    setFeedTileColor(null);
                    save({ lightness: depth.value, feedTileLightness: depth.value, feedTileColor: null });
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-md border py-1.5 transition active:scale-[0.98]"
                  style={{
                    borderColor:     active ? "#B8860B" : "rgba(0,0,0,0.10)",
                    backgroundColor: active ? "#FFFBEB" : "#FFFFFF"
                  }}
                  aria-pressed={active}
                  title={`Snap to L${depth.value}`}
                >
                  <span
                    className="block h-3 w-3 rounded-full"
                    style={{ backgroundColor: hex, boxShadow: "0 0 0 1px rgba(0,0,0,0.15)" }}
                  />
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-700">
                    {depth.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={lightness}
          onChange={(e) => setLightness(Number(e.target.value))}
          onPointerUp={() => {
            if (!baseHue) return;
            // Sync bottom feed lightness to match top so both
            // pickers stay aligned at first selection.
            setFeedTileLightness(lightness);
            setFeedTileColor(null);
            save({ lightness, feedTileLightness: lightness, feedTileColor: null });
          }}
          onKeyUp={() => {
            if (!baseHue) return;
            setFeedTileLightness(lightness);
            setFeedTileColor(null);
            save({ lightness, feedTileLightness: lightness, feedTileColor: null });
          }}
          className="w-full accent-yellow-500"
          disabled={!baseHue}
          aria-label="Palette lightness"
        />
        {/* Preview dots at each 20% arrival point. Colour computed
            live from baseHue + intensity, so as user tweaks either
            they see the whole scale update. */}
        {baseHue && (
          <div className="mt-2 flex items-center justify-between gap-1 px-0.5">
            {[0, 20, 40, 60, 80, 100].map((stop) => {
              const hex = accentAtLightness(baseHue, stop, intensity);
              const active = Math.abs(lightness - stop) < 10;
              return (
                <button
                  key={stop}
                  type="button"
                  onClick={() => {
                    setLightness(stop);
                    // Sync bottom feed lightness to match top.
                    setFeedTileLightness(stop);
                    setFeedTileColor(null);
                    save({
                      lightness:         stop,
                      feedTileLightness: stop,
                      feedTileColor:     null
                    });
                  }}
                  className="flex flex-col items-center gap-1"
                  aria-label={`Set lightness to ${stop}%`}
                  title={`${stop}% · ${hex}`}
                >
                  <span
                    className="block h-5 w-5 rounded-full transition"
                    style={{
                      backgroundColor: hex,
                      boxShadow: active
                        ? `0 0 0 2px #FFFFFF, 0 0 0 3px ${hex}`
                        : "0 0 0 1px rgba(0,0,0,0.15)"
                    }}
                  />
                  <span className="text-[8.5px] font-black tabular-nums text-neutral-500">
                    {stop}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-2 flex justify-between text-[9px] font-black uppercase tracking-wider text-neutral-500">
          <span>Wash</span>
          <span>Solid</span>
        </div>
        {!baseHue && (
          <p className="mt-2 text-[11px] leading-snug text-neutral-500">
            Pick a base hue first to enable the lightness slider.
          </p>
        )}
      </div>
      </>)}

      {/* Intensity row removed (Philip 2026-07-17) — the Lightness
          slider covers the same territory (0=wash, 100=solid).
          `paletteIntensity` column stays in the DB for backwards
          compat; new merchants leave it at 'standard' and never
          see the control. */}

      {/* Mode toggle relocated inline with the Lightness header row
          above (Philip 2026-07-17) so both tonal controls read as
          one decision. Writes theme_mode; consumed only by the
          mobile-app preview — canteen page is locked to #FBF6EC. */}
      </SectionCard>

      {/* ── CARD 2 · HERO PHOTO ──────────────────────────
           Standalone card wrapping the hero shade slider. Controls
           how much the veil overlay drapes the hero image. */}
      <SectionCard
        label="Hero photo"
        oneLiner="How much shade sits over the mobile app hero image so text stays legible."
        stateChip={heroPhotoStateChip}
        saving={saving === "heroShade"}
      >
      <div className="mb-2">
        {/* Light / Dark toggle moved to the hue-cards grid in Card 1
            (Philip 2026-07-17) — merchant now picks mode via the
            LEFT/RIGHT half of each hue card. Card 2 is hero-shade
            only, single control. */}
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
            Hero Shade
          </div>
          <div className="text-[10px] font-black tabular-nums text-neutral-700">
            {heroShade}%
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={heroShade}
          onChange={(e) => setHeroShade(Number(e.target.value))}
          onPointerUp={() => save({ heroShade })}
          onKeyUp={() => save({ heroShade })}
          className="w-full accent-yellow-500"
          aria-label="Hero shade opacity"
        />
        <div className="mt-1 flex justify-between text-[9px] font-black uppercase tracking-wider text-neutral-500">
          <span>Clear hero</span>
          <span>Full shade</span>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-neutral-500">
          Fades the hero veil overlay. Bottom edge always keeps a soft fade so the hero image never shows a hard line into the page below.
        </p>
      </div>
      </SectionCard>

      {/* ── CARD 3 · LIVE FEED TILE ─────────────────────
           The unified 3-tab picker (Colour / Library / Upload) for
           the mobile app's live feed background. Three ways of
           setting one value; whichever tab is active wins. */}
      <SectionCard
        label="Live feed tile"
        oneLiner="Background behind the live post feed inside the mobile app."
        stateChip={feedTileStateChip}
        saving={saving === "feedTileHue" || saving === "feedTileLightness" || saving === "feedTileColor"}
      >
      <div className="mb-2">

        {/* Tab bar — segmented control. Active tab has amber underline
            for a professional, restrained accent. */}
        <div
          className="mb-4 flex items-center gap-0 border-b"
          style={{ borderColor: "rgba(0,0,0,0.08)" }}
          role="tablist"
        >
          {(["color", "library", "upload"] as const).map((tab) => {
            const label = tab === "color" ? "Colour" : tab === "library" ? "Library" : "Upload";
            const active = feedTileTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFeedTileTab(tab)}
                className="relative -mb-px inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-black uppercase tracking-wider transition"
                style={{
                  color:              active ? "#0A0A0A" : "#737373",
                  borderBottom:       active ? "2px solid #B8860B" : "2px solid transparent"
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Colour tab ─────────────────────────────────── */}
        {feedTileTab === "color" && (
          <div>
            {/* When a feed background image is set, colour has no
                effect on the render (image always wins). Show a
                dismissable notice + block interactions until the
                image is removed (Philip 2026-07-17). */}
            {feedTileImageUrl && (
              <div
                className="mb-3 flex items-center justify-between gap-3 rounded-md border p-2.5"
                style={{ borderColor: "rgba(184,134,11,0.30)", backgroundColor: "#FFFAEB" }}
              >
                <div className="text-[11px] leading-snug text-neutral-700">
                  <span className="font-black">Image is set.</span> Remove it to change the tile colour.
                </div>
                <button
                  type="button"
                  onClick={clearFeedTileImage}
                  disabled={uploadingImage}
                  className="inline-flex items-center gap-1 rounded-md border border-red-500/40 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-red-600 transition hover:bg-red-50 disabled:opacity-40"
                >
                  <XIcon size={10}/>
                  Remove image
                </button>
              </div>
            )}

            {/* Wrap all colour controls in a soft-disabled shell when
                an image is present — dims the pickers and blocks
                clicks so tweaks don't happen silently. */}
            <div
              className={feedTileImageUrl ? "pointer-events-none opacity-40" : ""}
              aria-disabled={Boolean(feedTileImageUrl)}
            >
            {/* Quick styles row removed 2026-07-17 (Philip) — the
                feed hue-cards grid below is enough on its own. */}

            {/* Feed hue cards — mirrors Card 1's HueCards but with
                Bright / Deep halves instead of Light / Dark (feed tile
                doesn't have a mode axis). One tap sets feedTileHue +
                feedTileLightness. Philip 2026-07-17. */}
            <FeedHueCards
              activeHue={feedTileHue}
              activeLightness={feedTileLightness}
              onPick={(patch) => {
                setFeedTileHue(patch.hue);
                setFeedTileLightness(patch.lightness);
                setFeedTileColor(null);
                if (feedTileImageUrl) clearFeedTileImage();
                save({ feedTileHue: patch.hue, feedTileLightness: patch.lightness, feedTileColor: null });
              }}
              onMatch={() => { setFeedTileHue(null); save({ feedTileHue: null, feedTileLightness: null, feedTileColor: null }); }}
              matchActive={!feedTileHue && !feedTileColor}
            />

            {/* Old feed hue chip + slider block — wrapped in false-fragment
                so it's easy to restore. Delete once new design validated. */}
            {false && (<>
            <div className="mb-2 mt-4 flex items-baseline justify-between gap-2">
              <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                Or pick a hue
                {feedTileHue && (
                  <span className="ml-1 font-black text-neutral-700">· {hueDisplayName(feedTileHue)} · L{feedTileLightness}</span>
                )}
              </div>
              {feedTileHue && (
                <button
                  type="button"
                  onClick={() => { setFeedTileHue(null); save({ feedTileHue: null }); }}
                  className="text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
                  title="Reset to palette default"
                >
                  Match palette
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {BASE_HUES.map((h) => {
                // Dynamic chip — same pattern as Colour Theme (rendered
                // at the current feed lightness). Ensures the chip
                // colour matches what actually applies to the feed
                // tile. Philip 2026-07-17.
                const chipHex = accentAtLightness(h, feedTileLightness, intensity);
                const active = feedTileHue === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => {
                      setFeedTileHue(h);
                      // Clear image so colour wins.
                      if (feedTileImageUrl) clearFeedTileImage();
                      save({ feedTileHue: h, feedTileLightness });
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-full transition"
                    style={{
                      backgroundColor: chipHex,
                      boxShadow: active
                        ? `0 0 0 2px #FFFFFF, 0 0 0 4px ${chipHex}`
                        : "0 0 0 1px rgba(0,0,0,0.12)"
                    }}
                    aria-pressed={active}
                    title={hueDisplayName(h)}
                  />
                );
              })}
            </div>
            <div className="mt-3">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                  Lightness
                </div>
                <div className="text-[10px] font-black tabular-nums text-neutral-700">
                  {feedTileLightness}%
                </div>
              </div>
              {/* Depth quick chips — same 4 kits as main Colour Theme.
                  Mirrors the main picker exactly so both controls feel
                  identical (Philip 2026-07-17). */}
              {feedTileHue && (
                <div className="mb-3 grid grid-cols-4 gap-1.5">
                  {[
                    { slug: "pastel-f",   name: "Pastel",   value: 15 },
                    { slug: "standard-f", name: "Standard", value: 40 },
                    { slug: "bold-f",     name: "Bold",     value: 65 },
                    { slug: "deep-f",     name: "Deep",     value: 95 }
                  ].map((depth) => {
                    const active = Math.abs(feedTileLightness - depth.value) <= 10;
                    const hex = accentAtLightness(feedTileHue, depth.value, intensity);
                    return (
                      <button
                        key={depth.slug}
                        type="button"
                        onClick={() => {
                          setFeedTileLightness(depth.value);
                          setFeedTileColor(null);
                          save({ feedTileLightness: depth.value, feedTileColor: null });
                        }}
                        className="flex items-center justify-center gap-1.5 rounded-md border py-1.5 transition active:scale-[0.98]"
                        style={{
                          borderColor:     active ? "#B8860B" : "rgba(0,0,0,0.10)",
                          backgroundColor: active ? "#FFFBEB" : "#FFFFFF"
                        }}
                        aria-pressed={active}
                        title={`Snap to L${depth.value}`}
                      >
                        <span
                          className="block h-3 w-3 rounded-full"
                          style={{ backgroundColor: hex, boxShadow: "0 0 0 1px rgba(0,0,0,0.15)" }}
                        />
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-700">
                          {depth.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={feedTileLightness}
                onChange={(e) => setFeedTileLightness(Number(e.target.value))}
                onPointerUp={() => feedTileHue && save({ feedTileLightness })}
                onKeyUp={() => feedTileHue && save({ feedTileLightness })}
                className="w-full accent-yellow-500"
                disabled={!feedTileHue}
                aria-label="Feed tile lightness"
              />
              {feedTileHue && (
                <div className="mt-2 flex items-center justify-between gap-1 px-0.5">
                  {[0, 20, 40, 60, 80, 100].map((stop) => {
                    const hex = accentAtLightness(feedTileHue, stop, intensity);
                    const active = Math.abs(feedTileLightness - stop) < 10;
                    return (
                      <button
                        key={stop}
                        type="button"
                        onClick={() => {
                          setFeedTileLightness(stop);
                          save({ feedTileLightness: stop });
                        }}
                        className="flex flex-col items-center gap-1"
                        aria-label={`Set feed lightness to ${stop}%`}
                        title={`${stop}% · ${hex}`}
                      >
                        <span
                          className="block h-5 w-5 rounded-full transition"
                          style={{
                            backgroundColor: hex,
                            boxShadow: active
                              ? `0 0 0 2px #FFFFFF, 0 0 0 3px ${hex}`
                              : "0 0 0 1px rgba(0,0,0,0.15)"
                          }}
                        />
                        <span className="text-[8.5px] font-black tabular-nums text-neutral-500">
                          {stop}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            </>)}
            </div>
          </div>
        )}

        {/* ── Library tab ────────────────────────────────── */}
        {feedTileTab === "library" && (
          <div>
            {/* Category dropdown — replaces the binary "my trade / all"
                toggle so merchants can browse ANY trade category with
                per-trade image counts (Philip 2026-07-17). Merchant's
                own trade is the default selection and gets a "your
                trade" label so they always know their home category. */}
            {(() => {
              // Aggregate per-trade counts from the library source.
              // A single image can list multiple trades; each trade
              // gets +1 from that image.
              const counts = new Map<string, number>();
              for (const entry of librarySource) {
                for (const t of entry.trade_slugs) {
                  counts.set(t, (counts.get(t) ?? 0) + 1);
                }
              }
              // Sort: merchant's trade first, then alphabetical.
              const sortedTrades = Array.from(counts.keys()).sort((a, b) => {
                if (a === tradeSlug) return -1;
                if (b === tradeSlug) return 1;
                return a.localeCompare(b);
              });
              // Simple slug → display name (kebab-case → Title case).
              const displayName = (slug: string) => slug
                .split("-")
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ");
              return (
                <div className="mb-3 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-neutral-500">
                    Category
                    <select
                      value={libraryCategory}
                      onChange={(e) => setLibraryCategory(e.target.value)}
                      className="inline-flex h-8 max-w-[200px] items-center rounded-md border bg-white px-2 text-[11px] font-black uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-50"
                      style={{ borderColor: "rgba(0,0,0,0.12)" }}
                    >
                      <option value="all">All trades ({librarySource.length})</option>
                      {sortedTrades.map((t) => (
                        <option key={t} value={t}>
                          {displayName(t)} ({counts.get(t) ?? 0}){t === tradeSlug ? " · your trade" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              );
            })()}
            {(() => {
              // Filter the display grid based on the selected category.
              const displayImages = libraryCategory === "all"
                ? librarySource.map((e) => ({ id: e.id, url: e.url, alt: e.alt, textTone: e.textTone }))
                : librarySource
                    .filter((e) => e.trade_slugs.includes(libraryCategory))
                    .map((e) => ({ id: e.id, url: e.url, alt: e.alt, textTone: e.textTone }));
              if (displayImages.length === 0) {
                return (
                  <div
                    className="rounded-lg border p-6 text-center"
                    style={{ borderColor: "rgba(0,0,0,0.10)", backgroundColor: "#FAFAF7" }}
                  >
                    <div className="text-[12px] font-black text-neutral-700">
                      Trade image library — coming soon
                    </div>
                    <p className="mx-auto mt-1 max-w-xs text-[11px] leading-snug text-neutral-500">
                      We&apos;re curating a set of professional trade images for your feed background. For now, use Colour or Upload your own.
                    </p>
                  </div>
                );
              }
              return (
                // Portrait aspect (9:16) matches the mobile-app hero
                // + full-height feed tile so merchants see each image
                // in native shape — same crop as the app view (Philip
                // 2026-07-17). Selected image gets a bold yellow rim.
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {displayImages.map((img) => {
                    const active = feedTileImageUrl === img.url;
                    return (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => selectLibraryImage(img.url)}
                        className="relative overflow-hidden rounded-md transition active:scale-[0.98]"
                        style={{
                          aspectRatio: "9 / 16",
                          boxShadow: active
                            ? "0 0 0 3px #FFB300"
                            : "0 0 0 1px rgba(0,0,0,0.10)"
                        }}
                        aria-pressed={active}
                        title={img.alt}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.url}
                          alt={img.alt}
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                        {active && (
                          <span
                            className="absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-black shadow-sm"
                            style={{ backgroundColor: "#FFB300" }}
                          >
                            ✓ Selected
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
            {feedTileImageUrl && librarySource.some((i) => i.url === feedTileImageUrl) && (
              <button
                type="button"
                onClick={clearFeedTileImage}
                className="mt-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
              >
                <XIcon size={10}/>
                Clear selection
              </button>
            )}
          </div>
        )}

        {/* ── Upload tab ─────────────────────────────────── */}
        {feedTileTab === "upload" && (
          <div className="flex items-center gap-3">
            <label
              className="relative flex h-16 w-24 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 border-dashed transition hover:border-neutral-500"
              style={{
                borderColor:     feedTileImageUrl ? "transparent" : "rgba(0,0,0,0.20)",
                backgroundColor: feedTileImageUrl ? "transparent" : "#FAFAF7",
                ...(feedTileImageUrl && !libraryImages.some((i) => i.url === feedTileImageUrl) ? {
                  backgroundImage:    `url('${feedTileImageUrl}')`,
                  backgroundSize:     "cover",
                  backgroundPosition: "center"
                } : {})
              }}
            >
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  if (f) uploadFeedTileImage(f);
                  e.currentTarget.value = "";
                }}
                disabled={uploadingImage}
              />
              {(!feedTileImageUrl || libraryImages.some((i) => i.url === feedTileImageUrl)) && (
                <span className="text-neutral-400">
                  <ImagePlusIcon size={20}/>
                </span>
              )}
            </label>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-black text-neutral-900">
                {feedTileImageUrl && !libraryImages.some((i) => i.url === feedTileImageUrl)
                  ? "Image uploaded"
                  : "Upload your own image"}
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                PNG · JPEG · WEBP · max 5 MB. Feed text runs over the image with a dark scrim so it stays readable.
              </p>
              {uploadingImage && (
                <span className="mt-1 inline-block text-[10px] font-black uppercase tracking-wider text-neutral-500">
                  Uploading…
                </span>
              )}
              {uploadError && (
                <span className="mt-1 inline-block text-[10px] font-black uppercase tracking-wider text-red-600">
                  {uploadError}
                </span>
              )}
              {feedTileImageUrl && !libraryImages.some((i) => i.url === feedTileImageUrl) && (
                <button
                  type="button"
                  onClick={clearFeedTileImage}
                  disabled={uploadingImage}
                  className="mt-1 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-red-600 hover:text-red-800 disabled:opacity-40"
                >
                  <XIcon size={10}/>
                  Remove image
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      </SectionCard>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="pt-1">
        <Link
          href={`/trade-off/yard/canteens?palette=${palette}`}
          className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500 transition hover:text-neutral-900"
        >
          See how others styled it in {PALETTES[palette].displayName}
          <ArrowRight size={11} strokeWidth={2.6}/>
        </Link>
      </div>
    </section>
  );
}

// ── HueCards ───────────────────────────────────────────────
//
// The whole colour picker as 8 hue "containers", each split into a
// Light half and a Dark half. Replaces the round hue chips + slider
// + depth chips + preview dots (Philip 2026-07-17). One tap applies
// hue + lightness + mode in a single save. Merchant no longer has
// any sliders — colour picking is fully discrete now.
//
// Layout: 4-column grid on mobile, 4x2 total. Each card is a
// full-width card with a divider down the middle; left half = Light
// mode, right half = Dark mode. Both halves render the hue at
// standard L55 (bright) for light mode, L95 (deep) for dark mode.
// Active half gets an amber ring.

type HuePickPatch = { hue: BaseHue; lightness: number; mode: Mode };

// Sensible per-hue lightness defaults. Light mode uses a mid
// lightness (55) so the accent reads vivid on cream. Dark mode
// uses per-hue deep lightness so the accent reads rich on black.
// Deep lightness is capped at 95 so all hues stay clearly visible
// (see HUE_MIN_L in paletteHsl.ts for the per-hue floor).
const HUE_CARD_LIGHT_L = 55;
const HUE_CARD_DARK_L  = 95;

function HueCards({
  activeHue,
  activeMode,
  onPick
}: {
  activeHue: BaseHue | null;
  activeMode: Mode;
  onPick: (patch: HuePickPatch) => void;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
          Pick a colour
        </div>
        <span className="text-[10px] font-bold text-neutral-400">
          left = light · right = dark
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BASE_HUES.map((hue) => {
          const lightHex = accentAtLightness(hue, HUE_CARD_LIGHT_L);
          const darkHex  = accentAtLightness(hue, HUE_CARD_DARK_L);
          const lightActive = activeHue === hue && activeMode === "light";
          const darkActive  = activeHue === hue && activeMode === "dark";
          return (
            <div
              key={hue}
              className="overflow-hidden rounded-lg border bg-white"
              style={{ borderColor: "rgba(0,0,0,0.10)" }}
            >
              {/* Two-half tap area — LEFT = light mode, RIGHT = dark */}
              <div className="grid grid-cols-2">
                <button
                  type="button"
                  onClick={() => onPick({ hue, lightness: HUE_CARD_LIGHT_L, mode: "light" })}
                  className="relative flex h-14 items-center justify-center transition active:scale-[0.98]"
                  style={{
                    backgroundColor: lightHex,
                    boxShadow: lightActive ? "inset 0 0 0 3px #B8860B" : undefined
                  }}
                  aria-pressed={lightActive}
                  title={`${hueDisplayName(hue)} · Light mode`}
                >
                  {lightActive && (
                    <span
                      className="absolute right-1 top-1 rounded-full px-1 py-0.5 text-[8px] font-black uppercase tracking-wider shadow-sm"
                      style={{ backgroundColor: "#FFFFFF", color: "#0A0A0A" }}
                    >
                      ✓
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onPick({ hue, lightness: HUE_CARD_DARK_L, mode: "dark" })}
                  className="relative flex h-14 items-center justify-center transition active:scale-[0.98]"
                  style={{
                    backgroundColor: darkHex,
                    boxShadow: darkActive ? "inset 0 0 0 3px #B8860B" : undefined
                  }}
                  aria-pressed={darkActive}
                  title={`${hueDisplayName(hue)} · Dark mode`}
                >
                  {darkActive && (
                    <span
                      className="absolute right-1 top-1 rounded-full px-1 py-0.5 text-[8px] font-black uppercase tracking-wider shadow-sm"
                      style={{ backgroundColor: "#FFFFFF", color: "#0A0A0A" }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              </div>
              {/* Bottom strip — hue name + tiny light/dark labels */}
              <div className="flex items-center justify-between px-2 py-1 text-[9px] font-black uppercase tracking-wider text-neutral-500">
                <span>Light</span>
                <span className="font-black text-neutral-900">{hueDisplayName(hue)}</span>
                <span>Dark</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── FeedHueCards ───────────────────────────────────────────
//
// Same visual pattern as HueCards (used in Card 1) but the split is
// Bright / Deep instead of Light / Dark — the feed tile has no
// mode axis, so the two halves offer two lightness variants of the
// same hue. Plus a small "Match theme" chip so merchants can reset
// the tile to follow the main palette in one tap. Philip 2026-07-17.

type FeedHuePickPatch = { hue: BaseHue; lightness: number };

const FEED_HUE_BRIGHT_L = 55;
const FEED_HUE_DEEP_L   = 95;

function FeedHueCards({
  activeHue,
  activeLightness,
  onPick,
  onMatch,
  matchActive
}: {
  activeHue: BaseHue | null;
  activeLightness: number;
  onPick: (patch: FeedHuePickPatch) => void;
  onMatch: () => void;
  matchActive: boolean;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
          Pick a feed colour
        </div>
        <button
          type="button"
          onClick={onMatch}
          className="inline-flex h-6 items-center rounded-md border px-2 text-[10px] font-black uppercase tracking-wider transition"
          style={{
            borderColor:     matchActive ? "#B8860B" : "rgba(0,0,0,0.10)",
            backgroundColor: matchActive ? "#FFFBEB" : "#FFFFFF",
            color:           "#525252"
          }}
          aria-pressed={matchActive}
          title="Feed tile follows the main palette"
        >
          Match theme
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BASE_HUES.map((hue) => {
          const brightHex = accentAtLightness(hue, FEED_HUE_BRIGHT_L);
          const deepHex   = accentAtLightness(hue, FEED_HUE_DEEP_L);
          const brightActive = activeHue === hue && Math.abs(activeLightness - FEED_HUE_BRIGHT_L) <= 15;
          const deepActive   = activeHue === hue && Math.abs(activeLightness - FEED_HUE_DEEP_L) <= 15;
          return (
            <div
              key={hue}
              className="overflow-hidden rounded-lg border bg-white"
              style={{ borderColor: "rgba(0,0,0,0.10)" }}
            >
              <div className="grid grid-cols-2">
                <button
                  type="button"
                  onClick={() => onPick({ hue, lightness: FEED_HUE_BRIGHT_L })}
                  className="relative flex h-14 items-center justify-center transition active:scale-[0.98]"
                  style={{
                    backgroundColor: brightHex,
                    boxShadow: brightActive ? "inset 0 0 0 3px #B8860B" : undefined
                  }}
                  aria-pressed={brightActive}
                  title={`${hueDisplayName(hue)} · Bright`}
                >
                  {brightActive && (
                    <span
                      className="absolute right-1 top-1 rounded-full px-1 py-0.5 text-[8px] font-black uppercase tracking-wider shadow-sm"
                      style={{ backgroundColor: "#FFFFFF", color: "#0A0A0A" }}
                    >
                      ✓
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onPick({ hue, lightness: FEED_HUE_DEEP_L })}
                  className="relative flex h-14 items-center justify-center transition active:scale-[0.98]"
                  style={{
                    backgroundColor: deepHex,
                    boxShadow: deepActive ? "inset 0 0 0 3px #B8860B" : undefined
                  }}
                  aria-pressed={deepActive}
                  title={`${hueDisplayName(hue)} · Deep`}
                >
                  {deepActive && (
                    <span
                      className="absolute right-1 top-1 rounded-full px-1 py-0.5 text-[8px] font-black uppercase tracking-wider shadow-sm"
                      style={{ backgroundColor: "#FFFFFF", color: "#0A0A0A" }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between px-2 py-1 text-[9px] font-black uppercase tracking-wider text-neutral-500">
                <span>Bright</span>
                <span className="font-black text-neutral-900">{hueDisplayName(hue)}</span>
                <span>Deep</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// QuickFeedStyleRow + ThemePresetRow removed 2026-07-17 (Philip).
// The hue-cards system (HueCards + FeedHueCards) replaced both.
// Historical implementation in git if ever needed for reference.
type _RemovedRowsPlaceholder = never;
// ── SectionCard ────────────────────────────────────────────
//
// One grouped card used by ThemeControls to house the Colour theme /
// Hero photo / Live feed tile sections. Shopify-style: small uppercase
// label + one-line description + a live-state chip on the right that
// shows the current values at a glance, so the merchant can scan the
// three cards without focusing on any single control.

function SectionCard({
  label,
  oneLiner,
  stateChip,
  saving = false,
  children
}: {
  label: string;
  oneLiner: string;
  /** Compact current-state summary shown in the top-right of the
   *  card header ("Yellow · L100 · Dark", "68%", "Image", etc.). */
  stateChip?: string;
  saving?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border bg-white shadow-sm"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      <div
        className="flex items-start justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: "rgba(0,0,0,0.06)" }}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
            {label}
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
            {oneLiner}
          </p>
        </div>
        {(stateChip || saving) && (
          <div className="flex flex-shrink-0 items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-700">
            {saving ? (
              <span className="text-neutral-400">Saving…</span>
            ) : (
              stateChip && <span className="rounded-md bg-neutral-100 px-2 py-1 text-neutral-700">{stateChip}</span>
            )}
          </div>
        )}
      </div>
      <div className="px-4 py-4">
        {children}
      </div>
    </div>
  );
}
