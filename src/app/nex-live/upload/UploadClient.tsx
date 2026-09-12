"use client";

// src/app/nex-live/upload/UploadClient.tsx
//
// NEX LIVE · Phase C · Hardened upload flow
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase C
//
// End-to-end upload surface:
//   1. Select file (client-side pre-validation · MIME + size)
//   2. Preview (blob URL)
//   3. Metadata (title, mode)
//   4. Rights declaration (mandatory · via RightsDeclarationForm)
//   5. Publish (uploads bytes via AUTHENTICATED /api/nex-live/upload-file,
//      then registers declaration via /api/nex-live/upload)
//   6. Truthful stage transitions (§9 · §15)
//
// §16 immutable · Phase C · NO client-supplied owner_id. Server derives
//     ownership from the authenticated session. If the caller isn't
//     signed in, the upload endpoint returns 401 and we show an honest
//     "Sign in to upload" state.
// §33 · error messages are human-readable — never "HTTP 422".
// §10 · declaration ≠ verified · footer disclaims explicitly.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RightsDeclarationForm, isRightsDeclarationComplete, type RightsDeclarationValue } from "@/components/nex-app/live/RightsDeclarationForm";
import type { DeclaredRightsKind } from "@/lib/nex/live/rights-declaration";
import {
  validateUpload,
  MAX_UPLOAD_BYTES,
  ALLOWED_LIVE_UPLOAD_MIME,
} from "@/lib/nex/live/upload-validation";

type Mode = "MUSIC" | "VIDEO";

type UploadStage =
  | "PICK"                       // no file selected
  | "PREVIEW"                    // file selected, forms editable
  | "AUTHENTICATION_REQUIRED"    // server said not signed in
  | "UPLOADING"                  // bytes flowing to authenticated endpoint
  | "REGISTERING"                // POSTing rights declaration to /api/nex-live/upload
  | "PUBLISHED"                  // success
  | "UPLOAD_FAILED"
  | "REGISTER_FAILED";

function inferMode(file: File): Mode {
  return file.type.startsWith("audio/") ? "MUSIC" : "VIDEO";
}

/** Human-readable message per §33 · never expose HTTP status codes.
 *  Server returns error_code strings we translate here. */
function humanErrorMessage(error_code: string | null | undefined, fallback: string): string {
  switch (error_code) {
    case "AUTHENTICATION_REQUIRED":     return "Please sign in to publish to NEX Live.";
    case "UNSUPPORTED_MEDIA":           return "That file type isn't supported yet. Try MP4, WebM, MP3, WAV, or OGG.";
    case "FILE_TOO_LARGE":              return `That file is larger than the ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB limit.`;
    case "FILE_EMPTY":                  return "That file is empty. Try another.";
    case "FILENAME_TOO_LONG":           return "The filename is too long. Rename the file and try again.";
    case "FILENAME_UNSAFE":             return "That filename contains characters NEX can't process. Rename the file and try again.";
    case "INVALID_FILE":                return "We couldn't read that file. Try another.";
    case "MEDIA_NOT_FOUND":             return "This media is no longer available.";
    case "MEDIA_NOT_OWNED":             return "You aren't the owner of this media — publication refused.";
    case "MEDIA_NOT_READY":             return "The media is still being prepared. Try again in a moment.";
    case "MEDIA_STORAGE_UNAVAILABLE":   return "NEX storage is temporarily unavailable. Try again in a moment.";
    case "RIGHTS_DECLARATION_REQUIRED": return "A rights declaration is required to publish.";
    case "UPLOAD_FAILED":               return "The upload didn't finish. Try again.";
    case "PROCESSING_FAILED":           return "NEX couldn't process the media. Try another file.";
    default:                            return fallback || "Something went wrong. Try again.";
  }
}

export function UploadClient() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<Mode>("VIDEO");

  const [rights, setRights] = useState<RightsDeclarationValue>({
    declared_kind: "OWNER_DECLARED",
    declared_statement: "",
    supporting_reference: null,
    confirmed: false,
  });

  const [stage, setStage] = useState<UploadStage>("PICK");
  const [error, setError] = useState<string | null>(null);
  const [resultMediaId, setResultMediaId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Preview blob-URL cleanup
  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setMode(inferMode(file));
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const canPublish = useMemo(() => {
    if (stage !== "PREVIEW") return false;
    if (!file) return false;
    if (title.trim().length === 0) return false;
    if (!isRightsDeclarationComplete(rights)) return false;
    return true;
  }, [stage, file, title, rights]);

  const onPickFile = useCallback((f: File | null) => {
    setError(null);
    setResultMediaId(null);
    if (!f) {
      setFile(null);
      setStage("PICK");
      return;
    }
    // §2 · §10 · client-side pre-validation. Server ALSO validates.
    const v = validateUpload({
      mime_type: f.type || "application/octet-stream",
      byte_size: f.size,
      filename: f.name || null,
    });
    if (!v.ok) {
      setFile(null);
      setStage("PICK");
      setError(humanErrorMessage(v.error_code, v.reason));
      return;
    }
    setFile(f);
    setStage("PREVIEW");
    if (title.trim().length === 0) {
      setTitle(f.name.replace(/\.[^.]+$/, ""));
    }
  }, [title]);

  const onPublish = useCallback(async () => {
    if (!canPublish || !file) return;
    setError(null);
    setStage("UPLOADING");

    // Step 1 · upload bytes via AUTHENTICATED endpoint · §16 no client owner_id
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title);
    if (description) fd.append("description", description);
    // Deliberately NO fd.append("owner_id", ...) · server derives it.

    let media_id: string;
    try {
      const r = await fetch("/api/nex-live/upload-file", {
        method: "POST",
        body: fd,
        credentials: "same-origin",   // send Supabase auth cookies
      });
      const j = await r.json();
      if (r.status === 401) {
        setStage("AUTHENTICATION_REQUIRED");
        setError(humanErrorMessage("AUTHENTICATION_REQUIRED", ""));
        return;
      }
      if (!r.ok || !j?.media?.media_id) {
        setStage("UPLOAD_FAILED");
        setError(humanErrorMessage(j?.error_code, j?.error ?? ""));
        return;
      }
      media_id = String(j.media.media_id);
    } catch (e) {
      setStage("UPLOAD_FAILED");
      setError(humanErrorMessage(null, (e as Error).message));
      return;
    }

    // Step 2 · register NEX Live declaration
    // The server-side /api/nex-live/upload will independently verify
    // this authenticated user owns the media_id (§17 immutable).
    setStage("REGISTERING");
    try {
      const r = await fetch("/api/nex-live/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          media_id,
          mode,
          declared_kind: rights.declared_kind as DeclaredRightsKind,
          declared_statement: rights.declared_statement,
          supporting_reference: rights.supporting_reference,
        }),
      });
      const j = await r.json();
      if (r.status === 401) {
        setStage("AUTHENTICATION_REQUIRED");
        setError(humanErrorMessage("AUTHENTICATION_REQUIRED", ""));
        setResultMediaId(media_id);
        return;
      }
      if (!r.ok || !j?.ok) {
        setStage("REGISTER_FAILED");
        setError(humanErrorMessage(j?.error_code, j?.error ?? ""));
        setResultMediaId(media_id);
        return;
      }
      setStage("PUBLISHED");
      setResultMediaId(media_id);
    } catch (e) {
      setStage("REGISTER_FAILED");
      setError(humanErrorMessage(null, (e as Error).message));
      setResultMediaId(media_id);
    }
  }, [canPublish, file, title, description, mode, rights]);

  const stageLabel = (() => {
    switch (stage) {
      case "PICK":                     return "Choose a file to begin.";
      case "PREVIEW":                  return "Preview + rights declaration.";
      case "AUTHENTICATION_REQUIRED":  return "Sign in to NEX to publish.";
      case "UPLOADING":                return "Uploading…";
      case "REGISTERING":              return "Registering with NEX Live…";
      case "PUBLISHED":                return "Published.";
      case "UPLOAD_FAILED":            return "Upload failed.";
      case "REGISTER_FAILED":          return "Rights registration failed. Bytes are stored; re-declare to complete publication.";
    }
  })();

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/40">NEX Live</div>
          <div className="text-lg font-semibold">Upload</div>
        </div>
        <Link
          href="/nex-live"
          className="rounded-full bg-white/10 px-3 py-1.5 text-xs backdrop-blur hover:bg-white/20"
          data-testid="nex-live-upload-back"
        >
          ← NEX Live
        </Link>
      </header>

      <section className="mx-auto max-w-2xl px-4 py-6" data-testid="nex-live-upload-client">
        {/* Stage indicator · truthful (§15) */}
        <div className="mb-4 text-[11px] text-white/60" data-testid="nex-live-upload-stage" data-stage={stage}>
          {stageLabel}
        </div>

        {/* File input · always visible when not published */}
        {stage !== "PUBLISHED" && (
          <div className="mb-4">
            <label className="block">
              <span className="block text-[11px] uppercase tracking-wider text-white/50 mb-1">
                Media file
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,audio/*"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-white/80 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-white file:hover:bg-white/20"
                data-testid="nex-live-upload-file"
                disabled={stage === "UPLOADING" || stage === "REGISTERING"}
              />
            </label>
            <p className="mt-2 text-[10px] text-white/40">
              Prefer camera capture? <Link href="/nex-video/create" className="underline">Record via camera</Link>. NEX Live upload registers the file plus your rights declaration in one flow.
            </p>
          </div>
        )}

        {/* Preview */}
        {file && previewUrl && (
          <div className="mb-4 rounded-xl overflow-hidden bg-black border border-white/10" data-testid="nex-live-upload-preview">
            {file.type.startsWith("audio/") ? (
              <div className="flex items-center gap-3 p-4">
                <span className="text-3xl text-white/60">♪</span>
                <div className="min-w-0">
                  <div className="text-sm truncate">{file.name}</div>
                  <div className="text-[10px] text-white/40">{file.type}</div>
                </div>
              </div>
            ) : (
              <video src={previewUrl} controls className="w-full max-h-[50vh] bg-black" />
            )}
          </div>
        )}

        {/* Metadata */}
        {(stage === "PREVIEW" || stage === "UPLOAD_FAILED" || stage === "REGISTER_FAILED" || stage === "AUTHENTICATION_REQUIRED") && (
          <div className="mb-4 space-y-3">
            <label className="block">
              <span className="block text-[11px] uppercase tracking-wider text-white/50 mb-1">
                Title · required
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="w-full rounded-lg bg-black/50 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                data-testid="nex-live-upload-title"
              />
            </label>

            <label className="block">
              <span className="block text-[11px] uppercase tracking-wider text-white/50 mb-1">
                Description · optional
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={1000}
                className="w-full rounded-lg bg-black/50 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                data-testid="nex-live-upload-description"
              />
            </label>

            <div>
              <span className="block text-[11px] uppercase tracking-wider text-white/50 mb-1">Mode</span>
              <div className="flex gap-2">
                {(["MUSIC", "VIDEO"] as const).map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setMode(m)}
                    className={`rounded-full px-3 py-1.5 text-xs ${
                      mode === m ? "bg-white text-black" : "bg-white/10 text-white/80"
                    }`}
                    data-testid={`nex-live-upload-mode-${m}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Rights declaration */}
        {(stage === "PREVIEW" || stage === "REGISTER_FAILED") && (
          <div className="mb-4">
            <RightsDeclarationForm value={rights} onChange={setRights} />
          </div>
        )}

        {/* Publish button · disabled until declaration complete (§13) */}
        {(stage === "PREVIEW" || stage === "UPLOAD_FAILED" || stage === "REGISTER_FAILED" || stage === "AUTHENTICATION_REQUIRED") && (
          <button
            type="button"
            onClick={onPublish}
            disabled={!canPublish}
            className={`w-full rounded-full px-4 py-3 text-sm font-semibold ${
              canPublish ? "bg-white text-black hover:bg-slate-200" : "bg-white/10 text-white/40 cursor-not-allowed"
            }`}
            data-testid="nex-live-upload-publish"
            data-can-publish={canPublish ? "true" : "false"}
          >
            {canPublish ? "Publish to NEX Live" : "Complete the form to publish"}
          </button>
        )}

        {/* In-flight stages */}
        {(stage === "UPLOADING" || stage === "REGISTERING") && (
          <div className="mt-4 text-center text-white/70 text-sm" data-testid="nex-live-upload-inflight">
            {stage === "UPLOADING" ? "Uploading bytes…" : "Registering rights declaration…"}
          </div>
        )}

        {/* Published state */}
        {stage === "PUBLISHED" && (
          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-white" data-testid="nex-live-upload-published">
            <div className="text-sm font-semibold text-emerald-300">Published.</div>
            <div className="mt-1 text-xs text-white/70">
              Media {resultMediaId?.slice(0, 12)}… is registered with a rights declaration and will surface in the {mode} feed.
            </div>
            <div className="mt-3">
              <Link
                href="/nex-live"
                className="inline-block rounded-full bg-white text-black px-4 py-2 text-xs font-semibold"
              >
                Open NEX Live
              </Link>
            </div>
          </div>
        )}

        {/* Failure state */}
        {(stage === "UPLOAD_FAILED" || stage === "REGISTER_FAILED" || stage === "AUTHENTICATION_REQUIRED") && error && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-white" data-testid="nex-live-upload-failure">
            <div className="text-sm font-semibold text-rose-300">
              {stage === "UPLOAD_FAILED" ? "Upload failed" : "Rights registration failed"}
            </div>
            <div className="mt-1 text-[11px] text-white/70 break-all">{error}</div>
            {resultMediaId && (
              <div className="mt-1 text-[10px] text-white/40">Bytes stored under media_id {resultMediaId}. Retrying publishes the declaration.</div>
            )}
          </div>
        )}

        {/* Honesty footer · §10 */}
        <p className="mt-8 text-[10px] text-white/40">
          NEX records your declaration. NEX does not independently verify ownership.
        </p>
      </section>
    </main>
  );
}
