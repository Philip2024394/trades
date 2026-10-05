"use client";

// Phase 1 · Phone Gallery tile. Feature-flag gated by NEX_THEMES_PHONE_TILES.
// Replaces the flat ThemeGridCard/ThemeSwatch presentation with a 9:18
// mini-phone that renders the theme's real wallpaper + two real bubbles
// via the Phase 0 <ThemeWorld> primitive. Preserves lock / FREE / active
// chip semantics. Opens the existing preview modal on click or Enter.
//
// Performance behaviour (founder-approved 2026-10-05):
//   · content-visibility + contain-intrinsic-size defer paint off-screen
//   · IntersectionObserver (threshold 0.4) toggles data-visible, which
//     flips a single CSS rule setting animation-play-state (one rule,
//     no per-tile RAF, no per-tile JS tick)
//   · prefetches ±1 neighbour wallpaper when a tile intersects
//   · prefers-reduced-motion disables overlay animation entirely
//   · overlay density is scaled DOWN for tile size (16 particles → 4,
//     24 sparkles → 6) so a 160×320 tile doesn't look like a snowstorm
//
// NON-GOALS (deferred to Phase 2+):
//   · interactive showcase bubble entry animations
//   · simulated test-message composer
//   · mascot layer sourced from new DB columns
//
// Doctrine respected:
//   · Theme scope boundary (sealed 2026-10-04) · gallery CHROME stays
//     NEX cyan; theme paints inside the phone screen only.
//   · One NEX Identity (sealed 2026-09-30) · the tile uses the same
//     <ThemeWorld> primitive that will render chat and cover in the
//     fullness of time; byte-equivalent to the live shell via Phase 0.

import * as React from "react";
import {
  ThemeWorld,
  ThemeBubble,
  type WallpaperConfig,
  type BubblePreset,
} from "@/lib/nex-native/chat-render/theme-world";
import type { BrowserThemeRow } from "./_theme-browser-client";

const NEX = {
  bg: "#020914",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0,175,255,0.14)",
  cyanBorder: "rgba(0,175,255,0.35)",
  orange: "#FF7800",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
};

// Scales the DB overlay config down for a 160–220 px wide tile. 24
// sparkles on a tile reads as noise; 6 reads as "this theme has stars".
function scaleConfigForTile(
  config: WallpaperConfig | null | undefined,
): WallpaperConfig | null {
  if (!config) return null;
  const out: WallpaperConfig = {};
  if (config.bubbleStyle) out.bubbleStyle = config.bubbleStyle;
  if (config.sparkle) {
    out.sparkle = {
      ...config.sparkle,
      count: Math.max(3, Math.min(8, Math.floor((config.sparkle.count ?? 24) / 4))),
    };
  }
  if (config.particleDrift) {
    out.particleDrift = {
      ...config.particleDrift,
      count: Math.max(2, Math.min(6, Math.floor((config.particleDrift.count ?? 16) / 4))),
    };
  }
  // Mist is deliberately omitted · its fog is too heavy for a tile.
  return out;
}

interface PhoneGridProps {
  themes: BrowserThemeRow[];
  currentThemeId: string;
  canUsePremium: boolean;
  onOpen: (themeId: string) => void;
}

/** Grid wrapper · owns the shared IntersectionObserver + prefetcher.
 *  One observer for every tile, one global stylesheet toggle, one
 *  prefetch cache. */
export function PhoneGrid({
  themes,
  currentThemeId,
  canUsePremium,
  onOpen,
}: PhoneGridProps): React.JSX.Element {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const prefetchedRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (typeof IntersectionObserver === "undefined") return;

    const prefetch = (url: string) => {
      if (!url) return;
      if (prefetchedRef.current.has(url)) return;
      prefetchedRef.current.add(url);
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.as = "image";
      link.href = url;
      document.head.appendChild(link);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const idx = Number(el.dataset.themeIndex ?? "-1");
          if (entry.isIntersecting && entry.intersectionRatio >= 0.4) {
            el.dataset.visible = "true";
            const prev = idx > 0 ? themes[idx - 1]?.hero_image_url : null;
            const next =
              idx >= 0 && idx < themes.length - 1
                ? themes[idx + 1]?.hero_image_url
                : null;
            if (prev) prefetch(prev);
            if (next) prefetch(next);
          } else {
            el.dataset.visible = "false";
          }
        }
      },
      { threshold: [0, 0.4, 1], rootMargin: "200px" },
    );

    const tiles = container.querySelectorAll<HTMLElement>("[data-phone-tile]");
    tiles.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [themes]);

  return (
    <>
      <style>{`
        /* Phase 1 phone gallery · scoped styles. The reduced-motion +
         * off-screen pause rules together ensure animations only burn
         * CPU for tiles the user is actively looking at. */
        .nex-phone-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, 1fr);
          max-width: 920px;
        }
        @media (min-width: 481px) {
          .nex-phone-grid { grid-template-columns: repeat(3, 1fr); gap: 14px; }
        }
        @media (min-width: 901px) {
          .nex-phone-grid {
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 16px;
          }
        }
        [data-phone-tile] {
          contain: layout paint style;
          content-visibility: auto;
          contain-intrinsic-size: 160px 320px;
        }
        [data-phone-tile][data-visible="false"] * {
          animation-play-state: paused !important;
        }
        @media (prefers-reduced-motion: reduce) {
          [data-phone-tile] * {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
      <div
        ref={containerRef}
        className="nex-phone-grid"
        data-nex-themes-phone-grid=""
      >
        {themes.map((t, idx) => (
          <PhoneTile
            key={t.id}
            theme={t}
            index={idx}
            active={t.id === currentThemeId}
            locked={t.tier === "bisnis" && !canUsePremium}
            trialBadge={t.tier === "bisnis" && canUsePremium}
            onOpen={() => onOpen(t.id)}
          />
        ))}
      </div>
    </>
  );
}

interface PhoneTileProps {
  theme: BrowserThemeRow;
  index: number;
  active: boolean;
  locked: boolean;
  /** User is on an active themes trial · show a soft FREE pill on the
   *  premium tiles that would otherwise read as locked. Flag is TRUE
   *  only for Bisnis-tier themes while the viewer's effectiveTier is
   *  bisnis via trial (not via subscription). */
  trialBadge: boolean;
  onOpen: () => void;
}

function PhoneTile({
  theme,
  index,
  active,
  locked,
  trialBadge,
  onOpen,
}: PhoneTileProps): React.JSX.Element {
  const scaledConfig = React.useMemo(
    () => scaleConfigForTile(theme.wallpaper_config),
    [theme.wallpaper_config],
  );
  const preset: BubblePreset = theme.wallpaper_config?.bubbleStyle?.preset ?? "classic";
  const bubbleRim = theme.bubble_rim_hex ?? theme.accent_hex;

  // Accent-tinted glass values · chosen to read on both light and dark
  // wallpapers. These match the shell's defaults (shell uses the same
  // pattern via its own peerCrystal/myCrystal constants).
  const accentGlassMine = "rgba(0,159,239,0.26)";
  const accentGlassPeer = "rgba(30,44,66,0.72)";

  return (
    <button
      type="button"
      onClick={onOpen}
      data-phone-tile=""
      data-theme-index={index}
      data-visible="true"
      aria-label={`Preview ${theme.name}${locked ? " · premium theme" : ""}${active ? " · currently active" : ""}`}
      style={{
        display: "flex",
        flexDirection: "column",
        padding: 0,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: NEX.text,
        gap: 8,
        textAlign: "center",
      }}
    >
      {/* Phone silhouette · outer frame is NEX chrome per the theme
          scope boundary doctrine. The screen inside is where the
          theme paints. */}
      <div
        style={{
          position: "relative",
          aspectRatio: "9 / 18",
          borderRadius: 20,
          overflow: "hidden",
          background: NEX.bg,
          border: active
            ? `1px solid ${theme.accent_hex}`
            : `1px solid ${NEX.cyanBorder}`,
          boxShadow: active
            ? `0 0 18px ${theme.accent_hex}55`
            : "0 2px 10px rgba(0,0,0,0.35)",
          transition: "transform 160ms ease, border-color 160ms ease",
        }}
      >
        {/* Theme screen · ThemeWorld paints wallpaper + overlays, bubbles
            stack above via flexbox children. z-index 1 keeps bubbles
            above overlays (which paint at z-index 2 inside their own
            absolute wrapper — bubble zone's z-index 1 wins because the
            overlays are inside this stacking context too). */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
          }}
        >
          <ThemeWorld
            wallpaperUrl={theme.hero_image_url}
            wallpaperConfig={scaledConfig}
            size="tile"
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              gap: 6,
              padding: "0 10px 14px",
              zIndex: 3,
            }}
          >
            <ThemeBubble
              preset={preset}
              mine={false}
              bubbleRim={bubbleRim}
              accentGlassMine={accentGlassMine}
              accentGlassPeer={accentGlassPeer}
              size="tile"
            >
              hey!
            </ThemeBubble>
            <ThemeBubble
              preset={preset}
              mine={true}
              bubbleRim={bubbleRim}
              accentGlassMine={accentGlassMine}
              accentGlassPeer={accentGlassPeer}
              size="tile"
            >
              love this ✨
            </ThemeBubble>
          </div>
        </div>

        {/* Top chrome · subtle notch bar · NEX cyan to signal this is
            the system chrome, not part of the theme's own identity. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 6,
            left: "50%",
            transform: "translateX(-50%)",
            width: 44,
            height: 5,
            borderRadius: 999,
            background: "rgba(2,9,20,0.55)",
            border: `1px solid rgba(255,255,255,0.08)`,
            zIndex: 4,
          }}
        />

        {/* State chip (top-right corner) · active beats locked beats
            trial badge. One chip at a time to keep the tile calm. */}
        {active ? (
          <span
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              fontSize: 8,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 800,
              padding: "3px 7px",
              borderRadius: 999,
              background: `${theme.accent_hex}cc`,
              color: "#0B0F1A",
              zIndex: 5,
            }}
          >
            Active
          </span>
        ) : locked ? (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              width: 22,
              height: 22,
              borderRadius: 999,
              background: "rgba(2,9,20,0.72)",
              border: `1px solid ${NEX.orange}`,
              color: NEX.orange,
              display: "grid",
              placeItems: "center",
              fontSize: 11,
              zIndex: 5,
            }}
          >
            🔒
          </span>
        ) : trialBadge ? (
          <span
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              fontSize: 8,
              letterSpacing: "0.14em",
              fontWeight: 900,
              padding: "3px 7px",
              borderRadius: 999,
              background: `linear-gradient(180deg, #FF9033 0%, ${NEX.orange} 100%)`,
              color: "#0B0F1A",
              animation:
                "nex-themes-trial-free-pulse 2.4s ease-in-out infinite",
              zIndex: 5,
            }}
          >
            FREE
          </span>
        ) : null}
      </div>

      {/* Caption · theme name + tagline below the phone, NEX chrome. */}
      <div style={{ padding: "0 4px" }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {theme.name}
        </div>
        {theme.tagline && (
          <div
            style={{
              fontSize: 10,
              color: NEX.textDim,
              lineHeight: 1.35,
              marginTop: 2,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {theme.tagline}
          </div>
        )}
      </div>
    </button>
  );
}

export { scaleConfigForTile };
