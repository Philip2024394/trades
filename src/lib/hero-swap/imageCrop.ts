// imageCrop — client-side utilities for the merchant upload flow.
//
// Given a source image + a focal point (0-100% x/y), we generate a
// data URL at a target aspect ratio using the canvas API. No extra
// deps. This is what powers the "your image looks like this on
// desktop / tile / mobile" preview when the merchant uploads.

export type AspectRatio = "16:9" | "1:1" | "3:4";

export type CropFocalPoint = {
  x: number; // 0-100 percent
  y: number; // 0-100 percent
};

const RATIO_MAP: Record<AspectRatio, [number, number]> = {
  "16:9": [16, 9],
  "1:1": [1, 1],
  "3:4": [3, 4]
};

/** Compute the pixel rectangle (in source-image coordinates) that we'd
 *  crop out to render the image at the target aspect, centred on the
 *  focal point. Handles both landscape and portrait source images. */
export function computeCropRect(
  sourceWidth: number,
  sourceHeight: number,
  aspect: AspectRatio,
  focal: CropFocalPoint
): { sx: number; sy: number; sw: number; sh: number } {
  const [rw, rh] = RATIO_MAP[aspect];
  const targetAspect = rw / rh;
  const sourceAspect = sourceWidth / sourceHeight;

  let sw: number;
  let sh: number;
  if (sourceAspect > targetAspect) {
    // source is wider — crop horizontally
    sh = sourceHeight;
    sw = sourceHeight * targetAspect;
  } else {
    // source is taller — crop vertically
    sw = sourceWidth;
    sh = sourceWidth / targetAspect;
  }

  // Convert focal % to source pixels
  const focalX = (focal.x / 100) * sourceWidth;
  const focalY = (focal.y / 100) * sourceHeight;

  let sx = focalX - sw / 2;
  let sy = focalY - sh / 2;

  // Clamp so we never crop off the source image
  sx = Math.max(0, Math.min(sourceWidth - sw, sx));
  sy = Math.max(0, Math.min(sourceHeight - sh, sy));

  return { sx, sy, sw, sh };
}

/** Generate a data URL of the source image cropped to the target
 *  aspect at the given focal point. Called on Save when the merchant
 *  confirms their upload + crops. Runs in the browser (canvas). */
export async function generateAspectCrop(
  sourceDataUrl: string,
  aspect: AspectRatio,
  focal: CropFocalPoint,
  outputMaxWidth = 2400
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const rect = computeCropRect(
          img.naturalWidth,
          img.naturalHeight,
          aspect,
          focal
        );
        const [rw, rh] = RATIO_MAP[aspect];
        // Scale output to fit maxWidth without exceeding original quality
        const scale = Math.min(1, outputMaxWidth / rect.sw);
        const outW = Math.round(rect.sw * scale);
        const outH = Math.round(rect.sh * scale);
        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context unavailable"));
          return;
        }
        ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, outW, outH);
        void rw;
        void rh;
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = sourceDataUrl;
  });
}

/** Detect if an image is too small for hero use. Returns null if OK
 *  or a short warning string if the merchant should be advised. */
export function validateHeroSize(
  width: number,
  height: number
): string | null {
  const minAcceptable = 1200;
  const recommended = 2400;
  if (width < minAcceptable || height < 675) {
    return `Small image — may look blurry on desktop. Try ${recommended} × ${Math.round((recommended * 9) / 16)}+ px.`;
  }
  if (width < recommended) {
    return `Below recommended size. May look soft on retina screens.`;
  }
  return null;
}
