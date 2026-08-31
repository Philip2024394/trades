// Vision-input normaliser · pre-processes user images before they reach
// a local vision model.
//
// Why this exists (2026-08-30 benchmark on the RTX 2050 4 GB laptop):
//   qwen2.5vl:3b (Q4_K_M) reliably produces `@@@@@` gibberish when fed
//   a large PNG (1080×1080 test images consistently failed at 4K / 8K
//   / 16K context). Converting the same image to JPEG at max 1024px
//   fixed every case. The failure mode is silent — the model still
//   returns `done_reason: "stop"` — so it can't be caught by an error
//   handler.
//
// This helper standardises every image the local vision adapter sees:
//   - re-encoded as JPEG (q=85)
//   - resized to fit within 1024×1024 (preserving aspect)
//   - skipped entirely if sharp isn't installed (returns raw input)
//
// The 1024px cap is a practical Qwen-VL-friendly resolution: high
// enough to read UI text and product details, small enough that the
// vision encoder's tile-count stays within 4 GB VRAM.

const MAX_DIMENSION = Number(process.env.NEX_VISION_MAX_DIM ?? "1024");
const JPEG_QUALITY = Number(process.env.NEX_VISION_JPEG_QUALITY ?? "85");

type SharpFn = (typeof import("sharp"))["default"];
let sharpPromise: Promise<SharpFn | null> | null = null;

async function loadSharp(): Promise<SharpFn | null> {
  if (sharpPromise) return sharpPromise;
  sharpPromise = (async () => {
    try {
      const mod = await import("sharp");
      return mod.default;
    } catch {
      return null;
    }
  })();
  return sharpPromise;
}

/** Normalise a single base64-encoded image for local vision inference.
 *  Returns raw base64 (no data URL prefix). Never throws — on any
 *  failure it returns the original input so the caller can still
 *  attempt inference (worst case: model returns gibberish and the
 *  runtime falls back to the cloud path). */
export async function normalizeImageBase64ForVision(rawBase64: string): Promise<string> {
  const sharp = await loadSharp();
  if (!sharp) return rawBase64;

  try {
    const input = Buffer.from(rawBase64, "base64");
    const output = await sharp(input)
      .rotate() // honour EXIF orientation
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    return output.toString("base64");
  } catch {
    return rawBase64;
  }
}
