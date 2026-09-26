"use client";

// src/app/nex-native/create-account/face/_face-scan-client.tsx
//
// NEX face-scan client component.
// -------------------------------------------------------------------------
// Owns the visible face-scan experience:
//   · Round blue rim (SVG stroke)
//   · Pixel-head silhouette that gently bobs (idle only)
//   · Vertical scan line that runs top → bottom repeatedly
//   · Live camera preview via navigator.mediaDevices.getUserMedia,
//     clipped to a circle inside the rim
//   · MediaPipe face detection: prompts "MOVE LEFT/RIGHT/UP/DOWN" or
//     "COME CLOSER" / "MOVE BACK" under the ring if the face is not
//     centred, and shows a 3 · 2 · 1 countdown in the ring centre once
//     the face has been aligned for ~800ms
//   · WebAuthn platform-authenticator ceremony via @simplewebauthn/browser
//     kicks in only once the countdown completes
//
// The camera preview + face detection is the NEX visual layer. The
// actual biometric verification is delegated to the OS platform
// authenticator (Windows Hello, Touch ID, Face ID, Android Face Unlock).
// NEX never sees the user's face data — MediaPipe runs entirely in the
// browser and never leaves the device.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

interface Props {
  mode: "enroll" | "assert";
}

type ScanState =
  | { kind: "idle" }
  | { kind: "camera_starting" }
  | { kind: "camera_running" }
  | { kind: "webauthn_prompting" }
  | { kind: "success"; redirect?: string }
  | { kind: "error"; message: string };

type AlignmentHint =
  | "NO FACE DETECTED"
  | "MULTIPLE FACES"
  | "MOVE LEFT"
  | "MOVE RIGHT"
  | "MOVE UP"
  | "MOVE DOWN"
  | "COME CLOSER"
  | "MOVE BACK";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.55)",
  cyanFaint: "rgba(0, 175, 255, 0.18)",
  orange: "#FF7200",
};

// How many consecutive aligned frames before starting the countdown.
// At ~200ms per detection tick that is roughly 800ms of steady alignment.
const ALIGNED_FRAMES_TO_HOLD = 4;

// CDN URLs for MediaPipe · loaded once, cached by the browser.
const MP_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10/wasm";
const MP_FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";

export function FaceScanClient({ mode }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<FaceDetector | null>(null);
  const detectionRafRef = useRef<number | null>(null);
  const alignedFramesRef = useRef(0);
  const lastDetectTsRef = useRef<number>(0);
  const [state, setState] = useState<ScanState>({ kind: "idle" });
  const [alignment, setAlignment] = useState<AlignmentHint | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [webauthnSupported, setWebauthnSupported] = useState(true);

  useEffect(() => {
    setWebauthnSupported(
      typeof window !== "undefined" &&
        typeof window.PublicKeyCredential !== "undefined",
    );
  }, []);

  const stopDetectionLoop = useCallback(() => {
    if (detectionRafRef.current !== null) {
      cancelAnimationFrame(detectionRafRef.current);
      detectionRafRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    stopDetectionLoop();
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [stopDetectionLoop]);

  // Clean up detector + camera on unmount.
  useEffect(() => {
    return () => {
      stopCamera();
      if (detectorRef.current) {
        try { detectorRef.current.close(); } catch { /* noop */ }
        detectorRef.current = null;
      }
    };
  }, [stopCamera]);

  // One detection tick · called from the animation-frame loop.
  const runDetectionFrame = useCallback(() => {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (!video || !detector) {
      detectionRafRef.current = requestAnimationFrame(runDetectionFrame);
      return;
    }
    // Only detect every ~180ms so the CPU stays cool and the countdown
    // isn't jittery on slower devices.
    const now = performance.now();
    if (now - lastDetectTsRef.current < 180 || video.readyState < 2) {
      detectionRafRef.current = requestAnimationFrame(runDetectionFrame);
      return;
    }
    lastDetectTsRef.current = now;

    let hint: AlignmentHint | null = null;
    try {
      const result = detector.detectForVideo(video, now);
      if (result.detections.length === 0) {
        hint = "NO FACE DETECTED";
      } else if (result.detections.length > 1) {
        hint = "MULTIPLE FACES";
      } else {
        const bbox = result.detections[0]!.boundingBox;
        if (bbox) {
          const vw = video.videoWidth || 1;
          const vh = video.videoHeight || 1;
          const cx = bbox.originX + bbox.width / 2;
          const cy = bbox.originY + bbox.height / 2;
          const widthRatio = bbox.width / vw;
          const xRatio = cx / vw;
          const yRatio = cy / vh;

          // Distance thresholds
          if (widthRatio < 0.25) hint = "COME CLOSER";
          else if (widthRatio > 0.72) hint = "MOVE BACK";
          // Horizontal alignment (mirrored: raw-right → user's-left in preview,
          // so if face is on raw-right the user needs to move right physically)
          else if (xRatio > 0.6) hint = "MOVE RIGHT";
          else if (xRatio < 0.4) hint = "MOVE LEFT";
          // Vertical
          else if (yRatio > 0.6) hint = "MOVE UP";
          else if (yRatio < 0.4) hint = "MOVE DOWN";
        }
      }
    } catch {
      // Detection can throw transiently while the model is warming up.
      // Treat as no-face rather than crashing the loop.
      hint = "NO FACE DETECTED";
    }

    if (hint === null) {
      alignedFramesRef.current += 1;
      setAlignment(null);
      // Once we've been aligned for a stable window, kick off the
      // countdown. The countdown state advances via its own effect.
      if (alignedFramesRef.current >= ALIGNED_FRAMES_TO_HOLD) {
        setCountdown((prev) => (prev === null ? 3 : prev));
      }
    } else {
      alignedFramesRef.current = 0;
      setAlignment(hint);
      // Any misalignment cancels an in-progress countdown.
      setCountdown(null);
    }

    detectionRafRef.current = requestAnimationFrame(runDetectionFrame);
  }, []);

  // WebAuthn ceremony · runs at countdown = 0.
  const runWebAuthn = useCallback(async () => {
    stopDetectionLoop();
    setState({ kind: "webauthn_prompting" });
    try {
      if (mode === "enroll") {
        const startRes = await fetch("/api/nex-native/auth/webauthn/enroll-start", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!startRes.ok) throw new Error(await startRes.text().catch(() => `enroll-start ${startRes.status}`));
        const startJson = (await startRes.json()) as {
          options: PublicKeyCredentialCreationOptionsJSON;
        };
        const attestation = await startRegistration({ optionsJSON: startJson.options });
        const finishRes = await fetch("/api/nex-native/auth/webauthn/enroll-finish", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            response: attestation,
            deviceLabel:
              typeof navigator !== "undefined" ? navigator.platform || null : null,
          }),
        });
        if (!finishRes.ok) throw new Error(await finishRes.text().catch(() => `enroll-finish ${finishRes.status}`));
        setState({ kind: "success", redirect: "/nex-native/settings/profile" });
      } else {
        const startRes = await fetch("/api/nex-native/auth/webauthn/assert-start", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!startRes.ok) throw new Error(await startRes.text().catch(() => `assert-start ${startRes.status}`));
        const startJson = (await startRes.json()) as {
          options: PublicKeyCredentialRequestOptionsJSON;
        };
        const assertion = await startAuthentication({ optionsJSON: startJson.options });
        const finishRes = await fetch("/api/nex-native/auth/webauthn/assert-finish", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ response: assertion }),
        });
        if (!finishRes.ok) throw new Error(await finishRes.text().catch(() => `assert-finish ${finishRes.status}`));
        const finishJson = (await finishRes.json()) as { redirect?: string };
        setState({ kind: "success", redirect: finishJson.redirect ?? "/nex-native/conversations" });
      }
    } catch (e) {
      setState({
        kind: "error",
        message:
          (e instanceof Error ? e.message : String(e)).slice(0, 240) ||
          "Face sign-in failed · try password sign in.",
      });
    } finally {
      stopCamera();
    }
  }, [mode, stopCamera, stopDetectionLoop]);

  // Countdown ticker · 3 → 2 → 1 → run WebAuthn.
  useEffect(() => {
    if (countdown === null) return;
    const timer = window.setTimeout(() => {
      if (countdown > 1) {
        setCountdown(countdown - 1);
      } else {
        setCountdown(null);
        void runWebAuthn();
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, runWebAuthn]);

  const startScan = useCallback(async () => {
    setState({ kind: "camera_starting" });
    setAlignment(null);
    setCountdown(null);
    alignedFramesRef.current = 0;

    // 1 · request camera preview
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch {
      setState({
        kind: "error",
        message:
          "Camera access denied · face sign-in needs the camera. Enable it in your browser settings and try again.",
      });
      return;
    }
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      try { await videoRef.current.play(); } catch { /* autoplay may block; UI still visible */ }
    }
    setState({ kind: "camera_running" });

    // 2 · lazy-init the FaceDetector (once per session) then start loop
    if (!detectorRef.current) {
      try {
        const vision = await FilesetResolver.forVisionTasks(MP_WASM_URL);
        detectorRef.current = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MP_FACE_MODEL_URL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.5,
        });
      } catch (e) {
        // If MediaPipe fails, we honestly disable face-detection and
        // fall through to the countdown after a short delay so the user
        // isn't stuck. WebAuthn still runs.
        console.warn("[face-scan] MediaPipe init failed, falling back:", (e as Error).message);
      }
    }

    if (detectorRef.current) {
      detectionRafRef.current = requestAnimationFrame(runDetectionFrame);
    } else {
      // Fallback: no detector → skip alignment, go straight to countdown.
      setCountdown(3);
    }
  }, [runDetectionFrame]);

  // Auto-redirect after success · give the user 900ms to see the tick.
  useEffect(() => {
    if (state.kind !== "success" || !state.redirect) return;
    const t = setTimeout(() => {
      window.location.href = state.redirect!;
    }, 900);
    return () => clearTimeout(t);
  }, [state]);

  const showCameraLive =
    state.kind === "camera_running" || state.kind === "webauthn_prompting";
  const scanning =
    state.kind === "camera_starting" ||
    state.kind === "camera_running" ||
    state.kind === "webauthn_prompting";

  return (
    <>
      <style>{`
        @keyframes nex-face-scan-line {
          0%   { transform: translateY(-100%); opacity: 0.0; }
          8%   { opacity: 1.0; }
          92%  { opacity: 1.0; }
          100% { transform: translateY(100%); opacity: 0.0; }
        }
        @keyframes nex-face-head-bob {
          0%, 100% { transform: translate(-50%, -50%) rotate(-1.2deg); }
          25%      { transform: translate(-50%, -52%) rotate(1.2deg); }
          50%      { transform: translate(-50%, -50%) rotate(-0.6deg); }
          75%      { transform: translate(-50%, -49%) rotate(0.9deg); }
        }
        @keyframes nex-face-ring-pulse {
          0%, 100% { stroke-opacity: 0.55; }
          50%      { stroke-opacity: 1.0; }
        }
        @keyframes nex-face-countdown-pop {
          0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 0.0; }
          20%  { transform: translate(-50%, -50%) scale(1.05); opacity: 1.0; }
          85%  { transform: translate(-50%, -50%) scale(1.0); opacity: 1.0; }
          100% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.0; }
        }
        [data-nex-scan-root] * { box-sizing: border-box; }
      `}</style>

      {/* SCAN STAGE · ring + head + camera preview + countdown */}
      <div
        data-nex-scan-root
        style={{
          position: "relative",
          width: 260,
          height: 260,
          margin: "24px auto 0",
        }}
      >
        {/* Round blue rim (SVG) */}
        <svg
          width="260"
          height="260"
          viewBox="0 0 260 260"
          style={{ position: "absolute", inset: 0 }}
          aria-hidden
        >
          <circle
            cx="130"
            cy="130"
            r="122"
            fill="none"
            stroke={NEX.cyan}
            strokeWidth="3"
            style={{
              filter: `drop-shadow(0 0 12px ${NEX.cyan}) drop-shadow(0 0 32px rgba(0,175,255,0.25))`,
              animation: "nex-face-ring-pulse 2.4s ease-in-out infinite",
            }}
          />
          {[0, 90, 180, 270].map((deg) => (
            <line
              key={deg}
              x1="130"
              y1="6"
              x2="130"
              y2="18"
              stroke={NEX.cyan}
              strokeWidth="2"
              transform={`rotate(${deg} 130 130)`}
              strokeOpacity="0.8"
            />
          ))}
        </svg>

        {/* Circular clip for camera preview or pixel head */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            width: 240,
            height: 240,
            borderRadius: "50%",
            overflow: "hidden",
            background:
              "radial-gradient(ellipse at center, rgba(0,175,255,0.06), transparent 70%)",
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scaleX(-1)",
              opacity: showCameraLive ? 1 : 0,
              transition: "opacity 300ms ease",
            }}
          />

          {!showCameraLive && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: 110,
                height: 130,
                animation: "nex-face-head-bob 3.6s ease-in-out infinite",
                imageRendering: "pixelated",
              }}
            >
              <PixelHead />
            </div>
          )}

          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: `linear-gradient(180deg, transparent 0%, ${NEX.cyan} 45%, ${NEX.cyan} 55%, transparent 100%)`,
                boxShadow: `0 0 12px ${NEX.cyan}, 0 0 24px rgba(0,175,255,0.6)`,
                animation: "nex-face-scan-line 2.6s linear infinite",
              }}
            />
          </div>

          {/* Countdown 3 · 2 · 1 · rendered inside the scan area */}
          {countdown !== null && (
            <div
              key={countdown}
              aria-live="assertive"
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                fontSize: 128,
                fontWeight: 300,
                color: NEX.cyan,
                lineHeight: 1,
                letterSpacing: "-0.02em",
                textShadow: `0 0 24px ${NEX.cyan}, 0 0 48px rgba(0,175,255,0.5)`,
                animation: "nex-face-countdown-pop 1s ease-out both",
                pointerEvents: "none",
              }}
              data-nex-face-countdown={countdown}
            >
              {countdown}
            </div>
          )}

          {/* Success tick overlay */}
          {state.kind === "success" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(2,9,20,0.6)",
                backdropFilter: "blur(2px)",
              }}
            >
              <svg
                width="80"
                height="80"
                viewBox="0 0 24 24"
                fill="none"
                stroke={NEX.cyan}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          )}
        </div>

        {/* Status label · under ring · shows either the alignment hint or
            the ceremony phase */}
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            bottom: -34,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 12,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color:
              alignment !== null
                ? NEX.orange
                : state.kind === "error"
                  ? NEX.orange
                  : state.kind === "success"
                    ? NEX.cyan
                    : NEX.textSecondary,
          }}
          data-nex-face-hint={alignment ?? undefined}
        >
          {state.kind === "idle" && "Ready"}
          {state.kind === "camera_starting" && "Starting camera…"}
          {state.kind === "camera_running" &&
            (alignment
              ? `← ${alignment} →`.replace(/← (NO FACE DETECTED|MULTIPLE FACES) →/, "$1")
              : countdown !== null
                ? "Hold still"
                : "Aligning face…")}
          {state.kind === "webauthn_prompting" && "Confirm with your device"}
          {state.kind === "success" &&
            (mode === "enroll" ? "Enrolled" : "Signed in")}
          {state.kind === "error" && "Try again"}
        </div>
      </div>

      {/* Primary action button */}
      <button
        type="button"
        onClick={startScan}
        disabled={scanning || state.kind === "success" || !webauthnSupported}
        style={{
          marginTop: 60,
          width: "100%",
          minHeight: 48,
          background: NEX.orange,
          color: NEX.textPrimary,
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: "0.06em",
          cursor:
            state.kind === "idle" || state.kind === "error" ? "pointer" : "wait",
          opacity: !webauthnSupported ? 0.5 : 1,
        }}
        data-nex-face-scan-button
      >
        {mode === "enroll"
          ? state.kind === "idle" || state.kind === "error"
            ? "Scan face"
            : state.kind === "success"
              ? "Enrolled"
              : "Scanning…"
          : state.kind === "idle" || state.kind === "error"
            ? "Scan face to sign in"
            : state.kind === "success"
              ? "Signed in"
              : "Scanning…"}
      </button>

      {!webauthnSupported && (
        <p
          style={{
            marginTop: 12,
            fontSize: 12,
            color: NEX.orange,
            textAlign: "center",
          }}
        >
          This browser doesn&rsquo;t support platform passkeys. Use password sign in instead.
        </p>
      )}

      {state.kind === "error" && (
        <p
          role="status"
          style={{
            marginTop: 12,
            padding: "10px 14px",
            border: `1px solid ${NEX.orange}`,
            borderRadius: 8,
            color: NEX.textPrimary,
            fontSize: 12,
            background: "rgba(255,114,0,0.08)",
          }}
          data-nex-face-error
        >
          {state.message}
        </p>
      )}
    </>
  );
}

function PixelHead() {
  return (
    <svg viewBox="0 0 22 26" width="100%" height="100%" style={{ display: "block" }}>
      <g fill={NEX.cyan}>
        <rect x="6" y="2" width="10" height="1" />
        <rect x="4" y="3" width="14" height="1" />
        <rect x="3" y="4" width="16" height="1" />
        <rect x="3" y="5" width="16" height="9" opacity="0.15" />
        <rect x="3" y="5" width="1" height="9" />
        <rect x="18" y="5" width="1" height="9" />
        <rect x="7" y="8" width="2" height="2" />
        <rect x="13" y="8" width="2" height="2" />
        <rect x="9" y="12" width="4" height="1" />
        <rect x="4" y="14" width="14" height="1" />
        <rect x="5" y="15" width="12" height="1" />
        <rect x="6" y="16" width="10" height="1" />
        <rect x="8" y="17" width="6" height="2" />
        <rect x="4" y="19" width="14" height="1" />
        <rect x="2" y="20" width="18" height="1" />
        <rect x="1" y="21" width="20" height="4" opacity="0.4" />
      </g>
    </svg>
  );
}
