// Perceptual hash helper. We want a stable string that's identical for
// visually identical photos so the render cache can dedupe. The full
// pHash algorithm requires image decoding which is expensive on
// serverless; we lean on a SHA-256 of the byte stream as a first pass
// (identical bytes → identical hash) and leave a hook for a real
// pHash upgrade later.
import "server-only";
import { createHash } from "node:crypto";

export async function computePhash(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to fetch image for pHash: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  return createHash("sha256").update(buf).digest("hex").slice(0, 32);
}

export function canonicalPromptHash(payload: unknown): string {
  const canonical = JSON.stringify(payload, Object.keys(payload as object).sort());
  return createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}
