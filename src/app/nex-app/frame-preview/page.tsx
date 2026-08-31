// Isolated preview page · shows the existing /nex-app/chat inside
// the new bezel PNG. Does NOT touch NexAppShell / NexHudFrame or the
// chat page itself. Sample viewer only.

"use client";

const FRAME_URL = "https://ik.imagekit.io/admintect/ChatGPT%20Image%20Aug%2030,%202026,%2006_21_18%20PM.png";
const FRAME_RATIO = 851 / 1849;

export default function FramePreviewPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at 50% 30%, #1a1a1e 0%, #0a0a0c 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        position: "relative",
        width: "min(420px, 90vw)",
        aspectRatio: `${FRAME_RATIO}`,
      }}>
        {/* Existing chat page rendered inside the frame */}
        <iframe
          src="/nex-app/chat"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "0",
            borderRadius: 24,
            background: "#000",
          }}
        />
        {/* Bezel PNG · pointer-events none so the chat stays interactive */}
        <img
          src={FRAME_URL}
          alt="NEX frame preview"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
      </div>
    </div>
  );
}
