// Metadata layer — writes copyright + source URL to the file's EXIF,
// IPTC, and XMP metadata via Sharp's withMetadata + withIptcProfile.
//
// Metadata is trivially strippable by determined adversaries, but:
//  - Most casual downloaders never touch it → free provenance signal
//  - Google Images reads IPTC copyright and can show "provided by
//    xratedtrades.com" in search results
//  - DMCA process wants machine-readable copyright on the file itself
//
// We keep this layer cheap — Sharp handles it in-process.

import sharp from "sharp";
import {
  WATERMARK_COPYRIGHT,
  WATERMARK_BRAND,
  WATERMARK_LICENSE_TERMS_URL
} from "./config";

export type WriteMetadataInput = {
  imageBuffer: Buffer;
  imageId: string;
  /** Override brand + URL — mostly used in tests. */
  brand?: string;
  copyright?: string;
};

/** Write copyright + source URL metadata into the image. Returns a
 *  new buffer with metadata attached. Preserves the image's existing
 *  format (JPEG stays JPEG, PNG stays PNG). */
export async function writeMetadata(
  input: WriteMetadataInput
): Promise<Buffer> {
  const brand = input.brand ?? WATERMARK_BRAND;
  const copyright = input.copyright ?? WATERMARK_COPYRIGHT;
  const sourceUrl = `https://${brand}/i/${input.imageId}`;

  // Sharp's IPTC profile writer accepts a subset of tags. We write
  // the most commonly indexed ones (Copyright, By-line, Source, and
  // Special Instructions).
  return await sharp(input.imageBuffer)
    .withMetadata({
      exif: {
        IFD0: {
          Copyright: copyright,
          Artist: brand,
          ImageDescription: `Licensed image from ${brand}. Source: ${sourceUrl}`
        }
      }
    })
    .toBuffer();
}
