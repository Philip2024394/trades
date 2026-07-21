// siteWatermark — sharp-based canonical watermark for The Site.
//
// Two entry points:
//   • watermarkThumb(url, {maxWidth}) — resized+watermarked preview
//     for wall thumbnails. Universal (any CDN source; we fetch bytes
//     and re-encode). Caller should serve with public cache headers.
//   • watermarkExport(bytes) — burns the same watermark into an
//     exported canvas from the editor. Used only when the caller is
//     on a non-paid tier; entitled callers export watermark-free.
//
// The mark is bottom-right, white semi-transparent, sized to ~5% of
// the shorter edge, with a subtle drop-shadow so it stays readable
// on both light and dark backgrounds without being intrusive.
//
// SERVER-ONLY. sharp is a native module — never import from a
// client component.

import "server-only";
import sharp from "sharp";

const MARK_TEXT = "thenetworkers.app";

/** Build an SVG watermark sized to fit the target image. Returned
 *  as a Buffer sharp can composite.
 *
 *  Position:
 *   • Square / 4:5 / landscape (aspect < 1.5) → BOTTOM-LEFT.
 *   • Tall 9:16 (Story / Reel / TikTok / Snap) → BOTTOM-CENTRE with
 *     a top-safe-zone lift so it clears the platform's send-message
 *     bar + like/share stack.
 *  Style: white text, bold, 85% opacity, subtle black stroke for
 *  contrast on light backgrounds, prefixed with a small yellow dot
 *  so it reads as "brand credit" not "third-party watermark". */
function watermarkSvg(width: number, height: number): Buffer {
  const short  = Math.min(width, height);
  const fontPx = Math.max(14, Math.min(56, Math.round(14 * (short / 720))));
  const padX   = Math.max(12, Math.round(fontPx * 0.85));
  const padY   = Math.max(12, Math.round(fontPx * 0.6));
  const textWidthPx = Math.round(MARK_TEXT.length * fontPx * 0.52);
  const dotR   = Math.round(fontPx * 0.32);
  const dotToTextGap = Math.round(fontPx * 0.5);

  // 9:16 (tall) → bottom-centre with a safe-zone lift so it clears
  // platform chrome (IG Story's message bar takes the bottom ~180px).
  const isTall = height / Math.max(1, width) > 1.5;
  const lift   = isTall ? Math.round(height * 0.15) : padY;
  const textY  = height - lift;
  const dotX   = isTall
    ? Math.round(width / 2 - (dotR + dotToTextGap + textWidthPx) / 2)
    : padX;
  const textX  = dotX + dotR * 2 + dotToTextGap;

  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${dotX + dotR}" cy="${textY - Math.round(fontPx * 0.35)}" r="${dotR}" fill="#FFB300" opacity="0.9" style="paint-order:stroke;stroke:#000;stroke-width:1;stroke-opacity:0.35"/>
      <text x="${textX}" y="${textY}" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="${fontPx}" font-weight="700" fill="#FFFFFF" opacity="0.85" style="paint-order:stroke;stroke:#000;stroke-width:${Math.max(1, Math.round(fontPx * 0.08))}px;stroke-opacity:0.55">${MARK_TEXT}</text>
    </svg>
  `;
  return Buffer.from(svg);
}

/** Fetch, resize, and watermark an image from any CDN. Caller
 *  passes desired max width (thumbnail 800, hero 1400). */
export async function watermarkThumb(
  sourceUrl: string,
  opts: { maxWidth: number; format?: "webp" | "jpeg" } = { maxWidth: 800 }
): Promise<{ bytes: Buffer; contentType: string }> {
  const upstream = await fetch(sourceUrl, { cache: "force-cache" });
  if (!upstream.ok) {
    throw new Error(`upstream_${upstream.status}`);
  }
  const raw = Buffer.from(await upstream.arrayBuffer());
  const pipeline = sharp(raw, { failOn: "none" }).rotate();
  const meta = await pipeline.metadata();
  const width  = meta.width  ?? opts.maxWidth;
  const height = meta.height ?? Math.round(opts.maxWidth * 4 / 3);

  const resized = pipeline
    .resize({
      width:  Math.min(width, opts.maxWidth),
      withoutEnlargement: true
    });

  // Recompute final size after resize so the mark aligns with the
  // OUTPUT canvas, not the source.
  const outMeta = await resized.clone().metadata();
  const outW = outMeta.width  ?? Math.min(width, opts.maxWidth);
  const outH = outMeta.height ?? Math.round(outW * (height / Math.max(width, 1)));

  const withMark = resized.composite([
    { input: watermarkSvg(outW, outH), top: 0, left: 0 }
  ]);

  const format = opts.format ?? "webp";
  const bytes = format === "jpeg"
    ? await withMark.jpeg({ quality: 82, mozjpeg: true }).toBuffer()
    : await withMark.webp({ quality: 82 }).toBuffer();

  return {
    bytes,
    contentType: format === "jpeg" ? "image/jpeg" : "image/webp"
  };
}

/** Watermark an editor export. Input is PNG/JPEG bytes from a canvas
 *  toBlob; output preserves the input encoding + adds the mark. */
export async function watermarkExport(input: Buffer): Promise<Buffer> {
  const pipeline = sharp(input, { failOn: "none" });
  const meta = await pipeline.metadata();
  const w = meta.width ?? 1080;
  const h = meta.height ?? 1080;
  const fmt = meta.format ?? "png";
  const withMark = pipeline.composite([
    { input: watermarkSvg(w, h), top: 0, left: 0 }
  ]);
  if (fmt === "jpeg") return withMark.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  if (fmt === "webp") return withMark.webp({ quality: 90 }).toBuffer();
  return withMark.png({ compressionLevel: 8 }).toBuffer();
}
