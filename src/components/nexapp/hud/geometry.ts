// NEX HUD · GEOMETRY (stable · never themeable · never redesigned to fit a skin).
//
// MASTER frame (Philip 2026-09-02 v3 · re-confirmed at fit-perfect aspect):
//   853 × 1844 · aspect 0.4626 · matches BEZEL_METAL 850×1850 phone shape
//   within 0.68% — zero distortion on any device. Transparent alpha centre.
//   NEX wordmark top-left · 2 small indicators top-right · oval pill footer.
//
// TRUE TRANSPARENT INTERIOR (pixel-scan alpha ≤ 8, run 2026-09-02):
//   top    inset  7.27%   ·   bottom inset  10.90%
//   left   inset  8.32%   ·   right  inset   8.09%   (near-symmetric)
//   interior width 83.59% · height 81.83%
//
// Previous chassis retained for recovery:
//   hud-frame-master-prev-851x1847.png · aspect 0.4607 · v2
//   hud-frame-master-prev-940x1672.png · aspect 0.5622 · v1
//
// Content zone below wraps a 2.5% safe pad inside the transparent interior
// per Philip's "little back from transparent edge" ask (2026-09-01).

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
 * BEZEL METAL dimensions (v9 · Philip 2026-08-28 · NEW LOCKED CHASSIS).
 *
 * NEX MASTER FRAME DOCTRINE (Philip 2026-08-28 · CONSTITUTIONAL):
 *   · The frame is a FIXED PHYSICAL CHASSIS · never redesigned, resized
 *     internally, cropped, stretched, repositioned, or modified.
 *   · The transparent central region IS the application viewport.
 *   · ALL NEX content (hero media, video, LIVE video, chat, text, cards,
 *     controls) renders BEHIND the frame · never on top of the bezel.
 *   · Application viewport MUST be measured from actual transparent alpha
 *     boundary of this asset · never estimated from PNG dimensions.
 *   · "full height/full width" = full width/height of the TRANSPARENT
 *     VIEWPORT inside the physical frame, NOT the PNG bounds.
 *   · HERO CONTENT IS NOT A HERO OVERLAY · when instructed to place a
 *     video/image in the "hero top area", place it inside the transparent
 *     viewport · never over the NEX logo, top metal, right-side controls,
 *     bottom dock, or any physical frame component.
 *   · The frame is IDENTICAL across all NEX pages.
 *
 * Source asset: public/nex/hud-frame-master.png · 853 × 1844 · aspect 0.4626
 * (matches BEZEL_METAL 850×1850 within 0.68% · zero distortion on any device).
 * Previous chassis kept as hud-frame-master-prev-{851x1847,940x1672}.png.
 *
 * PRESENTATION aspect (Philip 2026-08-28 · "want tall/skinny phone shape"):
 * 850 × 1850 · aspect 0.4595 (9:19.5 · modern phone). The source PNG has a
 * wider ratio (ChatGPT-generated at 941×1672 ≈ 9:16 · reads too chunky).
 * We keep the source alpha channel authoritative for viewport measurement
 * (NEX_INNER_VIEWPORT percentages hold under uniform scaling), but present
 * the frame in a phone-shaped container. `object-fit: fill` stretches the
 * PNG vertically to fit · frame elements look phone-native.
 *
 * NEX_INNER_VIEWPORT percentages remain valid because they're expressed as
 * % of container · the interior scales with the container.
 */
export const BEZEL_METAL = { w: 850, h: 1850 } as const;
/**
 * The raw source PNG's native pixel dimensions · used ONLY by measurement
 * scripts (measure-frame-viewport / measure-frame-accents). Never render
 * containers at these dimensions · use BEZEL_METAL for presentation.
 */
export const BEZEL_METAL_SOURCE = { w: 853, h: 1844 } as const;
export const BEZEL_ASPECT_RATIO = `${BEZEL_METAL.w} / ${BEZEL_METAL.h}` as const;

/**
 * MASTER INTERIOR OPENING (transparent · pixel-scan verified 2026-09-02 v3):
 *   vertical   : metal-y  7.27% – 89.10%   (interior 81.83% tall)
 *   horizontal : metal-x  8.32% – 91.91%   (interior 83.59% wide)
 * MASTER BOTTOM FOOTER (opaque oval pill artwork):
 *   vertical   : metal-y 89.10% – 100%     (10.90% tall)
 * MASTER TOP BEZEL (NEX wordmark + 2 indicators):
 *   vertical   : metal-y  0% –  7.27%      (7.27% tall)
 * NOTE: NO right-rail housing. Interior insets near-symmetric L=8.32 /
 * R=8.09 (~0.23% asymmetry · below visible threshold).
 */
export const DEFAULT_ZONES: Record<ZoneId, ZoneRect> = {
  // TOP · NEX identity band (measured top-bezel height on master = 7.27%).
  top:       { top: "0%",   left: "0%",  width: "100%", height: "7.27%" },
  // ═══════════════════════════════════════════════════════════════════════
  // CONTENT · CHAT / WORKSPACE CONTAINER · Philip 2026-09-02 · MASTER v3
  //
  // Measured transparent interior on master v3:
  //   top 7.27%  ·  bottom 10.90%  ·  left 8.32%  ·  right 8.09%
  //   interior: 83.59% wide  ·  81.83% tall
  //
  // Applied 2.5% safe pad inside each transparent edge so content sits
  // SLIGHTLY BACK from the bezel · never touches the metal:
  //   top 9.77% · left 10.82% · width 78.59% · height 76.83%
  //
  // All values expressed as % of the aspect-locked bezel · content scales
  // identically across every phone size (drift from BEZEL_METAL = 0.68%).
  // ═══════════════════════════════════════════════════════════════════════
  content:   { top: "9.77%",  left: "10.82%",  width: "78.59%",  height: "76.83%" },
  // WORKSPACE mirrors CONTENT · fills the transparent interior with pad.
  workspace: { top: "9.77%",  left: "10.82%",  width: "78.59%",  height: "76.83%" },
  belowChat: { top: "76%",    left: "10.82%",  width: "78.59%",  height: "12%"    },
  // SIDE · legacy right-rail hit-target zone · master chassis has NO rail
  // housing. Retained for source-compat with pages still referencing 5
  // rail slots · consumers should stop reading this zone on master.
  side:      { top: "24%",   right: "0%",   width: "8.09%",  height: "52%" },
  // BOTTOM · composer stack · Philip 2026-09-01 seamless HUD treatment.
  // Height 18% holds fade region → input bar → chips row · fade is
  // rendered inside the composer so chat above scrolls underneath it
  // and dissolves smoothly with no hard top edge.
  // Safe-area-inset-bottom pushes the entire composer stack ABOVE the
  // iOS home indicator / Android gesture bar (Philip 2026-09-02 HARD
  // REQUIREMENT · interactive controls must not sit under system UI).
  bottom:    {
    bottom: "calc(3.2% + env(safe-area-inset-bottom, 0px))",
    left:   "10.82%",
    width:  "78.59%",
    height: "18%",
  },
};

/**
 * Hero image height as % of bezel · Philip 2026-08-28 "reduce to give more
 * chat space, keep NEX centered on the image". Single source of truth for
 * the hero.
 *
 * The orb no longer derives ORB_TOP_PCT from HERO_HEIGHT_PCT — that
 * derivation assumed the hero started at y=0, but hero actually starts at
 * HERO_TOP_OFFSET_PX so the orb ended up anchored above the master
 * frame's transparent interior top (7.06%). Its glow spilled into the top
 * bezel. Orb is now positioned EXPLICITLY inside the interior.
 */
export const HERO_HEIGHT_PCT = 22.5 as const;
/** Vertical pixel offset for hero · Philip 2026-08-28 "move down 50px" then "up 3px". */
export const HERO_TOP_OFFSET_PX = 47 as const;
// Philip 2026-08-29 · orb size 11 (~8%) for a tighter footprint.
const ORB_HEIGHT_PCT = 11;
/**
 * ORB TOP-RIGHT PARKED POSITION · Philip 2026-09-01 · LOCKED.
 *
 * The canonical parked slot where the voice orb lives when the user is
 * chatting. Actual TOP-RIGHT of the transparent interior (previous tuning
 * ended up left-of-centre because of large negative pixel nudges — that
 * has been corrected). Measured from the transparent-interior corners so
 * the position stays anchored to the interior even if the bezel is swapped:
 *
 *   TRANSPARENT INTERIOR (master frame · pixel-scan verified):
 *     top-edge    = 7.06% of frame
 *     right-edge  = 92.98% of frame  (100% − 7.02% right inset)
 *
 *   Orb parked position:
 *     orb width   = 24% of frame
 *     top-inset from interior top  =  5.44% of frame  → orb.top  = 12.5%
 *     right-inset from interior right =  2.98% of frame → orb.right = 90%
 *                                                       → orb.left  = 66%
 *
 *   Fine-tune vertical nudge · −17px (Philip 2026-09-01 iterative -25/+8).
 *
 * Do NOT edit these constants for visual tuning of the ACTIVE orb (living
 * on the hero) — that would drag the parked destination out of the corner.
 * If a different active-orb position is needed, add a separate constant.
 */
// Interior corner constants re-measured on master v3 (2026-09-02).
// Orb-park insets rebalanced so the composed absolute values
// (ORB_TOP_PCT = 12.5 · ORB_LEFT_PCT = 66) stay VISUALLY IDENTICAL to
// the previous locked position — Philip's park slot doesn't move despite
// the frame's interior insets shifting from 8.11 → 8.32 on the left.
const INTERIOR_TOP_PCT        = 7.27;
const INTERIOR_LEFT_PCT       = 8.32;
const ORB_PARK_TOP_INSET_PCT  = 5.23;  // 7.27 + 5.23 = 12.5 · orb top unchanged
const ORB_PARK_LEFT_INSET_PCT = 57.68; // 8.32 + 57.68 = 66  · orb left unchanged
const ORB_PARK_TOP_NUDGE_PX   = -17;
const ORB_PARK_LEFT_NUDGE_PX  = 0;
const ORB_TOP_PCT  = INTERIOR_TOP_PCT + ORB_PARK_TOP_INSET_PCT;   // 12.5
const ORB_LEFT_PCT = INTERIOR_LEFT_PCT + ORB_PARK_LEFT_INSET_PCT; // 66.0
const ORB_TOTAL_OFFSET_PX = ORB_PARK_TOP_NUDGE_PX;                // −17

/**
 * Bezel affordances (NEX wordmark · 3 header icons in top-right).
 * v6 shows 3 header icon slots in the top-right beside NEX wordmark.
 *
 * SAFE-AREA HANDLING · Philip 2026-09-02 HARD REQUIREMENT.
 * `env(safe-area-inset-*)` is added to every INTERACTIVE affordance so
 * that on iOS PWA install (viewport-fit=cover · black-translucent status
 * bar) the wordmark + header icons + kebab render BELOW the status bar
 * area / gesture bar, not underneath them. The frame chassis itself
 * still extends behind the OS system UI — only interactive controls are
 * inset. `env(*, 0px)` fallback keeps browsers without safe-area support
 * unaffected. Left/right insets handle iPhone landscape + Android cutouts.
 */
export const BEZEL_AFFORDANCES = {
  wordmark:   {
    top:   "calc(0.3% + env(safe-area-inset-top, 0px))",
    left:  "calc(1% + env(safe-area-inset-left, 0px))",
    width: "22%", height: "5%",
  },
  // Voice orb · LOCKED to the TOP-RIGHT PARKED POSITION (Philip 2026-09-01).
  // Coordinates derived from transparent-interior corner + inset constants
  // above · anchor stays fixed to the interior at any viewport size, and
  // survives future bezel swaps as long as INTERIOR_TOP_PCT / LEFT_PCT are
  // updated to match the new transparent alpha bounds.
  voiceOrb:   {
    top:    `calc(${ORB_TOP_PCT}%  + ${ORB_PARK_TOP_NUDGE_PX}px)`,
    left:   `calc(${ORB_LEFT_PCT}% + ${ORB_PARK_LEFT_NUDGE_PX}px)`,
    width:  "24%",
    height: `${ORB_HEIGHT_PCT}%`,
  },
  // 3 header icon hit targets · pixel-scan (v8 2026-08-26).
  // Cumulative nudges: -35px left → back 3px = -32px left · down 5px.
  // Safe-area-inset-top pushes them BELOW the iOS status bar/Dynamic Island.
  // Safe-area-inset-right pushes them IN from Android cutouts.
  headerIcon1: {
    top:   "calc(2% + 5px + env(safe-area-inset-top, 0px))",
    right: "calc(19.5% + 32px + env(safe-area-inset-right, 0px))",
    width: "5%", height: "3%",
  },
  headerIcon2: {
    top:   "calc(2% + 5px + env(safe-area-inset-top, 0px))",
    right: "calc(10.5% + 32px + env(safe-area-inset-right, 0px))",
    width: "5%", height: "3%",
  },
  headerIcon3: {
    top:   "calc(2% + 5px + env(safe-area-inset-top, 0px))",
    right: "calc(2% + 32px + env(safe-area-inset-right, 0px))",
    width: "5%", height: "3%",
  },
  // 3-dot vertical kebab under the Food rail button · Philip 2026-08-28.
  // Right-inset only (kebab sits vertically mid-frame · no status bar risk).
  rightKebab: {
    top:   "calc(77% + 5px)",
    right: "calc(3% + 5px + env(safe-area-inset-right, 0px))",
    width: "9%", height: "5%",
  },
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

/* ═══════════════════════════════════════════════════════════════════════
 * CHAT-BUBBLE MAX-WIDTH LOCK · Philip 2026-08-27 · CONSTITUTIONAL.
 * Every chat bubble in NEX — user text · NEX reply · mascot postcard ·
 * whatever ships later — MUST NEVER exceed this width. Bubbles can be
 * SMALLER (short messages · single-word replies) but MUST NOT exceed.
 *
 * Locked to the PHONE FRAME, not the browser window. Scales with the
 * bezel dimensions so on desktop it stays phone-sized (not window-sized).
 *
 * Derived from the Mascot Stage's live chat container position:
 *   Bezel-relative container = 8.1% × bezel_w + 18px  →  82.5% × bezel_w + 8px
 *   MAX WIDTH               = 74.4% × bezel_w − 10px
 *   Bezel width formula     = min(100dvw, 100dvh × 850 / 1850)
 *
 * FUTURE EDITS: any change to chat bubble sizing MUST reference these
 * constants. Direct maxWidth overrides that exceed CHAT_BUBBLE_MAX_WIDTH
 * are forbidden.
 * ═══════════════════════════════════════════════════════════════════ */

/** CSS expression for the bezel's rendered width in the current viewport. */
export const BEZEL_W_CSS = `min(100dvw, calc(100dvh * ${BEZEL_METAL.w} / ${BEZEL_METAL.h}))` as const;

/** MAX bubble width · locked to the phone frame · scales with the bezel.
 *  0.70 = 70% · Philip 2026-08-28 · safe measured safeContentWidthPct
 *  (~70.13%) so the rail buttons NEVER cover a bubble when visible. */
export const CHAT_BUBBLE_MAX_WIDTH = `calc(${BEZEL_W_CSS} * 0.70)` as const;

/**
 * WIDE MAX bubble width · Philip 2026-08-28.
 * Used when the right rail is hidden via the kebab toggle · frame swaps to
 * hud-frame-v12-norail.png which STILL has a ~12.11% opaque right bezel
 * (rail housing is gone but the phone edge silhouette remains).
 *
 * Measured safe strip on v12-norail:
 *   leftBezelInsetPct  = 12.22%
 *   rightSilhouetteInsetPct = 12.11%
 *   safeContentWidth = 100 − 12.22 − 12.11 = 75.67%
 *
 * Rounded to 75% so bubbles clear the right silhouette cleanly.
 */
export const CHAT_BUBBLE_MAX_WIDTH_WIDE = `calc(${BEZEL_W_CSS} * 0.75)` as const;

/**
 * NEX Chat FEED LANE inset · Philip 2026-08-28.
 * Invisible spatial lane on the right side where messages MIGRATE to before
 * flying off at 45°. 4-6% inset from workspace right edge. NEVER drawn as
 * a rail — pure spatial concept. Referenced by NexWorkspaceChat's two-phase
 * flow (enteringFeed → exiting).
 */
export const FEED_LANE_INSET_PCT = 5 as const;

/**
 * NEX ANCHOR POSITION · Philip 2026-08-28 · Phase 1 spatial canvas · LOCKED.
 *
 * The permanent (x, y) coordinate of the first NEX message and every
 * subsequent message in the vertical timeline. This is the START POSITION
 * for the greeting text ("Hi. Ask me anything…") and every message that
 * follows — timeline flows down from here.
 *
 * Iteration history:
 *   · Original padding-top phase → calc(22% + 65px)
 *   · Philip 2026-08-29 · nudged up 15px more → 22%
 *   · Philip 2026-09-01 · nudged up 20px more → calc(22% - 20px) · LOCKED
 */
export const NEX_ANCHOR_POSITION = Object.freeze({
  yCss: "calc(22% - 20px)",   // Philip 2026-09-01 · -20px lock · start position for greeting text
  leftCss: "4%",              // left-inset · NEX = LEFT (Philip 2026-08-28 locked)
} as const);

/**
 * NEX text element left/right column X positions · Philip 2026-08-28.
 * User = LEFT column · NEX = RIGHT column · both 4% inset from workspace edge.
 */
export const NEX_COLUMN_INSET_PCT = 4 as const;

/**
 * Minimum vertical gap between consecutive same-sender text elements ·
 * Philip 2026-08-28. Guarantees no visual collision even for stacked short
 * messages. Actual y = previous.bottom + this.
 */
export const NEX_MESSAGE_VERTICAL_GAP_PX = 14 as const;

/**
 * Workspace horizontal width when rail is HIDDEN (Philip 2026-08-28).
 * Matches the measured v12-norail safe content strip so bubbles never get
 * covered by the frame's right bezel artwork.
 */
export const WORKSPACE_WIDTH_NO_RAIL = "75%" as const;

/** Left inset for left-aligned bubbles (NEX / mascot postcard). Scales. */
export const CHAT_BUBBLE_LEFT_INSET = `calc(${BEZEL_W_CSS} * 0.081 + 18px)` as const;

/** Right inset for right-aligned bubbles (user). Scales. */
export const CHAT_BUBBLE_RIGHT_INSET = `calc(${BEZEL_W_CSS} * 0.175 - 8px)` as const;

/* ═══════════════════════════════════════════════════════════════════════
 * NEX INNER VIEWPORT · Philip 2026-08-27 · CANONICAL · MEASURED · CONSTITUTIONAL.
 *
 * The transparent inner display region of the NEX frame image. Measured
 * ONCE from public/nex/hud-frame-v9.png alpha channel by
 * scripts/nexapp/measure-frame-viewport.mjs (native raster 853×1844).
 *
 * EVERY NEX page places its content INSIDE this viewport. Content MUST NOT:
 *   · extend under or over the frame artwork
 *   · position relative to the outer frame image
 *   · exceed these bounds ("full height/full width" means THIS viewport)
 *
 * The <NexFrameViewport> React helper wraps content in fixed-position
 * pixel-perfect bounds derived from these constants. Consumers should
 * use the component; direct CSS use of the constants is allowed for
 * one-off overlays but must match the exact values.
 *
 * DO NOT re-measure per page. DO NOT invent alternative values.
 * ═══════════════════════════════════════════════════════════════════ */

export const NEX_INNER_VIEWPORT = Object.freeze({
  // v12 · Philip 2026-08-28 · MEASURED via scripts/nexapp/measure-frame-full.mjs
  // (full alpha-channel scan · not the earlier mid-band-only scan).
  //
  //   hero strip ends at y = 131 px  (top 7.83%)
  //   footer strip starts at y = 1465 px  (bottom 12.38%)
  //   viewport height = 1334 px  (79.78% of frame height)
  //
  // Content viewport is FULL WIDTH (edge-to-edge of the frame image) and
  // vertically bounded by hero (top) and footer/composer (bottom). Rail
  // housing + rail buttons + left bezel silhouette OVERLAY the content ·
  // content passes BEHIND them by design (NEX MASTER FRAME doctrine).
  topPct:    7.83,     // hero strip ends here (y = 131 px)
  bottomPct: 12.38,    // footer/composer strip begins here (y = 1465 px)
  leftPct:   0,        // full frame width · left bezel silhouette OVERLAYS
  rightPct:  0,        // full frame width · rail housing + buttons OVERLAY
  widthPct:  100,
  heightPct: 79.78,    // 100 - topPct - bottomPct
} as const);

/* ═══════════════════════════════════════════════════════════════════════
 * NEX FRAME INNER ROOM · Philip 2026-08-28 · MEASURED · CONSTITUTIONAL.
 *
 * These constants describe the EXACT usable interior of the frame as
 * measured from the alpha channel. Any content that must not be hidden
 * by the frame's opaque parts (left bezel silhouette · right rail
 * housing) MUST respect these bounds.
 *
 * Doctrine (Philip 2026-08-28): "when I say lock images or containers into
 * position these are locked to frame inner size so we are sure they display
 * correctly for all mobile phone devices."
 *
 * Source: scripts/nexapp/measure-frame-full.mjs against hud-frame-v12.png ·
 * JSON snapshot at data/nex-run-logs/frame-inner-geometry.json.
 * ═══════════════════════════════════════════════════════════════════ */

export const NEX_FRAME_INNER_ROOM = Object.freeze({
  /** Left bezel silhouette max intrusion · content < this x is HIDDEN behind bezel. */
  leftBezelInsetPct:   11.80,
  /** Right rail housing width · content > (100 - this) is HIDDEN behind rail. */
  rightRailInsetPct:   18.07,
  /** Widest usable content strip between bezel and rail (may occur at any y). */
  innerWidestPct:      86.50,
  /** Narrowest usable content strip (worst-case row inside viewport). */
  innerNarrowestPct:   75.13,
  /** Safe content width (100 − left bezel − right rail). */
  safeContentWidthPct: 70.13,
} as const);

/** CSS calc expressions that resolve to viewport dimensions inside the bezel. */
export const NEX_INNER_VIEWPORT_CSS = Object.freeze({
  top:    `${NEX_INNER_VIEWPORT.topPct}%`,
  bottom: `${NEX_INNER_VIEWPORT.bottomPct}%`,
  left:   `${NEX_INNER_VIEWPORT.leftPct}%`,
  right:  `${NEX_INNER_VIEWPORT.rightPct}%`,
  width:  `${NEX_INNER_VIEWPORT.widthPct}%`,
  height: `${NEX_INNER_VIEWPORT.heightPct}%`,
} as const);

/* ═══════════════════════════════════════════════════════════════════════
 * NEX BRAND ACCENT REGIONS · Philip 2026-08-28.
 *
 * Rectangles inside the frame image that should stay BRAND ORANGE even
 * when frameMode is cinema/dim/off. Measured by
 * scripts/nexapp/measure-frame-accents.mjs against hud-frame-v9.png ·
 * scanned for orange RGB pixels in the top strip.
 *
 * Rendering strategy (NexHudFrame): when frameMode !== "normal", render an
 * additional copy of the frame image PER region, clipped via `clip-path:
 * inset(top right bottom left)` and with NO greyscale filter. Those clip
 * rectangles show the original orange pixels · everything outside stays
 * cinema-mode grey.
 *
 * Insets are % of the frame image (bezel wrapper).
 * ═══════════════════════════════════════════════════════════════════ */

export interface FrameAccentRegion {
  id: string;
  label: string;
  insetTop: number;
  insetRight: number;
  insetBottom: number;
  insetLeft: number;
  /**
   * Blend mode applied to the accent overlay · Philip 2026-08-28.
   * "color"  · default · transfers hue+saturation, keeps luminance from below
   *            (subtle blend · surrounding metal within the clip is invisible)
   * "normal" · paints the frame's original orange straight through
   *            (solid vivid orange · use for the X letter etc.)
   */
  blendMode?: "color" | "normal";
  /** Optional filter boost for vividness · e.g. "saturate(1.4)". */
  filter?: string;
}

export const NEX_BRAND_ACCENT_REGIONS: readonly FrameAccentRegion[] = Object.freeze([
  // v12 chassis · right-rail button housings · Philip 2026-08-29 · Path A.
  //
  // Five illuminated hexagonal housings on the right rail. Measurements were
  // taken from the actual master asset (public/nex/hud-frame-v12.png · 941×1672)
  // via scripts/nexapp/measure-frame-accents.mjs · flood-fill orange detection.
  // Bounding boxes visually verified via
  //   scripts/nexapp/preview-rail-housings.mjs
  // rendered to public/nex/hud-frame-v12-rail-housing-preview.png and confirmed
  // by Philip against the master frame before commit.
  //
  // Each housing aligns to its rail slot in DEFAULT_ZONES.side (top 24% · height
  // 52% · 5 equal slots @ 10.4% each). Top-to-top rhythm is a consistent
  // ~10% of frame height (measured: 162 · 168 · 166 · 169 px between rows).
  //
  // All five use rightPct=2.34% intentionally — this excludes the outer x=928-929
  // decorative frame trim near the top-right corner (that trim is chrome, not
  // housing light). Keeps all five housings visually identical in width.
  //
  // Consumer note: these regions render at z:21 with mixBlendMode "color" ONLY
  // when frameMode !== "normal" (see NexHudFrame.tsx:592). Ceremony-driven
  // per-region visibility (dark → housing 1 lights → housing 2 lights → ...)
  // is a follow-up batch — this commit just establishes the geometry.
  { id: "railHousing1", label: "Right rail button housing 1 (top)",    insetTop: 25.96, insetRight: 2.34, insetBottom: 66.27, insetLeft: 84.70 },
  { id: "railHousing2", label: "Right rail button housing 2",          insetTop: 35.65, insetRight: 2.34, insetBottom: 56.16, insetLeft: 84.70 },
  { id: "railHousing3", label: "Right rail button housing 3 (middle)", insetTop: 45.69, insetRight: 2.34, insetBottom: 46.23, insetLeft: 84.70 },
  { id: "railHousing4", label: "Right rail button housing 4",          insetTop: 55.62, insetRight: 2.34, insetBottom: 36.42, insetLeft: 84.70 },
  { id: "railHousing5", label: "Right rail button housing 5 (bottom)", insetTop: 65.73, insetRight: 2.34, insetBottom: 26.20, insetLeft: 84.70 },
]);

