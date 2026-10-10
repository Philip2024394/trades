// src/lib/nex/discovery/url-canonicalisation.ts
//
// UWI · Wave 3.3 · URL canonicalisation + dedup key derivation.
// Founder-authorised programme.
//
// Deterministic URL normalisation policy · every fetch is keyed by
// `canonical_key` so the dedup ledger + provenance chain can identify
// URL identity across variations (case · default ports · fragment ·
// tracking params · trailing slash · repeated slashes).
//
// This is NEX-native and auditable — no external URL library used.

import type { CanonicalUrl } from "./types";

// Tracking-param blocklist (surface-common analytics parameters).
// Deliberately conservative — only strip when clearly analytical.
const TRACKING_PARAMS = new Set<string>([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "fbclid", "mc_cid", "mc_eid",
  "_ga", "_gl", "yclid", "msclkid",
  "ref", "referrer", "ref_src", "ref_url",
]);

const DEFAULT_PORTS: Record<string, string> = {
  "http:": "80",
  "https:": "443",
  "ws:": "80",
  "wss:": "443",
};

/** Canonicalise a URL to NEX's deterministic normal form. Throws on
 *  unparseable input (caller should catch and record as malformed_url). */
export function canonicalise(raw: string): CanonicalUrl {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("empty URL");
  const u = new URL(trimmed); // may throw TypeError

  // Lowercase scheme + host
  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase();

  // Strip default port
  if (u.port && DEFAULT_PORTS[u.protocol] === u.port) u.port = "";

  // Collapse multiple slashes in path (but preserve leading / and empty segments only where meaningful)
  const collapsedPath = u.pathname.replace(/\/{2,}/g, "/");
  u.pathname = collapsedPath;

  // Strip fragment (never affects server-side content)
  u.hash = "";

  // Sort + strip tracking query params
  const params = Array.from(u.searchParams.entries())
    .filter(([k]) => !TRACKING_PARAMS.has(k.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));
  u.search = "";
  for (const [k, v] of params) u.searchParams.append(k, v);

  const normalised = u.toString();

  // Canonical key is normalised URL minus scheme (so http/https of same
  // resource collapse for dedup). The scheme is preserved in `normalised`
  // for the actual fetch.
  const scheme_stripped = normalised.replace(/^https?:\/\//, "");
  const canonical_key = scheme_stripped;

  return {
    raw,
    normalised,
    host: u.hostname,
    canonical_key,
  };
}

/** Try-catch wrapper — returns null on unparseable URL rather than throw. */
export function tryCanonicalise(raw: string): CanonicalUrl | null {
  try { return canonicalise(raw); } catch { return null; }
}

/** In-memory URL dedup ledger.
 *  Callers register every URL they visit; second registration of the same
 *  `canonical_key` returns `duplicate: true` and the caller MUST NOT
 *  re-fetch (unless intentional refresh flow · that's a different code path). */
export class UrlDedupLedger {
  private seen = new Map<string, { first_seen_iso: string; last_fetched_iso: string | null }>();

  register(url: CanonicalUrl, now_iso: string = new Date().toISOString()): { duplicate: boolean; first_seen_iso: string } {
    const existing = this.seen.get(url.canonical_key);
    if (existing) return { duplicate: true, first_seen_iso: existing.first_seen_iso };
    this.seen.set(url.canonical_key, { first_seen_iso: now_iso, last_fetched_iso: null });
    return { duplicate: false, first_seen_iso: now_iso };
  }

  markFetched(url: CanonicalUrl, now_iso: string = new Date().toISOString()): void {
    const entry = this.seen.get(url.canonical_key);
    if (entry) entry.last_fetched_iso = now_iso;
  }

  size(): number { return this.seen.size; }

  clear(): void { this.seen.clear(); }
}
