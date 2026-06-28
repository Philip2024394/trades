"use client";

// Tradesperson intro-video uploader. We host the file ourselves —
// the tradesperson records on their phone or laptop and uploads
// straight to Supabase Storage. Plays on the home page of their app.
//
// Flow:
//   1. User picks a file → client-side guards (MIME, size, duration)
//   2. POST /api/trade-off/video-upload-url for a signed upload URL
//   3. PUT the file directly to Supabase Storage with XHR progress
//   4. POST /api/trade-off/video-save to persist the URL on the listing
//
// Direct-to-Storage upload bypasses Vercel's 4.5 MB API body limit and
// keeps Hammerex's existing image-upload pipeline pattern.

import { useRef, useState } from "react";

const MAX_BYTES = 30 * 1024 * 1024; // 30 MB
const MAX_DURATION_SEC = 60;
const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

type Status =
  | { kind: "idle" }
  | { kind: "validating" }
  | { kind: "uploading"; pct: number }
  | { kind: "saving" }
  | { kind: "done"; url: string }
  | { kind: "error"; msg: string };

export function VideoUploadInput({
  listingId,
  editToken,
  initialVideoUrl,
  initialCaption,
  onSaved
}: {
  listingId: string;
  editToken: string;
  initialVideoUrl?: string | null;
  initialCaption?: string | null;
  onSaved?: (url: string, caption: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [currentUrl, setCurrentUrl] = useState<string>(initialVideoUrl ?? "");
  const [caption, setCaption] = useState<string>(initialCaption ?? "");

  function reset() {
    setStatus({ kind: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }

  async function probeDuration(file: File): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      const url = URL.createObjectURL(file);
      v.src = url;
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(v.duration);
      };
      v.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Couldn't read this video — try a different file."));
      };
    });
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus({ kind: "validating" });

    if (!ALLOWED_TYPES.includes(file.type)) {
      setStatus({
        kind: "error",
        msg: "Only MP4, MOV or WebM — pick a different file."
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus({
        kind: "error",
        msg: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — keep it under 30 MB.`
      });
      return;
    }

    let duration: number;
    try {
      duration = await probeDuration(file);
    } catch (err) {
      setStatus({
        kind: "error",
        msg: err instanceof Error ? err.message : "Could not read the file."
      });
      return;
    }
    if (duration > MAX_DURATION_SEC + 0.5) {
      setStatus({
        kind: "error",
        msg: `That clip is ${Math.round(duration)}s — trim it to 60s or less.`
      });
      return;
    }

    // 1. Request a signed upload URL
    let signed: {
      upload_url: string;
      upload_token: string;
      public_url: string;
      content_type: string;
    };
    try {
      const res = await fetch("/api/trade-off/video-upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          edit_token: editToken,
          content_type: file.type,
          size_bytes: file.size
        })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Upload setup failed.");
      signed = json;
    } catch (err) {
      setStatus({
        kind: "error",
        msg: err instanceof Error ? err.message : "Upload setup failed."
      });
      return;
    }

    // 2. Direct PUT to Supabase Storage with progress.
    // Supabase signed URLs require the `x-upsert` header to be true so
    // replays (same path with a fresh signed URL) succeed, and they
    // reject custom `cache-control` headers — both were the cause of
    // the previous 400 on PUT. The token is already encoded in
    // signedUrl so no extra Authorization header is needed.
    setStatus({ kind: "uploading", pct: 0 });
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signed.upload_url, true);
        xhr.setRequestHeader("content-type", file.type);
        xhr.setRequestHeader("x-upsert", "true");
        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          const pct = Math.round((e.loaded / e.total) * 100);
          setStatus({ kind: "uploading", pct });
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else {
            // Surface the storage server's message so we know whether
            // it's a token / path / permission / size problem.
            let detail = "";
            try {
              const body = xhr.responseText ?? "";
              detail = body.length > 0 ? ` — ${body.slice(0, 200)}` : "";
            } catch {
              /* responseText sometimes unavailable cross-origin */
            }
            reject(new Error(`Upload failed (${xhr.status})${detail}`));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload."));
        xhr.send(file);
      });
    } catch (err) {
      setStatus({
        kind: "error",
        msg: err instanceof Error ? err.message : "Upload failed."
      });
      return;
    }

    // 3. Persist the URL on the listing
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/trade-off/video-save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          edit_token: editToken,
          video_url: signed.public_url,
          video_caption: caption
        })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Save failed.");
      setCurrentUrl(signed.public_url);
      setStatus({ kind: "done", url: signed.public_url });
      onSaved?.(signed.public_url, caption);
    } catch (err) {
      setStatus({
        kind: "error",
        msg: err instanceof Error ? err.message : "Save failed."
      });
    }
  }

  async function onSaveCaption() {
    if (!currentUrl) return;
    setStatus({ kind: "saving" });
    const res = await fetch("/api/trade-off/video-save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        listing_id: listingId,
        edit_token: editToken,
        video_url: currentUrl,
        video_caption: caption
      })
    });
    const json = await res.json();
    if (!json.ok) {
      setStatus({ kind: "error", msg: json.error ?? "Save failed." });
      return;
    }
    setStatus({ kind: "done", url: currentUrl });
    onSaved?.(currentUrl, caption);
  }

  // Remove the saved intro video from the listing. Persists video_url
  // as empty string so the public profile's video block hides itself.
  // The Storage file is left in place — cheaper than DELETE during
  // an edit session and we can sweep orphans server-side later.
  async function onRemoveVideo() {
    if (!currentUrl) return;
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/trade-off/video-save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          edit_token: editToken,
          video_url: "",
          video_caption: ""
        })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Could not remove the video.");
      setCurrentUrl("");
      setCaption("");
      setStatus({ kind: "idle" });
      onSaved?.("", "");
    } catch (err) {
      setStatus({
        kind: "error",
        msg: err instanceof Error ? err.message : "Could not remove the video."
      });
    }
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-muted">
        Intro video
      </p>
      <p className="mt-1 text-xs text-brand-muted">
        Record on your phone or laptop, then upload here — we host it
        for you on the home page of your app. 60 seconds max. MP4,
        MOV or WebM, 30 MB cap.
      </p>

      {/* Best-shape guidance — the tile that visitors see on your
          profile page is a fixed widescreen (16:9) frame. Portrait
          videos play full-screen inside the lightbox at their native
          shape (no cropping), but the preview tile crops them. */}
      <div
        className="mt-3 rounded-lg border-l-2 border-brand-accent bg-brand-accent/10 px-3 py-2 text-[11px] leading-relaxed text-brand-text"
        role="note"
      >
        <p className="font-extrabold uppercase tracking-wider text-brand-muted">
          What size works best
        </p>
        <ul className="mt-1.5 grid gap-0.5">
          <li>
            <span className="font-bold">Best (recommended):</span>{" "}
            Landscape 16:9 — film with your phone held{" "}
            <span className="font-bold">sideways</span>. Typical
            resolutions: <span className="font-mono">1920×1080</span>{" "}
            or <span className="font-mono">1280×720</span>.
          </li>
          <li>
            <span className="font-bold">OK:</span> Square 1:1 — still
            fills the profile tile, no cropping.
          </li>
          <li>
            <span className="font-bold">Allowed but gets cropped on the tile:</span>{" "}
            Portrait 9:16 (phone-style) — plays full-shape inside the
            lightbox when tapped, but the preview tile on your profile
            is widescreen, so the top + bottom of the video get
            hidden until someone taps to play.
          </li>
        </ul>
      </div>

      {currentUrl ? (
        <div className="mt-3 overflow-hidden rounded-xl bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={currentUrl}
            controls
            playsInline
            className="block aspect-video w-full bg-black"
          />
        </div>
      ) : (
        <div className="mt-3 flex aspect-video w-full items-center justify-center rounded-xl border-2 border-dashed border-brand-line bg-brand-bg text-xs text-brand-muted">
          No video uploaded yet.
        </div>
      )}

      <label className="mt-3 block">
        <span className="text-xs font-bold uppercase tracking-widest text-brand-muted">
          One-line caption (optional)
        </span>
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, 60))}
          placeholder="e.g. Level-5 skim example"
          maxLength={60}
          className="mt-1.5 h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          className="sr-only"
          onChange={onPick}
          disabled={status.kind === "uploading" || status.kind === "saving"}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={status.kind === "uploading" || status.kind === "saving"}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-xs font-extrabold text-neutral-900 transition active:scale-[0.97] disabled:opacity-50"
          style={{ background: "#FFB300" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {currentUrl ? "Replace video" : "Upload video"}
        </button>
        {currentUrl && (
          <button
            type="button"
            onClick={onRemoveVideo}
            disabled={status.kind === "uploading" || status.kind === "saving"}
            className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-xs font-extrabold text-white shadow-sm transition active:scale-[0.97] disabled:opacity-50"
            style={{ background: "#8B0000" }}
          >
            Remove video
          </button>
        )}
        {currentUrl && status.kind === "idle" && caption !== (initialCaption ?? "") && (
          <button
            type="button"
            onClick={onSaveCaption}
            className="inline-flex h-11 items-center justify-center rounded-lg border-2 border-[#FFB300] bg-transparent px-4 text-xs font-extrabold text-[#FFB300] transition active:scale-[0.97]"
          >
            Save caption
          </button>
        )}
      </div>

      {status.kind === "validating" && (
        <p className="mt-3 text-xs text-brand-muted">Checking the file…</p>
      )}
      {status.kind === "uploading" && (
        <div className="mt-3">
          <p className="text-xs font-bold text-brand-text">
            Uploading… {status.pct}%
          </p>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-brand-line">
            <div
              className="h-full transition-all"
              style={{ width: `${status.pct}%`, background: "#FFB300" }}
            />
          </div>
        </div>
      )}
      {status.kind === "saving" && (
        <p className="mt-3 text-xs text-brand-muted">Saving to your profile…</p>
      )}
      {status.kind === "done" && (
        <p className="mt-3 text-xs font-bold text-green-700">
          Saved. Customers can now play it on your profile.
        </p>
      )}
      {status.kind === "error" && (
        <div className="mt-3 flex items-start gap-2 text-xs text-red-600">
          <span className="font-bold">Error:</span>
          <span>{status.msg}</span>
          <button
            type="button"
            onClick={reset}
            className="ml-auto text-[#FFB300] underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
