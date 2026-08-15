// NEX Business PWA · GET /api/b/[slug]/sw.js (Philip 2026-08-14 · Phase 18).
//
// Per-business Service Worker · scoped to `/b/{slug}/`.
//
// Constitutional locks:
//   - The SW is intentionally MINIMAL · install/activate + a passive fetch
//     handler that lets the network handle every request. No cache poisoning
//     · no request rewriting · no third-party endpoints called from the SW.
//   - We serve it from an API route so we can set `Service-Worker-Allowed`
//     properly (this file lives at /api/... but is scoped to /b/{slug}/).
//   - Adding real caching later must remain a governed change · SW updates
//     roll out via versioned cache names.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await params;
  const body = `// NEX SW · business=${slug} · version=1 · 2026-08-14
self.addEventListener("install", (event) => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
// Passive fetch handler · leave every request to the network.
// Explicit no-op makes the app installable while preserving the
// constitutional rule that NEX must never silently substitute or
// rewrite a request.
self.addEventListener("fetch", (_event) => {});
`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "service-worker-allowed": `/b/${slug}/`,
      "cache-control": "no-store"
    }
  });
}
