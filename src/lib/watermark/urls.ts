// Watermark URL helper — the single function every user-facing render
// site uses to load a library image.
//
// Passing library imageIds through this helper routes them through
// /api/image/serve where the watermark pipeline runs. Public visitors
// see the preview tier (corner URL + center chip); licensed merchants
// automatically get standard / clean by including their merchantId
// in the URL (?m=) — since browsers can't attach custom headers to
// <img> tags, the query string is how the serve endpoint knows who
// the caller is.

export type WatermarkedUrlOptions = {
  /** Return the untouched source URL. Admin dashboards + local dev
   *  without Supabase creds should pass this. */
  raw?: boolean;
  /** Raw source URL — used when raw is true, and passed as a fallback
   *  the client can point to if the serve endpoint fails. */
  fallback?: string;
  /** Signed-in merchant id. Threaded into ?m= so the serve endpoint
   *  can look up the merchant's active licences and skip the visible
   *  watermark for licensed images. */
  merchantId?: string | null;
  /** External buyer email — used by the licence download flow to
   *  identify the caller. Same purpose as merchantId, different
   *  identity type. */
  email?: string | null;
};

/** Return the URL to load an image through the watermark pipeline.
 *  Always returns a same-origin URL so the browser + Next Image
 *  component can cache + optimise it. */
export function watermarkedUrl(
  imageId: string,
  options: WatermarkedUrlOptions = {}
): string {
  if (options.raw && options.fallback) return options.fallback;
  const params = new URLSearchParams();
  if (options.merchantId) params.set("m", options.merchantId);
  if (options.email) params.set("email", options.email);
  const qs = params.toString();
  return `/api/image/serve/${encodeURIComponent(imageId)}${qs ? `?${qs}` : ""}`;
}
