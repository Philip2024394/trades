// GET /api/nex1/workstation/repo-file
//
// NEX1 · Workstation · Sandboxed Repo Reader · 2026-09-17 (raw mode added).
// Founder-authorised.
//
// PURPOSE
//   Serves individual file contents + directory listings from an already-
//   onboarded corpus repo. Powers the LEFT preview panel of the workstation.
//   Binary files (images / gifs / icons / video / audio / pdf) can be streamed
//   as raw bytes with the correct Content-Type so the browser renders them
//   natively via <img> / <video> / <audio> / <embed>. Code files still come
//   back as JSON with text `content` for the code viewer.
//
// SANDBOX (unchanged)
//   · The `repo_id` must match /^[a-z0-9][a-z0-9._-]{0,63}$/i (no traversal).
//   · The resolved absolute path MUST lie inside data/nex-training-corpus/.
//   · Symlinks are rejected (fs.lstat isSymbolicLink).
//   · Text files: capped at 512 KB.
//   · Raw mode uses the SAME sandbox — every check runs before bytes stream.
//
// Query parameters:
//   repo_id · required · slug (see above)
//   path    · optional · repo-relative path · "" or missing → listing of root
//   raw     · optional · "1" to stream file bytes directly (binary preview)
//
// Response (200)
//   Directory: JSON  { ok: true, kind: "dir", entries: [...] }
//   File:      JSON  { ok: true, kind: "file", size, mime, language, content }
//   Binary JSON meta: { ok: true, kind: "binary", size, mime, raw_url }
//   Raw:       binary stream · Content-Type = detected mime
//   Not-found: 404 { ok: false, error }

import { NextResponse } from "next/server";
import * as path from "node:path";
import * as fs from "node:fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPO_ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const MAX_TEXT_BYTES = 512 * 1024;

function isInsideCorpus(target: string, corpus: string): boolean {
  const t = path.resolve(target);
  const c = path.resolve(corpus);
  return t === c || t.startsWith(c + path.sep);
}

const LANGUAGE_BY_EXT: Record<string, string> = {
  ".ts": "typescript", ".tsx": "tsx",
  ".js": "javascript", ".jsx": "jsx",
  ".mjs": "javascript", ".cjs": "javascript",
  ".json": "json", ".md": "markdown",
  ".css": "css", ".scss": "scss",
  ".html": "html", ".htm": "html",
  ".yml": "yaml", ".yaml": "yaml",
  ".toml": "toml", ".xml": "xml",
  ".sh": "shell", ".ps1": "powershell", ".bat": "batch",
  ".py": "python", ".rb": "ruby", ".go": "go", ".rs": "rust",
  ".sql": "sql", ".graphql": "graphql", ".gql": "graphql",
  ".vue": "vue", ".svelte": "svelte",
  ".gradle": "groovy", ".kt": "kotlin", ".java": "java", ".swift": "swift",
};

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".avif": "image/avif",
  ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".webm": "video/webm",
  ".pdf": "application/pdf", ".zip": "application/zip",
  ".ttf": "font/ttf", ".otf": "font/otf", ".woff": "font/woff", ".woff2": "font/woff2",
};

function detectMime(p: string): { mime: string; is_binary: boolean; language: string | null } {
  const ext = path.extname(p).toLowerCase();
  if (MIME_BY_EXT[ext]) return { mime: MIME_BY_EXT[ext], is_binary: true, language: null };
  const lang = LANGUAGE_BY_EXT[ext] ?? null;
  return { mime: "text/plain; charset=utf-8", is_binary: false, language: lang };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const repo_id = (url.searchParams.get("repo_id") ?? "").trim();
  const rel = (url.searchParams.get("path") ?? "").trim();
  const raw = url.searchParams.get("raw") === "1";
  if (!repo_id || !REPO_ID_RE.test(repo_id)) {
    return NextResponse.json({ ok: false, error: "repo_id_invalid" }, { status: 400 });
  }
  if (rel.includes("..") || rel.startsWith("/") || rel.startsWith("\\")) {
    return NextResponse.json({ ok: false, error: "path_traversal_rejected" }, { status: 400 });
  }

  const corpusDir = path.join(process.cwd(), "data", "nex-training-corpus");
  const repoRoot = path.join(corpusDir, repo_id);
  if (!fs.existsSync(repoRoot) || !fs.statSync(repoRoot).isDirectory()) {
    return NextResponse.json({ ok: false, error: "repo_not_found" }, { status: 404 });
  }
  const abs = rel ? path.join(repoRoot, rel) : repoRoot;
  if (!isInsideCorpus(abs, corpusDir)) {
    return NextResponse.json({ ok: false, error: "sandbox_violation" }, { status: 403 });
  }
  let lstat: fs.Stats;
  try { lstat = fs.lstatSync(abs); } catch {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  if (lstat.isSymbolicLink()) {
    return NextResponse.json({ ok: false, error: "symlink_rejected" }, { status: 403 });
  }

  // Raw mode · stream file bytes with correct Content-Type.
  // Used by the workstation preview panel for images / gifs / icons / video /
  // audio / pdf so the browser renders them via <img>/<video>/<audio>/<embed>.
  // All sandbox checks above have already passed. Only regular files, capped
  // at 25 MB to keep the dev server responsive.
  if (raw && lstat.isFile()) {
    const RAW_MAX_BYTES = 25 * 1024 * 1024;
    if (lstat.size > RAW_MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "file_too_large_for_raw", size: lstat.size, limit: RAW_MAX_BYTES }, { status: 413 });
    }
    const { mime } = detectMime(abs);
    const bytes = fs.readFileSync(abs);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(bytes.length),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Nex-Repo-Id": repo_id,
        "X-Nex-Execution-Source": "NEX1_NATIVE",
        "X-Nex-Zero-LLM": "true",
      },
    });
  }

  if (lstat.isDirectory()) {
    const excludeDirs = new Set([".git", "node_modules", "dist", "build", ".next", "coverage"]);
    let entries: string[] = [];
    try { entries = fs.readdirSync(abs); } catch {
      return NextResponse.json({ ok: false, error: "read_failed" }, { status: 500 });
    }
    const listing = entries
      .filter((n) => !excludeDirs.has(n))
      .map((name) => {
        const childAbs = path.join(abs, name);
        let s: fs.Stats;
        try { s = fs.lstatSync(childAbs); } catch { return null; }
        if (s.isSymbolicLink()) return null;
        return s.isDirectory()
          ? { name, kind: "dir" as const }
          : { name, kind: "file" as const, size: s.size };
      })
      .filter((x): x is { name: string; kind: "dir" } | { name: string; kind: "file"; size: number } => x !== null)
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    return NextResponse.json({
      ok: true,
      kind: "dir",
      repo_id,
      path: rel,
      entries: listing,
      source: "NEX1_NATIVE",
      zero_llm: true,
    });
  }

  if (lstat.isFile()) {
    const { mime, is_binary, language } = detectMime(abs);
    if (is_binary) {
      const rawUrl = `/api/nex1/workstation/repo-file?repo_id=${encodeURIComponent(repo_id)}&path=${encodeURIComponent(rel)}&raw=1`;
      const previewKind = mime.startsWith("image/")
        ? "image"
        : mime.startsWith("video/")
        ? "video"
        : mime.startsWith("audio/")
        ? "audio"
        : mime === "application/pdf"
        ? "pdf"
        : "binary_other";
      return NextResponse.json({
        ok: true,
        kind: "binary",
        preview_kind: previewKind,
        repo_id,
        path: rel,
        size: lstat.size,
        mime,
        raw_url: rawUrl,
        source: "NEX1_NATIVE",
        zero_llm: true,
      });
    }
    if (lstat.size > MAX_TEXT_BYTES) {
      return NextResponse.json({
        ok: true,
        kind: "file",
        repo_id,
        path: rel,
        size: lstat.size,
        mime,
        language,
        truncated: true,
        content: fs.readFileSync(abs, "utf8").slice(0, MAX_TEXT_BYTES),
        source: "NEX1_NATIVE",
        zero_llm: true,
      });
    }
    const content = fs.readFileSync(abs, "utf8");
    return NextResponse.json({
      ok: true,
      kind: "file",
      repo_id,
      path: rel,
      size: lstat.size,
      mime,
      language,
      truncated: false,
      content,
      source: "NEX1_NATIVE",
      zero_llm: true,
    });
  }

  return NextResponse.json({ ok: false, error: "unsupported_node_type" }, { status: 400 });
}
