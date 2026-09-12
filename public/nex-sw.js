/* eslint-env serviceworker */
// public/nex-sw.js
//
// Founder PWA-1 · NEX offline-first service worker.
//
// Caches recent verified NEX chat replies + observatory snapshots +
// attributions so the phone can answer routine queries when WiFi is
// unreliable.
//
// Doctrine anchors:
//   #1 · cached replies were validated by Fabrication Gate v2 at the
//        time they were served · re-serving them is a strict subset of
//        the trust that was assigned.
//   #3 · cached replies inherit their original trust_band via the
//        response headers.
//
// Cache-invalidate on Truth Engine freshness signal (a future BEGIN
// wires a broadcast channel). For this phase: TTL-based expiry.

const CACHE_NAME = "nex-lcc-v1-2026-09-09";
const RUNTIME_CACHE = "nex-runtime-v1";
const REPLY_TTL_MS = 24 * 60 * 60 * 1000;   // 24 hours for verified replies
const STATIC_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for attributions/static

// Endpoints that are SAFE to cache (verified content · read-only).
const CACHEABLE_GET_PATHS = [
  "/api/nex/attributions",
  "/api/nex/observatory/snapshot",
  "/nex/observatory",
  "/nex/gaps",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    // Prime the cache with the attribution endpoint on install.
    const cache = await caches.open(CACHE_NAME);
    try { await cache.add("/api/nex/attributions"); } catch (e) { /* swallow · offline install */ }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Purge older versions.
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== CACHE_NAME && n !== RUNTIME_CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Utility: is a URL safe to cache?
function isCacheableGet(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return CACHEABLE_GET_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(p + "?") || url.pathname.startsWith(p + "/"));
}

// Utility: cache a response with a TTL sidecar header.
async function cacheWithTtl(cacheName, request, response, ttlMs) {
  const clone = response.clone();
  const headers = new Headers(clone.headers);
  headers.set("x-nex-cached-at", String(Date.now()));
  headers.set("x-nex-cache-ttl-ms", String(ttlMs));
  const body = await clone.arrayBuffer();
  const rewritten = new Response(body, { status: clone.status, statusText: clone.statusText, headers });
  const cache = await caches.open(cacheName);
  await cache.put(request, rewritten);
}

// Utility: return cached response iff still within TTL.
async function freshCached(request) {
  for (const name of [CACHE_NAME, RUNTIME_CACHE]) {
    const cache = await caches.open(name);
    const hit = await cache.match(request);
    if (!hit) continue;
    const at = Number(hit.headers.get("x-nex-cached-at") ?? 0);
    const ttl = Number(hit.headers.get("x-nex-cache-ttl-ms") ?? 0);
    if (!at || !ttl) return hit;
    if (Date.now() - at <= ttl) return hit;
  }
  return null;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (!isCacheableGet(req)) return; // let the browser handle normally

  event.respondWith((async () => {
    // Stale-while-revalidate for GET · always prefer network when up,
    // fall back to cache when down.
    try {
      const netRes = await fetch(req);
      if (netRes && netRes.ok) {
        const ttl = req.url.includes("/attributions") ? STATIC_TTL_MS : REPLY_TTL_MS;
        cacheWithTtl(RUNTIME_CACHE, req, netRes.clone(), ttl).catch(() => {});
        return netRes;
      }
      throw new Error(`net_status_${netRes?.status}`);
    } catch {
      const cached = await freshCached(req);
      if (cached) return cached;
      // No network + no cache · fall through to browser default (will show its offline page).
      return new Response(JSON.stringify({ error: "offline", note: "NEX is offline and this response is not in the cache." }), {
        status: 503,
        headers: { "Content-Type": "application/json", "x-nex-cache-miss": "true" },
      });
    }
  })());
});
