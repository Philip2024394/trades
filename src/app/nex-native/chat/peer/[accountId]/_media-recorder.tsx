"use client";

// src/app/nex-native/chat/peer/[accountId]/_media-recorder.tsx
//
// Live in-browser Camera / Video / Voice recorder for desktop.
// -----------------------------------------------------------
// The file-input capture flow (_media-capture.tsx) is honored by
// mobile browsers (native camera / video / voice memo apps open),
// but desktop browsers ignore `capture` and always show a file
// picker instead. This component runs the alternative path:
//
//   1. Request permission via navigator.mediaDevices.getUserMedia
//   2. Show a live preview inside a modal
//   3. Capture (single photo) OR record (video/voice) via
//      MediaRecorder · start / stop controls
//   4. Show captured preview · Send or Retry
//   5. Send · convert Blob → File · fire the upload action
//
// Fallback · when getUserMedia or MediaRecorder isn't available in
// the browser, the modal auto-falls back to the hidden file input
// via the passed openFileInput callback so users always have a way
// to attach media.

import * as React from "react";
import { createPortal } from "react-dom";

export type RecorderKind = "camera" | "video" | "voice";

const NEX = {
  panel: "#03101D",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  cyan: "#009FEF",
  cyanSoft: "rgba(0,159,239,0.65)",
  orange: "#FF7800",
  red: "#FF3355",
};

interface Props {
  kind: RecorderKind;
  onClose: () => void;
  /** Fires once the user hits Send · caller wires this to a form
   *  submission bound to the upload Server Action. Receives the
   *  captured File. */
  onSend: (file: File) => void;
  /** Fallback · when the browser lacks getUserMedia / MediaRecorder,
   *  we surface a button that triggers the classic file-input path. */
  onFallbackToFileInput: () => void;
}

export function MediaRecorderModal({
  kind,
  onClose,
  onSend,
  onFallbackToFileInput,
}: Props) {
  const [mounted, setMounted] = React.useState(false);
  const [status, setStatus] = React.useState<
    "requesting" | "ready" | "recording" | "captured" | "denied" | "unsupported"
  >("requesting");
  const [error, setError] = React.useState<string | null>(null);
  const [captured, setCaptured] = React.useState<{
    url: string;
    file: File;
  } | null>(null);
  const [elapsedMs, setElapsedMs] = React.useState(0);

  const streamRef = React.useRef<MediaStream | null>(null);
  const previewVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const startAtRef = React.useRef<number>(0);
  const tickerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => setMounted(true), []);

  // Escape closes.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Request the media stream on mount · constraints depend on kind.
  React.useEffect(() => {
    let cancelled = false;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }
    const constraints: MediaStreamConstraints =
      kind === "voice"
        ? { audio: true, video: false }
        : { audio: kind === "video", video: { facingMode: "user" } };
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus("denied");
      });
    return () => {
      cancelled = true;
      // Cleanup on unmount · stop all tracks so the camera light
      // turns off immediately.
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {}
      }
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, [kind]);

  // Attach the stream to the preview video element once ready.
  React.useEffect(() => {
    if (status !== "ready" || !streamRef.current) return;
    if (kind === "voice") return; // no video preview for voice
    const el = previewVideoRef.current;
    if (!el) return;
    el.srcObject = streamRef.current;
    el.play().catch(() => {
      /* autoplay may be blocked · user gesture will resume it */
    });
  }, [status, kind]);

  const takePhoto = () => {
    const stream = streamRef.current;
    const video = previewVideoRef.current;
    if (!stream || !video) return;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        const url = URL.createObjectURL(blob);
        setCaptured({ url, file });
        setStatus("captured");
      },
      "image/jpeg",
      0.9,
    );
  };

  const pickMimeType = (mode: "video" | "audio") => {
    if (typeof MediaRecorder === "undefined") return "";
    const candidates =
      mode === "video"
        ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
        : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    for (const t of candidates) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return "";
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    if (typeof MediaRecorder === "undefined") {
      setStatus("unsupported");
      return;
    }
    const mimeType = pickMimeType(kind === "voice" ? "audio" : "video");
    const rec = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    recorderRef.current = rec;
    chunksRef.current = [];
    rec.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    rec.onstop = () => {
      const type =
        rec.mimeType || (kind === "voice" ? "audio/webm" : "video/webm");
      const ext = type.includes("mp4")
        ? kind === "voice"
          ? "m4a"
          : "mp4"
        : type.includes("ogg")
          ? "ogg"
          : "webm";
      const blob = new Blob(chunksRef.current, { type });
      const filenameBase = kind === "voice" ? "voice-note" : "video";
      const file = new File([blob], `${filenameBase}-${Date.now()}.${ext}`, {
        type,
      });
      const url = URL.createObjectURL(blob);
      setCaptured({ url, file });
      setStatus("captured");
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
    rec.start(200); // 200 ms chunks · smooth incremental data
    startAtRef.current = Date.now();
    setElapsedMs(0);
    tickerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startAtRef.current);
    }, 100);
    setStatus("recording");
  };

  const stopRecording = () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  };

  const retry = () => {
    if (captured?.url) URL.revokeObjectURL(captured.url);
    setCaptured(null);
    setElapsedMs(0);
    setStatus(streamRef.current ? "ready" : "requesting");
  };

  const send = () => {
    if (!captured) return;
    onSend(captured.file);
    // Caller will close/redirect · we just cleanup the object URL.
    URL.revokeObjectURL(captured.url);
  };

  if (!mounted) return null;

  const title =
    kind === "camera"
      ? "Take a photo"
      : kind === "video"
        ? "Record a video"
        : "Record a voice note";

  return createPortal(
    <>
      <style>{`
        @keyframes nex-recorder-in {
          from { opacity: 0; transform: translate(-50%, -46%) scale(0.96); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes nex-rec-blink {
          0%, 55% { opacity: 1; }
          56%, 100% { opacity: 0.25; }
        }
      `}</style>
      <div
        role="button"
        aria-label="Close recorder"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2,9,20,0.78)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          zIndex: 200,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(440px, calc(100vw - 32px))",
          maxHeight: "calc(100vh - 64px)",
          padding: "20px 20px 18px",
          background:
            "linear-gradient(180deg, rgba(6,15,28,0.94) 0%, rgba(3,10,20,0.96) 100%)",
          border: `1px solid ${NEX.cyanSoft}`,
          borderRadius: 24,
          boxShadow:
            "0 32px 80px rgba(0,0,0,0.7), 0 0 60px rgba(0,159,239,0.16), inset 0 1px 0 rgba(255,255,255,0.06)",
          zIndex: 201,
          color: NEX.text,
          fontFamily: "inherit",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          animation: "nex-recorder-in 220ms cubic-bezier(.2,.7,.2,1) both",
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: NEX.cyan,
            textAlign: "center",
            fontWeight: 600,
          }}
        >
          {title}
        </div>

        {/* Preview surface · video for camera/video · glyph for voice */}
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: kind === "voice" ? "3 / 1" : "4 / 3",
            borderRadius: 16,
            background: "#000",
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
          }}
        >
          {kind !== "voice" && status !== "captured" && (
            <video
              ref={previewVideoRef}
              muted
              playsInline
              autoPlay
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                // Mirror the preview when using the front camera so it
                // reads naturally (writing text won't reverse, users
                // move the way they expect).
                transform: "scaleX(-1)",
              }}
            />
          )}
          {kind === "voice" && status !== "captured" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                color: NEX.textDim,
              }}
            >
              <span aria-hidden style={{ fontSize: 46 }}>
                🎙️
              </span>
              <span style={{ fontSize: 12, letterSpacing: "0.06em" }}>
                {status === "recording"
                  ? "Listening…"
                  : status === "ready"
                    ? "Mic ready"
                    : "Requesting mic access…"}
              </span>
            </div>
          )}
          {status === "captured" && captured && (
            <>
              {kind === "camera" && (
                <img
                  src={captured.url}
                  alt="Captured"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    background: "#000",
                    transform: "scaleX(-1)",
                  }}
                />
              )}
              {kind === "video" && (
                <video
                  src={captured.url}
                  controls
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              )}
              {kind === "voice" && (
                <audio
                  src={captured.url}
                  controls
                  style={{ width: "80%" }}
                />
              )}
            </>
          )}
          {status === "requesting" && (
            <div style={{ color: NEX.textDim, fontSize: 12 }}>
              Requesting camera access…
            </div>
          )}
          {status === "denied" && (
            <div
              style={{
                padding: 20,
                textAlign: "center",
                color: NEX.textDim,
                fontSize: 12,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ color: NEX.red, fontWeight: 700 }}>
                Permission denied
              </div>
              <div>{error ?? "Grant camera access to record."}</div>
              <button
                type="button"
                onClick={onFallbackToFileInput}
                style={btnGhost}
              >
                Upload a file instead
              </button>
            </div>
          )}
          {status === "unsupported" && (
            <div
              style={{
                padding: 20,
                textAlign: "center",
                color: NEX.textDim,
                fontSize: 12,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ color: NEX.orange, fontWeight: 700 }}>
                Recorder not supported
              </div>
              <button
                type="button"
                onClick={onFallbackToFileInput}
                style={btnGhost}
              >
                Upload a file instead
              </button>
            </div>
          )}
          {status === "recording" && (
            <div
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                background: "rgba(0,0,0,0.55)",
                borderRadius: 999,
                color: "#fff",
                fontSize: 11,
                letterSpacing: "0.08em",
                fontWeight: 600,
                zIndex: 2,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: NEX.red,
                  animation: "nex-rec-blink 900ms ease-in-out infinite",
                }}
              />
              REC {formatDuration(elapsedMs)}
            </div>
          )}
        </div>

        {/* Action row · depends on status + kind */}
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {status === "ready" && kind === "camera" && (
            <>
              <button type="button" onClick={onClose} style={btnGhost}>
                Cancel
              </button>
              <button type="button" onClick={takePhoto} style={btnPrimary}>
                📸 Capture
              </button>
            </>
          )}
          {status === "ready" && kind !== "camera" && (
            <>
              <button type="button" onClick={onClose} style={btnGhost}>
                Cancel
              </button>
              <button type="button" onClick={startRecording} style={btnRecord}>
                ● Start
              </button>
            </>
          )}
          {status === "recording" && (
            <>
              <button type="button" onClick={onClose} style={btnGhost}>
                Cancel
              </button>
              <button type="button" onClick={stopRecording} style={btnPrimary}>
                ⏹ Stop
              </button>
            </>
          )}
          {status === "captured" && (
            <>
              <button type="button" onClick={retry} style={btnGhost}>
                Retry
              </button>
              <button type="button" onClick={send} style={btnPrimary}>
                ✓ Send
              </button>
            </>
          )}
          {(status === "denied" || status === "unsupported") && (
            <button type="button" onClick={onClose} style={btnGhost}>
              Close
            </button>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const btnGhost: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  background: "rgba(0,0,0,0.35)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: NEX.text,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const btnPrimary: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 10,
  background:
    "linear-gradient(180deg, rgba(0,159,239,0.4) 0%, rgba(0,159,239,0.28) 100%)",
  border: `1px solid ${NEX.cyanSoft}`,
  color: NEX.text,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  letterSpacing: "0.02em",
};

const btnRecord: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 10,
  background:
    "linear-gradient(180deg, rgba(255,51,85,0.4) 0%, rgba(255,51,85,0.28) 100%)",
  border: `1px solid ${NEX.red}`,
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  letterSpacing: "0.02em",
};
