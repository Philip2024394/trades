// POST /api/nex/knowledge-inbox/urls
//
// URL import — accepts one or many URLs. Each URL is HEAD-checked for
// its content-type:
//   · image/*   → download bytes, save as an IMAGE inbox item (routes
//                 to the Image Analyst downstream)
//   · anything else → save as a URL inbox item (routes to the text
//                     pipeline; v3 will fetch page content)
//
// Body: { source: KnowledgeSource, urls: string[] | string }
//
// If urls is a single string, it is split on newlines, commas, and
// whitespace so the client's freeform textarea works as-is.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { coerceSource, saveFileItem, saveUrlItem } from "@/lib/nex/knowledge-inbox/storage";
import type { InboxItem } from "@/lib/nex/knowledge-inbox/types";
// W-OBS-1 Path A Layer 1 · ALS scope for HTTP → inbox → worker CID chain.
import { runFromRequest } from "@/lib/nex/observability/correlation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Rough image-URL heuristic by file extension. Any URL matching this
// skips the HEAD check and goes straight to download. URLs without an
// obvious extension still get HEAD-probed for content-type.
const IMAGE_EXTENSION_RX = /\.(jpe?g|png|webp|gif|bmp|avif|heic)(\?|#|$)/i;

// Content-types we recognise as image and will download.
const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/avif",
  "image/heic",
]);

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB safety cap

function collectUrls(input: unknown): string[] {
  if (Array.isArray(input)) return input.map(String).filter(Boolean);
  if (typeof input === "string") {
    // Split ONLY on whitespace (newlines, spaces, tabs). Commas are
    // NOT a separator — many real URLs (dates, query params, image
    // CDNs like ImageKit) contain commas legitimately. Users can put
    // one URL per line or space-separate.
    return input
      .split(/\s+/)
      .map((u) => u.trim().replace(/^[,;]+|[,;]+$/g, ""))
      .filter((u) => u.length > 0);
  }
  return [];
}

export async function POST(req: NextRequest) {
  return runFromRequest(req, () => urlsHandler(req));
}

async function urlsHandler(req: NextRequest) {
  let body: { source?: unknown; urls?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const urls = collectUrls(body.urls);
  if (urls.length === 0) {
    return NextResponse.json({ ok: false, error: "no_urls" }, { status: 400 });
  }
  const source = coerceSource(body.source);

  const created: InboxItem[] = [];
  const duplicates: InboxItem[] = [];
  const imagesFetched: string[] = [];
  const imageFetchFailures: Array<{ url: string; error: string }> = [];

  for (const u of urls) {
    try {
      // Fast path: obvious image extensions
      if (IMAGE_EXTENSION_RX.test(u)) {
        const result = await downloadAsImageItem(u, source);
        if (result) {
          const { item, deduplicated } = result;
          if (deduplicated) duplicates.push(item);
          else created.push(item);
          imagesFetched.push(u);
          continue;
        }
      }

      // Slow path: HEAD probe for content-type (skip on unreachable /
      // 4xx / 5xx). Some CDNs (including ImageKit) reject HEAD; fall
      // back to a small GET-range as a probe when HEAD isn't allowed.
      const mime = await probeContentType(u);
      if (mime && IMAGE_MIMES.has(mime.toLowerCase().split(";")[0].trim())) {
        const result = await downloadAsImageItem(u, source);
        if (result) {
          const { item, deduplicated } = result;
          if (deduplicated) duplicates.push(item);
          else created.push(item);
          imagesFetched.push(u);
          continue;
        }
      }

      // Not an image — save as a URL item as before.
      const { item, deduplicated } = await saveUrlItem({ source, url: u });
      if (deduplicated) duplicates.push(item);
      else created.push(item);
    } catch (err) {
      const msg = (err as Error).message;
      console.error("[knowledge-inbox.urls] save failed:", msg);
      imageFetchFailures.push({ url: u, error: msg.slice(0, 200) });
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    duplicates,
    images_fetched: imagesFetched,
    image_fetch_failures: imageFetchFailures,
  });
}

// ── Helpers ──────────────────────────────────────────────────────────

async function probeContentType(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    // First try HEAD (cheap)
    try {
      const head = await fetch(url, { method: "HEAD", signal: controller.signal });
      if (head.ok || head.status === 405) {
        const ct = head.headers.get("content-type");
        if (ct) return ct;
      }
    } catch {
      /* fall through to range GET */
    }
    // Fallback: GET first byte with Range so we don't download the
    // whole payload just to sniff the content-type
    const range = await fetch(url, {
      method: "GET",
      headers: { range: "bytes=0-0" },
      signal: controller.signal,
    });
    return range.headers.get("content-type");
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadAsImageItem(
  url: string,
  source: ReturnType<typeof coerceSource>
): Promise<{ item: InboxItem; deduplicated: boolean } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`fetch ${res.status}`);
    }
    const contentLength = Number(res.headers.get("content-length") ?? "0");
    if (contentLength > MAX_IMAGE_BYTES) {
      throw new Error(`image too large (${contentLength} bytes, max ${MAX_IMAGE_BYTES})`);
    }
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error(`image too large after download (${arrayBuffer.byteLength} bytes)`);
    }
    const bytes = Buffer.from(arrayBuffer);
    const mime = (res.headers.get("content-type") ?? "image/jpeg")
      .toLowerCase()
      .split(";")[0]
      .trim();
    if (!IMAGE_MIMES.has(mime)) {
      throw new Error(`unexpected content-type after download: ${mime}`);
    }
    // Derive a filename from the URL path
    let filename = "downloaded-image";
    try {
      const parsed = new URL(url);
      const last = parsed.pathname.split("/").pop() ?? "";
      if (last && /\.[a-z0-9]+$/i.test(last)) filename = last;
      else filename = `${last || "image"}.${mime.split("/")[1] ?? "bin"}`;
    } catch {
      /* keep default */
    }
    return await saveFileItem({
      source,
      forcedKind: "image",
      originalFilename: filename,
      mimeType: mime,
      bytes,
    });
  } finally {
    clearTimeout(timeout);
  }
}
