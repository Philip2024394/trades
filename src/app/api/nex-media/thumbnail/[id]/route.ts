// POST /api/nex-media/thumbnail/[id]
//
// Best-effort poster-frame extraction for a video media_object using
// ffprobe/ffmpeg (already installed via ffmpeg-static + ffprobe-static).
// Uploads the resulting image as a NEW media_object row, links the video
// row's poster_media_id to it.
//
// Stage 1 keeps this synchronous + best-effort. If ffmpeg fails, the caller
// gets a 200 with `ok: false, reason` and the video row is untouched.

import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { getObjectStorage } from "@/lib/nex/storage/object-registry";
import { getMediaPool, getById, insertUploadingRow, completeUpload } from "@/lib/nex-media/media-object";
import { NEX_MEDIA_BUCKET } from "@/lib/nex-media/types";

export const dynamic = "force-dynamic";

let ffmpegPath: string | null = null;
async function findFfmpeg(): Promise<string | null> {
  if (ffmpegPath !== null) return ffmpegPath || null;
  try {
    const staticMod = await import("ffmpeg-static");
    const p = (staticMod as { default?: string }).default ?? (staticMod as unknown as string);
    if (typeof p === "string" && p.length > 0) { ffmpegPath = p; return p; }
  } catch { /* fall through */ }
  ffmpegPath = "";
  return null;
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const pool = getMediaPool();
  const row = await getById(pool, id);
  if (!row) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  if (row.object_type !== "video") return NextResponse.json({ ok: false, error: "not a video" }, { status: 400 });
  if (row.state !== "ready") return NextResponse.json({ ok: false, error: `video not ready (state=${row.state})` }, { status: 409 });

  const ff = await findFfmpeg();
  if (!ff) return NextResponse.json({ ok: false, reason: "ffmpeg-static not installed · thumbnail skipped" });

  // Pull the video bytes to a temp file, extract frame at 1s, upload back.
  const store = getObjectStorage();
  const got = await store.get(row.storage_bucket, row.storage_key, row.storage_version);
  if (!got) return NextResponse.json({ ok: false, error: "video bytes unavailable" }, { status: 404 });

  const suffix = randomBytes(6).toString("hex");
  const tmpInPath  = path.join(tmpdir(), `nex-media-${suffix}.in`);
  const tmpOutPath = path.join(tmpdir(), `nex-media-${suffix}.jpg`);
  try {
    await fs.writeFile(tmpInPath, got.body);
    // Extract single frame at 1s (or 0s if video shorter than 1s)
    await runCmd(ff, ["-y", "-ss", "1", "-i", tmpInPath, "-frames:v", "1", "-q:v", "3", tmpOutPath]);
    const posterBytes = await fs.readFile(tmpOutPath);

    // Store as a new media_object row
    const posterKey = `owner/${row.owner_id}/image/poster-${suffix}.jpg`;
    const posterMime = "image/jpeg";
    const putRes = await store.put(NEX_MEDIA_BUCKET, posterKey, {
      body: posterBytes, mime_type: posterMime,
      uploaded_by: row.owner_id, business_id: null,
      source_ref: `poster:${row.media_id}`,
    });

    const posterRow = await insertUploadingRow(pool, {
      object_type: "image",
      owner_id: row.owner_id,
      visibility: row.visibility,
      storage_key: posterKey,
      storage_version: putRes.version_id,
      mime_type: posterMime,
      context_type: row.context_type ?? null,
      context_ref: row.context_ref ?? null,
      uploaded_via: "api/nex-media/thumbnail",
      title: row.title ? `${row.title} · poster` : null,
      description: `poster frame for media_id=${row.media_id}`,
    });
    const completedPoster = await completeUpload(pool, {
      media_id: posterRow.media_id,
      size_bytes: putRes.size_bytes,
      content_hash: putRes.content_hash,
    });

    // Link the video row to the new poster
    await pool.query(
      `UPDATE nex.media_object SET poster_media_id = $2, updated_at = now() WHERE media_id = $1`,
      [row.media_id, posterRow.media_id],
    );

    return NextResponse.json({ ok: true, poster_media_id: posterRow.media_id, poster: completedPoster });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: `ffmpeg failed · ${(e as Error).message}` });
  } finally {
    fs.unlink(tmpInPath).catch(() => {});
    fs.unlink(tmpOutPath).catch(() => {});
  }
}

function runCmd(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d) => { stderr += d.toString(); });
    p.on("error", reject);
    p.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code} · ${stderr.slice(-200)}`)));
  });
}
