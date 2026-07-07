// Image quality scoring — heuristic pass over the pixel buffer using
// Sharp. Fast, dependency-free, works without any external API.
//
// Metrics:
//   sharpness   — variance-of-laplacian approximation via edge stats
//   brightness  — mean luminance, penalises far-from-mid-grey
//   composition — rule-of-thirds proxy via crop-difference luminance
//
// Weighted into a 0.0–1.0 overall score. This is the same score the
// vision preprocess pipeline emits + the publications projection
// consumes when choosing per-channel thresholds (Instagram 0.75,
// GBP 0.55, website feed 0.55, case study 0.85).

import sharp from "sharp";

export type QualityFindings = {
  sharpness: number; // 0..1
  brightness: number; // 0..1 (closer to 0.5 luminance = better)
  composition: number; // 0..1
  overall: number; // 0..1
};

export async function scoreQuality(
  buffer: Buffer
): Promise<QualityFindings> {
  const small = await sharp(buffer)
    .resize(256, 256, { fit: "cover" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const data = small.data;

  // 1) Sharpness — sum of absolute differences between adjacent
  //    pixels, normalised. Higher = more edge information = sharper.
  let edgeSum = 0;
  const width = small.info.width;
  const height = small.info.height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      edgeSum += Math.abs(data[y * width + x + 1] - data[y * width + x]);
    }
  }
  const sharpness = Math.min(1, edgeSum / (width * height * 20));

  // 2) Brightness — mean luminance. Best around 0.5 (128).
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const mean = sum / data.length / 255;
  const brightness = 1 - Math.min(1, Math.abs(mean - 0.5) * 2);

  // 3) Composition — rule-of-thirds proxy. Sample the 4 rule-of-thirds
  //    intersection points; if their luminance differs from the image
  //    mean, the subject probably sits near a strong point.
  const thirds = [
    { x: Math.floor(width / 3), y: Math.floor(height / 3) },
    { x: Math.floor((2 * width) / 3), y: Math.floor(height / 3) },
    { x: Math.floor(width / 3), y: Math.floor((2 * height) / 3) },
    { x: Math.floor((2 * width) / 3), y: Math.floor((2 * height) / 3) }
  ];
  let interestSum = 0;
  for (const t of thirds) {
    const v = data[t.y * width + t.x] / 255;
    interestSum += Math.abs(v - mean);
  }
  const composition = Math.min(1, interestSum);

  const overall =
    sharpness * 0.5 + brightness * 0.25 + composition * 0.25;

  return {
    sharpness: round(sharpness),
    brightness: round(brightness),
    composition: round(composition),
    overall: round(overall)
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
