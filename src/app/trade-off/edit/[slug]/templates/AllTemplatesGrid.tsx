"use client";

// AllTemplatesGrid — inspiration + one-click apply.
//
// 12 compact preview cards, one per palette. Each card iframes a
// reference canteen with ?preview_palette=<slug> so the merchant
// sees the palette applied to a real trade layout. Tap Apply on
// any card = saves that palette to the merchant's own canteen via
// the theme API + bumps the parent's refresh tick so the live
// PhoneMockupPreview also updates.
//
// This sits BELOW the ThemeControls panel as "browse and apply"
// inspiration — separate mental model from the direct swatch picker
// which is faster for merchants who already know their colour.

import { useState } from "react";
import { PALETTES, type PaletteSlug } from "@/lib/paletteTokens";

const GRID_PALETTES: PaletteSlug[] = [
  "chalk", "oak", "timber", "sandstone", "blush", "brick",
  "moss", "emerald", "aqua", "slate", "ink", "iron"
];

/** Reference canteen slug for each palette. Cards iframe this
 *  canteen with `?preview_palette=<slug>` so the mockup reflects
 *  the palette regardless of the reference canteen's own theme. */
const PALETTE_REFERENCE_CANTEEN: Record<PaletteSlug, string> = {
  chalk:     "uk-kitchen-fitters",
  oak:       "uk-master-carpenters",
  timber:    "uk-furniture-makers",
  sandstone: "uk-plasterers",
  blush:     "uk-interior-designers",
  brick:     "uk-bricklayers",
  moss:      "uk-landscapers",
  emerald:   "uk-garden-designers",
  aqua:      "uk-pool-builders",
  slate:     "uk-tile-roofers",
  ink:       "uk-architects",
  iron:      "uk-rated-electricians"
};

const IFRAME_SCALE = 0.32;

export function AllTemplatesGrid({
  slug,
  currentPalette,
  onApplied
}: {
  slug: string;
  currentPalette: PaletteSlug;
  /** Called after a successful apply so the parent can bump the
   *  live preview refresh tick. */
  onApplied?: () => void;
}) {
  const [applying, setApplying] = useState<PaletteSlug | null>(null);
  const [applied, setApplied] = useState<PaletteSlug>(currentPalette);

  async function apply(p: PaletteSlug) {
    if (applying) return;
    setApplying(p);
    try {
      const res = await fetch(`/api/canteens/${encodeURIComponent(slug)}/theme`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paletteSlug: p })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setApplied(p);
        onApplied?.();
      }
    } finally {
      setApplying(null);
    }
  }

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            All Templates ({GRID_PALETTES.length})
          </div>
          <h2 className="mt-0.5 text-[16px] font-black text-neutral-900 md:text-[18px]">
            Browse every palette on a real trade
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {GRID_PALETTES.map((p) => {
          const tokens = PALETTES[p];
          const refCanteen = PALETTE_REFERENCE_CANTEEN[p];
          const isApplied = applied === p;
          const isApplying = applying === p;
          const src = `/trade-off/yard/canteens/${refCanteen}?embed=1&preview_palette=${p}`;

          return (
            <article
              key={p}
              className="flex flex-col gap-2 rounded-xl border bg-neutral-50 p-3 shadow-sm"
              style={{
                borderColor: isApplied ? tokens.accent : "rgba(139,69,19,0.15)",
                boxShadow:   isApplied ? `0 0 0 2px ${tokens.accent}44` : undefined
              }}
            >
              {/* iPhone chassis — dark rounded frame + notch. Matches
                  PhoneMockupPreview at grid-card scale. */}
              <div
                className="relative mx-auto w-full max-w-[180px] overflow-hidden rounded-[24px] border-[3px] border-neutral-900 bg-neutral-950 shadow-lg"
                style={{
                  aspectRatio: "9 / 19.5",
                  boxShadow: "0 12px 24px -8px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05) inset"
                }}
              >
                {/* Notch */}
                <div
                  aria-hidden
                  className="absolute left-1/2 top-1.5 z-30 h-2.5 w-10 -translate-x-1/2 rounded-full bg-black"
                />
                {/* Screen — scaled iframe */}
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ borderRadius: "20px", backgroundColor: tokens.bg, isolation: "isolate" }}
                >
                  <div
                    style={{
                      transform:       `scale(${IFRAME_SCALE})`,
                      transformOrigin: "top left",
                      width:           `${100 / IFRAME_SCALE}%`,
                      height:          `${100 / IFRAME_SCALE}%`,
                      overflow:        "hidden",
                      willChange:      "transform"
                    }}
                  >
                    <iframe
                      src={src}
                      title={`${tokens.displayName} preview`}
                      sandbox="allow-scripts allow-same-origin"
                      loading="lazy"
                      className="h-full w-full"
                      style={{ border: "none" }}
                    />
                  </div>
                </div>
              </div>
              {/* Meta + apply */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-3 w-3 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: tokens.accent, boxShadow: "0 0 0 1px rgba(0,0,0,0.10)" }}
                    aria-hidden
                  />
                  <span className="truncate text-[12px] font-black text-neutral-900">
                    {tokens.displayName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => apply(p)}
                  disabled={isApplied || isApplying}
                  className="inline-flex h-7 flex-shrink-0 items-center rounded-md px-2 text-[10px] font-black uppercase tracking-wider transition disabled:cursor-default"
                  style={{
                    backgroundColor: isApplied ? "#166534" : "#FFB300",
                    color:           isApplied ? "#FFFFFF" : "#0A0A0A"
                  }}
                >
                  {isApplying ? "…" : isApplied ? "Applied" : "Apply"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
