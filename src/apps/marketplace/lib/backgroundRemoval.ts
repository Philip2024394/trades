// Background-removal wrapper.
//
// Uses @imgly/background-removal — client-side ONNX model that runs
// entirely in the browser. No API keys, no per-image cost, no server
// round-trip. Model files (~28 MB) are cached in the browser after the
// first run so subsequent removals are instant.
//
// Constitution alignment: Trade Center runs the pipeline; the merchant
// still owns and confirms the result. We never destroy the original —
// we hand back both cleaned + original so the merchant chooses.

export type RemovalResult = {
  originalUrl: string;         // object URL of the source blob
  cleanedUrl: string;          // object URL of the transparent PNG
  cleanedBlob: Blob;           // transparent PNG (for save / upload)
  originalBlob: Blob;
  detectedNeedsClean: boolean; // did the naive heuristic think it needed cleaning?
  processingMs: number;
};

/**
 * Very small heuristic that decides whether an image already sits on
 * a clean background. Not a replacement for running the model — just a
 * hint so we can skip processing when the merchant has already done the
 * work (e.g. supplier catalogue photos on white).
 *
 * Samples the 4 corners; if all 4 are near-white and roughly equal, we
 * declare "already clean". Runs in ~2 ms on a Canvas.
 */
export async function detectNeedsCleaning(blob: Blob): Promise<boolean> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(200, bitmap.width);
  canvas.height = Math.min(200, bitmap.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return true;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const samples = [
    ctx.getImageData(0, 0, 1, 1).data,
    ctx.getImageData(canvas.width - 1, 0, 1, 1).data,
    ctx.getImageData(0, canvas.height - 1, 1, 1).data,
    ctx.getImageData(canvas.width - 1, canvas.height - 1, 1, 1).data
  ];
  const isNearWhite = (rgba: Uint8ClampedArray) =>
    rgba[0] > 235 && rgba[1] > 235 && rgba[2] > 235;
  const cornersNearWhite = samples.filter(isNearWhite).length;
  bitmap.close();
  // If 3 or 4 corners are near-white the background is probably clean
  // already — skip. Otherwise process.
  return cornersNearWhite < 3;
}

export async function removeImageBackground(blob: Blob): Promise<RemovalResult> {
  const start = performance.now();
  const originalBlob = blob;
  const detectedNeedsClean = await detectNeedsCleaning(blob);

  // If the image is already on a clean background, skip the model —
  // hand back the original as "cleaned" so downstream code is uniform.
  if (!detectedNeedsClean) {
    return {
      originalUrl: URL.createObjectURL(originalBlob),
      cleanedUrl: URL.createObjectURL(originalBlob),
      cleanedBlob: originalBlob,
      originalBlob,
      detectedNeedsClean: false,
      processingMs: performance.now() - start
    };
  }

  // Dynamic import — @imgly ships ONNX + WASM which we don't want in
  // the SSR bundle. This only loads when the merchant actually uploads.
  const { removeBackground } = await import("@imgly/background-removal");
  const cleanedBlob = await removeBackground(blob, {
    output: { format: "image/png", quality: 0.92 }
  });

  return {
    originalUrl: URL.createObjectURL(originalBlob),
    cleanedUrl: URL.createObjectURL(cleanedBlob),
    cleanedBlob,
    originalBlob,
    detectedNeedsClean: true,
    processingMs: performance.now() - start
  };
}

/** Free the object URLs held by a result once the merchant moves on. */
export function releaseResult(result: RemovalResult): void {
  URL.revokeObjectURL(result.originalUrl);
  if (result.cleanedUrl !== result.originalUrl) {
    URL.revokeObjectURL(result.cleanedUrl);
  }
}
