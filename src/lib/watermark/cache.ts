// In-memory LRU cache for the watermark serve endpoint.
//
// Sharp is expensive (30-200ms per pipeline run depending on size).
// Without a cache, every scroll refresh on a merchant landing page
// re-runs the pipeline for every image on screen. This cache holds
// the last N encoded buffers so hot library images are served
// straight from memory.
//
// Node processes are ephemeral in most hosting environments (Vercel
// serverless, Cloudflare Workers), so this cache warms per-instance
// then dies. That's fine — combined with Cache-Control: public,
// max-age=3600, hot images stay on the CDN + browser edge for an
// hour, and cold-hit requests get memoised for the next set of
// concurrent viewers on the same Node process.

type CacheEntry = {
  key: string;
  buffer: Buffer;
  contentType: string;
  layers: string[];
  bytes: number;
};

const MAX_ENTRIES = 64;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024; // 256 MB soft cap

class LRU {
  private map = new Map<string, CacheEntry>();
  private totalBytes = 0;

  get(key: string): CacheEntry | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    // Refresh position — delete + re-insert to move to end.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry;
  }

  set(entry: CacheEntry): void {
    const existing = this.map.get(entry.key);
    if (existing) {
      this.totalBytes -= existing.bytes;
      this.map.delete(entry.key);
    }
    this.map.set(entry.key, entry);
    this.totalBytes += entry.bytes;
    while (
      this.map.size > MAX_ENTRIES ||
      this.totalBytes > MAX_TOTAL_BYTES
    ) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey === undefined) break;
      const oldest = this.map.get(oldestKey);
      if (oldest) this.totalBytes -= oldest.bytes;
      this.map.delete(oldestKey);
    }
  }
}

// A single module-scoped instance, warmed on first request.
const watermarkCache = new LRU();

export function cacheGet(key: string) {
  return watermarkCache.get(key);
}

export function cacheSet(
  key: string,
  buffer: Buffer,
  contentType: string,
  layers: string[]
) {
  watermarkCache.set({
    key,
    buffer,
    contentType,
    layers,
    bytes: buffer.byteLength
  });
}
