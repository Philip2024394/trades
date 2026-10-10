"use client";

// src/app/nexapp/nex-agent/VoiceRecorderOverlay.tsx
//
// Voice-OVER recorder · captures microphone audio via MediaRecorder API and
// uploads the resulting blob as an attachment (audio/webm or audio/mp4 based
// on browser). Founder gets a proper voice-over file for their project — not
// dictation (that's VoiceOverlay) but an actual recorded audio asset.

import { useEffect, useRef, useState } from "react";

export interface VoiceRecorderOverlayProps {
  readonly enabled: boolean;
  readonly onExit: () => void;
  readonly onRecorded: (attachment: {
    id: string; filename: string; mimeType: string; size: number;
    isImage: boolean; isText: boolean; isVideo: boolean; isAudio: boolean;
    previewUrl: string; uploadedAt: string;
  }) => void;
}

export function VoiceRecorderOverlay({ enabled, onExit, onRecorded }: VoiceRecorderOverlayProps) {
  const [state, setState] = useState<"idle" | "recording" | "paused" | "uploading" | "error">("idle");
  const [seconds, setSeconds] = useState<number>(0);
  const [level, setLevel] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("audio/webm");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const stopAll = () => {
    try { recorderRef.current?.stop(); } catch { /* */ }
    recorderRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try { void audioCtxRef.current?.close(); } catch { /* */ }
    audioCtxRef.current = null;
    analyserRef.current = null;
  };

  useEffect(() => {
    if (!enabled) { stopAll(); return; }
    return () => stopAll();
  }, [enabled]);

  const beginRecording = async () => {
    setError(null);
    setSeconds(0);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Pick a well-supported MIME type
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
      let picked = "";
      for (const c of candidates) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) { picked = c; break; }
      if (!picked) picked = "audio/webm";
      setMimeType(picked);

      const rec = new MediaRecorder(stream, { mimeType: picked });
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        if (chunksRef.current.length === 0) { setState("idle"); return; }
        setState("uploading");
        const blob = new Blob(chunksRef.current, { type: picked });
        const ext = picked.includes("mp4") ? "m4a" : picked.includes("ogg") ? "ogg" : "webm";
        const filename = `voice-over-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.${ext}`;
        try {
          const form = new FormData();
          form.append("file", new File([blob], filename, { type: picked.split(";")[0] }));
          form.append("uploaded_by", "founder");
          const r = await fetch("/api/nex/agent/upload", { method: "POST", body: form });
          const j = await r.json();
          if (j.ok) {
            onRecorded({
              id: j.id, filename: j.filename, mimeType: j.mimeType, size: j.size,
              isImage: !!j.isImage, isText: !!j.isText, isVideo: !!j.isVideo, isAudio: !!j.isAudio,
              previewUrl: j.previewUrl, uploadedAt: j.uploadedAt,
            });
            onExit();
          } else { setError(j.error ?? "upload failed"); setState("error"); }
        } catch (e) { setError(e instanceof Error ? e.message : "upload failed"); setState("error"); }
      };
      rec.start(200);
      recorderRef.current = rec;

      // Level meter
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(buf);
        let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i];
        setLevel(Math.min(1, (sum / buf.length) / 128));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      setState("recording");
    } catch (e) {
      setError(e instanceof Error ? e.message : "microphone denied");
      setState("error");
    }
  };

  const pauseResume = () => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state === "recording") { rec.pause(); setState("paused"); if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } }
    else if (rec.state === "paused") { rec.resume(); setState("recording"); timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000); }
  };

  const stopAndSave = () => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state !== "inactive") rec.stop();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  };

  const cancelRecording = () => {
    chunksRef.current = [];
    stopAll();
    setState("idle");
    onExit();
  };

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") cancelRecording(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  if (!enabled) return null;

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div style={{
      position: "fixed",
      right: 24, bottom: 24,
      zIndex: 220,
      background: "rgba(11, 18, 32, 0.97)",
      border: "1px solid rgba(249, 115, 22, 0.55)",
      borderRadius: 14,
      padding: 14,
      minWidth: 320, maxWidth: 420,
      boxShadow: "0 24px 60px rgba(0, 0, 0, 0.6)",
      color: "#F9FAFB",
    }} role="dialog" aria-label="Voice-over recorder">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 14, height: 14, borderRadius: 7,
          background: state === "recording" ? "#EF4444" : state === "paused" ? "#F59E0B" : "#94A3B8",
          boxShadow: state === "recording" ? "0 0 10px rgba(239, 68, 68, 0.85)" : "none",
          animation: state === "recording" ? "naw-actor-pulse 1s ease-in-out infinite" : "none",
        }} />
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--naw-orange, #F97316)" }}>
          Voice-over recorder
        </span>
        <button
          type="button"
          onClick={cancelRecording}
          className="naw-btn-secondary"
          style={{ marginLeft: "auto", fontSize: 11 }}
        >✕ Cancel</button>
      </div>

      <div style={{
        background: "rgba(0,0,0,0.35)",
        border: "1px solid rgba(148,163,184,0.18)",
        borderRadius: 10, padding: "12px 14px",
        display: "flex", alignItems: "center", gap: 12,
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", color: state === "recording" ? "#EF4444" : "#F9FAFB", minWidth: 84 }}>{mmss}</div>
        <div style={{ flex: 1, height: 8, background: "rgba(148,163,184,0.12)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${Math.round(level * 100)}%`,
            background: level > 0.85 ? "#EF4444" : level > 0.5 ? "#F59E0B" : "#22C55E",
            transition: "width 60ms linear",
          }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {state === "idle" && (
          <button type="button" className="naw-btn-primary" onClick={beginRecording} style={{ flex: 1, minWidth: 120 }}>● Start</button>
        )}
        {(state === "recording" || state === "paused") && (
          <>
            <button type="button" className="naw-btn-secondary" onClick={pauseResume} style={{ flex: 1 }}>
              {state === "recording" ? "❚❚ Pause" : "▶ Resume"}
            </button>
            <button type="button" className="naw-btn-primary" onClick={stopAndSave} style={{ flex: 1 }}>■ Stop + Save</button>
          </>
        )}
        {state === "uploading" && (
          <div style={{ flex: 1, textAlign: "center", fontSize: 12, color: "var(--naw-cyan, #22D3EE)" }}>Uploading recording…</div>
        )}
        {state === "error" && (
          <div style={{ flex: 1, fontSize: 11, color: "var(--naw-danger, #EF4444)" }}>{error}</div>
        )}
      </div>
      <div style={{ marginTop: 8, fontSize: 9, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>
        {mimeType} · saved as .{mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm"} · Escape to cancel · content scanner runs on upload
      </div>
    </div>
  );
}
