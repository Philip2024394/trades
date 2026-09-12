// useChromaKeyedBezel · turns a JPEG bezel (opaque · with baked white
// interior + baked black outer surround) into a runtime PNG data URL with
// alpha channel so the interior + outer become transparent.
//
// Doctrine anchor: project_nex_bezel_material_layer_addendum_2026_08_25
//   "Chassis is permanent · material is replaceable · interior transparency
//    lets hero/atmosphere show through without altering the metal artwork."
//
// One-time cost per bezel URL · result cached in-memory across renders.
// Safe on SSR (returns undefined until first client render + load complete).

"use client";

import { useEffect, useState } from "react";

// In-memory cache keyed by source URL · reuse across theme switches that
// share a bezel asset.
const cache = new Map<string, string>();

// Graduated alpha across the JPEG's anti-aliased boundary pixels.
//   Interior WHITE:
//     min(RGB) ≥ WHITE_FULL_MIN  → alpha 0   (fully transparent)
//     min(RGB) ≥ WHITE_SOFT_MIN  → alpha linearly interpolated
//     min(RGB) <  WHITE_SOFT_MIN → alpha kept (metal chassis · orange glow)
//   Outer BLACK:
//     max(RGB) ≤ BLACK_FULL_MAX  → alpha 0
//     max(RGB) ≤ BLACK_SOFT_MAX  → linearly interpolated
//     max(RGB) >  BLACK_SOFT_MAX → alpha kept
// The `SOFT` bands soak up the JPEG's soft anti-aliased edges so no
// bright-grey halo lingers around the transparent cutouts.
const WHITE_FULL_MIN = 230;
const WHITE_SOFT_MIN = 180;
const BLACK_FULL_MAX = 22;
const BLACK_SOFT_MAX = 55;

// Bump this constant when tuning to invalidate the in-memory cache without
// requiring a full browser restart.
const CHROMA_KEY_VERSION = 2;

function cacheKey(src: string) { return `${CHROMA_KEY_VERSION}:${src}`; }

/**
 * PNG assets already ship with an alpha channel · no chroma-key needed.
 * JPEGs need chroma-key to peel off baked-in white/black backgrounds.
 * Also skips data-URLs (they're runtime-produced · probably already keyed).
 *
 * Query strings (?updatedAt=…, cache-busters, ImageKit transforms) are
 * stripped before extension matching so an https URL like
 * "https://cdn.example/frame.png?v=123" still resolves as PNG. Prior
 * behavior missed those and ran chroma-key over an already-alpha PNG,
 * which stripped its white/black pixels and looked blurred/washed.
 */
function needsChromaKey(src: string): boolean {
  const s = src.toLowerCase();
  if (s.startsWith("data:")) return false;
  // Strip ?query and #hash so extension check works for cache-busted URLs
  const path = s.split("?", 1)[0].split("#", 1)[0];
  if (path.endsWith(".png") || path.endsWith(".svg") || path.endsWith(".webp") || path.endsWith(".avif")) return false;
  return true; // .jpg / .jpeg / anything else
}

export function useChromaKeyedBezel(src: string | undefined): string | undefined {
  const [dataUrl, setDataUrl] = useState<string | undefined>(() => {
    if (!src) return undefined;
    if (!needsChromaKey(src)) return src; // return raw src synchronously for PNGs
    return cache.get(cacheKey(src));
  });

  useEffect(() => {
    if (!src) { setDataUrl(undefined); return; }
    if (!needsChromaKey(src)) { setDataUrl(src); return; }
    const key = cacheKey(src);
    const cached = cache.get(key);
    if (cached) { setDataUrl(cached); return; }
    if (typeof window === "undefined" || typeof document === "undefined") return;

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = imageData.data;
        const whiteBand = WHITE_FULL_MIN - WHITE_SOFT_MIN; // 50
        const blackBand = BLACK_SOFT_MAX - BLACK_FULL_MAX; // 33
        for (let i = 0; i < px.length; i += 4) {
          const r = px[i], g = px[i + 1], b = px[i + 2];
          const mn = Math.min(r, g, b);
          const mx = Math.max(r, g, b);
          let alpha = 255;

          // Interior WHITE fade (min channel high → transparent)
          if (mn >= WHITE_FULL_MIN) {
            alpha = 0;
          } else if (mn >= WHITE_SOFT_MIN) {
            // Ramp: 0 (fully transparent) at WHITE_FULL_MIN,
            //       255 (opaque) at WHITE_SOFT_MIN
            const t = (WHITE_FULL_MIN - mn) / whiteBand; // 0..1
            alpha = Math.round(t * 255);
          }

          // Outer BLACK fade (max channel low → transparent) · take the
          // MORE transparent of the two (min alpha wins) so black-edge
          // pixels near an orange glow don't stay opaque.
          if (mx <= BLACK_FULL_MAX) {
            alpha = 0;
          } else if (mx <= BLACK_SOFT_MAX) {
            const t = (BLACK_SOFT_MAX - mx) / blackBand;
            const blackAlpha = Math.round((1 - t) * 255);
            if (blackAlpha < alpha) alpha = blackAlpha;
          }

          px[i + 3] = alpha;
        }
        ctx.putImageData(imageData, 0, 0);
        const url = canvas.toDataURL("image/png");
        cache.set(key, url);
        if (!cancelled) setDataUrl(url);
      } catch {
        // If chroma-key fails (CORS · memory · anything) fall back to the
        // raw src · caller renders the JPEG as-is · zero regression.
        if (!cancelled) setDataUrl(src);
      }
    };
    img.onerror = () => { if (!cancelled) setDataUrl(src); };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);

  return dataUrl;
}
