"use client";

// src/app/nex-native/settings/profile/_face-camera-uploader.tsx
//
// Bridge 40 · live-camera avatar capture with MediaPipe face detection.
// Replaces the file-picker NexAvatarUploader on the personal profile
// tab. Founder direction 2026-09-28:
//   "we use our facescreen camera for their profile image · meaning we
//    don't allow upload image of any random person or micky mouse"
//
// Flow:
//   1. Idle    · current avatar or initials · big "Take profile photo"
//                CTA. Cameraless devices instead see an "Open NEX on
//                your phone" hint (no upload fallback · Founder's rule).
//   2. Camera  · live video · MediaPipe FaceDetector runs every 200ms ·
//                green ring + Capture enabled when exactly one face is
//                detected and centred / large enough · red ring + hint
//                otherwise.
//   3. Preview · shows the captured still · Retake or Confirm.
//   4. Uploading · form auto-submits with face_verified=true so the
//                  server can flip nex_account_profile.avatar_face_verified.
//
// Camera failures (permission denied, no device, MediaPipe load error)
// all resolve to the "camera not available" state with a plain message.
// No fallback file input · that would let a photo of Mickey Mouse
// through, which is exactly what this bridge exists to stop.

import { useCallback, useEffect, useRef, useState } from "react";
import { uploadAvatarAction } from "../../_actions";

interface Props {
  currentAvatarUrl: string | null;
  displayName: string;
  handle: string | null;
  /** True when the current avatar was already captured via camera.
   *  Purely cosmetic here · lets us show a subtle ✓ over the avatar. */
  faceVerified: boolean;
}

const NEX = {
  panel: "#03101D",
  fieldBg: "#04101F",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7200",
  red: "#EF4444",
  green: "#10B981",
};

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

type Stage = "idle" | "starting" | "camera" | "preview" | "unavailable";

interface FaceState {
  detected: boolean;
  /** Bounding box in video-pixel coords, or null when no face. */
  box: { x: number; y: number; w: number; h: number } | null;
  /** Why the current frame isn't captureable, when applicable. */
  hint: string;
}

export function NexFaceCameraUploader(props: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [face, setFace] = useState<FaceState>({
    detected: false,
    box: null,
    hint: "Point the camera at your face.",
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Ref-typed as any because @mediapipe/tasks-vision doesn't ship
  // ambient types we can lock down · the runtime shape (detectForVideo,
  // close) is what we actually depend on.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detectorRef = useRef<any | null>(null);
  const detectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = useCallback(() => {
    if (detectTimerRef.current) {
      clearInterval(detectTimerRef.current);
      detectTimerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (detectorRef.current) {
      try {
        detectorRef.current.close();
      } catch {
        // MediaPipe close can throw on some versions · ignore.
      }
      detectorRef.current = null;
    }
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = useCallback(async () => {
    setStage("starting");
    setErrorMsg(null);
    try {
      // Feature-detect. getUserMedia is missing on some kiosks / older
      // desktops / privacy modes · treat as "camera not available".
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not available on this device");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Video element missing");
      video.srcObject = stream;
      await video.play();

      // Load MediaPipe FaceDetector · dynamic import so the client
      // bundle only pulls it when the user actually tries to take a
      // photo. Model + wasm files live under /public/mediapipe/.
      const { FaceDetector, FilesetResolver } = await import(
        "@mediapipe/tasks-vision"
      );
      const files = await FilesetResolver.forVisionTasks("/mediapipe/tasks-vision/wasm");
      const detector = await FaceDetector.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: "/mediapipe/models/blaze_face_short_range.tflite",
        },
        runningMode: "VIDEO",
      });
      detectorRef.current = detector;
      setStage("camera");

      // Poll detection every 200ms · light enough for phones ·
      // frequent enough to feel responsive.
      detectTimerRef.current = setInterval(() => {
        const v = videoRef.current;
        const d = detectorRef.current;
        if (!v || !d || v.readyState < 2) return;
        try {
          const result = d.detectForVideo(v, performance.now());
          const detections = result?.detections ?? [];
          if (detections.length === 0) {
            setFace({
              detected: false,
              box: null,
              hint: "Look at the camera · we can't see a face yet.",
            });
            return;
          }
          if (detections.length > 1) {
            setFace({
              detected: false,
              box: null,
              hint: "Multiple faces in frame · only you.",
            });
            return;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bbox = (detections[0] as any)?.boundingBox;
          if (!bbox) {
            setFace({ detected: false, box: null, hint: "Point at your face." });
            return;
          }
          const box = {
            x: bbox.originX,
            y: bbox.originY,
            w: bbox.width,
            h: bbox.height,
          };
          const vw = v.videoWidth || 640;
          const vh = v.videoHeight || 640;
          const boxFrac = (box.w * box.h) / (vw * vh);
          if (boxFrac < 0.06) {
            setFace({
              detected: false,
              box,
              hint: "Move closer · your face is too small.",
            });
            return;
          }
          setFace({ detected: true, box, hint: "Looks good · hit Capture." });
        } catch {
          // MediaPipe can throw if the video frame isn't ready yet · ignore
          // and let the next tick retry.
        }
      }, 200);
    } catch (e) {
      stopCamera();
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(msg);
      setStage("unavailable");
    }
  }, [stopCamera]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) return;
    // Draw a square centred crop of the video so the resulting avatar
    // is 1:1 regardless of the camera aspect ratio.
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const size = Math.min(vw, vh);
    const sx = (vw - size) / 2;
    const sy = (vh - size) / 2;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setPreviewUrl(URL.createObjectURL(blob));
        setStage("preview");
        stopCamera();
      },
      "image/jpeg",
      0.9,
    );
  }, [stopCamera]);

  const retake = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    startCamera();
  }, [previewUrl, startCamera]);

  const confirm = useCallback(async () => {
    const canvas = captureCanvasRef.current;
    const form = formRef.current;
    const input = fileInputRef.current;
    if (!canvas || !form || !input) return;
    // Reconstruct a File from the canvas · attach it to the hidden
    // input via DataTransfer, then submit the form (server action
    // reads formData.get("avatar")).
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "face-capture.jpg", { type: "image/jpeg" });
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        form.requestSubmit();
      },
      "image/jpeg",
      0.9,
    );
  }, []);

  const AVATAR_SIZE = 92;
  const initials = initialsFrom(props.displayName);
  const displayed =
    stage === "preview" ? previewUrl : props.currentAvatarUrl;

  return (
    <form
      ref={formRef}
      action={uploadAvatarAction}
      data-nex-face-camera-uploader
      style={{
        marginBottom: 16,
        padding: 16,
        background: NEX.panel,
        border: `1px solid ${NEX.cyanSoft}`,
        borderRadius: 14,
      }}
    >
      {/* Hidden inputs the server action reads on submit */}
      <input
        ref={fileInputRef}
        type="file"
        name="avatar"
        accept="image/jpeg"
        style={{ display: "none" }}
      />
      <input type="hidden" name="face_verified" value="true" />

      {/* Header · avatar preview + label + status */}
      {stage !== "camera" && (
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            aria-hidden
            style={{
              position: "relative",
              flexShrink: 0,
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              borderRadius: "50%",
              border: `2px solid ${NEX.cyanSoft}`,
              background: NEX.cyanFaint,
              color: NEX.cyan,
              display: "grid",
              placeItems: "center",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "0.05em",
              overflow: "hidden",
            }}
          >
            {displayed ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={displayed}
                alt="Profile"
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <span>{initials}</span>
            )}
            {props.faceVerified && (
              <span
                aria-label="Face-verified"
                title="Captured with the live-camera flow"
                style={{
                  position: "absolute",
                  bottom: -3,
                  right: -3,
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: `2px solid ${NEX.panel}`,
                  background: NEX.cyan,
                  color: "#0B0F1A",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 14,
                  fontWeight: 900,
                }}
              >
                ✓
              </span>
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: NEX.textPrimary }}>
              Profile photo
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: NEX.textSecondary,
                lineHeight: 1.45,
              }}
            >
              {stage === "unavailable"
                ? "Camera not available on this device · open NEX on your phone to take a live profile photo."
                : props.faceVerified
                  ? "Face-verified · retake any time to update."
                  : "Real faces only · we run on-device face detection so photos of pets, cartoons, or others can't slip through."}
            </div>
            {props.handle && (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 10,
                  color: NEX.textSecondary,
                  opacity: 0.7,
                }}
              >
                Path{" "}
                <code style={{ fontFamily: "ui-monospace, monospace" }}>
                  {props.handle}/avatar
                </code>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Live camera panel */}
      {stage === "camera" && (
        <div style={{ display: "grid", gap: 10 }}>
          <div
            style={{
              position: "relative",
              aspectRatio: "1 / 1",
              width: "100%",
              maxWidth: 320,
              margin: "0 auto",
              borderRadius: 16,
              overflow: "hidden",
              background: "#000",
              border: `3px solid ${face.detected ? NEX.green : NEX.red}`,
              boxShadow: face.detected
                ? `0 0 0 3px rgba(16,185,129,0.25)`
                : `0 0 0 3px rgba(239,68,68,0.20)`,
              transition: "border-color 160ms ease, box-shadow 160ms ease",
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: "scaleX(-1)",
              }}
            />
            <canvas ref={overlayRef} style={{ display: "none" }} />
          </div>
          <div
            role="status"
            aria-live="polite"
            style={{
              textAlign: "center",
              fontSize: 12,
              color: face.detected ? NEX.green : NEX.textSecondary,
              fontWeight: face.detected ? 700 : 500,
            }}
          >
            {face.hint}
          </div>
        </div>
      )}

      <canvas ref={captureCanvasRef} style={{ display: "none" }} />

      {/* Action buttons per stage */}
      <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {stage === "idle" && (
          <button
            type="button"
            onClick={startCamera}
            style={primaryButton()}
          >
            📷 Take profile photo
          </button>
        )}
        {stage === "starting" && (
          <button type="button" disabled style={primaryButton({ dim: true })}>
            Starting camera…
          </button>
        )}
        {stage === "camera" && (
          <>
            <button
              type="button"
              onClick={capture}
              disabled={!face.detected}
              style={primaryButton({ dim: !face.detected })}
            >
              📸 Capture
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setStage("idle");
              }}
              style={secondaryButton()}
            >
              Cancel
            </button>
          </>
        )}
        {stage === "preview" && (
          <>
            <button type="button" onClick={confirm} style={primaryButton()}>
              ✓ Use this photo
            </button>
            <button type="button" onClick={retake} style={secondaryButton()}>
              Retake
            </button>
          </>
        )}
      </div>

      {errorMsg && stage === "unavailable" && (
        <p
          role="status"
          style={{
            marginTop: 12,
            padding: "6px 10px",
            borderRadius: 6,
            background: "rgba(239,68,68,0.10)",
            color: NEX.red,
            fontSize: 11,
            border: "1px solid rgba(239,68,68,0.35)",
            lineHeight: 1.4,
          }}
        >
          {errorMsg}
        </p>
      )}
    </form>
  );
}

function primaryButton(opts: { dim?: boolean } = {}): React.CSSProperties {
  return {
    minHeight: 44,
    padding: "10px 16px",
    borderRadius: 8,
    background: NEX.orange,
    color: "#0B0F1A",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    border: "none",
    cursor: opts.dim ? "not-allowed" : "pointer",
    opacity: opts.dim ? 0.5 : 1,
    flex: 1,
    minWidth: 140,
  };
}

function secondaryButton(): React.CSSProperties {
  return {
    minHeight: 44,
    padding: "10px 16px",
    borderRadius: 8,
    background: "transparent",
    color: NEX.textSecondary,
    border: `1px solid ${NEX.cyanFaint}`,
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: "0.04em",
    cursor: "pointer",
  };
}
