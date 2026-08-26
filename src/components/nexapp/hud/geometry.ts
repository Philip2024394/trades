// NEX HUD · GEOMETRY (stable · never themeable · never redesigned to fit a skin).
//
// v6 bezel (Philip 2026-08-26): 941×1672 · aspect 0.5628 · transparent
// alpha channel · interior opening cut out · rail housing + bottom pill
// are opaque frame artwork (hit targets overlay on top of them).

export type ZoneId =
  | "top"           // NEX identity strip (header icons: search, bell, menu)
  | "content"       // main interactive area inside the interior opening
  | "workspace"     // upper half of content · conversation transcript etc.
  | "belowChat"     // lower half of content · contextual workspace zone
  | "side"          // right-rail hit targets over the rail housing artwork
  | "bottom";       // composer inside the bottom pill housing

export interface ZoneRect {
  top?:    string;
  right?:  string;
  bottom?: string;
  left?:   string;
  width?:  string;
  height?: string;
}

/**
 * BEZEL METAL dimensions (v7 · Philip 2026-08-26 · phone-native re-render).
 * 850 × 1850 · aspect 0.4595 · matches modern phone 9:19.5.
 * Metal fills raster edge-to-edge with alpha-channel interior transparency.
 * Rail housings + bottom pill are opaque frame artwork · hit targets overlay.
 */
export const BEZEL_METAL = { w: 850, h: 1850 } as const;
export const BEZEL_ASPECT_RATIO = `${BEZEL_METAL.w} / ${BEZEL_METAL.h}` as const;

/**
 * v7 INTERIOR OPENING (transparent · pixel-scan verified):
 *   vertical   : metal-y  5.6% –  86.1%  (main opening · 80% tall)
 *   horizontal : metal-x  8.1% – 82.5%  (main opening · 74% wide)
 * v7 RAIL HOUSING (opaque frame artwork · 5 labelled slots visible):
 *   horizontal : metal-x 82.5% – 99%    (~16% wide · roomier than v6)
 * v7 BOTTOM PILL HOUSING (opaque · dark pill face):
 *   vertical   : metal-y 86.1% – 99.3%
 * v7 TOP BEZEL (NEX wordmark + 3 header icon slots):
 *   vertical   : metal-y  0% – 5.6%
 */
export const DEFAULT_ZONES: Record<ZoneId, ZoneRect> = {
  // TOP · NEX identity + 3 header icons (search, bell, menu).
  top:       { top: "0%",   left: "0%",  width: "100%", height: "5.6%" },
  // CONTENT · main interactive area inside the transparent interior opening.
  content:   { top: "7%",   left: "9%",  width: "72%",  height: "78%" },
  // WORKSPACE · chat transcript / cards. 2026-08-26 · Philip · start
  // BELOW the hero ring visual in the interior background (ring occupies
  // top ~32% of the interior). Chat bubbles now begin at metal-y 34%.
  workspace: { top: "34%",  left: "9%",  width: "72%",  height: "27%" },
  // BELOW-CHAT · CONTEXTUAL WORKSPACE ZONE.
  //   project_nex_contextual_workspace_zone_doctrine_2026_08_25
  // Philip 2026-08-27: shifted down so the context card ("NEX is searching")
  // displays OVER the footer/composer area · floats as a status band just
  // above the input. Composer sits at metal-y 91.8-96.8% · card bottom-edge
  // lands at 91% so composer stays fully tappable.
  belowChat: { top: "79%",  left: "9%",  width: "72%",  height: "12%" },
  // SIDE · right-rail hit targets · 5 labelled slots. Pixel-scan verified
  // v8 rail housings occupy metal-y 24% – 76% (Philip 2026-08-26).
  side:      { top: "24%",  right: "1.5%", width: "16%", height: "52%" },
  // BOTTOM · composer · sits inside the dark textured pill strip.
  // Pixel-scan: dark strip at metal-y 92% – 97% (Philip 2026-08-26 v8).
  bottom:    { bottom: "3.2%", left: "8%", width: "84%", height: "5%" },
};

/**
 * Bezel affordances (NEX wordmark · 3 header icons in top-right).
 * v6 shows 3 header icon slots in the top-right beside NEX wordmark.
 */
export const BEZEL_AFFORDANCES = {
  wordmark:   { top: "0.3%", left: "1%",   width: "22%", height: "5%" },
  // Voice orb · centered on the portal ring in the interior background.
  // 2026-08-26 · Philip · MAIN NEX feature · must be alive & in motion.
  // Cumulative nudge: +14px down · -5px left.
  voiceOrb:   { top: "calc(13.5% + 14px)", left: "calc(37% - 5px)", width: "26%", height: "12%" },
  // 3 header icon hit targets · pixel-scan (v8 2026-08-26).
  // Cumulative nudges: -35px left → back 3px = -32px left · down 5px.
  headerIcon1: { top: "calc(2% + 5px)", right: "calc(19.5% + 32px)", width: "5%", height: "3%" },
  headerIcon2: { top: "calc(2% + 5px)", right: "calc(10.5% + 32px)", width: "5%", height: "3%" },
  headerIcon3: { top: "calc(2% + 5px)", right: "calc(2% + 32px)",    width: "5%", height: "3%" },
} as const;

/**
 * Hard usability constraints (theme-invariant · themes must not violate).
 */
export const USABILITY_MINIMA = {
  workspaceMinHeightPx: 220,
  composerMinWidthPct:  70,
  railButtonMinPx:      40,
  workspaceMinContrast: 4.5,
} as const;

/**
 * Rail slot count · Philip example 2026-08-26 shows 5 labelled slots
 * (was 6 in earlier prototype). Rail slots have icon + label.
 */
export const RAIL_SLOT_COUNT = 5 as const;

/**
 * Backwards-compat aliases (deprecated).
 * @deprecated Use BEZEL_METAL directly.
 */
export const BEZEL_RASTER = {
  w: BEZEL_METAL.w,
  h: BEZEL_METAL.h,
  metalLeftPx:   0,
  metalTopPx:    0,
  metalRightPx:  BEZEL_METAL.w - 1,
  metalBottomPx: BEZEL_METAL.h - 1,
} as const;
