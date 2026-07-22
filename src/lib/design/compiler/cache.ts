// Prompt cache — hash-keyed by IR. Two-level: in-memory LRU + optional
// Postgres persistence for compiled prompts (hammerex_compiled_prompts
// migration lands with the analytics slice). Per V3 Q13 caching.
//
// Cache key = SHA256 of the canonical JSON representation of the IR.
// Invalidate on any of: compilerVersion change, brand-version change,
// intent change, memory-hint set change.

import { createHash } from "node:crypto";
import type { DesignIR } from "./ir";
import type { CompiledPrompt } from "./types";

const MAX_ENTRIES = 500;
const cache: Map<string, CompiledPrompt> = new Map();

/** Compute the canonical cache key for an IR. */
export function cacheKey(ir: DesignIR, compilerVersion: string): string {
  // Stable JSON: keys sorted. Object.entries + JSON.stringify keeps
  // ordering deterministic across identical inputs.
  const canonical = JSON.stringify(sortObject(ir));
  return createHash("sha256").update(`${compilerVersion}|${canonical}`).digest("hex").slice(0, 40);
}

export function readCache(key: string): CompiledPrompt | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  // Touch for LRU behaviour
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

export function writeCache(key: string, prompt: CompiledPrompt): void {
  cache.set(key, prompt);
  if (cache.size > MAX_ENTRIES) {
    // Evict oldest (Map iteration order = insertion order)
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

/** Deep sort object keys so JSON stringification is deterministic. */
function sortObject(input: unknown): unknown {
  if (input === null || typeof input !== "object") return input;
  if (Array.isArray(input)) return input.map(sortObject);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(input as Record<string, unknown>).sort()) {
    out[key] = sortObject((input as Record<string, unknown>)[key]);
  }
  return out;
}
