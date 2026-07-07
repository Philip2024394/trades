// LSB steganography — writes a short URL string into the least-
// significant bits of the image's RGB channels. Invisible to the
// human eye; recoverable by our verify endpoint.
//
// Format written into the image:
//   [ 4 bytes header 0x58 0x54 0x52 0x54 ("XTRT") ]
//   [ 2 bytes payload length (big-endian, max 65,535 bytes) ]
//   [ N bytes payload — UTF-8 encoded URL string ]
//
// Encoding rule: one payload BIT per pixel channel LSB. RGB channels
// only (alpha untouched). So a 1000×1000 image can carry ~375,000
// bytes; we only need ~50 for a URL, so we spread the payload across
// the first few thousand pixels only. Later pixels are untouched.
//
// Survives:
//  - Format re-encode PNG → PNG (lossless)
//  - Mild JPEG compression (quality ≥ 90) — most bits survive
//  - Resize down to ~50% and back up (survives on best-effort)
//
// Does NOT survive:
//  - Heavy JPEG compression (< 70 quality)
//  - Deliberate destruction (median blur / heavy filters)
//  - Cropping if the crop discards the payload region

import sharp from "sharp";

const HEADER = Uint8Array.from([0x58, 0x54, 0x52, 0x54]); // "XTRT"
const HEADER_LEN = 4;
const LENGTH_FIELD_BYTES = 2;
const MAX_PAYLOAD_BYTES = 65535;

/** Embed a UTF-8 string payload into the image's LSB channels. Returns
 *  a PNG buffer (lossless — critical for steganography to survive
 *  round-tripping). Throws if payload doesn't fit or image too small. */
export async function embedPayload(
  imageBuffer: Buffer,
  payload: string
): Promise<Buffer> {
  const payloadBytes = new TextEncoder().encode(payload);
  if (payloadBytes.length > MAX_PAYLOAD_BYTES) {
    throw new Error(
      `Payload too large (${payloadBytes.length} bytes > ${MAX_PAYLOAD_BYTES})`
    );
  }

  const totalBytes =
    HEADER_LEN + LENGTH_FIELD_BYTES + payloadBytes.length;
  const totalBits = totalBytes * 8;

  // Read as raw RGBA (or RGB) so we can mutate LSBs then re-encode
  // as lossless PNG.
  const { data, info } = await sharp(imageBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels; // 3 or 4
  const totalPixels = info.width * info.height;
  const totalRGBChannels = totalPixels * 3;

  if (totalRGBChannels < totalBits) {
    throw new Error(
      `Image too small to embed ${totalBits} bits (has ${totalRGBChannels} RGB channels)`
    );
  }

  // Serialise the frame: header + length + payload
  const frame = new Uint8Array(totalBytes);
  frame.set(HEADER, 0);
  frame[HEADER_LEN] = (payloadBytes.length >> 8) & 0xff;
  frame[HEADER_LEN + 1] = payloadBytes.length & 0xff;
  frame.set(payloadBytes, HEADER_LEN + LENGTH_FIELD_BYTES);

  // Write bit-by-bit. bitIndex counts payload bits; channelCursor
  // walks the pixel buffer skipping alpha channels.
  const mutable = Buffer.from(data);
  let bitIndex = 0;
  for (let px = 0; px < totalPixels && bitIndex < totalBits; px++) {
    const base = px * channels;
    for (let c = 0; c < 3 && bitIndex < totalBits; c++) {
      const byteIndex = Math.floor(bitIndex / 8);
      const bitInByte = 7 - (bitIndex % 8); // MSB-first
      const bit = (frame[byteIndex] >> bitInByte) & 1;
      mutable[base + c] = (mutable[base + c] & 0xfe) | bit;
      bitIndex++;
    }
  }

  // Re-encode as lossless PNG so the LSBs are preserved.
  return await sharp(mutable, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels
    }
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Extract a payload from an image's LSB channels. Returns null if
 *  the header isn't present (image not watermarked or destroyed). */
export async function extractPayload(
  imageBuffer: Buffer
): Promise<string | null> {
  const { data, info } = await sharp(imageBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const totalPixels = info.width * info.height;
  const totalRGBChannels = totalPixels * 3;

  const headerAndLenBits = (HEADER_LEN + LENGTH_FIELD_BYTES) * 8;
  if (totalRGBChannels < headerAndLenBits) {
    return null;
  }

  // Read enough bits to cover header + length field first.
  const prelude = readBits(data, channels, headerAndLenBits);
  // Header check
  for (let i = 0; i < HEADER_LEN; i++) {
    if (prelude[i] !== HEADER[i]) {
      return null;
    }
  }
  const payloadLen =
    (prelude[HEADER_LEN] << 8) | prelude[HEADER_LEN + 1];
  if (payloadLen <= 0 || payloadLen > MAX_PAYLOAD_BYTES) {
    return null;
  }

  const totalBits = (HEADER_LEN + LENGTH_FIELD_BYTES + payloadLen) * 8;
  if (totalRGBChannels < totalBits) {
    return null;
  }

  const full = readBits(data, channels, totalBits);
  const payloadBytes = full.slice(
    HEADER_LEN + LENGTH_FIELD_BYTES,
    HEADER_LEN + LENGTH_FIELD_BYTES + payloadLen
  );
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(payloadBytes);
  } catch {
    return null;
  }
}

/** Read `bits` LSBs from the RGB channels into a byte array. */
function readBits(
  data: Buffer,
  channels: number,
  bits: number
): Uint8Array {
  const bytes = new Uint8Array(Math.ceil(bits / 8));
  let bitIndex = 0;
  const totalPixels = Math.floor(data.length / channels);
  for (let px = 0; px < totalPixels && bitIndex < bits; px++) {
    const base = px * channels;
    for (let c = 0; c < 3 && bitIndex < bits; c++) {
      const bit = data[base + c] & 1;
      const byteIndex = Math.floor(bitIndex / 8);
      const bitInByte = 7 - (bitIndex % 8);
      bytes[byteIndex] |= bit << bitInByte;
      bitIndex++;
    }
  }
  return bytes;
}
