// Perceptual hash (aHash) — a robust 64-bit fingerprint of an image
// that survives resize, mild colour shift, format change, and small
// crops. Used to detect reposts even when all other watermarks are
// stripped.
//
// Algorithm: reduce to 8×8 greyscale → compute mean → each pixel
// becomes 1 if above the mean, 0 otherwise → concatenate into a
// 64-bit hex string.
//
// This is a purposeful choice over pHash (DCT-based) — aHash is
// simpler, fast, and adequate for our use case (matching reposts of
// our own catalogue, not fine-grained near-duplicate detection).

import sharp from "sharp";

/** Compute a 64-bit aHash for the image. Returns a 16-char hex string. */
export async function computeAHash(imageBuffer: Buffer): Promise<string> {
  const { data } = await sharp(imageBuffer)
    .resize(8, 8, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Compute mean pixel value.
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const mean = sum / data.length;

  // Build 64-bit hash.
  const bits: number[] = [];
  for (let i = 0; i < 64; i++) {
    bits.push(data[i] > mean ? 1 : 0);
  }
  return bitsToHex(bits);
}

/** Hamming distance between two 16-char hex hashes — number of bits
 *  that differ. 0 = identical; ≤10 usually means "same photo, slight
 *  variation"; >20 usually different subject. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) throw new Error("Hash length mismatch");
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    const na = parseInt(a[i], 16);
    const nb = parseInt(b[i], 16);
    let xor = na ^ nb;
    while (xor > 0) {
      diff += xor & 1;
      xor >>= 1;
    }
  }
  return diff;
}

function bitsToHex(bits: number[]): string {
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    const nibble =
      (bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3];
    hex += nibble.toString(16);
  }
  return hex;
}
