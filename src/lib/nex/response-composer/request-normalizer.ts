// src/lib/nex/response-composer/request-normalizer.ts
//
// Deterministic query normalizer · used for exact + semantic cache keys.
// Not intended as full NL processing · just enough to make "Best hotel near
// Malioboro for family" and "  best  hotel near malioboro for family " hash
// to the same key while keeping semantic-cache detection for near-identical
// phrasing.
//
// Zero external calls. Zero model. Pure function.

const STOPWORDS = new Set([
  "a","an","the","and","or","but","if","of","in","on","at","to","for","with",
  "is","are","was","were","be","been","being","have","has","had","do","does",
  "did","will","would","should","could","may","might","must","can",
  "i","me","my","mine","you","your","yours","we","us","our","ours",
  "please","hi","hello","hey","thanks","thank","just","some","any","all",
]);

export interface NormalizedQuery {
  original: string;
  lower_trimmed: string;
  tokens: string[];
  content_tokens: string[]; // stopwords removed
  exact_key: string;        // trimmed, lowercased, single-spaced
  semantic_bag: string[];   // sorted content_tokens for bag-of-words hash
  length_chars: number;
  length_tokens: number;
}

export function normalizeQuery(raw: string): NormalizedQuery {
  const original = raw;
  const lowerTrimmed = raw.trim().toLowerCase().replace(/\s+/g, " ");
  const tokens = lowerTrimmed
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const contentTokens = tokens.filter((t) => !STOPWORDS.has(t) && t.length > 1);
  const semanticBag = [...contentTokens].sort();
  return {
    original,
    lower_trimmed: lowerTrimmed,
    tokens,
    content_tokens: contentTokens,
    exact_key: lowerTrimmed,
    semantic_bag: semanticBag,
    length_chars: raw.length,
    length_tokens: tokens.length,
  };
}

/** SHA-256 short hash of a string (for cache-key fingerprinting). Deterministic + zero cost. */
export async function shortHash(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", enc);
  const bytes = new Uint8Array(hashBuf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex.slice(0, 24);
}

/** Synchronous alternative for scripts / Node contexts using node:crypto. */
export function shortHashSync(input: string): string {
  // Dynamic import at call-time — supported by both bundlers and Node
  // If subtle isn't available, callers should await shortHash instead.
  const nodeCrypto = eval("require")("node:crypto") as typeof import("node:crypto");
  return nodeCrypto.createHash("sha256").update(input).digest("hex").slice(0, 24);
}
