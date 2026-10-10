// src/lib/nex/signals/token-jaccard.ts
//
// UWI · Wave 4 · M17 layer 4 · Token Jaccard similarity
// Founder-authorised programme.
//
// Classical Jaccard = |A ∩ B| / |A ∪ B| over token or shingle sets.
// Deterministic · pure · no external deps.

/** Tokenise a string into lowercase words. */
export function tokenise(text: string): string[] {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/).filter(Boolean);
}

/** Character n-gram shingles (default n=5) for near-duplicate detection at char level. */
export function charShingles(text: string, n: number = 5): string[] {
  const t = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (t.length < n) return [t];
  const out: string[] = [];
  for (let i = 0; i <= t.length - n; i++) out.push(t.slice(i, i + n));
  return out;
}

/** Word n-gram shingles (default n=3). */
export function wordShingles(text: string, n: number = 3): string[] {
  const words = tokenise(text);
  if (words.length < n) return [words.join(" ")];
  const out: string[] = [];
  for (let i = 0; i <= words.length - n; i++) out.push(words.slice(i, i + n).join(" "));
  return out;
}

/** Jaccard similarity over string sets. */
export function jaccard(a: ReadonlyArray<string>, b: ReadonlyArray<string>): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const v of setA) if (setB.has(v)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
