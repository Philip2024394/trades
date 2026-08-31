// GET/PUT /api/nex/objects/[bucket]/[...key]
//
// NEX ObjectStorage · dev byte-serving route · Philip 2026-08-27.
//
// The filesystem + postgres object-storage adapters return presigned URLs
// pointing here (see object-postgres.ts line 209). R2 returns real signed
// URLs so this route is only hit when NEX_OBJECT_BACKEND is a dev backend.
//
// Delegates to `getObjectStorage()` so it works transparently across
// adapters. Serves bytes with the correct content-type + cache headers
// appropriate for signed URLs (short-lived · private).

import { NextResponse } from "next/server";
import { getObjectStorage } from "@/lib/nex/storage/object-registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ bucket: string; key: string[] }> };

export async function GET(req: Request, ctx: Ctx) {
  const { bucket, key: keySegs } = await ctx.params;
  const key = Array.isArray(keySegs) ? keySegs.join("/") : String(keySegs ?? "");
  if (!bucket || !key) return NextResponse.json({ ok: false, error: "bucket + key required" }, { status: 400 });

  const url = new URL(req.url);
  const versionId = url.searchParams.get("v") ?? undefined;

  const store = getObjectStorage();
  let read;
  try {
    read = await store.get(bucket, key, versionId);
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
  if (!read) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  // Range request support (needed for <video> seeking on many browsers).
  const range = req.headers.get("range");
  const size = read.body.length;
  const contentType = read.meta.mime_type || "application/octet-stream";
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (match) {
      const start = Number(match[1]);
      const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      if (start >= 0 && end < size && start <= end) {
        const slice = read.body.subarray(start, end + 1);
        return new Response(slice, {
          status: 206,
          headers: {
            "content-type": contentType,
            "content-length": String(slice.length),
            "accept-ranges": "bytes",
            "content-range": `bytes ${start}-${end}/${size}`,
            "cache-control": "private, max-age=300",
          },
        });
      }
    }
  }

  return new Response(read.body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-length": String(size),
      "accept-ranges": "bytes",
      "cache-control": "private, max-age=300",
    },
  });
}

// HEAD support · matches GET metadata without body · used by some players
export async function HEAD(req: Request, ctx: Ctx) {
  const { bucket, key: keySegs } = await ctx.params;
  const key = Array.isArray(keySegs) ? keySegs.join("/") : String(keySegs ?? "");
  const url = new URL(req.url);
  const versionId = url.searchParams.get("v") ?? undefined;
  const store = getObjectStorage();
  const meta = await store.head(bucket, key, versionId).catch(() => null);
  if (!meta) return new Response(null, { status: 404 });
  return new Response(null, {
    status: 200,
    headers: {
      "content-type": meta.mime_type,
      "content-length": String(meta.size_bytes),
      "accept-ranges": "bytes",
      "cache-control": "private, max-age=300",
    },
  });
}
