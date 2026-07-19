// storeImageVariants — shared preset definitions for download +
// display use across the store surfaces.
//
// Presets combine an ASPECT RATIO (via ImageKit smart-crop) with a
// RESOLUTION + FORMAT + quality. One button per use-case, so
// merchants don't have to pick "which size for Instagram" — the
// preset names it directly.
//
// ImageKit transform reference:
//   cm-extract  — smart crop to fill target aspect
//   fo-auto     — auto focus point (subject-aware)
//   w-N / h-N   — output width / height in px
//   q-N         — JPG quality (1-100)
//   f-jpg       — force JPG output (default is PNG passthrough)

export type VariantSlug = "instagram" | "website" | "mobile" | "full";

export type StoreImageVariant = {
  slug:     VariantSlug;
  label:    string;
  sub:      string;
  ratio:    string;   // human-readable ("1:1", "16:9", etc.)
  ext:      "jpg" | "png";
};

export const STORE_VARIANTS: StoreImageVariant[] = [
  { slug: "instagram", label: "Instagram post", sub: "1080 × 1080 · JPG",   ratio: "1:1",  ext: "jpg" },
  { slug: "website",   label: "Website hero",   sub: "1920 × 1080 · JPG",   ratio: "16:9", ext: "jpg" },
  { slug: "mobile",    label: "Mobile screen",  sub: "1080 × 1920 · JPG",   ratio: "9:16", ext: "jpg" },
  { slug: "full",      label: "Full original",  sub: "native · PNG",         ratio: "native", ext: "png" }
];

const VALID = new Set<VariantSlug>(["instagram", "website", "mobile", "full"]);

/** Coerce a raw query-param value to a valid variant slug.
 *  Back-compat: accepts the legacy `size=web|print|full` names
 *  (web→website, print→website, full→full). */
export function normaliseVariant(raw: string | null | undefined): VariantSlug {
  const v = (raw ?? "").toLowerCase().trim();
  if (VALID.has(v as VariantSlug)) return v as VariantSlug;
  // Legacy
  if (v === "web")   return "website";
  if (v === "print") return "website";
  return "full";
}

/** Apply the correct ImageKit transform for a variant to a source URL. */
export function urlForVariant(sourceUrl: string, slug: VariantSlug): string {
  if (slug === "full") return sourceUrl;
  // fo-face_auto = face detection FIRST, subject-aware auto as fallback.
  // Delivers the active focus of the image (worker, tool, feature) inside
  // every crop instead of a naive centre-crop. Philip 2026-07-17.
  const params = (() => {
    switch (slug) {
      case "instagram": return "w-1080,h-1080,cm-extract,fo-face_auto,q-90,f-jpg";
      case "website":   return "w-1920,h-1080,cm-extract,fo-face_auto,q-85,f-jpg";
      case "mobile":    return "w-1080,q-85,f-jpg"; // native 9:16 — no crop needed
      default:          return "q-90,f-jpg";
    }
  })();
  try {
    const u = new URL(sourceUrl);
    u.searchParams.set("tr", params);
    return u.toString();
  } catch {
    return sourceUrl;
  }
}

/** Suggested filename for a downloaded variant. */
export function filenameForVariant(imageId: string, slug: VariantSlug): string {
  const clean = imageId.replace(/[^a-z0-9-]/gi, "-");
  const ext = slug === "full" ? "png" : "jpg";
  return `site-interest-${clean}-${slug}.${ext}`;
}

/** PREVIEW URL — capped at 720px longest edge, q-70 JPG. Screenshots
 *  of previews therefore return soft, low-res content that has no
 *  commercial value next to the paid 1080/1920 download. Anti-theft
 *  Layer 2 (Philip 2026-07-17). Never use for paid delivery. */
export function urlForPreview(sourceUrl: string, slug: VariantSlug): string {
  const params = (() => {
    switch (slug) {
      case "instagram": return "w-720,h-720,cm-extract,fo-face_auto,q-70,f-jpg";
      case "website":   return "w-720,h-405,cm-extract,fo-face_auto,q-70,f-jpg";
      case "mobile":    return "w-405,h-720,cm-extract,fo-face_auto,q-70,f-jpg";
      default:          return "w-720,q-70,f-jpg"; // full → 720px longest edge
    }
  })();
  try {
    const u = new URL(sourceUrl);
    u.searchParams.set("tr", params);
    return u.toString();
  } catch {
    return sourceUrl;
  }
}
