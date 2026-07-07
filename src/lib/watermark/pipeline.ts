// Watermark pipeline — the single entry point that stacks the four
// layers (visible corner URL / visible center chip / metadata /
// steganography). Tier decides which layers apply.
//
//   preview  → all 4 layers (max protection, SEO backlink signal)
//   standard → metadata + steganography only (no visible marks —
//              the merchant paid for a licence)
//   clean    → no watermarks (only granted after a full buyout — the
//              buyer owns the image outright)
//
// The pipeline also computes the perceptual hash of the input so
// callers can register it in the repost-monitoring table.

import { applyVisibleWatermarks } from "./visible";
import { embedPayload } from "./steganography";
import { writeMetadata } from "./metadata";
import { computeAHash } from "./perceptualHash";
import type { WatermarkTier } from "./config";
import { WATERMARK_URL_BASE } from "./config";

export type PipelineInput = {
  imageBuffer: Buffer;
  imageId: string;
  tier: WatermarkTier;
};

export type PipelineOutput = {
  imageBuffer: Buffer;
  /** aHash of the ORIGINAL input (not the watermarked output) so
   *  reposts of stripped/altered variants still match on lookup. */
  originalAHash: string;
  /** aHash of the OUTPUT — what visitors actually download. Useful
   *  for detecting exact-match reposts. */
  outputAHash: string;
  appliedLayers: string[];
};

export async function runWatermarkPipeline(
  input: PipelineInput
): Promise<PipelineOutput> {
  const originalAHash = await computeAHash(input.imageBuffer);
  let buffer = input.imageBuffer;
  const appliedLayers: string[] = [];

  if (input.tier === "clean") {
    // Full-buyout owners get the original image untouched.
    const outputAHash = originalAHash;
    return {
      imageBuffer: buffer,
      originalAHash,
      outputAHash,
      appliedLayers
    };
  }

  // Steganographic URL — the invisible URL embedded in pixel LSBs.
  // Applied FIRST because visible watermarks are added on top (their
  // LSB writes could otherwise overwrite our payload).
  const embedUrl = `${WATERMARK_URL_BASE}/${input.imageId}`;
  buffer = await embedPayload(buffer, embedUrl);
  appliedLayers.push("steganography");

  // Metadata (EXIF / XMP copyright + source URL).
  buffer = await writeMetadata({ imageBuffer: buffer, imageId: input.imageId });
  appliedLayers.push("metadata");

  // Visible marks — preview tier only.
  if (input.tier === "preview") {
    buffer = await applyVisibleWatermarks(buffer, {
      cornerUrl: true,
      centerChip: true
    });
    appliedLayers.push("visible-corner-url");
    appliedLayers.push("visible-center-chip");
  }

  const outputAHash = await computeAHash(buffer);

  return {
    imageBuffer: buffer,
    originalAHash,
    outputAHash,
    appliedLayers
  };
}
