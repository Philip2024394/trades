// NEX Composer · voice icon · separator · text field · send button.
// Sits in the HUD frame's BOTTOM zone over the bottom pill housing.
//
// Layout (Philip 2026-08-26):
//   [ voice icon · orange ] [ gray line ] [ Ask NEX… input ] [ send · round ]
//
// Doctrine anchors:
//   project_nex_workspace_identity_doctrine_2026_08_25
//   project_nex_workspace_terminology_addendum_2026_08_25
//     (composer is the persistent input · workspace hosts the transcript)

"use client";

import React, { forwardRef, useEffect, useRef } from "react";
import type { NexVoiceState } from "@/lib/nex-voice";
import { useGuidanceTarget } from "./hud/NexGuidance";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  nexState: NexVoiceState;
  onMicTap: () => void;
  onMicPointerDown?: (e: React.PointerEvent) => void;
  onMicPointerUp?:   (e: React.PointerEvent) => void;
  onMicPointerCancel?: (e: React.PointerEvent) => void;
  disabled?: boolean;
  placeholder?: string;
}

// Voice-state colour tokens · drive the mic-icon tint + glow. Idle = orange.
const VOICE_TINT: Record<NexVoiceState, { color: string; glow: string; label: string }> = {
  idle:      { color: "#f97316", glow: "none",                            label: "Ask NEX by voice" },
  listening: { color: "#f97316", glow: "0 0 10px rgba(249,115,22,0.75)",  label: "Listening" },
  thinking:  { color: "#a855f7", glow: "0 0 10px rgba(168,85,247,0.65)",  label: "Thinking" },
  speaking:  { color: "#22d3ee", glow: "0 0 10px rgba(34,211,238,0.65)",  label: "Speaking" },
  error:     { color: "#f43f5e", glow: "none",                            label: "Retry" },
};

export const NexComposer = forwardRef<HTMLInputElement, Props>(function NexComposer(
  {
    value,
    onChange,
    onSubmit,
    nexState,
    onMicTap,
    onMicPointerDown,
    onMicPointerUp,
    onMicPointerCancel,
    disabled = false,
    placeholder,
  },
  ref,
) {
  const v = VOICE_TINT[nexState];
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (typeof ref === "function") ref(inputRef.current);
    else if (ref) ref.current = inputRef.current;
  }, [ref]);
  const hasText = value.trim().length > 0;
  // Register composer parts as guidance targets so NEX can point at them.
  const attachVoiceButton   = useGuidanceTarget("voice-button");
  const attachComposerInput = useGuidanceTarget("composer-input");
  const attachSendButton    = useGuidanceTarget("send-button");

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "0 8px",
      }}
    >
      {/* Voice icon · orange (or state-tinted) · leftmost affordance.
          Tap = voice.tap() (idle→listen, listening→end, etc.). Pulses when
          NEX is listening/thinking/speaking. */}
      <button
        ref={attachVoiceButton as (el: HTMLButtonElement | null) => void}
        type="button"
        aria-label={v.label}
        onClick={onMicTap}
        onPointerDown={onMicPointerDown}
        onPointerUp={onMicPointerUp}
        onPointerCancel={onMicPointerCancel}
        onPointerLeave={onMicPointerCancel}
        disabled={disabled}
        style={{
          appearance: "none",
          border: "none",
          background: "transparent",
          color: v.color,
          cursor: "pointer",
          padding: 0,
          width: 28, height: 28, minWidth: 28,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          filter: v.glow !== "none" ? `drop-shadow(${v.glow})` : undefined,
          transition: "color 180ms ease, filter 180ms ease",
          animation: (nexState === "listening" || nexState === "thinking" || nexState === "speaking")
            ? "nex-composer-mic-pulse 1.4s ease-in-out infinite" : undefined,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      </button>

      {/* Short gray divider between voice icon and input. */}
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 1,
          height: 16,
          background: "rgba(255,255,255,0.22)",
          borderRadius: 1,
          flexShrink: 0,
        }}
      />

      {/* Text input · main composer field. */}
      <input
        ref={(el) => {
          inputRef.current = el;
          attachComposerInput(el as unknown as HTMLElement | null);
        }}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder ?? "Ask NEX…"}
        aria-label="Message NEX"
        autoComplete="off"
        style={{
          flex: 1,
          minWidth: 0,
          appearance: "none",
          border: "1px solid transparent",
          background: "transparent",
          color: "rgba(245,245,245,0.95)",
          padding: "7px 4px",
          fontSize: 13,
          outline: "none",
        }}
        onFocus={(e) => { e.currentTarget.style.borderBottom = "1px solid rgba(249,115,22,0.35)"; }}
        onBlur={(e) => { e.currentTarget.style.borderBottom = "1px solid transparent"; }}
      />

      {/* Send button · round · far-right. Always visible · brightens when input
          has text so it reads as the primary action. */}
      <button
        ref={attachSendButton as (el: HTMLButtonElement | null) => void}
        type="submit"
        aria-label="Send"
        disabled={disabled || !hasText}
        style={{
          appearance: "none",
          border: `1px solid ${hasText ? "rgba(249,115,22,0.6)" : "rgba(255,255,255,0.12)"}`,
          background: hasText ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.04)",
          color: hasText ? "#fff" : "rgba(245,245,245,0.4)",
          width: 32, height: 32, minWidth: 32,
          borderRadius: "50%",
          cursor: hasText ? "pointer" : "default",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 180ms ease, border-color 180ms ease, color 180ms ease",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>

      <style>{`
        @keyframes nex-composer-mic-pulse {
          0%, 100% { transform: scale(1);    opacity: 1; }
          50%      { transform: scale(1.10); opacity: 0.85; }
        }
      `}</style>
    </form>
  );
});
