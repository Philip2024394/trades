// src/app/nex-native/chat-standard/_engine/sticker-generator.ts
//
// Phase 2A.0 · SVG-illustrative sticker generator.
//
// Given a theme's colour system + personality + conceptKeywords,
// produce a cohesive sticker set purely as inline SVG. No external
// assets, no network, no image generation API. Programmatic.
//
// Keywords map to vector primitives. Colour system drives fill/stroke.
// Personality tweaks motion inside the SVG (bubbles rising inside a
// shell sticker, embers inside a flame sticker, etc).
//
// New keywords extend the KEYWORD_RENDERERS map. Themes that want
// bespoke art can override via package.stickers.explicit at any time.

import * as React from "react";
import type {
  AnimationPersonality,
  ColourSystem,
  StickerSet,
  StickerTreatment,
} from "./types";

type Renderer = (
  size: number,
  colours: ColourSystem,
  personality: AnimationPersonality,
) => React.JSX.Element;

function tone(c: ColourSystem, slot: keyof ColourSystem, fallback: string): string {
  return c[slot] ?? fallback;
}

const SVG = (
  size: number,
  children: React.ReactNode,
  viewBox = "0 0 100 100",
): React.JSX.Element => (
  <svg
    width={size}
    height={size}
    viewBox={viewBox}
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
    style={{ display: "block" }}
  >
    {children}
  </svg>
);

// ─── Ocean primitives ───────────────────────────────────────────────

const fish: Renderer = (size, c) => {
  const body = tone(c, "primary", "#2E90B5");
  const belly = tone(c, "highlight", "#D4F1FF");
  const fin = tone(c, "secondary", "#4FC3DC");
  return SVG(
    size,
    <>
      <defs>
        <radialGradient id="fish-g" cx="55%" cy="40%" r="55%">
          <stop offset="0%" stopColor={belly} stopOpacity="0.95" />
          <stop offset="100%" stopColor={body} />
        </radialGradient>
      </defs>
      <path
        d="M15 50 Q35 20 60 25 Q85 30 92 50 Q85 70 60 75 Q35 80 15 50 Z"
        fill="url(#fish-g)"
      />
      <path d="M92 50 L108 32 L104 50 L108 68 Z" fill={fin} opacity="0.85" />
      <circle cx="68" cy="44" r="3" fill="#082030" />
      <circle cx="69" cy="43" r="1" fill="#fff" />
      <path
        d="M26 48 Q30 42 36 48 M26 55 Q30 61 36 55"
        stroke={fin}
        strokeWidth="1.5"
        fill="none"
        opacity="0.6"
      />
    </>,
    "0 0 120 100",
  );
};

const shell: Renderer = (size, c) => {
  const outer = tone(c, "secondary", "#F4C2A1");
  const inner = tone(c, "highlight", "#FFE8D4");
  const edge = tone(c, "primary", "#B8805D");
  return SVG(
    size,
    <>
      <defs>
        <radialGradient id="shell-g" cx="50%" cy="95%" r="90%">
          <stop offset="0%" stopColor={inner} />
          <stop offset="100%" stopColor={outer} />
        </radialGradient>
      </defs>
      <path
        d="M50 92 Q10 90 10 50 Q10 15 50 10 Q90 15 90 50 Q90 90 50 92 Z"
        fill="url(#shell-g)"
        stroke={edge}
        strokeWidth="1.6"
      />
      {[20, 32, 44, 56, 68, 80].map((x, i) => (
        <path
          key={i}
          d={`M50 92 Q${x} 70 ${x} 15`}
          stroke={edge}
          strokeWidth="1.2"
          fill="none"
          opacity={0.55}
        />
      ))}
    </>,
  );
};

const bubbleCluster: Renderer = (size, c) => {
  const main = tone(c, "highlight", "#D4F1FF");
  const rim = tone(c, "primary", "#2E90B5");
  return SVG(
    size,
    <>
      <circle cx="40" cy="55" r="26" fill={main} fillOpacity="0.65" stroke={rim} strokeWidth="2" />
      <circle cx="40" cy="55" r="26" fill="url(#bb-g)" />
      <circle cx="72" cy="35" r="14" fill={main} fillOpacity="0.6" stroke={rim} strokeWidth="1.6" />
      <circle cx="78" cy="68" r="9" fill={main} fillOpacity="0.55" stroke={rim} strokeWidth="1.3" />
      <circle cx="30" cy="42" r="5" fill="#fff" opacity="0.8" />
      <circle cx="68" cy="30" r="3" fill="#fff" opacity="0.75" />
      <defs>
        <radialGradient id="bb-g" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="100%" stopColor={main} stopOpacity="0" />
        </radialGradient>
      </defs>
    </>,
  );
};

const octopus: Renderer = (size, c) => {
  const body = tone(c, "primary", "#5B4EB8");
  const belly = tone(c, "highlight", "#C9B8FF");
  return SVG(
    size,
    <>
      <defs>
        <radialGradient id="oct-g" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={belly} stopOpacity="0.9" />
          <stop offset="100%" stopColor={body} />
        </radialGradient>
      </defs>
      <path d="M50 18 Q78 22 80 48 Q82 65 70 68 L70 60 Q66 70 60 72 L60 60 Q56 70 50 72 L50 62 Q44 70 40 60 L40 72 Q30 70 30 60 L30 68 Q18 66 20 48 Q22 22 50 18 Z" fill="url(#oct-g)" />
      <circle cx="42" cy="40" r="3" fill="#082030" />
      <circle cx="58" cy="40" r="3" fill="#082030" />
      <circle cx="43" cy="39" r="1" fill="#fff" />
      <circle cx="59" cy="39" r="1" fill="#fff" />
      <path d="M44 52 Q50 56 56 52" stroke="#082030" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </>,
  );
};

const wave: Renderer = (size, c) => {
  const foam = tone(c, "highlight", "#E8F7FF");
  const mid = tone(c, "secondary", "#4FC3DC");
  const deep = tone(c, "primary", "#2E90B5");
  return SVG(
    size,
    <>
      <defs>
        <linearGradient id="wave-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={foam} />
          <stop offset="50%" stopColor={mid} />
          <stop offset="100%" stopColor={deep} />
        </linearGradient>
      </defs>
      <path
        d="M5 70 Q25 50 45 65 Q65 80 85 60 Q95 50 95 90 L5 90 Z"
        fill="url(#wave-g)"
      />
      <path
        d="M5 55 Q25 35 45 50 Q65 65 85 45"
        stroke={foam}
        strokeWidth="3"
        fill="none"
        opacity="0.85"
      />
    </>,
  );
};

const treasure: Renderer = (size, c) => {
  const wood = tone(c, "secondary", "#8B5A2B");
  const metal = tone(c, "highlight", "#FFD75E");
  const dark = tone(c, "deep", "#3B2410");
  return SVG(
    size,
    <>
      <rect x="15" y="40" width="70" height="40" rx="4" fill={wood} stroke={dark} strokeWidth="2" />
      <path d="M15 44 Q50 20 85 44 L85 50 L15 50 Z" fill={wood} stroke={dark} strokeWidth="2" />
      <rect x="40" y="50" width="20" height="18" fill={metal} stroke={dark} strokeWidth="1.5" />
      <circle cx="50" cy="60" r="3" fill={dark} />
      <path d="M15 60 L85 60" stroke={dark} strokeWidth="1.5" opacity="0.6" />
      {[25, 45, 65, 80].map((x, i) => (
        <rect key={i} x={x - 2} y={38} width="4" height="4" fill={metal} />
      ))}
    </>,
  );
};

const diver: Renderer = (size, c) => {
  const suit = tone(c, "primary", "#2E90B5");
  const skin = "#E8C8A8";
  const mask = tone(c, "highlight", "#D4F1FF");
  return SVG(
    size,
    <>
      <circle cx="50" cy="38" r="18" fill={skin} />
      <path d="M35 32 Q50 20 65 32 L65 42 L35 42 Z" fill={mask} opacity="0.85" stroke={suit} strokeWidth="1.5" />
      <rect x="36" y="52" width="28" height="30" rx="6" fill={suit} />
      <circle cx="72" cy="38" r="6" fill={suit} />
      <circle cx="76" cy="35" r="2" fill={mask} />
      <circle cx="78" cy="28" r="1.8" fill={mask} opacity="0.8" />
      <circle cx="80" cy="22" r="1.4" fill={mask} opacity="0.6" />
    </>,
  );
};

// ─── Warm / coffee primitives ───────────────────────────────────────

const mug: Renderer = (size, c) => {
  const body = tone(c, "secondary", "#D4B896");
  const liquid = tone(c, "primary", "#5A3620");
  const highlight = tone(c, "highlight", "#F7E7CA");
  const deep = tone(c, "deep", "#2A1810");
  return SVG(
    size,
    <>
      <defs>
        <linearGradient id="mug-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={highlight} />
          <stop offset="100%" stopColor={body} />
        </linearGradient>
      </defs>
      <path d="M72 40 Q92 40 92 56 Q92 72 72 72" stroke={body} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M20 32 L74 32 L70 82 Q46 90 24 82 Z" fill="url(#mug-body)" stroke={deep} strokeWidth="1.5" />
      <ellipse cx="47" cy="34" rx="26" ry="4" fill={liquid} />
      <ellipse cx="47" cy="33.5" rx="22" ry="2.4" fill={deep} opacity="0.6" />
      <path d="M28 42 Q32 55 32 70" stroke={highlight} strokeWidth="2" fill="none" opacity="0.65" strokeLinecap="round" />
      <path d="M34 24 Q30 16 36 10 Q42 4 38 -2" stroke={highlight} strokeWidth="2" fill="none" opacity="0.75" strokeLinecap="round" />
      <path d="M50 22 Q46 14 52 8 Q58 2 54 -4" stroke={highlight} strokeWidth="2" fill="none" opacity="0.55" strokeLinecap="round" />
      <path d="M64 24 Q60 16 66 10 Q72 4 68 -2" stroke={highlight} strokeWidth="2" fill="none" opacity="0.65" strokeLinecap="round" />
    </>,
  );
};

const bean: Renderer = (size, c) => {
  const body = tone(c, "primary", "#5A3620");
  const highlight = tone(c, "highlight", "#F7E7CA");
  const deep = tone(c, "deep", "#2A1810");
  return SVG(
    size,
    <>
      <defs>
        <radialGradient id="bean-g" cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor={highlight} stopOpacity="0.5" />
          <stop offset="100%" stopColor={body} />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="50" rx="30" ry="40" fill="url(#bean-g)" transform="rotate(-18 50 50)" stroke={deep} strokeWidth="1.8" />
      <path d="M50 15 Q46 50 50 85" stroke={deep} strokeWidth="2.4" fill="none" transform="rotate(-18 50 50)" />
    </>,
  );
};

const croissant: Renderer = (size, c) => {
  const body = tone(c, "secondary", "#D4B896");
  const highlight = tone(c, "highlight", "#F7E7CA");
  const deep = tone(c, "deep", "#5A3620");
  return SVG(
    size,
    <>
      <defs>
        <linearGradient id="cr-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={highlight} />
          <stop offset="100%" stopColor={body} />
        </linearGradient>
      </defs>
      <path d="M16 56 Q16 20 50 20 Q84 20 84 56 Q76 70 50 68 Q24 70 16 56 Z" fill="url(#cr-g)" stroke={deep} strokeWidth="1.6" />
      {[32, 46, 60].map((x, i) => (
        <path key={i} d={`M${x} 28 Q${x + 2} 48 ${x} 66`} stroke={deep} strokeWidth="1.2" fill="none" opacity="0.6" />
      ))}
    </>,
  );
};

const latteArt: Renderer = (size, c) => {
  const foam = tone(c, "highlight", "#F7E7CA");
  const coffee = tone(c, "primary", "#5A3620");
  const rim = tone(c, "secondary", "#D4B896");
  return SVG(
    size,
    <>
      <circle cx="50" cy="52" r="36" fill={coffee} stroke={rim} strokeWidth="3" />
      <path d="M50 24 Q58 36 50 48 Q42 36 50 24 Z" fill={foam} />
      <path d="M50 42 Q60 50 50 60 Q40 50 50 42 Z" fill={foam} />
      <path d="M50 54 Q58 62 50 72 Q42 62 50 54 Z" fill={foam} />
      <path d="M50 48 L50 80" stroke={foam} strokeWidth="2.2" fill="none" />
    </>,
  );
};

const steamIcon: Renderer = (size, c) => {
  const foam = tone(c, "highlight", "#F7E7CA");
  const warm = tone(c, "secondary", "#D4B896");
  return SVG(
    size,
    <>
      <path d="M28 82 Q22 60 32 46 Q42 32 36 20 Q30 8 42 2" stroke={foam} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.9" />
      <path d="M52 82 Q46 56 56 42 Q66 28 60 16 Q54 4 66 -2" stroke={foam} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.7" />
      <path d="M76 82 Q70 60 80 46 Q90 32 84 20 Q78 8 90 2" stroke={warm} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.6" />
    </>,
  );
};

const espressoCup: Renderer = (size, c) => {
  const body = tone(c, "highlight", "#F7E7CA");
  const liquid = tone(c, "primary", "#5A3620");
  const rim = tone(c, "secondary", "#D4B896");
  const deep = tone(c, "deep", "#2A1810");
  return SVG(
    size,
    <>
      <ellipse cx="50" cy="86" rx="40" ry="6" fill={rim} stroke={deep} strokeWidth="1.4" />
      <ellipse cx="50" cy="82" rx="34" ry="4" fill={body} />
      <path d="M30 42 L70 42 L66 80 Q50 86 34 80 Z" fill={body} stroke={deep} strokeWidth="1.6" />
      <ellipse cx="50" cy="44" rx="20" ry="3.4" fill={liquid} />
      <ellipse cx="50" cy="43.5" rx="16" ry="1.6" fill={deep} opacity="0.5" />
      <path d="M68 50 Q82 50 82 62 Q82 74 68 72" stroke={rim} strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <path d="M40 34 Q36 24 42 18" stroke={body} strokeWidth="2" fill="none" opacity="0.6" strokeLinecap="round" />
      <path d="M58 34 Q54 24 60 18" stroke={body} strokeWidth="2" fill="none" opacity="0.6" strokeLinecap="round" />
    </>,
  );
};

// ─── Fallback (universal) ───────────────────────────────────────────

const genericBurst: Renderer = (size, c) => {
  const main = tone(c, "primary", "#00AFFF");
  const glow = tone(c, "glow", main);
  return SVG(
    size,
    <>
      <circle cx="50" cy="50" r="28" fill={main} opacity="0.9" />
      <circle cx="50" cy="50" r="36" fill="none" stroke={glow} strokeWidth="2" opacity="0.6" />
      <circle cx="50" cy="50" r="18" fill={glow} opacity="0.4" />
    </>,
  );
};

// ─── Registry ───────────────────────────────────────────────────────

export const KEYWORD_RENDERERS: Record<string, Renderer> = {
  // Ocean
  fish,
  shell,
  bubble: bubbleCluster,
  bubbles: bubbleCluster,
  octopus,
  wave,
  treasure,
  diver,
  // Warm · coffee / café / bakery adjacent
  mug,
  cup: mug,
  bean,
  coffee: bean,
  croissant,
  pastry: croissant,
  latte: latteArt,
  "latte-art": latteArt,
  steam: steamIcon,
  espresso: espressoCup,
  // Fallback
  burst: genericBurst,
  generic: genericBurst,
};

export function generateStickerSet(
  stickers: StickerSet | undefined,
  colours: ColourSystem,
  personality: AnimationPersonality,
): StickerTreatment {
  const keywords = stickers?.conceptKeywords?.length
    ? stickers.conceptKeywords
    : ["generic"];
  const slugs = keywords;
  const explicit = stickers?.explicit ?? {};
  return {
    slugs,
    render: (slug, size) => {
      // If theme provided an explicit URL for this slug, use it as img.
      if (explicit[slug]) {
        return (
          <img
            src={explicit[slug]}
            alt={slug}
            width={size}
            height={size}
            style={{ display: "block" }}
          />
        );
      }
      const renderer =
        KEYWORD_RENDERERS[slug] ?? KEYWORD_RENDERERS.generic!;
      return renderer(size, colours, personality);
    },
  };
}
