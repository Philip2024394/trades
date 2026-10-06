// src/app/nex-native/chat-themes-library/_category-grid.tsx
//
// Category Landing Grid · Step 1B (sealed 2026-10-06).
// Phone-frame hero tiles · Step 1B.1 (sealed 2026-10-06).
//
// Renders one phone-frame tile per registered category. The LANDING
// level of the Theme Library. The phone is the hero of the tile · its
// screen paints a representative World (ThemePackage) through the
// existing Theme Engine (ThemeWorld + ThemeBubble primitives), so the
// visitor sees a live miniature of what the category opens into. The
// surrounding chrome (frame · caption) uses the category's palette ·
// not NEX chrome · so Ocean reads blue, Café reads warm, Explore reads
// NEX-cyan.
//
// Tapping a tile navigates to the showcase route for that category:
//
//   /nex-native/chat-themes-library/category/[categoryId]
//
// Load-bearing architectural rules:
//
//   · DATA-DRIVEN · iterates `listCategories()` and renders a uniform
//     tile for every entry. Zero per-category UI branches · no
//     `if cat.id === "ocean"`. Adding a new category to the registry
//     automatically produces a new phone-frame tile here with no code
//     change (as long as the category declares a heroThemeId or
//     contains at least one world).
//   · HERO RESOLUTION is a universal, data-driven step · the grid
//     looks up `category.heroThemeId` in the merged theme collection ·
//     if absent or unresolvable it falls back to the first world in
//     that category. Zero per-id JSX.
//   · NO IFRAME · the phone screen renders ThemePackage visuals via
//     the Theme Engine primitives (ThemeWorld + ThemeBubble) directly ·
//     NOT inside an iframe. Sealed by the 8f805d7d doctrine · the
//     dev-mode performance.measure race from universalising
//     PhoneFramePreview iframes in Library tiles must never return.
//   · UNIVERSAL THEME COLOUR RULE applies with a two-tier split sealed
//     by the Step 1B.1 directive (point 13):
//       outer phone frame + caption → category.colours
//       inner phone screen         → World ThemePackage via engine
//     This preserves the room/world distinction: the category room
//     stays its own colour even when you see a world of a different
//     palette inside the phone.
//   · ZERO-MEMBER categories are HIDDEN from the landing · users
//     should not navigate into an empty room. The showcase route
//     still handles zero-member categories gracefully for deep-link
//     correctness (tested).
//   · The Explore collection is a general / uncategorised bucket ·
//     presented as a phone-frame tile but NEVER described as a visual
//     family. The caption copy comes from the registry so a future
//     rename of the display name ripples automatically.
//   · The tile is a server-rendered <Link> wrapping ThemeWorld +
//     ThemeBubble (both server-safe primitives). No client JS needed
//     to navigate · no useEffect required for the phone paint.
//   · UNIVERSAL THEME HANDOFF is unchanged · tiles link to
//     /chat-themes-library/category/${id}, NEVER /nex-native/themes/${id}
//     (that URL is minted by _theme-browser-client via themePreviewHref
//     at the per-world level inside the showcase room).

import * as React from "react";
import Link from "next/link";
import {
  EXPLORE_CATEGORY_ID,
  listCategories,
} from "@/lib/nex-native/theme-category/registry";
import type { ThemeCategory } from "@/lib/nex-native/theme-category/types";
import {
  ThemeBubble,
  ThemeWorld,
  type BubblePreset,
} from "@/lib/nex-native/chat-render/theme-world";
import type { BrowserThemeRow } from "./_theme-browser-client";

// Soft caption/text colours used on top of the category's own palette.
// The category's `highlight` slot carries the on-dark text colour · we
// derive a dimmer variant via rgba on the same channel below.
const CAPTION_DIM_ALPHA = 0.72;
const CAPTION_MUTE_ALPHA = 0.5;

export interface CategoryGridProps {
  /** The merged theme collection · one BrowserThemeRow per theme
   *  across code-registered live-worlds + DB themes. Used to compute
   *  member counts per category AND to resolve each category's hero
   *  World for the phone-screen paint. The grid does not render the
   *  themes themselves at the per-world level · that happens inside
   *  the showcase route. */
  browserThemes: ReadonlyArray<BrowserThemeRow>;
}

export function CategoryGrid({
  browserThemes,
}: CategoryGridProps): React.JSX.Element {
  // Universal rule · iterate the registry · one tile per entry · hide
  // categories with zero worlds. No per-category conditionals.
  const categoriesWithMembers = listCategories()
    .map((category) => {
      const inCategory = browserThemes.filter(
        (t) => t.category_id === category.id,
      );
      return {
        category,
        count: inCategory.length,
        hero: resolveHeroWorld(category, inCategory),
      };
    })
    .filter(({ count }) => count > 0);

  return (
    <>
      <style>{`
        /* Step 1B.1 phone-grid · tuned so each phone frame feels like
         * a real device at every mainstream width. The max-width keeps
         * the gallery from spreading past a comfortable reading pace.
         *   ≤ 600 px  → 1 phone  (one World at a time, dominant)
         *   601-900   → 2 phones (side-by-side pair)
         *   ≥ 901     → 3 phones (full row for the three categories)
         * Phones themselves max at 300px wide (9:18 → ~600px tall) so
         * the gallery never bloats on ultra-wide displays. */
        .nex-category-phone-grid {
          display: grid;
          gap: 20px;
          grid-template-columns: 1fr;
          max-width: 1120px;
          margin: 18px auto 0;
          justify-items: center;
        }
        @media (min-width: 601px) {
          .nex-category-phone-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
          }
        }
        @media (min-width: 901px) {
          .nex-category-phone-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 28px;
          }
        }
        .nex-category-phone-tile {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          text-decoration: none;
          width: 100%;
          max-width: 320px;
          transition: transform 180ms ease;
        }
        .nex-category-phone-tile:hover,
        .nex-category-phone-tile:focus-visible {
          transform: translateY(-2px);
        }
        .nex-category-phone-tile:focus-visible {
          outline: none;
        }
        .nex-category-phone-tile:focus-visible .nex-category-phone-frame {
          box-shadow: 0 0 0 3px rgba(255,255,255,0.4),
                      0 10px 30px rgba(0,0,0,0.5);
        }
      `}</style>
      <div
        data-nex-category-grid
        className="nex-category-phone-grid"
      >
        {categoriesWithMembers.map(({ category, count, hero }) => (
          <CategoryTile
            key={category.id}
            category={category}
            count={count}
            hero={hero}
          />
        ))}
      </div>
    </>
  );
}

/** A single category tile · universal · identical shape for every
 *  category. The phone is the hero · the caption below is secondary. */
function CategoryTile({
  category,
  count,
  hero,
}: {
  category: ThemeCategory;
  count: number;
  hero: BrowserThemeRow | null;
}): React.JSX.Element {
  const isExplore = category.id === EXPLORE_CATEGORY_ID;
  const { colours } = category;
  const captionText = colours.highlight;
  const captionDim = withAlpha(colours.highlight, CAPTION_DIM_ALPHA);
  const captionMute = withAlpha(colours.highlight, CAPTION_MUTE_ALPHA);

  return (
    <Link
      href={`/nex-native/chat-themes-library/category/${category.id}`}
      prefetch={false}
      data-nex-category-tile
      data-nex-category-id={category.id}
      className="nex-category-phone-tile"
      aria-label={`${category.name} · ${count} ${count === 1 ? "world" : "worlds"} · ${category.tagline ?? ""}`.trim()}
    >
      <CategoryPhoneFrame
        category={category}
        hero={hero}
      />
      <div
        data-nex-category-caption
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          padding: "0 8px",
          textAlign: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {category.icon && (
            <span
              aria-hidden
              style={{
                fontSize: 20,
                lineHeight: 1,
                filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))",
              }}
            >
              {category.icon}
            </span>
          )}
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: captionText,
            }}
          >
            {category.name}
          </div>
        </div>
        <div
          data-nex-category-member-count
          style={{
            fontSize: 11,
            color: isExplore ? captionMute : captionDim,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          {count} {count === 1 ? "World" : "Worlds"}
        </div>
        {category.tagline && (
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              color: captionDim,
              marginTop: 2,
              maxWidth: 280,
            }}
          >
            {category.tagline}
          </div>
        )}
      </div>
    </Link>
  );
}

/** Phone silhouette · outer frame is the CATEGORY palette · screen
 *  inside paints the hero World through the Theme Engine. When the
 *  category has no resolvable hero (fallback failed) renders a neutral
 *  screen so the layout stays stable. */
function CategoryPhoneFrame({
  category,
  hero,
}: {
  category: ThemeCategory;
  hero: BrowserThemeRow | null;
}): React.JSX.Element {
  const { colours } = category;
  const bezelOuter = colours.deep;
  const bezelBorder = colours.primary;
  const bezelGlow = colours.glow;
  const notchFill = withAlpha(colours.deep, 0.9);
  const notchBorder = withAlpha(colours.highlight, 0.14);

  return (
    <div
      data-nex-category-phone
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 300,
        aspectRatio: "9 / 18",
        borderRadius: 32,
        padding: 6,
        background: `linear-gradient(165deg, ${bezelOuter} 0%, ${withAlpha(bezelOuter, 0.72)} 100%)`,
        border: `1px solid ${withAlpha(bezelBorder, 0.5)}`,
        boxShadow: `0 18px 44px rgba(0,0,0,0.55), 0 0 32px ${bezelGlow}`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 6,
          borderRadius: 26,
          overflow: "hidden",
          background: bezelOuter,
          border: `1px solid ${withAlpha(bezelBorder, 0.35)}`,
        }}
      >
        {hero ? <HeroScreen hero={hero} /> : <EmptyScreen colours={colours} />}

        {/* Phone notch · subtle island shape · uses the category's
            deep + highlight channel so the notch reads as part of the
            phone chrome, not the theme beneath. */}
        <div
          aria-hidden
          data-nex-category-phone-notch
          style={{
            position: "absolute",
            top: 8,
            left: "50%",
            transform: "translateX(-50%)",
            width: 70,
            height: 8,
            borderRadius: 999,
            background: notchFill,
            border: `1px solid ${notchBorder}`,
            zIndex: 4,
          }}
        />
      </div>
    </div>
  );
}

/** The phone's screen · ThemeWorld paints the real wallpaper + overlays,
 *  two ThemeBubble instances float the archetypal "hey!" / "love this"
 *  so the visitor sees a chat-like preview. Byte-equivalent to the
 *  per-world Phone Gallery tile in _phone-tile.tsx · same engine
 *  primitives, same preset-first bubble pattern · no second
 *  implementation.
 *
 *  Wallpaper-null fallback · when the hero's ThemePackage declares no
 *  wallpaper art (coffee / botanical / midnight / french-cafe today),
 *  the screen paints an accent-tinted gradient derived from the World's
 *  own BrowserThemeRow colours. This keeps every category phone
 *  visually dominated by its World's identity rather than blending
 *  into the bezel. The gradient uses the three colour slots that live
 *  on BrowserThemeRow (accent · bubble-rim · composer-rim) so no
 *  per-id branches are needed. */
function HeroScreen({
  hero,
}: {
  hero: BrowserThemeRow;
}): React.JSX.Element {
  const preset: BubblePreset =
    hero.wallpaper_config?.bubbleStyle?.preset ?? "classic";
  const bubbleRim = hero.bubble_rim_hex ?? hero.accent_hex;
  // Mirror the gallery tile's accent-glass values so the two surfaces
  // read the same when both are visible in the same session.
  const accentGlassMine = "rgba(0,159,239,0.26)";
  const accentGlassPeer = "rgba(30,44,66,0.72)";

  const hasWallpaper = Boolean(hero.hero_image_url);
  const gradientTop = hero.accent_hex;
  const gradientMid = hero.bubble_rim_hex ?? hero.accent_hex;
  const gradientBottom = hero.composer_rim_hex ?? hero.accent_hex;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
      }}
    >
      {!hasWallpaper && (
        // Accent-tinted gradient · derived from the World's own
        // palette slots on BrowserThemeRow. Zero per-id JSX · the
        // same three channels drive every wallpaper-null World.
        <div
          aria-hidden
          data-nex-category-phone-fallback
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(165deg, ${gradientTop} 0%, ${gradientMid} 55%, ${gradientBottom} 100%)`,
            opacity: 0.92,
            zIndex: 0,
          }}
        />
      )}
      <ThemeWorld
        wallpaperUrl={hero.hero_image_url}
        wallpaperConfig={hero.wallpaper_config}
        size="preview"
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: 8,
          padding: "0 14px 22px",
          zIndex: 3,
        }}
      >
        <ThemeBubble
          preset={preset}
          mine={false}
          bubbleRim={bubbleRim}
          accentGlassMine={accentGlassMine}
          accentGlassPeer={accentGlassPeer}
          size="preview"
        >
          hey!
        </ThemeBubble>
        <ThemeBubble
          preset={preset}
          mine={true}
          bubbleRim={bubbleRim}
          accentGlassMine={accentGlassMine}
          accentGlassPeer={accentGlassPeer}
          size="preview"
        >
          love this ✨
        </ThemeBubble>
      </div>
    </div>
  );
}

/** Fallback screen · appears only when a category has members but
 *  neither heroThemeId nor the first-world fallback resolve to a
 *  BrowserThemeRow (should be unreachable in practice; the registry
 *  guard ensures hero ids are valid and resolveHeroWorld falls back to
 *  the first in-category world). Keeps the layout stable rather than
 *  crashing. */
function EmptyScreen({
  colours,
}: {
  colours: ThemeCategory["colours"];
}): React.JSX.Element {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(180deg, ${colours.deep} 0%, ${colours.primary} 100%)`,
        display: "grid",
        placeItems: "center",
        color: colours.highlight,
        fontSize: 11,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
      }}
    >
      No preview
    </div>
  );
}

/** Resolve the hero World for a category · universal rule, no per-id
 *  branches. heroThemeId takes precedence · a null hero or a hero that
 *  does not resolve against the in-category rows falls back to the
 *  first in-category row. Exported so tests can exercise it directly. */
export function resolveHeroWorld(
  category: ThemeCategory,
  inCategory: ReadonlyArray<BrowserThemeRow>,
): BrowserThemeRow | null {
  if (category.heroThemeId) {
    const hero = inCategory.find((r) => r.id === category.heroThemeId);
    if (hero) return hero;
  }
  return inCategory[0] ?? null;
}

/** Convert a hex colour (`#RRGGBB`) or rgba(...) string into an rgba
 *  string with the given alpha. Falls back to the input unchanged if
 *  parsing fails so a category with an unexpected colour format still
 *  paints something. */
function withAlpha(colour: string, alpha: number): string {
  const trimmed = colour.trim();
  if (trimmed.startsWith("#") && (trimmed.length === 7 || trimmed.length === 4)) {
    const hex = trimmed.length === 4
      ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
      : trimmed;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  const rgbaMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(",").map((s) => s.trim());
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
  }
  return trimmed;
}
