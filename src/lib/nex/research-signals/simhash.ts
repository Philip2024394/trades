// src/lib/nex/signals/simhash.ts
//
// UWI · Wave 4 · M17 layer 2 · SimHash (Charikar 2002)
// Founder-authorised programme.
//
// 64-bit fingerprint over a token bag such that Hamming distance
// approximates the cosine similarity of the underlying token distributions.
//
// Algorithm:
//   1. Tokenise → weighted token bag
//   2. For each token, hash to 64 bits (FNV-1a) and add/subtract each
//      bit position's weight to a length-64 accumulator array.
//   3. Final fingerprint = sign of each accumulator (positive → 1, else 0).
//
// Deterministic · pure · no external deps.

const FNV_OFFSET_64_HI = 0xcbf29ce4 >>> 0;
const FNV_OFFSET_64_LO = 0x84222325 >>> 0;
const FNV_PRIME_64_HI = 0x00000100;
const FNV_PRIME_64_LO = 0x000001b3;

/** 64-bit FNV-1a for strings; returns [hi, lo] as two 32-bit unsigned ints. */
export function fnv1a64(input: string): [number, number] {
  let hi = FNV_OFFSET_64_HI;
  let lo = FNV_OFFSET_64_LO;
  for (let i = 0; i < input.length; i++) {
    const b = input.charCodeAt(i) & 0xff;
    // xor into low byte of lo
    lo = (lo ^ b) >>> 0;
    // 64-bit multiply by prime
    const [nhi, nlo] = mul64(hi, lo, FNV_PRIME_64_HI, FNV_PRIME_64_LO);
    hi = nhi; lo = nlo;
  }
  return [hi, lo];
}

/** Multiply two 64-bit unsigned ints (hi/lo pair) returning [hi, lo] mod 2^64. */
function mul64(a_hi: number, a_lo: number, b_hi: number, b_lo: number): [number, number] {
  const a_lo_hi = a_lo >>> 16, a_lo_lo = a_lo & 0xffff;
  const b_lo_hi = b_lo >>> 16, b_lo_lo = b_lo & 0xffff;
  const ll = a_lo_lo * b_lo_lo;
  const lh = a_lo_lo * b_lo_hi + (ll >>> 16);
  const hl = a_lo_hi * b_lo_lo + (lh & 0xffff);
  const carry = ((lh >>> 16) + (hl >>> 16)) >>> 0;
  const lo_result = (((hl & 0xffff) << 16) | (ll & 0xffff)) >>> 0;
  // high 32 bits come from a_hi*b_lo + a_lo*b_hi + carry (a_hi*b_hi truncated mod 2^64)
  const hi_result = ((a_hi * b_lo + a_lo * b_hi + carry) & 0xffffffff) >>> 0;
  return [hi_result, lo_result];
}

/** Compute 64-bit SimHash over a weighted token bag. */
export function simhash64(tokens: ReadonlyArray<{ token: string; weight: number }>): [number, number] {
  const acc = new Array<number>(64).fill(0);
  for (const { token, weight } of tokens) {
    const [hi, lo] = fnv1a64(token);
    for (let bit = 0; bit < 32; bit++) {
      const mask = 1 << bit;
      acc[bit] += (lo & mask) ? weight : -weight;
      acc[bit + 32] += (hi & mask) ? weight : -weight;
    }
  }
  // Fold accumulator into 64-bit fingerprint
  let out_hi = 0, out_lo = 0;
  for (let bit = 0; bit < 32; bit++) {
    if (acc[bit] > 0) out_lo = (out_lo | (1 << bit)) >>> 0;
    if (acc[bit + 32] > 0) out_hi = (out_hi | (1 << bit)) >>> 0;
  }
  return [out_hi, out_lo];
}

/** SimHash a text by tokenising + counting frequencies. */
export function simhashText(text: string): [number, number] {
  const bag = new Map<string, number>();
  const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
  for (const t of tokens) bag.set(t, (bag.get(t) ?? 0) + 1);
  return simhash64(Array.from(bag.entries()).map(([token, weight]) => ({ token, weight })));
}

/** Hamming distance between two 64-bit fingerprints. */
export function hammingDistance64(a: [number, number], b: [number, number]): number {
  return popcount32((a[0] ^ b[0]) >>> 0) + popcount32((a[1] ^ b[1]) >>> 0);
}

function popcount32(n: number): number {
  n = n - ((n >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/** Convert 64-bit fingerprint to hex string. */
export function toHex64(fp: [number, number]): string {
  return fp[0].toString(16).padStart(8, "0") + fp[1].toString(16).padStart(8, "0");
}
