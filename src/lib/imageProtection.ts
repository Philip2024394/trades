// Serving-time watermark helpers.
//
// ImageKit supports on-the-fly text overlays via URL transform
// params (`?tr=…`). We use this to watermark hero-library imagery
// at delivery time — the source PNG on ImageKit stays clean, but
// every public fetch goes through a watermarked variant. Cheaper
// than baking a watermark into each master + traceable per-user
// when we pass a merchant slug.
//
// Docs: https://imagekit.io/docs/text-overlay

/** Compose an ImageKit URL with a watermark overlay. Adds a tiled
 *  diagonal "thenetworkers.app" mark at ~14% opacity across the
 *  image. Non-ImageKit URLs are returned unchanged (no-op) so this
 *  is safe to wrap around any URL. */
export function watermarkImageKitUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (!url.includes("imagekit.io")) return url;

  // Existing ImageKit transforms live in `?tr=…`. Append ours,
  // chained with a colon so both apply. If the URL already has our
  // brand tag, don't double-stamp.
  if (url.includes("brand-mark")) return url;

  // Layered watermark:
  //   1. Tiled diagonal text at 14% opacity + 30° rotation
  //   2. Bottom-right corner brand chip at 40% opacity
  const overlay =
    "l-text,i-thenetworkers.app,fs-32,co-FFFFFF,ia-center,rt-330,bg-black_20,l-end:" +
    "l-text,i-thenetworkers.app,fs-28,co-FFFFFF,pa-16,lx-N20,ly-N20,ia-bottom_right,bg-black_50,l-end";
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}tr=${overlay}#brand-mark`;
}

/** Compose an ImageKit URL with a merchant-specific watermark so a
 *  leaked download can be traced to the account that pulled it.
 *  Adds a tiny slug watermark at 8% opacity in the bottom-left. */
export function traceableImageKitUrl(url: string, merchantSlug: string): string {
  if (!url) return "";
  if (!url.includes("imagekit.io")) return url;
  if (url.includes("trace-")) return url;

  const safe = merchantSlug.replace(/[^a-z0-9-]/gi, "").slice(0, 40);
  if (!safe) return watermarkImageKitUrl(url);

  const overlay =
    `l-text,i-thenetworkers.app%2F${safe},fs-16,co-FFFFFF,pa-12,lx-16,ly-N16,bg-black_35,l-end`;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}tr=${overlay}#trace-${safe}`;
}

/** Detect if a URL is safely watermark-protected (either has a
 *  serving-time transform or is a burnt-in crown banner). Callers
 *  can use this to decide whether to gate a raw-source download. */
export function isProtectedUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  // Baked-in watermark (crown banners live under /crown-banners/)
  if (url.startsWith("/crown-banners/") || url.includes("/crown-banners/")) return true;
  // Serving-time transformed
  if (url.includes("brand-mark") || url.includes("trace-")) return true;
  return false;
}
