"use client";

// src/app/nexapp/nex-agent/VoiceOverlay.tsx
//
// Voice dictation · uses Web Speech API SpeechRecognition · live transcript
// streams into the prompt textarea · waveform visualiser powered by
// AudioContext + AnalyserNode.
//
// Discipline:
//   - Falls back gracefully if browser doesn't support (banner appears)
//   - Never records audio to disk · never sends audio to server
//   - Stop on Escape or click outside the orb

import { useEffect, useRef, useState } from "react";

interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
}
// Minimal SR type · avoids `any`
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: ArrayLike<ArrayLike<SpeechRecognitionResult>>; resultIndex: number }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export interface VoiceOverlayProps {
  readonly enabled: boolean;
  readonly onExit: () => void;
  readonly onTranscript: (text: string, appendMode: boolean) => void;
}

export function VoiceOverlay({ enabled, onExit, onTranscript }: VoiceOverlayProps) {
  const [supported, setSupported] = useState<boolean>(true);
  const [listening, setListening] = useState<boolean>(false);
  const [interim, setInterim] = useState<string>("");
  const [committed, setCommitted] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Guard against SSR + unsupported browsers
  useEffect(() => {
    if (!enabled) return;
    const SR = typeof window !== "undefined" ? (window.SpeechRecognition ?? window.webkitSpeechRecognition) : null;
    if (!SR) { setSupported(false); return; }
    setSupported(true);
  }, [enabled]);

  // Start recognition + audio graph on enter
  useEffect(() => {
    if (!enabled) return;
    const SR = typeof window !== "undefined" ? (window.SpeechRecognition ?? window.webkitSpeechRecognition) : null;
    if (!SR) return;

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-GB";
    rec.onresult = (e) => {
      let interimBuf = "";
      let finalBuf = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i] as unknown as { 0: SpeechRecognitionResult; isFinal: boolean };
        const t = res[0].transcript;
        if (res.isFinal) finalBuf += t + " ";
        else interimBuf += t;
      }
      if (finalBuf) {
        setCommitted((c) => (c + " " + finalBuf).trim());
        onTranscript(finalBuf.trim(), true);
      }
      setInterim(interimBuf);
    };
    rec.onerror = (e) => setError(`speech error · ${e.error}`);
    rec.onend = () => { setListening(false); };
    recognitionRef.current = rec;

    // Waveform via getUserMedia
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        analyserRef.current = analyser;
        drawWave();
        rec.start();
        setListening(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "microphone denied");
      }
    })();

    return () => {
      try { rec.stop(); } catch { /* */ }
      recognitionRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      try { void audioCtxRef.current?.close(); } catch { /* */ }
      audioCtxRef.current = null;
      analyserRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const drawWave = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) { rafRef.current = requestAnimationFrame(drawWave); return; }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== canvas.clientWidth * dpr) {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.scale(dpr, dpr);
    }
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(buf);
    ctx.clearRect(0, 0, w, h);
    const bars = 24;
    const step = Math.floor(buf.length / bars);
    for (let i = 0; i < bars; i++) {
      const v = buf[i * step] / 255;
      const barH = Math.max(2, v * h * 0.9);
      const x = (i / bars) * w + 2;
      const y = h - barH;
      ctx.fillStyle = i % 3 === 0 ? "#22D3EE" : i % 3 === 1 ? "#F97316" : "#F59E0B";
      ctx.fillRect(x, y, (w / bars) - 3, barH);
    }
    rafRef.current = requestAnimationFrame(drawWave);
  };

  // Escape to exit
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onExit(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, onExit]);

  if (!enabled) return null;

  // Simple string · no useMemo needed. Keeping this OUTSIDE any hooks means
  // the hook count for VoiceOverlay is fixed at exactly 14 on every render.
  const preview = (committed + (interim ? " " + interim : "")).trim().slice(-140);

  return (
    <div style={{
      position: "fixed",
      right: 24, bottom: 24,
      zIndex: 210,
      background: "rgba(11, 18, 32, 0.96)",
      border: "1px solid rgba(34, 211, 238, 0.5)",
      borderRadius: 14,
      padding: 14,
      minWidth: 320, maxWidth: 460,
      boxShadow: "0 24px 60px rgba(0, 0, 0, 0.55)",
      color: "#F9FAFB",
    }}
      role="dialog" aria-label="Voice mode"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 12, height: 12, borderRadius: 6,
          background: listening ? "#22C55E" : "#94A3B8",
          boxShadow: listening ? "0 0 8px rgba(34, 197, 94, 0.7)" : "none",
          animation: listening ? "naw-actor-pulse 1.4s ease-in-out infinite" : "none",
        }} />
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {listening ? "Listening" : supported ? "Starting…" : "Not supported"}
        </span>
        <button
          type="button"
          onClick={onExit}
          className="naw-btn-secondary"
          style={{ marginLeft: "auto", fontSize: 11 }}
        >✕ Stop</button>
      </div>

      {supported ? (
        <>
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: 64, borderRadius: 8, background: "rgba(0,0,0,0.35)", display: "block" }}
          />
          <div style={{
            marginTop: 8, minHeight: 44,
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(148,163,184,0.18)",
            borderRadius: 8, padding: "8px 10px",
            fontSize: 12, color: "#F9FAFB", lineHeight: 1.4,
            fontFamily: "Inter, system-ui, sans-serif",
          }}>
            {preview ? preview : <span style={{ color: "#94A3B8" }}>Start speaking · transcription appears here and streams into the prompt</span>}
          </div>
          {error && <div style={{ marginTop: 6, fontSize: 10, color: "#EF4444" }}>{error}</div>}
          <div style={{ marginTop: 6, fontSize: 9, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>
            Web Speech API · en-GB · continuous · interim results · escape to stop
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: "#F59E0B" }}>
          This browser doesn&apos;t support Web Speech API. Chrome + Edge + Safari work best. Firefox needs a flag.
        </div>
      )}
    </div>
  );
}
