// ImageKit-served images can carry an on-the-fly text overlay via
// URL transforms — no server processing needed. This helper wraps
// that so every Site Interest image renders with a small
// `thenetworkers.app` watermark bottom-right.
//
// Only applied when the source URL is on ImageKit; other CDNs
// (Cloudinary, S3 direct) fall through unchanged. Real image
// downloads still contain the watermark since ImageKit rasterises
// the overlay before serving the bytes.

const WATERMARK_TEXT = "thenetworkers.app";

/** Append an ImageKit text-overlay transform to the URL. Idempotent
 *  — if the URL already has a `tr=` param with our overlay, we
 *  don't stack another. */
export function watermarkImageUrl(url: string): string {
  if (!url) return url;
  // Only ImageKit CDN supports the URL-transform overlay syntax we
  // use. Other hosts get the raw URL back.
  if (!/ik\.imagekit\.io\//.test(url)) return url;
  // If the URL already contains our overlay, don't double-add.
  if (url.includes("l-text,i-thenetworkers.app")) return url;

  // ImageKit overlay layer syntax:
  //   l-text,i-<TEXT>,fs-<size>,ff-<font>,co-<hex>,ly-<y-offset>,
  //   lx-<x-offset>,l-end
  //
  // Positioning:
  //   ly-N30 — 30px from the bottom edge (N prefix flips origin)
  //   lx-N30 — 30px from the right edge
  //
  // Style:
  //   fs-20 — 20px font
  //   co-FFFFFF — white text
  //   ff-Arial — safe fallback family (ImageKit's Arial default
  //     renders on every device)
  //
  // NOTE (2026-07-16): the previous version used a semi-opaque
  // background pill (`bg-000000_60`) but ImageKit rejects that alpha
  // syntax on this account and returns 400 → images stopped rendering
  // on Site Interest. Simplified to white text at 20px which stays
  // legible on almost any photo, no background pill required. If
  // dark-image legibility becomes a problem, revisit with a solid
  // `bg-000000` (no alpha) or move the watermark to a corner tile
  // overlay on the CLIENT side (CSS ::after) instead.
  const overlay =
    "l-text,i-thenetworkers.app,fs-20,ff-Arial,co-FFFFFF,ly-N30,lx-N30,l-end";

  // Two URL shapes to handle:
  //   1. …/image.jpg (no query)   → append ?tr=<overlay>
  //   2. …/image.jpg?updatedAt=…   → merge as ?tr=<overlay>&updatedAt=…
  //   3. …/image.jpg?tr=w-800     → prepend our overlay layer to the
  //                                  existing tr= chain (comma-joined)
  try {
    const u = new URL(url);
    const existing = u.searchParams.get("tr");
    if (existing) {
      u.searchParams.set("tr", `${existing},${overlay}`);
    } else {
      u.searchParams.set("tr", overlay);
    }
    return u.toString();
  } catch {
    return url;
  }
}
