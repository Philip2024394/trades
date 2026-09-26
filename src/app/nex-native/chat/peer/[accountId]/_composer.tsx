"use client";

// src/app/nex-native/chat/peer/[accountId]/_composer.tsx
//
// NEX Chat composer · Aurora Rail + 3-dot media menu.
// ---------------------------------------------------
// Aurora-gradient rim around the input pill · send nested at the
// right · a vertical 3-dot menu button on the far right. Tapping
// the 3-dot slides out a small drawer with camera · video · mic
// options that hover above the pill.
//
// Sealed 2026-09-27. Functionality preserved: real textarea,
// auto-grow, Enter submits, pending state via useFormStatus.

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
  cyanSoft: "rgba(0,159,239,0.65)",
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
  const [menuOpen, setMenuOpen] = React.useState(false);
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
        @keyframes nex-media-in {
          from { opacity: 0; transform: translateX(20px) scale(0.85); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        [data-nex-media-btn] {
          animation: nex-media-in 260ms cubic-bezier(.2,.7,.2,1) both;
        }
      `}</style>
      <form
        ref={formRef}
        action={action as (formData: FormData) => void | Promise<void>}
        data-nex-peer-composer
        onSubmit={() => setText("")}
        style={{
          position: "relative",
        }}
      >
        {/* Media drawer · appears above the pill when the 3-dot is
            active. Slides in from the right so it visually connects
            to the dots button that spawned it. */}
        {menuOpen && (
          <div
            style={{
              position: "absolute",
              right: 0,
              bottom: "calc(100% + 8px)",
              display: "flex",
              gap: 8,
              padding: "8px",
              background: "rgba(3,16,29,0.92)",
              border: "1px solid rgba(0,159,239,0.35)",
              borderRadius: 999,
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              boxShadow: "0 12px 30px rgba(0,0,0,0.55)",
              zIndex: 5,
            }}
          >
            <MediaButton label="Camera" onClose={() => setMenuOpen(false)}>
              <CameraIcon />
            </MediaButton>
            <MediaButton label="Video" onClose={() => setMenuOpen(false)}>
              <VideoIcon />
            </MediaButton>
            <MediaButton label="Voice" onClose={() => setMenuOpen(false)}>
              <MicIcon />
            </MediaButton>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          {/* Aurora-bordered input pill · flex 1 to fill horizontal
              space, leaving room for the 3-dot menu button on the
              right. */}
          <div
            data-nex-aurora-pill
            style={{
              flex: 1,
              minWidth: 0,
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

          {/* Vertical 3-dot menu button · lower right of the composer.
              Tap toggles the media drawer above. */}
          <button
            type="button"
            aria-label={menuOpen ? "Close media menu" : "Open media menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              flexShrink: 0,
              width: 40,
              height: 44,
              borderRadius: 22,
              background: menuOpen
                ? "rgba(0,159,239,0.18)"
                : "rgba(4,20,36,0.7)",
              border: menuOpen
                ? "1px solid rgba(0,159,239,0.85)"
                : `1px solid ${NEX.cyanSoft}`,
              color: NEX.text,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              padding: 0,
              transition:
                "background 220ms ease, border-color 220ms ease, transform 160ms ease",
              transform: menuOpen ? "scale(1)" : "scale(0.96)",
            }}
          >
            <DotsIcon />
          </button>
        </div>
      </form>
    </>
  );
}

function MediaButton({
  children,
  label,
  onClose,
}: {
  children: React.ReactNode;
  label: string;
  onClose: () => void;
}) {
  return (
    <button
      type="button"
      data-nex-media-btn
      aria-label={`${label} (coming soon)`}
      title={`${label} · coming soon`}
      onClick={onClose}
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: "rgba(0,159,239,0.12)",
        border: "1px solid rgba(0,159,239,0.5)",
        color: NEX.cyan,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
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

function DotsIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden {...strokeProps} strokeWidth={2.2}>
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden {...strokeProps}>
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden {...strokeProps}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden {...strokeProps}>
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
