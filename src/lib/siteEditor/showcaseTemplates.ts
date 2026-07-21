// Showcase templates — hardcoded, client-side rich templates that
// the TemplatesDrawer merges with whatever the DB returns. Ensures
// the drawer is populated the moment the editor loads, even before
// the admin has authored anything against
// hammerex_site_editor_templates.
//
// v2 architecture (2026-07-21): every showcase template stores
// SEMANTIC content only (eyebrow/hero/display/body/cta strings) +
// a background image URL. The template's concrete text layers are
// resolved by resolveTemplateLayers() using per-frame zones from
// frameLayout.ts. Result: the same template produces frame-perfect
// compositions on Feed, Portrait, Story, Reel, TikTok, Snapchat,
// Facebook Feed — every string lands inside the frame's real
// safe zone by construction.
//
// Preview metadata drives the WYSIWYG thumbnail in the drawer
// (real photo + scrim + headline overlay in HTML/CSS).

import { resolveTemplateLayers, getFrameLayout, type TemplateContent } from "./frameLayout";

// Real library images (hammerex_feed_tile_library, tier 2/3, clean).
// Picked to be trade-agnostic enough that any merchant sees a
// composition that reads. Swap these when better banner-ready
// images land — no other code needs to change.
const IMG_BRICKLAYER = "https://ik.imagekit.io/9mrgsv2rp/91c371b6931b26892a94bae82fc510a1.jpg";
const IMG_PLUMBER    = "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2019,%202026,%2010_29_05%20AM.png";
const IMG_STAIR      = "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2012_56_38%20AM.png";
const IMG_PLASTER    = "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2019,%202026,%2010_36_02%20AM.png";
const IMG_GATE       = "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2019,%202026,%2011_55_15%20AM.png";
const IMG_TILER      = "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/network-uploads/yard-feed/tiler-floor-tile-samples-grid.png";
const IMG_WINDOW     = "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2019,%202026,%2011_36_16%20AM.png";
const IMG_POOL       = "https://ik.imagekit.io/9mrgsv2rp/b431de47ac88f4568bd150ddf7b2211f.jpg";

// Crown banners — Philip-authored ChatGPT compositions with all
// design + text burned into the PNG. Merchant only edits the phone
// number slot. Trade-scoped so they only surface for the right
// merchants. Source PNG lives in /public/crown-banners/ at
// 1080×1080 Instagram Feed native — cover-fits perfectly onto the
// ig-feed / fb-square frames.
const IMG_CROWN_STAIRCASE = "/crown-banners/staircase-step-above.png";

const YELLOW = "#FFB300";
const BLACK  = "#0A0A0A";

/** Same shape as DB EditorTemplate, plus:
 *   • `content` — semantic strings the resolver expands per frame
 *                 (undefined for crown banners — they use hardcoded
 *                  layers so the merchant's edit surface is a single
 *                  draggable slot, not a full text stack)
 *   • `preview` — HTML/CSS composite metadata for the drawer tile
 *   • `state`   — a pre-resolved starter state for the default frame
 *   • `isCrown` — premium banner (all text + design burned into the
 *                 image at authoring time; only the phone slot is
 *                 editable). Gets a gold Crown badge in the drawer
 *                 + tier + trade gating at pick time.
 *   • `tradeSlugs` — when set, the template only surfaces in the
 *                 drawer for merchants whose primary trade matches
 *                 one of these slugs. Crown banners are always
 *                 trade-scoped (see the staircase banner below). */
export type ShowcaseTemplate = {
  id:                 string;
  slug:               string;
  label:              string;
  category:           string;
  frame_slug:         string;
  state:              unknown;
  thumbnail_url:      string | null;
  sibling_group_slug?: string | null;
  /** Semantic content used by the resolver at pick-time. Undefined
   *  for crown banners which ship with hardcoded layers instead. */
  content?:           TemplateContent;
  /** Image URL applied as the base slot. */
  imageUrl:           string;
  /** WYSIWYG preview metadata. */
  preview?: {
    imageUrl:    string;
    headline:    string;
    subline?:    string;
    textColor?:  string;
    accentColor?: string;
    scrim?:      "bottom" | "top" | "full" | "left";
  };
  /** Crown banner marker — renders a gold Crown badge on the drawer
   *  tile + routes the pick through the legacy state path. */
  isCrown?:           boolean;
  /** Trade-slug allowlist. When set the template only appears in
   *  the drawer for merchants whose primary trade matches one of
   *  these slugs. Enforced client-side in TemplatesDrawer. */
  tradeSlugs?:        string[];
  /** For crown banners: the pre-calibrated location of the phone-
   *  number slot inside the burned-in design. Coordinates are in
   *  authoring pixels (1080-scale). The pick handler multiplies by
   *  displayScale before creating the Konva layer. Merchant can
   *  drag / resize the layer afterwards to fine-tune position. */
  phoneSlot?: {
    x:        number;
    y:        number;
    width:    number;
    fontSize: number;
    /** Placeholder shown until the merchant enters their number.
     *  Defaults to "07XXX XXX XXX" when omitted. */
    placeholder?: string;
    /** Text colour — usually white on brown/dark bands. */
    color?:   string;
  };
};

/** Build a starter EditorState for the template's default frame.
 *  Used when code paths adopt the template without going through
 *  the frame resolver (fallback). Live pick paths go through
 *  resolveTemplateLayers(content, currentFrame) instead. */
function starterState(imageUrl: string, content: TemplateContent, frameSlug: string, mode: "single" | "beforeAfter" = "single") {
  // Starter state uses a display scale of 1 (authoring-resolution).
  // Real pick paths go through the resolver with the merchant's live
  // canvas display scale (see EditorClient template pick handler).
  const layout = getFrameLayout(frameSlug);
  const layers = resolveTemplateLayers(content, frameSlug, 720 / Math.min(layout.w, layout.h));
  const base = {
    sourceImageId: null,
    url:           imageUrl,
    offsetX:       0,
    offsetY:       0,
    scale:         1,
    kind:          "image" as const,
    isPlaceholder: false
  };
  if (mode === "beforeAfter") {
    return {
      version:       1,
      frameSlug,
      mode,
      base,
      secondaryBase: { ...base, isPlaceholder: true },
      layers
    };
  }
  return {
    version:   1,
    frameSlug,
    mode,
    base,
    layers
  };
}

// ─── Templates ────────────────────────────────────────────────────

const T_WEEKEND: TemplateContent = { hero: "WEEKEND", display: "SALE", body: "20% OFF THIS WEEK. DM TO BOOK." };
const T_PRICE:   TemplateContent = { eyebrow: "FROM", hero: "£99", body: "GET A QUOTE TODAY", cta: "DM to book" };
const T_TESTI:   TemplateContent = { hero: "“ABSOLUTE PROS”", body: "Job done in a day. Spotless finish.", cta: "SARAH · MANCHESTER" };
const T_BOOKING: TemplateContent = { hero: "NOW", display: "BOOKING", body: "MAY + JUNE SLOTS OPEN", cta: "DM to secure your date" };
const T_FREE:    TemplateContent = { eyebrow: "GET A", hero: "FREE", display: "QUOTE", body: "Quote today, work tomorrow.", cta: "DM us for a quote" };
const T_EMRG:    TemplateContent = { hero: "24/7", display: "EMERGENCY", body: "Callouts across the county", cta: "Call now" };
const T_BA:      TemplateContent = { hero: "BEFORE / AFTER", body: "See the transformation" };
const T_VERIF:   TemplateContent = { hero: "VERIFIED", display: "TRADE", body: "ID + insurance checked", cta: "thenetworkers.app" };

export const SHOWCASE_TEMPLATES: ShowcaseTemplate[] = [
  {
    id:            "showcase-sale-weekend",
    slug:          "showcase-sale-weekend",
    label:         "Weekend Sale",
    category:      "promo",
    frame_slug:    "ig-feed",
    imageUrl:      IMG_BRICKLAYER,
    content:       T_WEEKEND,
    thumbnail_url: IMG_BRICKLAYER,
    state:         starterState(IMG_BRICKLAYER, T_WEEKEND, "ig-feed"),
    preview: {
      imageUrl:    IMG_BRICKLAYER,
      headline:    "WEEKEND SALE",
      subline:     "20% OFF THIS WEEK",
      textColor:   YELLOW,
      accentColor: BLACK,
      scrim:       "bottom"
    }
  },
  {
    id:            "showcase-price-from-99",
    slug:          "showcase-price-from-99",
    label:         "Price from £99",
    category:      "price-card",
    frame_slug:    "ig-feed",
    imageUrl:      IMG_PLUMBER,
    content:       T_PRICE,
    thumbnail_url: IMG_PLUMBER,
    state:         starterState(IMG_PLUMBER, T_PRICE, "ig-feed"),
    preview: {
      imageUrl:  IMG_PLUMBER,
      headline:  "FROM £99",
      subline:   "GET A QUOTE TODAY",
      textColor: YELLOW,
      scrim:     "bottom"
    }
  },
  {
    id:            "showcase-testimonial-classy",
    slug:          "showcase-testimonial-classy",
    label:         "Customer testimonial",
    category:      "testimonial",
    frame_slug:    "ig-portrait",
    imageUrl:      IMG_STAIR,
    content:       T_TESTI,
    thumbnail_url: IMG_STAIR,
    state:         starterState(IMG_STAIR, T_TESTI, "ig-portrait"),
    preview: {
      imageUrl:  IMG_STAIR,
      headline:  "“Absolute pros”",
      subline:   "SARAH · MANCHESTER",
      textColor: "#FFFFFF",
      scrim:     "full"
    }
  },
  {
    id:            "showcase-now-booking",
    slug:          "showcase-now-booking",
    label:         "Now booking",
    category:      "announcement",
    frame_slug:    "ig-feed",
    imageUrl:      IMG_PLASTER,
    content:       T_BOOKING,
    thumbnail_url: IMG_PLASTER,
    state:         starterState(IMG_PLASTER, T_BOOKING, "ig-feed"),
    preview: {
      imageUrl:  IMG_PLASTER,
      headline:  "NOW BOOKING",
      subline:   "MAY + JUNE SLOTS OPEN",
      textColor: YELLOW,
      scrim:     "bottom"
    }
  },
  {
    id:            "showcase-free-quote",
    slug:          "showcase-free-quote",
    label:         "Free quote",
    category:      "quote",
    frame_slug:    "ig-portrait",
    imageUrl:      IMG_GATE,
    content:       T_FREE,
    thumbnail_url: IMG_GATE,
    state:         starterState(IMG_GATE, T_FREE, "ig-portrait"),
    preview: {
      imageUrl:  IMG_GATE,
      headline:  "FREE QUOTE",
      subline:   "QUOTE TODAY. WORK TOMORROW.",
      textColor: YELLOW,
      scrim:     "bottom"
    }
  },
  {
    id:            "showcase-emergency-247",
    slug:          "showcase-emergency-247",
    label:         "24/7 Emergency",
    category:      "announcement",
    frame_slug:    "ig-feed",
    imageUrl:      IMG_PLUMBER,
    content:       T_EMRG,
    thumbnail_url: IMG_PLUMBER,
    state:         starterState(IMG_PLUMBER, T_EMRG, "ig-feed"),
    preview: {
      imageUrl:    IMG_PLUMBER,
      headline:    "24/7 EMERGENCY",
      subline:     "CALL NOW. WE COME OUT.",
      textColor:   "#FFFFFF",
      accentColor: "#B91C1C",
      scrim:       "full"
    }
  },
  {
    id:            "showcase-before-after",
    slug:          "showcase-before-after",
    label:         "Before / After",
    category:      "before-after",
    frame_slug:    "ig-portrait",
    imageUrl:      IMG_TILER,
    content:       T_BA,
    thumbnail_url: IMG_TILER,
    state:         starterState(IMG_TILER, T_BA, "ig-portrait", "beforeAfter"),
    preview: {
      imageUrl:  IMG_TILER,
      headline:  "BEFORE · AFTER",
      subline:   "SEE THE TRANSFORMATION",
      textColor: "#FFFFFF",
      scrim:     "full"
    }
  },
  {
    id:            "showcase-verified-trade",
    slug:          "showcase-verified-trade",
    label:         "Verified trade",
    category:      "announcement",
    frame_slug:    "ig-feed",
    imageUrl:      IMG_WINDOW,
    content:       T_VERIF,
    thumbnail_url: IMG_WINDOW,
    state:         starterState(IMG_WINDOW, T_VERIF, "ig-feed"),
    preview: {
      imageUrl:  IMG_WINDOW,
      headline:  "VERIFIED TRADE",
      subline:   "ID + INSURANCE CHECKED",
      textColor: YELLOW,
      scrim:     "bottom"
    }
  },

  // Crown banners now live in the DB — see the migration
  // `20260722360000_site_editor_crown_banners.sql`. The drawer
  // picks them up from `/api/site/editor/templates` and the pick
  // handler already branches on tpl.isCrown for the burnt-in
  // + phone-slot flow. Deleted the previous inline showcase entry
  // (`crown-staircase-step-above`) so it doesn't duplicate.
];

// Named export so other callers can add showcase-authored images
// without another library lookup.
export const SHOWCASE_IMAGE_URLS = {
  bricklayer: IMG_BRICKLAYER,
  plumber:    IMG_PLUMBER,
  stair:      IMG_STAIR,
  plaster:    IMG_PLASTER,
  gate:       IMG_GATE,
  tiler:      IMG_TILER,
  window:     IMG_WINDOW,
  pool:       IMG_POOL
};
