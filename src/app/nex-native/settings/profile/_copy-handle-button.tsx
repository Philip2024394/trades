"use client";

// src/app/nex-native/settings/profile/_copy-handle-button.tsx
//
// Phase 3A Adoption-Ready UX · copy-handle affordance.
// -----------------------------------------------------
// Client component so navigator.clipboard is reachable at tap time.
// Graceful fallback: if the Clipboard API is unavailable (older
// browsers · insecure context · permissions policy), we fall back
// to the deprecated-but-widely-supported document.execCommand pattern
// via a hidden textarea. On any failure we surface an honest "copy
// failed" state instead of pretending success.
//
// Visual confirmation lasts 1.6s · prevents toast spam from
// repeated taps (the component ignores clicks while already in the
// confirmed state).

import * as React from "react";

const CL = {
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  orange: "#FF7200",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.14)",
  danger: "#991B1B",
};

type Status = "idle" | "copied" | "failed";

export function CopyHandleButton({ handle }: { handle: string }): React.JSX.Element {
  const [status, setStatus] = React.useState<Status>("idle");
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  async function doCopy(): Promise<void> {
    if (status === "copied") return; // debounce rapid taps
    let ok = false;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(handle);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      // Fallback · deprecated execCommand still works in older + locked-
      // down contexts (insecure origins, strict permissions policy). We
      // keep the textarea off-screen so the viewport doesn't jump.
      try {
        const ta = document.createElement("textarea");
        ta.value = handle;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-9999px";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    setStatus(ok ? "copied" : "failed");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setStatus("idle"), 1600);
  }

  const label =
    status === "copied" ? "Copied ✓" :
    status === "failed" ? "Copy failed" :
    "Copy";
  const colour =
    status === "copied" ? CL.cyan :
    status === "failed" ? CL.danger :
    CL.textDim;

  return (
    <button
      type="button"
      onClick={() => void doCopy()}
      aria-label={`Copy your NEX handle ${handle} to the clipboard`}
      aria-live="polite"
      disabled={status === "copied"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 999,
        background: status === "copied" ? CL.cyanSoft : "transparent",
        border: `1px solid ${status === "copied" ? CL.cyan + "66" : "rgba(255,255,255,0.12)"}`,
        color: colour,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.02em",
        cursor: status === "copied" ? "default" : "pointer",
        fontFamily: "inherit",
        transition: "background 160ms ease, color 160ms ease",
      }}
    >
      <CopyGlyph />
      {label}
    </button>
  );
}

function CopyGlyph(): React.JSX.Element {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x={9} y={9} width={12} height={12} rx={2} />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
