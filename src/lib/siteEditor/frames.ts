// Editor frames — the canonical set of social-post aspect ratios the
// Site Editor supports at v1. Each frame carries:
//   • slug         — stable id (Konva key, DB persistence)
//   • label        — user-facing chip text
//   • network      — parent network for icon grouping
//   • aspectW/H    — export ratio (Konva stage sizing multiplies)
//   • pixel size   — the "Best size" hint above the canvas
//   • bestFor      — one-line hint under the label
//
// Editable in one place so adding a new frame (Pinterest, Threads,
// LinkedIn) is a single-entry addition — canvas + picker + export
// all read from here.

export type NetworkSlug = "instagram" | "facebook" | "tiktok" | "snapchat" | "networkers";

export type EditorFrame = {
  slug:      string;
  label:     string;
  network:   NetworkSlug;
  aspectW:   number;
  aspectH:   number;
  pixelW:    number;
  pixelH:    number;
  bestFor:   string;
  /** True when this frame accepts a multi-slide carousel (Instagram
   *  feed + portrait — up to 10 slides). Stories/Reels/Canteen are
   *  single-slide only, so the SlideNavigator stays hidden there. */
  supportsCarousel?: boolean;
};

export const EDITOR_FRAMES: EditorFrame[] = [
  // Instagram
  { slug: "ig-feed",   label: "Feed",   network: "instagram", aspectW:  1, aspectH:  1, pixelW: 1080, pixelH: 1080, bestFor: "Square feed post",     supportsCarousel: true },
  { slug: "ig-story",  label: "Story",  network: "instagram", aspectW:  9, aspectH: 16, pixelW: 1080, pixelH: 1920, bestFor: "Full-screen story"      },
  { slug: "ig-reel",   label: "Reel",   network: "instagram", aspectW:  9, aspectH: 16, pixelW: 1080, pixelH: 1920, bestFor: "Reel cover"             },
  { slug: "ig-portrait",label: "Portrait", network: "instagram", aspectW: 4, aspectH: 5, pixelW: 1080, pixelH: 1350, bestFor: "Portrait feed post",  supportsCarousel: true },

  // Facebook
  { slug: "fb-feed",   label: "Feed",   network: "facebook",  aspectW: 1200, aspectH: 630, pixelW: 1200, pixelH: 630, bestFor: "Link-preview feed post" },
  { slug: "fb-story",  label: "Story",  network: "facebook",  aspectW:    9, aspectH:  16, pixelW: 1080, pixelH: 1920, bestFor: "Full-screen story"     },
  { slug: "fb-square", label: "Square", network: "facebook",  aspectW:    1, aspectH:   1, pixelW: 1080, pixelH: 1080, bestFor: "Square feed post"      },

  // TikTok
  { slug: "tt-video-cover", label: "Video cover", network: "tiktok", aspectW: 9, aspectH: 16, pixelW: 1080, pixelH: 1920, bestFor: "Vertical video cover" },
  { slug: "tt-photo",       label: "Photo",       network: "tiktok", aspectW: 9, aspectH: 16, pixelW: 1080, pixelH: 1920, bestFor: "Photo mode post"      },

  // Snapchat
  { slug: "snap-story", label: "Story", network: "snapchat", aspectW: 9, aspectH: 16, pixelW: 1080, pixelH: 1920, bestFor: "Snap story"        },
  { slug: "snap-spot",  label: "Spotlight", network: "snapchat", aspectW: 9, aspectH: 16, pixelW: 1080, pixelH: 1920, bestFor: "Spotlight video cover" },

  // Thenetworkers — Canteen (4:5 portrait, matches canteen post card).
  // The Yard doesn't get its own frame because Yard = aggregated
  // canteen posts — one canteen post shows on both surfaces.
  { slug: "canteen-post", label: "Canteen", network: "networkers", aspectW: 4, aspectH: 5, pixelW: 1080, pixelH: 1350, bestFor: "Canteen post card (auto-shows on Yard too)" }
];

export const NETWORK_META: Record<NetworkSlug, { label: string; color: string }> = {
  instagram:  { label: "Instagram",   color: "#E4405F" },
  facebook:   { label: "Facebook",    color: "#1877F2" },
  tiktok:     { label: "TikTok",      color: "#010101" },
  snapchat:   { label: "Snapchat",    color: "#FFFC00" },
  networkers: { label: "Networkers",  color: "#FFB300" }
};

/** Brand-mark icons served from Supabase Storage. Rendered as
 *  <img> in FramePicker and the image-library fit-pips so the
 *  network is instantly recognisable. `networkers` stays lucide
 *  (HardHat) since it's our own mark. */
const ICON_CDN = "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/social-media/network-icons";
export const NETWORK_ICON_URL: Partial<Record<NetworkSlug, string>> = {
  instagram: `${ICON_CDN}/instagram.png`,
  facebook:  `${ICON_CDN}/facebook.png`,
  tiktok:    `${ICON_CDN}/tiktok.png`,
  snapchat:  `${ICON_CDN}/snapchat.png`
};

/** Placeholder background rendered inside the canvas frame BEFORE
 *  the user picks or uploads a base image. Construction worker
 *  scene that keeps the empty state on-brand. */
export const EMPTY_FRAME_BG_URL = "https://msdonkkechxzgagyguoe.supabase.co/storage/v1/object/public/social-media/editor-ui/empty-frame.png";

/** Best-fit frame given an image's natural aspect ratio (w/h). Used
 *  when the library picks an image so the canvas frame auto-adjusts.
 *  Runs the same tolerance check as fitsFrame below. */
export function bestFitFrame(naturalAspect: number): EditorFrame {
  if (!Number.isFinite(naturalAspect) || naturalAspect <= 0) return EDITOR_FRAMES[0];
  let best = EDITOR_FRAMES[0];
  let bestDelta = Infinity;
  for (const f of EDITOR_FRAMES) {
    const frameAspect = f.aspectW / f.aspectH;
    const delta = Math.abs(Math.log(naturalAspect / frameAspect));
    if (delta < bestDelta) { bestDelta = delta; best = f; }
  }
  return best;
}

/** True when an image with the given natural aspect ratio fits the
 *  frame cleanly (with the given tolerance in log-ratio space).
 *  Default tolerance ~0.15 = ±16% aspect difference which is what
 *  Instagram / Facebook accept without letterboxing. */
export function fitsFrame(naturalAspect: number, frame: EditorFrame, tolerance = 0.30): boolean {
  if (!Number.isFinite(naturalAspect) || naturalAspect <= 0) return false;
  const frameAspect = frame.aspectW / frame.aspectH;
  return Math.abs(Math.log(naturalAspect / frameAspect)) <= tolerance;
}

/** For an image aspect, return every frame slug it fits. Used to
 *  precompute `fits_frames[]` on the image row so the gallery can
 *  filter+ tag cheaply. Empty array = image doesn't cleanly fit
 *  ANY frame and should be excluded from the library. */
export function computeFitsFrames(naturalAspect: number, tolerance = 0.30): string[] {
  return EDITOR_FRAMES.filter((f) => fitsFrame(naturalAspect, f, tolerance)).map((f) => f.slug);
}

export function findFrame(slug: string): EditorFrame | null {
  return EDITOR_FRAMES.find((f) => f.slug === slug) ?? null;
}

export function framesByNetwork(network: NetworkSlug): EditorFrame[] {
  return EDITOR_FRAMES.filter((f) => f.network === network);
}
