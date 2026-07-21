// Editor state model — the source of truth for what the canvas
// renders and what we persist into hammerex_site_editor_drafts.state.
//
// Layer union kept flat so serialisation is one JSON.stringify with
// no cyclical refs. `id` on every layer is UI-only (Konva key + focus
// state). `z` orders layers bottom→top.

export type LayerAnimation = {
  /** When the overlay becomes visible (seconds since video start).
   *  0 = visible from t=0. */
  enterAtSec:  number;
  /** When the overlay disappears (seconds). Should be > enterAtSec.
   *  If >= video duration, treated as "until the end". */
  exitAtSec:   number;
  /** Crossfade duration on entry (seconds). 0 = pop-in (no fade). */
  fadeInSec:   number;
  /** Crossfade duration on exit (seconds). 0 = pop-out. */
  fadeOutSec:  number;
};

export type EditorLayerBase = {
  id:      string;
  z:       number;
  x:       number;
  y:       number;
  rotation: number;
  /** Baseline opacity — for animated layers, live opacity is
   *  derived by combining this with the animation curve at each
   *  video frame. Static layers use this value as-is. */
  opacity: number;
  /** Optional keyframe animation. Only meaningful when the editor's
   *  base is a video. Undefined = show the overlay for the whole
   *  clip at `opacity`. */
  animation?: LayerAnimation;
};

export type ImageLayer = EditorLayerBase & {
  kind:   "image";
  url:    string;      // upstream URL or data URL
  width:  number;
  height: number;
};

/** Text-effect bundle — subtle by default so the composition still
 *  reads clearly. Shadow adds depth on busy photos; outline (stroke)
 *  keeps thin fonts readable on chaotic backgrounds; highlight puts
 *  a solid rect behind the text for max legibility. */
export type TextEffects = {
  shadow?: {
    color:  string;   // e.g. "rgba(0,0,0,0.6)"
    blur:   number;   // px
    offsetX:number;
    offsetY:number;
  };
  outline?: {
    color: string;
    width: number;   // px stroke width
  };
  highlight?: {
    color:   string;
    padding: number; // px around text
  };
};

export type TextLayer = EditorLayerBase & {
  kind:       "text";
  text:       string;
  fontSize:   number;
  fontWeight: 400 | 600 | 700 | 800;
  fontFamily: string;
  color:      string;
  align:      "left" | "center" | "right";
  width:      number;
  variant:    "body" | "header";
  effects?:   TextEffects;
  /** Template-authored lock modes. Merchants can always edit the
   *  text content itself; `locked` narrows what ELSE they can change:
   *    "style"    — font / size / weight / colour / effects locked
   *    "position" — position + rotation + resize locked
   *  Undefined = fully editable (default). */
  locked?:    "style" | "position";
};

export type OverlayLayer = EditorLayerBase & {
  kind:      "overlay";
  overlayId: string;
  url:       string;
  width:     number;
  height:    number;
};

export type BannerLayer = EditorLayerBase & {
  kind:      "banner";
  bannerId:  string;
  url:       string;
  width:     number;
  height:    number;
};

export type ShapeLayer = EditorLayerBase & {
  kind:        "shape";
  shape:       "rect" | "circle" | "arrow" | "line" | "triangle" | "star";
  width:       number;
  height:      number;
  /** Solid fill colour. Null = transparent (outline-only shapes) —
   *  useful for badge-style callouts where the background image
   *  should show through. */
  fill:        string | null;
  stroke:      string | null;
  strokeWidth: number;
};

export type ObjectLayer = EditorLayerBase & {
  kind:     "object3d";
  objectId: string;   // key into the 3D object library
  width:    number;
  height:   number;
};

export type EditorLayer =
  | ImageLayer
  | TextLayer
  | OverlayLayer
  | BannerLayer
  | ShapeLayer
  | ObjectLayer;

export type BaseImageSlot = {
  /** Optional starting image from The Site wall. */
  sourceImageId: string | null;
  /** Actual image URL used as the base layer (either the source
   *  image or a user upload). Null when the user hasn't picked
   *  a base yet — the canvas shows an empty frame with an upload
   *  prompt. */
  url:            string | null;
  /** Positioning + scale within the frame. */
  offsetX:        number;
  offsetY:        number;
  scale:          number;
  /** Optional non-uniform scale overrides. When either is set the
   *  base image renders with scaleX × natural width and scaleY ×
   *  natural height (independent axes). Driven by the horizontal +
   *  vertical scale bars around the canvas. Falls back to `scale`
   *  when undefined — every legacy draft keeps working. */
  scaleX?:        number;
  scaleY?:        number;
  /** Media type — "image" is the default and everything works as
   *  before. "video" swaps in an HTMLVideoElement as the Konva
   *  texture, adds a scrubber under the canvas, and routes export
   *  through the /video/compose ffmpeg pipeline instead of the
   *  client-side stage.toDataURL flatten. */
  kind?:          "image" | "video";
  /** For video slots: probed duration in seconds and the storage
   *  path that /video/compose needs. Populated by the upload
   *  endpoint response. */
  videoDurationS?: number;
  videoStorage?:   string;
  videoWidth?:     number;
  videoHeight?:    number;
  videoBytes?:     number;
  /** Trim range (seconds within the source video). Composed output
   *  starts at trimFrom and ends at trimTo. Undefined = use the
   *  whole video. Client also clamps playback to this range. */
  trimFrom?:       number;
  trimTo?:         number;
  /** Template placeholder marker — when true the slot renders as a
   *  dashed-outlined empty area with "Tap to add your photo" copy
   *  even when the composition otherwise looks complete. Set by
   *  the template-authoring flow so merchants know exactly where
   *  to drop their own photo. Cleared as soon as `url` is set. */
  isPlaceholder?:  boolean;
};

export type EditorMode = "single" | "beforeAfter";

/** Video compose payload — a legacy-shaped snapshot of the ONE
 *  slide the merchant is composing (a video is always a single
 *  clip). Shared by the client, the compose route, and the ffmpeg
 *  worker so the three surfaces stay in lockstep. */
export type ComposePayload = {
  version:        1;
  frameSlug:      string;
  base:           BaseImageSlot;
  secondaryBase?: BaseImageSlot;
  mode:           EditorMode;
  layers:         EditorLayer[];
  /** Preview canvas dimensions at the time overlays were placed.
   *  The worker uses these to compute the scale factor from preview
   *  coords → target export coords. Optional for back-compat with
   *  pre-fix payloads (worker falls back to 720 short-side). */
  previewWidth?:  number;
  previewHeight?: number;
};

/** One slide in a carousel. A single-post composition is just a
 *  carousel with one slide. Multi-slide compositions (Instagram
 *  carousel, up to 10) hold N slides here — the SlideNavigator
 *  strip below the canvas switches the active index. */
export type CarouselSlide = {
  id:            string;
  base:          BaseImageSlot;
  secondaryBase?: BaseImageSlot;
  mode:          EditorMode;
  layers:        EditorLayer[];
};

export type EditorState = {
  version:   1;
  frameSlug: string;
  /** Every composition is a carousel — single-slide compositions
   *  just have slides.length === 1. Cap 10 for Instagram's carousel
   *  limit. Always at least one slide. */
  slides:           CarouselSlide[];
  /** Which slide the canvas is currently showing / editing.
   *  0-based index into slides[]. */
  activeSlideIndex: number;
};

/** Read the active slide from state — every render + editor helper
 *  routes through this so slide navigation is transparent. */
export function activeSlide(state: EditorState): CarouselSlide {
  return state.slides[state.activeSlideIndex] ?? state.slides[0];
}

/** Immutably patch the active slide. Returns a new EditorState. */
export function withActiveSlide(state: EditorState, patch: Partial<CarouselSlide> | ((s: CarouselSlide) => CarouselSlide)): EditorState {
  const idx = state.activeSlideIndex;
  const cur = state.slides[idx] ?? state.slides[0];
  const next = typeof patch === "function" ? patch(cur) : { ...cur, ...patch };
  const nextSlides = state.slides.slice();
  nextSlides[idx] = next;
  return { ...state, slides: nextSlides };
}

/** Migration — older drafts stored base/mode/layers at the top of
 *  EditorState. Wrap them into slides[0] so they open in the new
 *  carousel-shaped editor without loss.
 *
 *  Defensive against garbage input: anything that isn't a plain
 *  object, or a slide array with the wrong shape, falls back to an
 *  empty single-slide state so the editor still opens instead of
 *  crashing on hydration. */
export function migrateLegacyState(raw: unknown): EditorState {
  if (!raw || typeof raw !== "object") return newEmptyState("ig-feed");
  const s = raw as Partial<EditorState> & { base?: unknown; secondaryBase?: unknown; layers?: unknown; mode?: unknown };
  const frameSlug = typeof s.frameSlug === "string" && s.frameSlug.length > 0 ? s.frameSlug : "ig-feed";

  // New (carousel) shape — validate slides is a non-empty array of
  // slide-shaped objects. Anything malformed → empty state.
  if (Array.isArray(s.slides) && s.slides.length > 0) {
    const cleaned: CarouselSlide[] = s.slides
      .filter((slide) => slide && typeof slide === "object")
      .map((slide, i) => ({
        id:            typeof slide.id === "string" && slide.id ? slide.id : `slide-${Date.now()}-${i}`,
        base:          isBaseImageSlot(slide.base) ? slide.base : newEmptyBaseSlot(),
        secondaryBase: isBaseImageSlot(slide.secondaryBase) ? slide.secondaryBase : undefined,
        mode:          slide.mode === "beforeAfter" ? "beforeAfter" : "single",
        layers:        Array.isArray(slide.layers) ? (slide.layers as EditorLayer[]) : []
      }));
    if (cleaned.length === 0) return newEmptyState(frameSlug);
    const idx = typeof s.activeSlideIndex === "number"
      ? Math.max(0, Math.min(cleaned.length - 1, s.activeSlideIndex))
      : 0;
    return { version: 1, frameSlug, slides: cleaned, activeSlideIndex: idx };
  }

  // Legacy shape: base + layers + mode at top level.
  const slide: CarouselSlide = {
    id:            `slide-${Date.now()}`,
    base:          isBaseImageSlot(s.base) ? s.base : newEmptyBaseSlot(),
    secondaryBase: isBaseImageSlot(s.secondaryBase) ? s.secondaryBase : undefined,
    mode:          s.mode === "beforeAfter" ? "beforeAfter" : "single",
    layers:        Array.isArray(s.layers) ? (s.layers as EditorLayer[]) : []
  };
  return { version: 1, frameSlug, slides: [slide], activeSlideIndex: 0 };
}

function isBaseImageSlot(v: unknown): v is BaseImageSlot {
  if (!v || typeof v !== "object") return false;
  const b = v as Partial<BaseImageSlot>;
  return typeof b.offsetX === "number" && typeof b.offsetY === "number" && typeof b.scale === "number";
}

export function newEmptyBaseSlot(): BaseImageSlot {
  return { sourceImageId: null, url: null, offsetX: 0, offsetY: 0, scale: 1 };
}

export function newEmptySlide(): CarouselSlide {
  return {
    id:     `slide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    base:   newEmptyBaseSlot(),
    mode:   "single",
    layers: []
  };
}

export function newEmptyState(frameSlug: string): EditorState {
  return {
    version:          1,
    frameSlug,
    slides:           [newEmptySlide()],
    activeSlideIndex: 0
  };
}
