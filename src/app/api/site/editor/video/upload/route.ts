// POST /api/site/editor/video/upload
//
// Accepts a ≤60s, ≤100MB MP4/MOV video from the editor. Runs ffprobe
// server-side to read duration + dimensions (client can lie about
// duration in the browser), rejects anything over cap, uploads bytes
// to Supabase Storage under social-media/user-videos/<slug>/<uuid>.<ext>,
// returns { input_url, input_duration_s, width, height, bytes }.
//
// The video itself is not registered anywhere at this point — the
// client keeps the returned URL in editor state. When the user hits
// Export, /api/site/editor/video/compose creates the job row that
// references this URL.

import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { execFile as _execFile } from "node:child_process";
// ffprobe-static ships without types — declare the shape inline.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore  ffprobe-static has no bundled .d.ts
import ffprobePath from "ffprobe-static";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { readSiteBuyerEmailCookie } from "@/lib/siteBuyerCookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFile = promisify(_execFile);

const BUCKET       = "social-media";
const PREFIX       = "user-videos";
const MAX_BYTES    = 100 * 1024 * 1024;    // 100 MB
const MAX_DURATION = 60;                    // seconds
const ALLOWED_MIME = new Set(["video/mp4", "video/quicktime", "video/mov"]);

/** ffprobe wrapper — returns { durationSec, width, height } from
 *  the packaged ffprobe-static binary. Written to a temp file first
 *  because ffprobe needs a real file path, not a buffer. */
async function probe(bytes: Buffer, ext: string): Promise<{ durationSec: number; width: number; height: number }> {
  const tmpFile = path.join(os.tmpdir(), `probe-${randomBytes(8).toString("hex")}.${ext}`);
  fs.writeFileSync(tmpFile, bytes);
  try {
    const { stdout } = await execFile(
      // ffprobe-static exports the binary path as a string on `default`.
      (ffprobePath as unknown as { path: string }).path,
      ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", tmpFile]
    );
    const data = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{ codec_type?: string; width?: number; height?: number; duration?: string }>;
    };
    const durationSec = Number(data.format?.duration ?? data.streams?.[0]?.duration ?? 0);
    const videoStream = data.streams?.find((s) => s.codec_type === "video");
    return {
      durationSec: Number.isFinite(durationSec) ? durationSec : 0,
      width:       videoStream?.width  ?? 0,
      height:      videoStream?.height ?? 0
    };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const merchantSlug = await getMerchantSlug();
  const emailCookie  = await readSiteBuyerEmailCookie();
  if (!merchantSlug && !emailCookie) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "file_required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "too_large", limit_bytes: MAX_BYTES }, { status: 413 });
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ ok: false, error: "unsupported_type", allowed: Array.from(ALLOWED_MIME) }, { status: 400 });
  }
  const ext = mime.includes("quicktime") || mime.includes("mov") ? "mov" : "mp4";
  const bytes = Buffer.from(await file.arrayBuffer());

  // Probe duration + dims server-side — trusted answer.
  let probed: { durationSec: number; width: number; height: number };
  try {
    probed = await probe(bytes, ext);
  } catch (e) {
    console.error("[video/upload] ffprobe failed:", e);
    return NextResponse.json({ ok: false, error: "probe_failed" }, { status: 500 });
  }
  if (probed.durationSec <= 0) {
    return NextResponse.json({ ok: false, error: "unreadable_video" }, { status: 400 });
  }
  if (probed.durationSec > MAX_DURATION) {
    return NextResponse.json(
      {
        ok:         false,
        error:      "too_long",
        limit_s:    MAX_DURATION,
        actual_s:   Math.round(probed.durationSec * 10) / 10
      },
      { status: 400 }
    );
  }

  // Upload to Storage.
  const ownerKey = merchantSlug ?? emailCookie ?? "anon";
  const storagePath = `${PREFIX}/${ownerKey}/${randomBytes(16).toString("hex")}.${ext}`;
  const up = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: mime,
    upsert:      false
  });
  if (up.error) {
    console.error("[video/upload] storage upload:", up.error.message);
    return NextResponse.json({ ok: false, error: "upload_failed" }, { status: 500 });
  }
  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);

  return NextResponse.json({
    ok:               true,
    input_url:        pub.publicUrl,
    input_storage:    storagePath,
    input_duration_s: Math.round(probed.durationSec * 100) / 100,
    input_width:      probed.width,
    input_height:     probed.height,
    input_bytes:      bytes.length
  });
}
