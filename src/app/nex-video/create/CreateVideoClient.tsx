"use client";

// NEX Video Feed · Create · client · Philip 2026-08-27 (Stage 2.5).
//
// Simplest possible camera → record → preview → publish flow.
// - getUserMedia({ video, audio })
// - MediaRecorder → WebM
// - Max 60 s (auto-stop)
// - Preview after recording
// - Public/Private + title + description
// - POST multipart to /api/nex-media/upload
// - After publish → navigate to /nex-video
// - Optional: POST /api/nex-media/thumbnail/[id] for poster (fire-and-forget)

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const OWNER_KEY = "nex-video-owner";
const MAX_RECORD_MS = 60_000;

function getOwnerId(): string {
  if (typeof window === "undefined") return "ssr";
  let o = localStorage.getItem(OWNER_KEY);
  if (!o) {
    o = `nex-user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(OWNER_KEY, o);
  }
  return o;
}

type Phase = "idle" | "requesting" | "ready" | "recording" | "preview" | "uploading" | "done" | "error";

export function CreateVideoClient() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("public");
  const [recordedMs, setRecordedMs] = useState(0);
  const [uploadPercent, setUploadPercent] = useState<number>(0);

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const previewBlobRef = useRef<Blob | null>(null);

  useEffect(() => { setOwnerId(getOwnerId()); }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setPhase("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 720 }, height: { ideal: 1280 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
        previewVideoRef.current.muted = true;
        void previewVideoRef.current.play();
      }
      setPhase("ready");
    } catch (e) {
      setError(`Camera access denied: ${(e as Error).message}`);
      setPhase("error");
    }
  }, []);

  const chooseMime = (): string => {
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];
    for (const c of candidates) if (MediaRecorder.isTypeSupported(c)) return c;
    return "";
  };

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mime = chooseMime();
    const rec = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined);
    recorderRef.current = rec;
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const finalMime = rec.mimeType || "video/webm";
      const blob = new Blob(chunksRef.current, { type: finalMime });
      previewBlobRef.current = blob;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = URL.createObjectURL(blob);
      // Detach live camera and swap the video element to the recorded blob for preview.
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = null;
        previewVideoRef.current.src = previewUrlRef.current;
        previewVideoRef.current.muted = false;
        previewVideoRef.current.controls = true;
        void previewVideoRef.current.play().catch(() => {});
      }
      setPhase("preview");
    };
    rec.start(500);
    startedAtRef.current = Date.now();
    setRecordedMs(0);
    setPhase("recording");
    // Auto-stop at MAX_RECORD_MS
    stopTimerRef.current = setTimeout(() => stopRecording(), MAX_RECORD_MS);
    // Update elapsed ms display
    const tick = setInterval(() => {
      if (rec.state !== "recording") { clearInterval(tick); return; }
      setRecordedMs(Date.now() - startedAtRef.current);
    }, 100);
  }, []);

  const stopRecording = useCallback(() => {
    if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    // Also stop the live tracks — we don't need the camera while previewing.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const discardAndReset = useCallback(() => {
    if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null; }
    previewBlobRef.current = null;
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
      previewVideoRef.current.removeAttribute("src");
      previewVideoRef.current.controls = false;
    }
    setPhase("idle");
    setRecordedMs(0);
  }, []);

  const publish = useCallback(async () => {
    const blob = previewBlobRef.current;
    if (!blob) return;
    setPhase("uploading");
    setUploadPercent(0);
    try {
      const fd = new FormData();
      const ext = (blob.type.includes("mp4")) ? "mp4" : "webm";
      fd.append("file", new File([blob], `nex-video-${Date.now()}.${ext}`, { type: blob.type }));
      fd.append("owner_id", ownerId);
      fd.append("object_type", "video");
      fd.append("visibility", visibility);
      fd.append("context_type", "feed");
      if (title) fd.append("title", title);
      if (description) fd.append("description", description);
      fd.append("duration_ms", String(recordedMs));

      // XHR (for upload progress) instead of fetch (which streams differently)
      const result = await new Promise<{ ok: boolean; media?: { media_id: string; object_type: string }; error?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/nex-media/upload");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadPercent(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { reject(new Error(`bad response · ${xhr.status}`)); }
        };
        xhr.onerror = () => reject(new Error("network error"));
        xhr.send(fd);
      });

      if (!result.ok) throw new Error(result.error ?? "upload failed");

      // Fire-and-forget poster generation (server best-effort · non-blocking).
      if (result.media) {
        void fetch(`/api/nex-media/thumbnail/${result.media.media_id}`, { method: "POST" }).catch(() => {});
      }

      setPhase("done");
      // Small pause so the user sees "published", then redirect to feed.
      setTimeout(() => { router.push("/nex-video"); }, 900);
    } catch (e) {
      setError(`Upload failed: ${(e as Error).message}`);
      setPhase("error");
    }
  }, [ownerId, title, description, visibility, recordedMs, router]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const secondsRemaining = Math.max(0, Math.ceil((MAX_RECORD_MS - recordedMs) / 1000));

  return (
    <div className="fixed inset-0 flex flex-col bg-black text-white select-none">
      <header className="flex items-center justify-between p-3 text-sm">
        <Link href="/nex-video" className="rounded bg-white/10 px-3 py-1.5 hover:bg-white/20">← Feed</Link>
        <div className="font-semibold">＋ Create · NEX Video</div>
        <div className="text-xs text-slate-400">as <code>{ownerId.slice(0, 20)}</code></div>
      </header>

      {/* Camera / preview canvas */}
      <div className="flex-1 relative flex items-center justify-center bg-slate-900">
        <video
          ref={previewVideoRef}
          className="max-h-full max-w-full object-contain"
          playsInline
        />
        {phase === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-black/60 backdrop-blur-sm">
            <p className="mb-4 text-lg">Tap Start to open your camera</p>
            <button onClick={startCamera} className="rounded-full bg-white text-black px-6 py-3 text-base font-semibold hover:bg-slate-200">Start camera</button>
            <p className="mt-4 max-w-sm text-xs text-slate-400">Max 60 s · WebM · uploads to NEX Media Foundation · you own the video (ADR-0118 · phone delete does NOT delete the NEX copy)</p>
          </div>
        )}
        {phase === "recording" && (
          <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-sm font-semibold">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" /> REC · {secondsRemaining}s left
          </div>
        )}
        {phase === "uploading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
            <p className="mb-3 text-base">Uploading to NEX Media…</p>
            <div className="w-64 h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white transition-all" style={{ width: `${uploadPercent}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-300">{uploadPercent}%</p>
          </div>
        )}
        {phase === "done" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-800/80">
            <p className="text-xl font-bold">✓ Published</p>
            <p className="mt-2 text-sm text-slate-100">Redirecting to feed…</p>
          </div>
        )}
        {phase === "error" && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-900/80 p-6 text-center">
            <p className="mb-2 text-lg font-semibold">Something went wrong</p>
            <p className="text-sm">{error}</p>
            <button onClick={discardAndReset} className="mt-4 rounded bg-white text-black px-4 py-2 text-sm">Try again</button>
          </div>
        )}
      </div>

      {/* Controls */}
      <footer className="p-3">
        {phase === "ready" && (
          <div className="flex justify-center">
            <button
              onClick={startRecording}
              className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-500 ring-4 ring-white/40"
              aria-label="Record"
            />
          </div>
        )}
        {phase === "recording" && (
          <div className="flex justify-center">
            <button
              onClick={stopRecording}
              className="h-16 w-16 rounded-lg bg-red-600 hover:bg-red-500 ring-4 ring-white/40"
              aria-label="Stop"
            />
          </div>
        )}
        {phase === "preview" && (
          <div className="mx-auto max-w-md space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-300">
                Title
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100}
                  className="mt-1 w-full rounded bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:bg-white/20"
                  placeholder="Optional" />
              </label>
              <label className="text-xs text-slate-300">
                Visibility
                <select value={visibility} onChange={(e) => setVisibility(e.target.value as "public" | "private")}
                  className="mt-1 w-full rounded bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:bg-white/20">
                  <option value="public">Public · appears in NEX Video</option>
                  <option value="private">Private · only me</option>
                </select>
              </label>
            </div>
            <label className="block text-xs text-slate-300">
              Description
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2}
                className="mt-1 w-full rounded bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:bg-white/20"
                placeholder="Optional" />
            </label>
            <div className="flex gap-2">
              <button onClick={discardAndReset}
                className="flex-1 rounded border border-white/20 px-3 py-2 text-sm hover:bg-white/10">Discard</button>
              <button onClick={publish}
                className="flex-1 rounded bg-white text-black px-3 py-2 text-sm font-semibold hover:bg-slate-200">
                Publish · {(recordedMs / 1000).toFixed(1)}s
              </button>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
