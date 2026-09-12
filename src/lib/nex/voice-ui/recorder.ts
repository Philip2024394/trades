// src/lib/nex/voice-ui/recorder.ts
//
// Founder Phase 21 · P21-1 · Browser voice recording + VAD.
//
// Client-only module (uses navigator, AudioContext, MediaRecorder).
// Provides:
//   · createRecorder({ onLevel, onSilence, silenceMs, minMs })
//       .start() · .stop() → { blob, base64, duration_ms }
//   · Simple RMS-based voice activity detection · fires onSilence
//     after `silenceMs` of continuous low-energy audio, but only after
//     at least `minMs` of recording has elapsed (avoids stopping on
//     the initial ramp-up).
//
// No frameworks · vanilla Web APIs. Fails gracefully if MediaRecorder
// isn't available in the browser.

export interface RecorderHandle {
  start(): Promise<void>;
  stop(): Promise<{ blob: Blob; base64: string; duration_ms: number; mime_type: string } | null>;
  isRecording(): boolean;
  cancel(): void;
}

export interface RecorderOpts {
  onLevel?: (rms: number) => void;         // 0..1 running RMS
  onSilence?: () => void;                   // called when VAD trips
  silenceMs?: number;                       // default 900ms
  minMs?: number;                           // default 800ms
  silenceThreshold?: number;                // default 0.02 · RMS units
  mimePreference?: string[];
}

const _DEFAULT_MIMES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function pickMime(preferred?: string[]): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const list = preferred?.length ? preferred : _DEFAULT_MIMES;
  for (const m of list) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return undefined;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 32_768;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.slice(i, i + chunk) as unknown as number[]);
  }
  return btoa(bin);
}

export function createRecorder(opts: RecorderOpts = {}): RecorderHandle {
  const silenceMs = opts.silenceMs ?? 900;
  const minMs = opts.minMs ?? 800;
  const silenceThreshold = opts.silenceThreshold ?? 0.02;

  let mediaRecorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let rafId: number | null = null;
  let chunks: Blob[] = [];
  let recording = false;
  let cancelled = false;
  let startedAt = 0;
  let lastLoudAt = 0;
  let mimeType: string | undefined;

  function tick() {
    if (!analyser || !recording) return;
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    opts.onLevel?.(rms);
    const now = performance.now();
    if (rms > silenceThreshold) lastLoudAt = now;
    // VAD trigger
    const elapsed = now - startedAt;
    if (elapsed > minMs && now - lastLoudAt > silenceMs) {
      opts.onSilence?.();
      // caller is responsible for calling stop()
    }
    rafId = requestAnimationFrame(tick);
  }

  return {
    isRecording: () => recording,
    async start() {
      if (recording) return;
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("mediadevices_unavailable");
      }
      mimeType = pickMime(opts.mimePreference);
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorder.ondataavailable = (ev) => { if (ev.data.size > 0) chunks.push(ev.data); };
      mediaRecorder.start();
      recording = true;
      cancelled = false;
      startedAt = performance.now();
      lastLoudAt = startedAt;
      audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      rafId = requestAnimationFrame(tick);
    },
    async stop() {
      if (!recording || !mediaRecorder) return null;
      recording = false;
      const stopped = new Promise<void>((resolve) => {
        if (!mediaRecorder) return resolve();
        mediaRecorder.onstop = () => resolve();
      });
      mediaRecorder.stop();
      await stopped;
      if (rafId != null) cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
      try { await audioCtx?.close(); } catch { /* ignore */ }
      const blob = new Blob(chunks, { type: mimeType ?? "audio/webm" });
      if (cancelled || blob.size === 0) return null;
      const base64 = await blobToBase64(blob);
      const duration_ms = Math.round(performance.now() - startedAt);
      return { blob, base64, duration_ms, mime_type: mimeType ?? "audio/webm" };
    },
    cancel() {
      cancelled = true;
      recording = false;
      if (rafId != null) cancelAnimationFrame(rafId);
      try { mediaRecorder?.stop(); } catch { /* ignore */ }
      stream?.getTracks().forEach((t) => t.stop());
      try { audioCtx?.close(); } catch { /* ignore */ }
    },
  };
}
