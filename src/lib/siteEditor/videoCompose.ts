// videoCompose — server-side ffmpeg pipeline that takes an uploaded
// video + editor state (frame + overlays) and produces a composed
// MP4 with all overlays and (for free tier) a burned watermark.
//
// Pipeline per job:
//   1. Fetch input video bytes to a tmp file
//   2. For every overlay layer, render it to a transparent PNG the
//      exact export size:
//        - text layers  → sharp text SVG
//        - shape layers → sharp shape SVG
//        - image/overlay/banner → fetch the layer's source URL
//   3. Add a watermark PNG at top-left when !paid (matches image path)
//   4. Build an ffmpeg command with:
//        - main input (video)
//        - scale + pad to frame.pixelW × frame.pixelH (letterbox/crop)
//        - one `-i` per overlay png
//        - filter graph chaining N `overlay` filters
//        - output as h264 mp4, aac audio
//   5. Read the output file, upload to Supabase Storage
//   6. Return the public URL

import "server-only";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { execFile as _execFile } from "node:child_process";
import sharp from "sharp";
import ffmpegStatic from "ffmpeg-static";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { findFrame } from "@/lib/siteEditor/frames";
import { findFont } from "@/lib/siteEditor/fonts";
import type { ComposePayload, EditorLayer, ImageLayer, TextLayer, ShapeLayer } from "@/lib/siteEditor/types";

const execFile = promisify(_execFile);

const BUCKET             = "social-media";
const OUTPUT_PREFIX      = "video-exports";
const FFMPEG             = (ffmpegStatic as unknown as string) || "ffmpeg";
const WATERMARK_TEXT     = "thenetworkers.app";
const MAX_ATTEMPTS       = 3;

export type ComposeResult =
  | { ok: true;  outputUrl: string; storagePath: string }
  | { ok: false; error:     string };

/** Main entrypoint — takes a video job row's payload, returns
 *  { outputUrl } or { error }. Cleans up all temp files. */
export async function composeVideoJob(input: {
  jobId:            string;
  inputUrl:         string;
  frameSlug:        string;
  overlays:         ComposePayload;
  paid:             boolean;
}): Promise<ComposeResult> {
  const frame = findFrame(input.frameSlug);
  if (!frame) return { ok: false, error: "unknown_frame_slug" };

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "vidjob-"));
  const cleanup = () => {
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch { /* ignore */ }
  };

  try {
    // Step 1 — download the input video.
    const inputPath = path.join(workDir, "in.mp4");
    const videoRes = await fetch(input.inputUrl, { cache: "no-store" });
    if (!videoRes.ok) return { ok: false, error: `input_fetch_${videoRes.status}` };
    fs.writeFileSync(inputPath, Buffer.from(await videoRes.arrayBuffer()));

    // Step 2 — build overlay PNGs at the export size (frame.pixelW × H).
    const targetW = frame.pixelW;
    const targetH = frame.pixelH;
    // Editor-preview canvas dims — needed to scale overlay x/y/w/h
    // from preview px into export px. State snapshot lacks the
    // preview size, so we derive it from the aspect + a common
    // preview short side. Overlays store x/y/w/h in the client
    // Scale factor — the client sends the actual preview canvas
    // dimensions it composed the overlays against (previewWidth /
    // previewHeight). We derive a uniform scale from those to target
    // export size so overlay positions land pixel-accurately on
    // mobile-composed clips as well as desktop. Older clients that
    // pre-date this field fall back to the historical 720 short-side
    // assumption so their in-flight jobs keep composing.
    const previewW = typeof input.overlays.previewWidth  === "number" && input.overlays.previewWidth  > 0
      ? input.overlays.previewWidth  : (frame.aspectW >= frame.aspectH ? 720 * (frame.aspectW / frame.aspectH) : 720);
    const previewH = typeof input.overlays.previewHeight === "number" && input.overlays.previewHeight > 0
      ? input.overlays.previewHeight : (frame.aspectW >= frame.aspectH ? 720 : 720 * (frame.aspectH / frame.aspectW));
    const scale = Math.min(targetW / previewW, targetH / previewH);

    const overlayInputs: Array<{
      pngPath:  string;
      x:        number;
      y:        number;
      w:        number;
      h:        number;
      rotation: number;
      /** Per-layer animation timing (fade + enter/exit). Undefined =
       *  static overlay visible for the whole (trimmed) clip. */
      anim?: {
        enterAtSec:  number;
        exitAtSec:   number;
        fadeInSec:   number;
        fadeOutSec:  number;
      };
    }> = [];

    // Sort by z so lower z composites first (bottom → top order).
    const sortedLayers = [...(input.overlays.layers ?? [])].sort((a, b) => a.z - b.z);
    let overlayIdx = 0;
    for (const layer of sortedLayers) {
      const png = await renderLayerToPng(layer, scale);
      if (!png) continue;
      const pngPath = path.join(workDir, `ov-${String(overlayIdx).padStart(2, "0")}.png`);
      fs.writeFileSync(pngPath, png.bytes);
      overlayInputs.push({
        pngPath,
        x:        Math.round(layer.x * scale),
        y:        Math.round(layer.y * scale),
        w:        png.width,
        h:        png.height,
        rotation: layer.rotation ?? 0,
        anim:     layer.animation ?? undefined
      });
      overlayIdx++;
    }

    // Step 3 — watermark PNG (free tier only). Same top-left position
    // as the image-editor watermark.
    if (!input.paid) {
      const wmPng = await watermarkPng(targetW, targetH);
      const pngPath = path.join(workDir, "watermark.png");
      fs.writeFileSync(pngPath, wmPng.bytes);
      overlayInputs.push({ pngPath, x: 0, y: 0, w: wmPng.width, h: wmPng.height, rotation: 0 });
    }

    // Trim range from base slot — clip the source before compositing.
    const base = (input.overlays.base ?? {}) as { trimFrom?: number; trimTo?: number };
    const trimFrom = typeof base.trimFrom === "number" ? Math.max(0, base.trimFrom) : 0;
    const trimTo   = typeof base.trimTo   === "number" ? base.trimTo : undefined;
    const clippedDuration = trimTo !== undefined ? trimTo - trimFrom : undefined;

    // Step 4 — assemble ffmpeg command.
    //   Base filter: seek to trimFrom, cap duration to (trimTo-trimFrom),
    //   scale+pad to target dimensions.
    //   Overlay chain: for each overlay pin its lifetime with
    //   fade= filter (crossfade) + overlay= enable='between(t,in,out)'.
    //   Overlay animation times are relative to the ORIGINAL video;
    //   we shift them by -trimFrom so they line up with the trimmed
    //   output starting at t=0.
    const outputPath = path.join(workDir, "out.mp4");
    const args: string[] = ["-y"];
    // Fast seek via -ss BEFORE -i.
    if (trimFrom > 0) args.push("-ss", trimFrom.toString());
    args.push("-i", inputPath);
    if (clippedDuration !== undefined && clippedDuration > 0) {
      args.push("-t", clippedDuration.toString());
    }
    for (const ov of overlayInputs) args.push("-i", ov.pngPath);

    const filterParts: string[] = [];
    filterParts.push(`[0:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:color=black[base]`);

    // Pre-process each overlay input with fade-in/fade-out if the
    // layer has animation. Timings shift by -trimFrom.
    for (let i = 0; i < overlayInputs.length; i++) {
      const ov = overlayInputs[i];
      if (ov.anim) {
        const enterShift = Math.max(0, ov.anim.enterAtSec - trimFrom);
        const exitShift  = Math.max(0, ov.anim.exitAtSec  - trimFrom);
        const fadeIn     = Math.max(0, ov.anim.fadeInSec);
        const fadeOut    = Math.max(0, ov.anim.fadeOutSec);
        const fades: string[] = [];
        if (fadeIn  > 0) fades.push(`fade=t=in:st=${enterShift.toFixed(3)}:d=${fadeIn.toFixed(3)}:alpha=1`);
        if (fadeOut > 0) fades.push(`fade=t=out:st=${(exitShift - fadeOut).toFixed(3)}:d=${fadeOut.toFixed(3)}:alpha=1`);
        if (fades.length > 0) {
          filterParts.push(`[${i + 1}:v]${fades.join(",")}[ov${i}]`);
        } else {
          filterParts.push(`[${i + 1}:v]null[ov${i}]`);
        }
      } else {
        filterParts.push(`[${i + 1}:v]null[ov${i}]`);
      }
    }

    let currentTag = "base";
    for (let i = 0; i < overlayInputs.length; i++) {
      const ov = overlayInputs[i];
      const inLabel  = i === overlayInputs.length - 1 ? "vout" : `v${i}`;
      let enable = "";
      if (ov.anim) {
        const enterShift = Math.max(0, ov.anim.enterAtSec - trimFrom);
        const exitShift  = Math.max(0, ov.anim.exitAtSec  - trimFrom);
        enable = `:enable='between(t,${enterShift.toFixed(3)},${exitShift.toFixed(3)})'`;
      }
      filterParts.push(`[${currentTag}][ov${i}]overlay=${ov.x}:${ov.y}${enable}[${inLabel}]`);
      currentTag = inLabel;
    }
    // If there were zero overlays, the last usable stream is [base].
    const mapLabel = overlayInputs.length === 0 ? "base" : "vout";

    args.push("-filter_complex", filterParts.join(";"));
    args.push("-map", `[${mapLabel}]`);
    args.push("-map", "0:a?");                       // audio if present
    args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "23");
    args.push("-c:a", "aac", "-b:a", "128k");
    args.push("-movflags", "+faststart");
    args.push("-t", "60");                           // hard-cap output to 60s
    args.push(outputPath);

    // Run ffmpeg. Time-out defensively.
    try {
      await execFile(FFMPEG, args, { maxBuffer: 32 * 1024 * 1024, timeout: 5 * 60 * 1000 });
    } catch (e) {
      const err = e as { message?: string; stderr?: string };
      const detail = err.stderr ?? err.message ?? "unknown";
      console.error("[videoCompose] ffmpeg failed:", detail.slice(0, 800));
      return { ok: false, error: `ffmpeg: ${detail.slice(0, 200)}` };
    }
    if (!fs.existsSync(outputPath)) {
      return { ok: false, error: "ffmpeg_no_output" };
    }
    const outputBytes = fs.readFileSync(outputPath);

    // Step 5 — upload output to Storage.
    const storagePath = `${OUTPUT_PREFIX}/${input.jobId}.mp4`;
    const up = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, outputBytes, {
      contentType: "video/mp4",
      upsert:      true
    });
    if (up.error) return { ok: false, error: `storage_upload: ${up.error.message}` };
    const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);

    return { ok: true, outputUrl: pub.publicUrl, storagePath };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `unexpected: ${msg.slice(0, 200)}` };
  } finally {
    cleanup();
  }
}

// ============================================================ helpers

/** Render a single editor layer to a transparent PNG at the given
 *  scale. Returns { bytes, width, height } or null if we can't render
 *  the layer kind (unknown / degenerate). */
async function renderLayerToPng(layer: EditorLayer, scale: number): Promise<{ bytes: Buffer; width: number; height: number } | null> {
  if (layer.kind === "image" || layer.kind === "overlay" || layer.kind === "banner") {
    const l = layer as ImageLayer;
    if (!l.url) return null;
    const w = Math.max(1, Math.round(l.width  * scale));
    const h = Math.max(1, Math.round(l.height * scale));
    // Fetch the asset (SVG data URLs decode fine via sharp too).
    const buf = await fetchAsBuffer(l.url);
    if (!buf) return null;
    let pipeline = sharp(buf, { failOn: "none" }).resize({ width: w, height: h, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
    if (l.rotation && l.rotation !== 0) {
      pipeline = pipeline.rotate(l.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
    }
    const out = await pipeline.png().toBuffer();
    const meta = await sharp(out).metadata();
    return { bytes: out, width: meta.width ?? w, height: meta.height ?? h };
  }

  if (layer.kind === "text") {
    const l = layer as TextLayer;
    const font = findFont(l.fontFamily);
    // Add extra pixels to the canvas when a shadow / outline extends
    // past the text baseline so the effects don't clip.
    const eff = l.effects ?? {};
    const shadowPad  = eff.shadow  ? Math.round((eff.shadow.blur + Math.abs(eff.shadow.offsetX) + Math.abs(eff.shadow.offsetY)) * scale) : 0;
    const outlinePad = eff.outline ? Math.round(eff.outline.width * scale) : 0;
    const highlightPad = eff.highlight ? Math.round(eff.highlight.padding * scale) : 0;
    const pad = Math.max(shadowPad, outlinePad, highlightPad);

    const w = Math.max(1, Math.round(l.width * scale)) + pad * 2;
    const fontPx = Math.max(6, Math.round(l.fontSize * scale));
    const weight = l.fontWeight >= 700 ? 900 : 400;
    const textAnchor = l.align === "right" ? "end" : l.align === "left" ? "start" : "middle";
    const textX = textAnchor === "middle" ? w / 2 : textAnchor === "end" ? w - 4 - pad : 4 + pad;
    const h = Math.round(fontPx * 1.4) + pad * 2;
    const baseline = fontPx + pad;
    const escaped = l.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // SVG defs: shadow filter + outline as paint-order stroke.
    const shadowFilter = eff.shadow
      ? `<filter id="tsh" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${eff.shadow.offsetX * scale}" dy="${eff.shadow.offsetY * scale}" stdDeviation="${(eff.shadow.blur * scale) / 2}" flood-color="${eff.shadow.color}"/></filter>`
      : "";
    const filterAttr = eff.shadow ? `filter="url(#tsh)"` : "";
    const strokeAttrs = eff.outline
      ? `stroke="${eff.outline.color}" stroke-width="${eff.outline.width * scale}" paint-order="stroke fill"`
      : "";
    // Highlight rect behind text — sized to the layer width.
    const highlightRect = eff.highlight
      ? `<rect x="${pad - eff.highlight.padding * scale}" y="${baseline - fontPx - eff.highlight.padding * 0.4 * scale}" width="${l.width * scale + eff.highlight.padding * 2 * scale}" height="${fontPx * 1.3 + eff.highlight.padding * 0.8 * scale}" rx="${fontPx * 0.15}" fill="${eff.highlight.color}"/>`
      : "";

    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${shadowFilter ? `<defs>${shadowFilter}</defs>` : ""}${highlightRect}<text x='${textX}' y='${baseline}' font-family='${font.cssFamily}' font-size='${fontPx}' font-weight='${weight}' fill='${l.color}' text-anchor='${textAnchor}' ${strokeAttrs} ${filterAttr}>${escaped}</text></svg>`;
    let pipeline = sharp(Buffer.from(svg));
    if (l.rotation && l.rotation !== 0) {
      pipeline = pipeline.rotate(l.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
    }
    const out = await pipeline.png().toBuffer();
    const meta = await sharp(out).metadata();
    return { bytes: out, width: meta.width ?? w, height: meta.height ?? h };
  }

  if (layer.kind === "shape") {
    const l = layer as ShapeLayer;
    const w = Math.max(1, Math.round(l.width  * scale));
    const h = Math.max(1, Math.round(l.height * scale));
    // fill=null on the ShapeLayer means transparent — emit
    // fill='none' so the SVG doesn't paint a background rectangle.
    // stroke='none' when the layer opts out of a stroke.
    const fillAttr   = l.fill   ? `fill='${l.fill}'`   : `fill='none'`;
    const strokeAttr = l.stroke ? `stroke='${l.stroke}' stroke-width='${l.strokeWidth}'` : "";
    // Arrows are stroke-only shapes — fall back to fill colour or
    // stroke colour or black so they always render visibly.
    const arrowColour = l.fill ?? l.stroke ?? "#0A0A0A";
    let inner = "";
    if      (l.shape === "rect")     inner = `<rect x='0' y='0' width='${w}' height='${h}' rx='8' ${fillAttr} ${strokeAttr}/>`;
    else if (l.shape === "circle")   inner = `<circle cx='${w / 2}' cy='${h / 2}' r='${Math.min(w, h) / 2}' ${fillAttr} ${strokeAttr}/>`;
    else if (l.shape === "triangle") inner = `<polygon points='${w / 2},0 ${w},${h} 0,${h}' ${fillAttr} ${strokeAttr}/>`;
    else if (l.shape === "star")     inner = starPolygon(w, h, l.fill ?? "#FFB300", l.stroke, l.strokeWidth);
    else if (l.shape === "arrow")    inner = arrowShape(w, h, arrowColour);
    else                             inner = `<rect x='0' y='0' width='${w}' height='${h}' ${fillAttr}/>`;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${inner}</svg>`;
    let pipeline = sharp(Buffer.from(svg));
    if (l.rotation && l.rotation !== 0) {
      pipeline = pipeline.rotate(l.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
    }
    const out = await pipeline.png().toBuffer();
    const meta = await sharp(out).metadata();
    return { bytes: out, width: meta.width ?? w, height: meta.height ?? h };
  }

  return null;
}

async function fetchAsBuffer(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith("data:")) {
      const m = /^data:[^,]+,(.+)$/.exec(url);
      if (!m) return null;
      // Decode data URL (base64 or utf-8 depending on encoding token).
      if (url.startsWith("data:image/svg+xml;utf8,")) {
        return Buffer.from(decodeURIComponent(m[1]), "utf8");
      }
      return Buffer.from(m[1], "base64");
    }
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function starPolygon(w: number, h: number, fill: string | null, stroke?: string | null, strokeWidth?: number): string {
  const cx = w / 2, cy = h / 2;
  const rOut = Math.min(w, h) / 2;
  const rIn  = rOut * 0.5;
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  const fillAttr   = fill   ? `fill='${fill}'`     : `fill='none'`;
  const strokeAttr = stroke ? `stroke='${stroke}' stroke-width='${strokeWidth ?? 3}'` : "";
  return `<polygon points='${pts.join(" ")}' ${fillAttr} ${strokeAttr}/>`;
}

function arrowShape(w: number, h: number, fill: string): string {
  const cy = h / 2;
  const barH = Math.max(4, Math.round(h * 0.25));
  const headW = Math.max(10, Math.round(w * 0.2));
  return `<polygon points='0,${cy - barH / 2} ${w - headW},${cy - barH / 2} ${w - headW},0 ${w},${cy} ${w - headW},${h} ${w - headW},${cy + barH / 2} 0,${cy + barH / 2}' fill='${fill}'/>`;
}

/** Watermark PNG that matches the image-editor top-left placement.
 *  Rendered at target video size so the coordinates line up. */
async function watermarkPng(width: number, height: number): Promise<{ bytes: Buffer; width: number; height: number }> {
  const short  = Math.min(width, height);
  const fontPx = Math.max(14, Math.min(48, Math.round(short * 0.045)));
  const padPx  = Math.max(8,  Math.round(fontPx * 0.6));
  const textW  = Math.round(WATERMARK_TEXT.length * fontPx * 0.52);
  const bgH    = Math.round(fontPx * 1.6);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'>
    <g>
      <rect x='${padPx}' y='${padPx}' width='${textW + padPx * 2}' height='${bgH}' rx='${Math.round(bgH / 2)}' fill='rgba(10,10,10,0.55)'/>
      <text x='${padPx * 2}' y='${padPx + bgH - Math.round(bgH * 0.3)}' font-family='system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' font-size='${fontPx}' font-weight='800' fill='#FFB300' letter-spacing='0.5'>${WATERMARK_TEXT}</text>
    </g>
  </svg>`;
  const bytes = await sharp(Buffer.from(svg)).png().toBuffer();
  return { bytes, width, height };
}

export const VIDEO_JOB_MAX_ATTEMPTS = MAX_ATTEMPTS;
