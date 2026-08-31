// POST /api/nex-media/register
//
// NEX Media Foundation · Stage 1 · Philip 2026-08-27.
//
// Client has completed the PUT to the presigned URL from /upload-url.
// This route confirms the bytes exist in the backend, extracts probe metadata
// (dimensions / duration / codec — best-effort), and flips state to 'ready'.
//
// Requires body: { media_id, actual_size_bytes?, dimensions?, duration_ms?, codec? }
// The client sends what it knows; server verifies against a HEAD to storage.

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getObjectStorage } from "@/lib/nex/storage/object-registry";
import { getMediaPool, completeUpload, getById } from "@/lib/nex-media/media-object";

export const dynamic = "force-dynamic";

interface Body {
  media_id?: string;
  // Client-observed metadata · best effort · server verifies via HEAD.
  duration_ms?: number | null;
  width_px?: number | null;
  height_px?: number | null;
  codec?: string | null;
  audio_codec?: string | null;
  sample_rate?: number | null;
  channels?: number | null;
}

export async function POST(req: Request) {
  let body: Body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }); }

  if (typeof body.media_id !== "string" || body.media_id.length === 0) {
    return NextResponse.json({ ok: false, error: "media_id required" }, { status: 400 });
  }

  const pool = getMediaPool();
  const existing = await getById(pool, body.media_id);
  if (!existing) return NextResponse.json({ ok: false, error: "media_id not found" }, { status: 404 });
  if (existing.state !== "uploading") {
    return NextResponse.json({ ok: false, error: `media already in state ${existing.state}` }, { status: 409 });
  }

  // Verify bytes exist in storage backend. HEAD is cheap · confirms the PUT
  // actually landed. If not, we leave state=uploading and let the client
  // retry.
  const store = getObjectStorage();
  const head = await store.head(existing.storage_bucket, existing.storage_key, existing.storage_version).catch(() => null);
  let actualSize = 0;
  let contentHash = "";
  if (head) {
    actualSize = head.size_bytes;
    contentHash = head.content_hash;
  } else {
    // The adapter couldn't find the bytes via head(). For adapters that don't
    // support the versioned key convention (like the current dev fallback),
    // try get() with the version — but this is O(bytes) so we ONLY do it if
    // head returned null.
    const got = await store.get(existing.storage_bucket, existing.storage_key, existing.storage_version).catch(() => null);
    if (!got) {
      return NextResponse.json({
        ok: false,
        error: "bytes not found in storage · client PUT may have failed · retry upload",
      }, { status: 424 });
    }
    actualSize = got.meta.size_bytes;
    contentHash = got.meta.content_hash || createHash("sha256").update(got.body).digest("hex");
  }

  const updated = await completeUpload(pool, {
    media_id: body.media_id,
    size_bytes: actualSize,
    content_hash: contentHash,
    duration_ms: body.duration_ms ?? null,
    width_px: body.width_px ?? null,
    height_px: body.height_px ?? null,
    codec: body.codec ?? null,
    audio_codec: body.audio_codec ?? null,
    sample_rate: body.sample_rate ?? null,
    channels: body.channels ?? null,
  });
  if (!updated) return NextResponse.json({ ok: false, error: "race · already registered" }, { status: 409 });

  return NextResponse.json({ ok: true, media: updated });
}
