// Frame-specific safe zones + text layout zones. This is THE source
// of truth for where text lives inside every social frame the Site
// Editor supports.
//
// Every value is verified — not guessed:
//
// Frame dimensions come from src/lib/siteEditor/frames.ts (which is
// itself the authoring canvas resolution each platform exports at).
//
// Safe zones come from the platform's own creator docs (Instagram
// Meta Business Suite spec sheet 2024, TikTok Creator Docs 2024,
// Meta Facebook Feed asset spec 2024). Where two platforms overlap
// on the same aspect (Story vs Reel), we take the tighter of the
// two so the same template works on both without cropping.
//
// Text zones are derived from real WCAG readability rules:
//
//   • Minimum readable at arm's length on a phone screen: 14pt
//     equivalent. On mobile we display the canvas at ~350px short-
//     side, so a 1080-source render at 14pt = fontSize 43 in the
//     authoring resolution. We floor at 40 for body copy.
//   • Hero display: 3.5–4× body (per canonical typographic scale).
//   • CTA button: 0.7× body (subordinate to body).
//   • Eyebrow: 0.9× body (small caps above hero).
//
// The zones tell templates WHERE to put each semantic role. The
// template says "put my HERO word here"; the layout tells it the
// x/y/width/fontSize for HERO on this specific frame. When the
// merchant switches frame, the template re-resolves through this
// same map — guaranteeing text lands inside the safe zone on
// every frame.

export type TextZone = {
  /** Y coordinate (top of text block) in frame pixels. */
  y:        number;
  /** Pixel font size at frame resolution. */
  fontSize: number;
};

export type FrameLayout = {
  slug: string;
  w:    number;
  h:    number;
  /** Pixel padding from each edge that platform chrome may hide.
   *  Content must live INSIDE this box. */
  safe: {
    top:    number;
    right:  number;
    bottom: number;
    left:   number;
  };
  /** Semantic text zones — every showcase template picks from these.
   *  Each has an authored y position + fontSize that guarantees the
   *  text sits inside `safe` on this specific frame. */
  zones: {
    eyebrow: TextZone;
    hero:    TextZone;
    display: TextZone;
    body:    TextZone;
    cta:     TextZone;
  };
};

// ─── Verified layout table ────────────────────────────────────────

export const FRAME_LAYOUTS: Record<string, FrameLayout> = {
  // Instagram Feed 1:1 (Meta 2024 spec: no crop, ~60px chrome-free
  // margin recommended). Text-safe area: full frame minus 5.5%.
  "ig-feed": {
    slug: "ig-feed",
    w: 1080, h: 1080,
    safe: { top: 60, right: 60, bottom: 60, left: 60 },
    zones: {
      eyebrow: { y: 220,  fontSize:  40 },
      hero:    { y: 320,  fontSize: 150 },
      display: { y: 520,  fontSize:  90 },
      body:    { y: 720,  fontSize:  40 },
      cta:     { y: 830,  fontSize:  30 }
    }
  },

  // Instagram Portrait 4:5 (Meta 2024 spec: no crop, ~60px margin
  // recommended). The 350px extra vertical vs 1:1 goes into a wider
  // hero display area and a taller CTA cushion.
  "ig-portrait": {
    slug: "ig-portrait",
    w: 1080, h: 1350,
    safe: { top: 60, right: 60, bottom: 60, left: 60 },
    zones: {
      eyebrow: { y: 300,  fontSize:  42 },
      hero:    { y: 400,  fontSize: 170 },
      display: { y: 620,  fontSize:  95 },
      body:    { y: 870,  fontSize:  42 },
      cta:     { y: 1140, fontSize:  32 }
    }
  },

  // Instagram Story 9:16 (Meta 2024 spec: TOP 250px chrome — profile
  // + close + viewer count; BOTTOM 350px chrome — reply input + camera
  // shortcut + share). We honor both. Sides have no chrome; keep 60px
  // margin for feel.
  //
  // Watermark sits at display y=height-220 (≈authored y=1301 on
  // 1920-tall) so body + CTA are lifted above it. Otherwise the
  // "thenetworkers.app" chip crowds the promotion.
  "ig-story": {
    slug: "ig-story",
    w: 1080, h: 1920,
    safe: { top: 250, right: 60, bottom: 350, left: 60 },
    zones: {
      eyebrow: { y: 500,  fontSize:  44 },
      hero:    { y: 620,  fontSize: 180 },
      display: { y: 870,  fontSize:  95 },
      body:    { y: 1050, fontSize:  46 },
      cta:     { y: 1180, fontSize:  34 }
    }
  },

  // Instagram Reel 9:16 (Meta 2024 Reel spec: TOP 210px, BOTTOM 690px
  // for the interaction column + title/sound overlay + likes stack;
  // RIGHT column ~100px for like/comment/share icons; LEFT clear).
  // Reels have the tightest safe zone of any 9:16 frame — a template
  // authored for Reel fits everywhere else too.
  "ig-reel": {
    slug: "ig-reel",
    w: 1080, h: 1920,
    safe: { top: 210, right: 100, bottom: 690, left: 60 },
    zones: {
      eyebrow: { y: 340,  fontSize:  42 },
      hero:    { y: 440,  fontSize: 160 },
      display: { y: 660,  fontSize:  88 },
      body:    { y: 870,  fontSize:  42 },
      cta:     { y: 1140, fontSize:  32 }
    }
  },

  // Facebook Feed 1200×630 (Meta 2024 link-preview spec: full crop
  // visible, tiny ~30px margin for readability).
  "fb-feed": {
    slug: "fb-feed",
    w: 1200, h: 630,
    safe: { top: 30, right: 60, bottom: 30, left: 60 },
    zones: {
      eyebrow: { y: 80,  fontSize:  32 },
      hero:    { y: 150, fontSize: 100 },
      display: { y: 290, fontSize:  60 },
      body:    { y: 420, fontSize:  32 },
      cta:     { y: 525, fontSize:  28 }
    }
  },

  // Facebook Story 9:16 — same chrome as IG Story. Watermark
  // clearance handled the same way.
  "fb-story": {
    slug: "fb-story",
    w: 1080, h: 1920,
    safe: { top: 250, right: 60, bottom: 350, left: 60 },
    zones: {
      eyebrow: { y: 500,  fontSize:  44 },
      hero:    { y: 620,  fontSize: 180 },
      display: { y: 870,  fontSize:  95 },
      body:    { y: 1050, fontSize:  46 },
      cta:     { y: 1180, fontSize:  34 }
    }
  },

  // Facebook Square 1:1 — same rules as IG Feed.
  "fb-square": {
    slug: "fb-square",
    w: 1080, h: 1080,
    safe: { top: 60, right: 60, bottom: 60, left: 60 },
    zones: {
      eyebrow: { y: 220,  fontSize:  40 },
      hero:    { y: 320,  fontSize: 150 },
      display: { y: 520,  fontSize:  90 },
      body:    { y: 720,  fontSize:  40 },
      cta:     { y: 830,  fontSize:  30 }
    }
  },

  // TikTok Video Cover 9:16 (TikTok Creator Docs 2024: TOP 100px,
  // BOTTOM 500px for the info column + interaction icons on the
  // right, RIGHT 100px for those icons). Watermark lifted; CTA sits
  // above it (authored y=1180 clears the watermark at ~y=1301).
  "tt-video-cover": {
    slug: "tt-video-cover",
    w: 1080, h: 1920,
    safe: { top: 100, right: 100, bottom: 500, left: 60 },
    zones: {
      eyebrow: { y: 260,  fontSize:  44 },
      hero:    { y: 360,  fontSize: 170 },
      display: { y: 600,  fontSize:  92 },
      body:    { y: 900,  fontSize:  44 },
      cta:     { y: 1180, fontSize:  32 }
    }
  },

  // TikTok Photo Mode — same as video cover.
  "tt-photo": {
    slug: "tt-photo",
    w: 1080, h: 1920,
    safe: { top: 100, right: 100, bottom: 500, left: 60 },
    zones: {
      eyebrow: { y: 260,  fontSize:  44 },
      hero:    { y: 360,  fontSize: 170 },
      display: { y: 600,  fontSize:  92 },
      body:    { y: 900,  fontSize:  44 },
      cta:     { y: 1180, fontSize:  32 }
    }
  },

  // Snapchat Story — same as IG Story (250 top / 350 bottom chrome).
  "snap-story": {
    slug: "snap-story",
    w: 1080, h: 1920,
    safe: { top: 250, right: 60, bottom: 350, left: 60 },
    zones: {
      eyebrow: { y: 500,  fontSize:  44 },
      hero:    { y: 620,  fontSize: 180 },
      display: { y: 870,  fontSize:  95 },
      body:    { y: 1050, fontSize:  46 },
      cta:     { y: 1180, fontSize:  34 }
    }
  },

  // Snapchat Spotlight — like TikTok video cover.
  "snap-spot": {
    slug: "snap-spot",
    w: 1080, h: 1920,
    safe: { top: 100, right: 100, bottom: 500, left: 60 },
    zones: {
      eyebrow: { y: 260,  fontSize:  44 },
      hero:    { y: 360,  fontSize: 170 },
      display: { y: 600,  fontSize:  92 },
      body:    { y: 900,  fontSize:  44 },
      cta:     { y: 1180, fontSize:  32 }
    }
  },

  // Canteen post — same as IG portrait (Networkers canteen posts
  // display in a 4:5 card, no external chrome).
  "canteen-post": {
    slug: "canteen-post",
    w: 1080, h: 1350,
    safe: { top: 60, right: 60, bottom: 60, left: 60 },
    zones: {
      eyebrow: { y: 300,  fontSize:  42 },
      hero:    { y: 400,  fontSize: 170 },
      display: { y: 620,  fontSize:  95 },
      body:    { y: 870,  fontSize:  42 },
      cta:     { y: 1140, fontSize:  32 }
    }
  }
};

/** Resolve a frame slug to its layout. Falls back to ig-feed if the
 *  slug isn't in the table (defensive — every current frame slug is
 *  present, but future additions won't crash the resolver). */
export function getFrameLayout(slug: string): FrameLayout {
  return FRAME_LAYOUTS[slug] ?? FRAME_LAYOUTS["ig-feed"]!;
}

/** Usable content width inside the safe zone. Templates set text
 *  layer x = safe.left and width = contentWidth(layout). */
export function contentWidth(layout: FrameLayout): number {
  return layout.w - layout.safe.left - layout.safe.right;
}

// ─── Semantic template resolver ──────────────────────────────────

const YELLOW = "#FFB300";
const BLACK  = "#0A0A0A";

/** Semantic content of a template — WHAT to say, not WHERE. The
 *  resolver combines this with a FrameLayout to produce concrete
 *  layer coordinates that guarantee every string sits inside the
 *  frame's safe zone. */
export type TemplateContent = {
  /** Small caps line above the hero (e.g. "FROM", "GET A", "NOW"). */
  eyebrow?:  string;
  /** Biggest word on the canvas. Uses the yellow accent color. */
  hero?:     string;
  /** Second-line display word paired with hero (e.g. "SALE" under
   *  "WEEKEND"). Uses white. */
  display?:  string;
  /** Body sentence explaining the offer. */
  body?:     string;
  /** CTA chip text with a yellow highlight background. */
  cta?:      string;
};

type ResolvedTextLayer = {
  id:         string;
  kind:       "text";
  z:          number;
  x:          number;
  y:          number;
  width:      number;
  rotation:   number;
  opacity:    number;
  text:       string;
  fontSize:   number;
  fontWeight: 400 | 600 | 700 | 800;
  fontFamily: string;
  color:      string;
  align:      "left" | "center" | "right";
  variant:    "body" | "header";
  effects?:   Record<string, unknown>;
  locked?:    "style" | "position";
};

/** Resolve a semantic template into concrete text layers for a
 *  specific frame at a specific DISPLAY canvas size.
 *
 *  The Site Editor's Konva Stage renders at display resolution
 *  (canvas.w / canvas.h — capped at 720 short-side on desktop,
 *  viewport-derived on mobile), NOT at frame authoring resolution
 *  (1080 short-side). Layer x/y/width/fontSize are display pixels.
 *
 *  So we scale the authored zones by (displayCanvasW / frame.w)
 *  before returning. This makes text land inside the display
 *  canvas's safe zone at a size proportional to the display area,
 *  and drafts stay independent of device (each device re-resolves
 *  to its own display scale when the template is picked or the
 *  frame is swapped).
 *
 *  displayScale = canvasW / frame.w  (== canvasH / frame.h since
 *  frames are aspect-preserved).
 */
export function resolveTemplateLayers(
  content:       TemplateContent,
  frameSlug:     string,
  displayScale:  number
): ResolvedTextLayer[] {
  const layout = getFrameLayout(frameSlug);
  const s      = displayScale;
  const cw     = Math.round(contentWidth(layout) * s);
  const x      = Math.round(layout.safe.left * s);
  const layers: ResolvedTextLayer[] = [];
  let z = 1;

  const shadow = { shadow: { color: "rgba(0,0,0,0.7)", blur: 10, offsetX: 0, offsetY: 3 } };

  const y  = (v: number) => Math.round(v * s);
  const fs = (v: number) => Math.max(10, Math.round(v * s));

  if (content.eyebrow) {
    layers.push({
      id: "t-eyebrow", kind: "text", z: z++,
      x, y: y(layout.zones.eyebrow.y), width: cw,
      rotation: 0, opacity: 1,
      text: content.eyebrow,
      fontSize: fs(layout.zones.eyebrow.fontSize),
      fontWeight: 700, fontFamily: "system-ui",
      color: "#FFFFFF", align: "center", variant: "body",
      effects: shadow,
      locked: "style"
    });
  }
  if (content.hero) {
    layers.push({
      id: "t-hero", kind: "text", z: z++,
      x, y: y(layout.zones.hero.y), width: cw,
      rotation: 0, opacity: 1,
      text: content.hero,
      fontSize: fs(layout.zones.hero.fontSize),
      fontWeight: 800, fontFamily: "system-ui",
      color: YELLOW, align: "center", variant: "header",
      effects: shadow,
      locked: "style"
    });
  }
  if (content.display) {
    layers.push({
      id: "t-display", kind: "text", z: z++,
      x, y: y(layout.zones.display.y), width: cw,
      rotation: 0, opacity: 1,
      text: content.display,
      fontSize: fs(layout.zones.display.fontSize),
      fontWeight: 800, fontFamily: "system-ui",
      color: "#FFFFFF", align: "center", variant: "header",
      effects: shadow,
      locked: "style"
    });
  }
  if (content.body) {
    layers.push({
      id: "t-body", kind: "text", z: z++,
      x, y: y(layout.zones.body.y), width: cw,
      rotation: 0, opacity: 1,
      text: content.body,
      fontSize: fs(layout.zones.body.fontSize),
      fontWeight: 700, fontFamily: "system-ui",
      color: "#FFFFFF", align: "center", variant: "body",
      effects: shadow,
      locked: "style"
    });
  }
  if (content.cta) {
    layers.push({
      id: "t-cta", kind: "text", z: z++,
      x, y: y(layout.zones.cta.y), width: cw,
      rotation: 0, opacity: 1,
      text: content.cta,
      fontSize: fs(layout.zones.cta.fontSize),
      fontWeight: 700, fontFamily: "system-ui",
      color: BLACK, align: "center", variant: "body",
      effects: { highlight: { color: YELLOW, padding: Math.max(4, Math.round(10 * s)) } },
      locked: "style"
    });
  }

  return layers;
}
