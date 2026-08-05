// Client-side in-memory cache for the NEX Trade Centre feed.
//
// Populated by the CentreFeedPreloader mounted in /nex-app/layout.tsx.
// Consumed by NexCentreLiveFeed's first fetch so navigating from any
// /nex-app/* surface into /nex-app/centre lands instantly — the feed
// is already there because it began loading the moment the user
// entered the app.
//
// Keyed by URL so different filter combinations don't collide.
// 60-second TTL keeps the cache honest without over-caching.

import type { CentreFeedItem } from "./types";

const TTL_MS = 60_000;

type Entry = {
  url: string;
  items: CentreFeedItem[];
  total: number | null;
  writtenAt: number;
};

let cache: Entry | null = null;

export function primeCentreFeedCache(
  url: string,
  items: CentreFeedItem[],
  total: number | null = null
): void {
  cache = { url, items, total, writtenAt: Date.now() };
}

export function readCentreFeedCache(
  url: string
): { items: CentreFeedItem[]; total: number | null } | null {
  if (!cache) return null;
  if (cache.url !== url) return null;
  if (Date.now() - cache.writtenAt > TTL_MS) {
    cache = null;
    return null;
  }
  return { items: cache.items, total: cache.total };
}

export function clearCentreFeedCache(): void {
  cache = null;
}
