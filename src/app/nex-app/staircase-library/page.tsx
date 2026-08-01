// /nex-app/staircase-library — full-screen swipe gallery destination.
//
// Philip 2026-08-02 · destination for the "Staircase Library" tile on the
// Nex landing (/nex-app/brains/staircase?state=discover). Immersive
// one-image-at-a-time viewer · swipe left/right (touch + mouse drag) ·
// floating orange Nex button opens a chat that understands the current
// staircase.
//
// VIEWPORT-FIT FILTER (Philip 2026-08-02 · TIGHTENED):
//   Only surface images that FILL the app screen (mobile portrait) WITHOUT
//   cropping. Rules:
//     · Min longer edge ≥ 1200 px (safe for common mobile + desktop)
//     · Aspect ratio (w/h) between 0.45 and 0.70 · matches app-screen
//       portrait (9:16 through 3:5) so the image fills BOTH dimensions
//       with no cropping and no side/top bars on typical phone screens
//   Wider landscape · square · extreme-portrait images are EXCLUDED so
//   the library never crops and never letterboxes on mobile.
//   Any future staircase image uploaded at app-screen aspect passes
//   automatically after re-running scripts/measure-confirmed-images.mjs.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { StaircaseLibraryShell } from "@/components/nex-app/library/StaircaseLibraryShell";
import { listConfirmedImages, CUSTOMER_DEFAULT_FAMILIES } from "@/lib/nex/images/confirmed-library";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staircase Library · Nex", robots: { index: false } };

const DIMENSIONS_PATH = "data/nex-confirmed-image-dimensions.json";
const MIN_LONG_EDGE = 1200;       // safe for common mobile + desktop displays
const MIN_ASPECT    = 0.45;       // Philip 2026-08-02 · portrait floor · 9:16-ish
const MAX_ASPECT    = 0.70;       // Philip 2026-08-02 · portrait ceiling · 3:5-ish
// Rationale · a mobile app screen is portrait (~9:16 = 0.5625). Images at
// this aspect ratio fill both dimensions of the phone with no cropping.
// Wider landscape / square / very-tall portrait images either crop or
// letterbox on the app screen · both violate "show original image."

type Dim = { ok: true; width: number; height: number; format?: string } | { ok: false; error: string };
type Cache = { dimensions?: Record<string, Dim> };

function loadDimensions(): Record<string, Dim> {
  const p = join(process.cwd(), DIMENSIONS_PATH);
  if (!existsSync(p)) return {};
  try {
    const raw = readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as Cache;
    return parsed.dimensions ?? {};
  } catch { return {}; }
}

function fitsViewport(dim: Dim | undefined): boolean {
  if (!dim || dim.ok !== true) return false;
  const long  = Math.max(dim.width, dim.height);
  const ratio = dim.width / dim.height;
  return long >= MIN_LONG_EDGE && ratio >= MIN_ASPECT && ratio <= MAX_ASPECT;
}

export default function StaircaseLibraryPage() {
  const allowed = new Set<string>(CUSTOMER_DEFAULT_FAMILIES);
  const dims = loadDimensions();

  const designs = listConfirmedImages()
    .filter((img) => !img.design_family || allowed.has(img.design_family))
    // Viewport-fit filter · primary URL must satisfy dimension + aspect rules.
    .filter((img) => fitsViewport(dims[img.url]))
    .map((img) => {
      const d = dims[img.url] as Extract<Dim, { ok: true }>;   // safe · filter above enforces .ok
      return {
        design_id:            img.design_id ?? img.image_id ?? img.url.split("/").pop() ?? "unknown",
        title:                img.title ?? img.staircase_type,
        url:                  img.url,
        additional_views:     (img.additional_views ?? []).filter((u) => fitsViewport(dims[u])),
        staircase_type:       img.staircase_type,
        design_style:         img.design_style,
        design_family:        img.design_family,
        materials:            img.materials,
        customer_description: img.customer_description,
        image_state:          img.image_state ?? "concept",
        width:                d.width,
        height:               d.height,
      };
    });

  return <StaircaseLibraryShell designs={designs} />;
}
