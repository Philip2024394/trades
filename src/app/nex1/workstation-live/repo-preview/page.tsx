// src/app/nex1/workstation-live/repo-preview/page.tsx
//
// NEX1 · Workstation · Sandboxed Repo Preview · 2026-09-17.
// Founder-authorised.
//
// PURPOSE
//   Renders a repo file inside the LEFT app-phone iframe on the primary
//   workstation. Chosen file kinds:
//     · html  → full-viewport sandboxed iframe (srcdoc + sandbox="")
//     · image → centered <img>
//     · video → centered <video controls>
//     · audio → centered <audio controls>
//     · pdf   → full-viewport <embed>
//   Other types render as a "not previewable" note with a link to raw bytes.
//
// SANDBOX
//   · repo_id must match /^[a-z0-9][a-z0-9._-]{0,63}$/i.
//   · path must resolve inside data/nex-training-corpus/{repo_id}/.
//   · Symlinks and traversal rejected.
//   · HTML rendered with `sandbox=""` (empty allow-list · no scripts, no
//     forms, no popups, no top-nav) so repo HTML cannot escape our origin.
//   · No LLM · no network · no code execution.
//
// URL: /nex1/workstation-live/repo-preview?repo_id=X&path=Y

import * as fs from "node:fs";
import * as path from "node:path";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REPO_ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2 MB

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".avif", ".bmp"]);
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov", ".m4v"]);
const AUDIO_EXTS = new Set([".mp3", ".wav", ".ogg", ".m4a"]);
const PDF_EXTS   = new Set([".pdf"]);
const HTML_EXTS  = new Set([".html", ".htm"]);

interface PreviewProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function resolveSafe(repo_id: string, rel: string): { corpus: string; abs: string } | null {
  if (!REPO_ID_RE.test(repo_id)) return null;
  if (rel.includes("..") || rel.startsWith("/") || rel.startsWith("\\")) return null;
  const corpus = path.join(process.cwd(), "data", "nex-training-corpus");
  const repoRoot = path.join(corpus, repo_id);
  const abs = rel ? path.join(repoRoot, rel) : repoRoot;
  const t = path.resolve(abs);
  const c = path.resolve(corpus);
  if (t !== c && !t.startsWith(c + path.sep)) return null;
  return { corpus, abs };
}

const shellStyle: React.CSSProperties = {
  margin: 0, padding: 0,
  width: "100%", height: "100vh",
  background: "#0b1220",
  color: "#e2e8f0",
  fontFamily: "Inter, system-ui, sans-serif",
  display: "flex", alignItems: "center", justifyContent: "center",
  overflow: "hidden",
};

export default async function RepoPreviewPage({ searchParams }: PreviewProps) {
  const sp = await searchParams;
  const repo_id = String(sp.repo_id ?? "").trim();
  const rel     = String(sp.path ?? "").trim();
  const resolved = resolveSafe(repo_id, rel);
  if (!resolved) notFound();

  let lstat: fs.Stats;
  try { lstat = fs.lstatSync(resolved.abs); } catch { notFound(); }
  if (lstat.isSymbolicLink() || !lstat.isFile()) notFound();

  const ext = path.extname(resolved.abs).toLowerCase();
  const rawUrl = `/api/nex1/workstation/repo-file?repo_id=${encodeURIComponent(repo_id)}&path=${encodeURIComponent(rel)}&raw=1`;

  if (HTML_EXTS.has(ext)) {
    let content = "";
    try {
      if (lstat.size > MAX_HTML_BYTES) {
        content = fs.readFileSync(resolved.abs, "utf8").slice(0, MAX_HTML_BYTES);
      } else {
        content = fs.readFileSync(resolved.abs, "utf8");
      }
    } catch {
      notFound();
    }
    return (
      <div style={shellStyle}>
        <iframe
          srcDoc={content}
          sandbox=""
          title={`Repo preview · ${repo_id} · ${rel}`}
          data-nex-repo-preview="html"
          style={{ width: "100%", height: "100%", border: 0, background: "#ffffff" }}
        />
      </div>
    );
  }

  if (IMAGE_EXTS.has(ext)) {
    return (
      <div style={shellStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={rawUrl}
          alt={rel}
          data-nex-repo-preview="image"
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
        />
      </div>
    );
  }

  if (VIDEO_EXTS.has(ext)) {
    return (
      <div style={shellStyle}>
        <video
          src={rawUrl}
          controls
          data-nex-repo-preview="video"
          style={{ maxWidth: "100%", maxHeight: "100%", background: "#000" }}
        />
      </div>
    );
  }

  if (AUDIO_EXTS.has(ext)) {
    return (
      <div style={shellStyle}>
        <audio src={rawUrl} controls data-nex-repo-preview="audio" style={{ width: "90%" }} />
      </div>
    );
  }

  if (PDF_EXTS.has(ext)) {
    return (
      <div style={shellStyle}>
        <embed
          src={rawUrl}
          type="application/pdf"
          data-nex-repo-preview="pdf"
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    );
  }

  return (
    <div style={{ ...shellStyle, flexDirection: "column", gap: 8, fontSize: 12 }}>
      <div style={{ opacity: 0.7 }}>{rel}</div>
      <div style={{ opacity: 0.5 }}>Not previewable in the phone · {ext || "no extension"} · {lstat.size} bytes</div>
      <a href={rawUrl} target="_blank" rel="noreferrer" style={{ color: "#38bdf8", fontSize: 11 }}>Open raw bytes ↗</a>
    </div>
  );
}
