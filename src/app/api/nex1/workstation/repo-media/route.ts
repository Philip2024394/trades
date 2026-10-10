// GET /api/nex1/workstation/repo-media
//
// NEX1 · Workstation · Media Search · 2026-09-17.
// Founder-authorised.
//
// PURPOSE
//   Lists every image / video / audio / html / pdf file in a corpus repo
//   with its size · mime · repo-relative path · raw URL. Powers the workstation
//   backend so the LEFT preview panel (the app-phone iframe) can be pointed at
//   any repo media file without walking the tree by hand.
//
// SANDBOX
//   · repo_id must match /^[a-z0-9][a-z0-9._-]{0,63}$/i
//   · walk stays inside data/nex-training-corpus/{repo_id}/
//   · symlinks skipped
//   · excludes .git · node_modules · dist · build · .next · coverage
//   · zero code execution · zero LLM · deterministic
//
// Query:
//   repo_id · required · slug
//   kinds   · optional · comma-separated of image,video,audio,html,pdf,other
//             (default: all)
//   limit   · optional · int · cap (default 500 · max 2000)
//
// Response (200):
//   { ok, source: "NEX1_NATIVE", zero_llm: true, repo_id, total, kinds:
//     { image: [...], video: [...], audio: [...], html: [...], pdf: [...] } }
//   Each entry: { path, size, mime, kind, raw_url, preview_url? }

import { NextResponse } from "next/server";
import * as path from "node:path";
import * as fs from "node:fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPO_ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;
const EXCLUDE_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", "coverage", ".turbo", ".cache", ".vercel"]);

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".avif", ".bmp", ".tiff"]);
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv"]);
const AUDIO_EXTS = new Set([".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac"]);
const HTML_EXTS  = new Set([".html", ".htm"]);
const PDF_EXTS   = new Set([".pdf"]);

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".avif": "image/avif", ".bmp": "image/bmp", ".tiff": "image/tiff",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
  ".m4v": "video/x-m4v", ".avi": "video/x-msvideo", ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
  ".flac": "audio/flac", ".m4a": "audio/mp4", ".aac": "audio/aac",
  ".html": "text/html", ".htm": "text/html",
  ".pdf": "application/pdf",
};

type Kind = "image" | "video" | "audio" | "html" | "pdf" | "other";

interface Entry {
  readonly path: string;
  readonly size: number;
  readonly mime: string;
  readonly kind: Kind;
  readonly raw_url: string;
  readonly preview_url?: string;
}

function classify(ext: string): Kind {
  if (IMAGE_EXTS.has(ext)) return "image";
  if (VIDEO_EXTS.has(ext)) return "video";
  if (AUDIO_EXTS.has(ext)) return "audio";
  if (HTML_EXTS.has(ext))  return "html";
  if (PDF_EXTS.has(ext))   return "pdf";
  return "other";
}

function walk(root: string, repoRoot: string, maxEntries: number): Entry[] {
  const out: Entry[] = [];
  const stack: string[] = [root];
  while (stack.length && out.length < maxEntries) {
    const cur = stack.pop()!;
    let lstat: fs.Stats;
    try { lstat = fs.lstatSync(cur); } catch { continue; }
    if (lstat.isSymbolicLink()) continue;
    if (lstat.isDirectory()) {
      const base = path.basename(cur);
      if (EXCLUDE_DIRS.has(base)) continue;
      let entries: string[] = [];
      try { entries = fs.readdirSync(cur); } catch { continue; }
      for (const e of entries) stack.push(path.join(cur, e));
      continue;
    }
    if (!lstat.isFile()) continue;
    const ext = path.extname(cur).toLowerCase();
    const kind = classify(ext);
    if (kind === "other") continue; // only media kinds enumerated
    const rel = path.relative(repoRoot, cur).replace(/\\/g, "/");
    const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
    out.push({
      path: rel,
      size: lstat.size,
      mime,
      kind,
      raw_url: `/api/nex1/workstation/repo-file?repo_id=${encodeURIComponent(path.basename(repoRoot))}&path=${encodeURIComponent(rel)}&raw=1`,
      // For HTML we can't drop a repo file straight into an iframe (scripts
      // in the repo would execute in our origin). The preview page renders
      // the HTML inside a sandboxed iframe with `sandbox=""`.
      preview_url: kind === "html"
        ? `/nex1/workstation-live/repo-preview?repo_id=${encodeURIComponent(path.basename(repoRoot))}&path=${encodeURIComponent(rel)}`
        : undefined,
    });
  }
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const repo_id = (url.searchParams.get("repo_id") ?? "").trim();
  if (!repo_id || !REPO_ID_RE.test(repo_id)) {
    return NextResponse.json({ ok: false, error: "repo_id_invalid" }, { status: 400 });
  }
  const kindsParam = (url.searchParams.get("kinds") ?? "").trim().toLowerCase();
  const filter: Set<Kind> | null = kindsParam
    ? new Set(kindsParam.split(",").map((s) => s.trim()).filter(Boolean) as Kind[])
    : null;
  const limitParam = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(limitParam) ? limitParam : DEFAULT_LIMIT));

  const corpusDir = path.join(process.cwd(), "data", "nex-training-corpus");
  const repoRoot = path.join(corpusDir, repo_id);
  if (!fs.existsSync(repoRoot) || !fs.statSync(repoRoot).isDirectory()) {
    return NextResponse.json({ ok: false, error: "repo_not_found" }, { status: 404 });
  }

  const all = walk(repoRoot, repoRoot, limit);
  const filtered = filter ? all.filter((e) => filter.has(e.kind)) : all;

  const buckets: Record<Kind, Entry[]> = { image: [], video: [], audio: [], html: [], pdf: [], other: [] };
  for (const e of filtered) buckets[e.kind].push(e);
  for (const k of Object.keys(buckets) as Kind[]) buckets[k].sort((a, b) => a.path.localeCompare(b.path));

  return NextResponse.json({
    ok: true,
    source: "NEX1_NATIVE",
    zero_llm: true,
    repo_id,
    total: filtered.length,
    kinds: {
      image: buckets.image,
      video: buckets.video,
      audio: buckets.audio,
      html:  buckets.html,
      pdf:   buckets.pdf,
    },
  });
}
