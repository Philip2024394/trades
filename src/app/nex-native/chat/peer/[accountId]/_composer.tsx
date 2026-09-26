"use client";

// src/app/nex-native/chat/peer/[accountId]/_composer.tsx
//
// NEX Chat composer · Aurora Rail (Footer 08 promoted).
// -----------------------------------------------------
// Slow-animating aurora gradient border around the input pill · three
// ghost action buttons (attach · camera · voice) hovering above it ·
// send icon nested inside the pill on the right. Sealed 2026-09-27.
//
// Functionality preserved from the previous composer:
//   · real <textarea> with 16px font (no iOS focus zoom)
//   · auto-grows to 4 lines then scrolls internally
//   · Enter submits · Shift+Enter inserts newline
//   · pending state via useFormStatus (single-source-of-truth from
//     the parent form's Server Action)
//
// Attach / Camera / Voice are visual affordances only until their
// respective backends land (image upload · camera capture · voice
// note). They render as ghost icons that read as real controls.

import * as React from "react";
import { useFormStatus } from "react-dom";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  fieldBg: "rgba(4,20,36,0.90)",
  textPrimary: "#F4F7FC",
  textSecondary: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#009FEF",
  orange: "#FF7800",
  orangeSoft: "rgba(255,120,0,0.5)",
};

interface PeerComposerProps {
  action: (formData: FormData) => Promise<never> | void | Promise<void>;
  placeholder: string;
}

export function PeerComposer({ action, placeholder }: PeerComposerProps) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [text, setText] = React.useState("");
  const hasText = text.trim().length > 0;

  const resizeTextarea = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, 112);
    el.style.height = `${Math.max(next, 24)}px`;
  }, []);

  React.useEffect(() => {
    resizeTextarea();
  }, [text, resizeTextarea]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!hasText) return;
        formRef.current?.requestSubmit();
      }
    },
    [hasText],
  );

  return (
    <>
      <style>{`
        @keyframes nex-aurora-border {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        [data-nex-aurora-pill] {
          background: linear-gradient(
            90deg,
            #00ffb4 0%,
            #009fef 25%,
            #6945f5 50%,
            #ff7a00 75%,
            #00ffb4 100%
          );
          background-size: 300% 100%;
          animation: nex-aurora-border 12s ease-in-out infinite;
        }
      `}</style>
      <form
        ref={formRef}
        action={action as (formData: FormData) => void | Promise<void>}
        data-nex-peer-composer
        onSubmit={() => {
          setText("");
        }}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {/* Ghost icon row · attach · camera · voice */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 22,
          }}
        >
          <GhostIcon label="Attach (coming soon)" title="Attach · coming soon">
            <PlusIcon />
          </GhostIcon>
          <GhostIcon label="Photo (coming soon)" title="Photo · coming soon">
            <CameraIcon />
          </GhostIcon>
          <GhostIcon label="Voice (coming soon)" title="Voice · coming soon">
            <MicIcon />
          </GhostIcon>
        </div>

        {/* Aurora-bordered input pill · 2px padding creates the visible
            gradient rim around the inner dark input surface. */}
        <div
          data-nex-aurora-pill
          style={{
            position: "relative",
            padding: 2,
            borderRadius: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              minHeight: 44,
              padding: "6px 6px 6px 16px",
              borderRadius: 22,
              background: NEX.bg,
            }}
          >
            <textarea
              ref={textareaRef}
              name="body"
              required
              maxLength={4000}
              placeholder={placeholder}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                flex: 1,
                width: "100%",
                minHeight: 24,
                maxHeight: 112,
                padding: "6px 6px 6px 0",
                background: "transparent",
                color: NEX.textPrimary,
                border: "none",
                outline: "none",
                fontSize: 16,
                lineHeight: 1.4,
                fontFamily: "inherit",
                resize: "none",
                overflow: "auto",
              }}
            />
            <SendButton armed={hasText} />
          </div>
        </div>
      </form>
    </>
  );
}

function GhostIcon({
  children,
  label,
  title,
}: {
  children: React.ReactNode;
  label: string;
  title: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      disabled
      style={{
        width: 34,
        height: 34,
        borderRadius: "50%",
        background: "transparent",
        color: NEX.textSecondary,
        border: "none",
        display: "grid",
        placeItems: "center",
        cursor: "not-allowed",
        opacity: 0.85,
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

function SendButton({ armed }: { armed: boolean }) {
  const { pending } = useFormStatus();
  const active = armed && !pending;
  return (
    <button
      type="submit"
      aria-label={pending ? "Sending message" : "Send message"}
      disabled={!armed || pending}
      style={{
        flexShrink: 0,
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: active
          ? "linear-gradient(135deg,#008CFF,#4657FF,#FF7A00)"
          : pending
            ? "rgba(255,120,0,0.35)"
            : "rgba(120,140,180,0.14)",
        color: active || pending ? NEX.textPrimary : NEX.textMute,
        border: active
          ? `1px solid ${NEX.orangeSoft}`
          : `1px solid transparent`,
        display: "grid",
        placeItems: "center",
        cursor: pending ? "wait" : armed ? "pointer" : "not-allowed",
        transition:
          "background 220ms ease, color 220ms ease, border-color 220ms ease, transform 120ms ease",
        transform: active ? "scale(1)" : "scale(0.92)",
        marginLeft: 4,
        padding: 0,
      }}
    >
      {pending ? (
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: NEX.textPrimary,
            animation: "nex-composer-pulse 1s ease-in-out infinite",
          }}
        />
      ) : (
        <SendIcon />
      )}
      <style>{`
        @keyframes nex-composer-pulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.3); }
        }
      `}</style>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function PlusIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden {...strokeProps}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden {...strokeProps}>
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden {...strokeProps}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden {...strokeProps} strokeWidth={2.2}>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22 11 13 2 9 22 2z" />
    </svg>
  );
}
