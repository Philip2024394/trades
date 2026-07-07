// Face + registration-plate + competitor-logo detection via Anthropic
// multimodal + Sharp.
//
// Ask the model for bounding boxes in relative coordinates
// (0.0–1.0), then Sharp gaussian-blurs each face/plate region on the
// ORIGINAL full-resolution buffer. Logo regions are surfaced but not
// blurred by default (merchant may want to hold vs silently strip).
//
// Cost: ~$0.005–$0.01 per image on Sonnet 4.6 (shared prompt with
// subject tags if called from preprocess in parallel).

import sharp from "sharp";
import type { OverlayOptions } from "sharp";
import { askVisionJson } from "@/lib/llm/multimodal";

export type Box = {
  kind: "face" | "plate" | "logo";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FaceBlurResult = {
  buffer: Buffer;
  facesBlurred: number;
  platesBlurred: number;
  boxes: Array<{
    kind: "face" | "plate";
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  provider: string;
};

const SYSTEM_PROMPT = `You detect sensitive regions in photos.
Return bounding boxes for:
- human faces (kind: "face")
- UK vehicle registration plates (kind: "plate")
- competitor commercial logos (kind: "logo")

Coordinates are relative to image dimensions (0.0 = top/left,
1.0 = bottom/right). Do NOT include boxes you're unsure about.
Respond in JSON only.`;

export async function blurFacesAndPlates(
  input: Buffer
): Promise<FaceBlurResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return {
      buffer: input,
      facesBlurred: 0,
      platesBlurred: 0,
      boxes: [],
      provider: "stub"
    };
  }

  const meta = await sharp(input).metadata();
  const width = meta.width ?? 1000;
  const height = meta.height ?? 1000;

  let downscaled: Buffer;
  let mime = "image/jpeg";
  try {
    downscaled = await sharp(input)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch {
    downscaled = input;
    mime = "image/png";
  }

  const detected = await askVisionJson<{ boxes?: Box[] }>({
    imageBase64: downscaled.toString("base64"),
    imageMimeType: mime,
    system: SYSTEM_PROMPT,
    userText: `Return { "boxes": [ { "kind": "face" | "plate" | "logo",
"x": 0..1, "y": 0..1, "width": 0..1, "height": 0..1 } ] }.
Boxes should tightly wrap the sensitive region with ~10% padding.`,
    maxTokens: 800
  });

  const boxes = (detected?.boxes ?? []).filter(
    (b) =>
      typeof b.x === "number" &&
      typeof b.y === "number" &&
      typeof b.width === "number" &&
      typeof b.height === "number"
  );

  if (boxes.length === 0) {
    return {
      buffer: input,
      facesBlurred: 0,
      platesBlurred: 0,
      boxes: [],
      provider: "anthropic_multimodal"
    };
  }

  const overlays: OverlayOptions[] = [];
  let facesBlurred = 0;
  let platesBlurred = 0;

  for (const box of boxes) {
    if (box.kind === "logo") continue;
    const absLeft = Math.max(0, Math.floor(box.x * width));
    const absTop = Math.max(0, Math.floor(box.y * height));
    const absWidth = Math.min(
      width - absLeft,
      Math.floor(box.width * width)
    );
    const absHeight = Math.min(
      height - absTop,
      Math.floor(box.height * height)
    );
    if (absWidth <= 4 || absHeight <= 4) continue;
    const cropBlurred = await sharp(input)
      .extract({
        left: absLeft,
        top: absTop,
        width: absWidth,
        height: absHeight
      })
      .blur(Math.max(6, Math.min(absWidth, absHeight) / 6))
      .toBuffer();
    overlays.push({
      input: cropBlurred,
      top: absTop,
      left: absLeft
    });
    if (box.kind === "face") facesBlurred += 1;
    else if (box.kind === "plate") platesBlurred += 1;
  }

  const outBuffer = overlays.length
    ? await sharp(input).composite(overlays).toBuffer()
    : input;

  return {
    buffer: outBuffer,
    facesBlurred,
    platesBlurred,
    boxes: boxes
      .filter((b) => b.kind === "face" || b.kind === "plate")
      .map((b) => ({
        kind: b.kind as "face" | "plate",
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height
      })),
    provider: "anthropic_multimodal"
  };
}
