"use client";

// src/app/nex-native/chat/peer/[accountId]/_composer.tsx
//
// NEX Friend Chat composer · spec-accurate implementation.
// --------------------------------------------------------
// Client component that owns composer state so the send button can
// arm/disarm based on input, auto-grow the textarea, submit on Enter,
// and drive the pending state.
//
// Layout:
//   [ + attach ]  [ input pill ...................  😊 ]  [ send ]
//
// - Attach: 52×52 circle, cyan border, warm-orange edge accent, glass fill
// - Input: 56px tall pill, 28px radius, cyan border, dark glass fill,
//          16px placeholder, small emoji affordance nested at right
// - Send: 60×60 circle, blue→purple→orange gradient, white paper plane,
//         scales 0.94→1 on arm, 0.96 on press
//
// Backdrop blur is applied on the outer footer container in page.tsx.

import * as React from "react";
import { useFormStatus } from "react-dom";

const NEX = {
  bg: "#020914",
  glassSurface: "rgba(5,20,36,0.72)",
  glassAttach: "rgba(4,19,34,0.8)",
  glassInput: "rgba(4,20,36,0.90)",
  cyan: "#009FEF",
  cyanSoft: "rgba(0,159,239,0.65)",
  cyanEdge: "rgba(0,159,239,0.28)",
  cyanFaint: "rgba(0,159,239,0.16)",
  attachRing: "#008FDF",
  textPrimary: "#F4F7FC",
  textSecondary: "#8BA9D1",
  placeholder: "#6F8EAF",
  orange: "#FF7800",
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

  // Auto-grow textarea up to 4 lines, then scroll internally.
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
    <form
      ref={formRef}
      action={action as (formData: FormData) => void | Promise<void>}
      data-nex-peer-composer
      onSubmit={() => {
        // Optimistic clear · redirect will refresh the message list.
        setText("");
      }}
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 10,
      }}
    >
      <AttachmentButton />

      <div
        style={{
          flex: 1,
          minWidth: 0,
          position: "relative",
          display: "flex",
          alignItems: "center",
          minHeight: 56,
          padding: "6px 44px 6px 18px",
          background: NEX.glassInput,
          border: `1px solid ${NEX.cyanSoft}`,
          borderRadius: 28,
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
            padding: 0,
            background: "transparent",
            color: NEX.textPrimary,
            border: "none",
            outline: "none",
            // 16px prevents iOS Safari from auto-zooming on focus.
            fontSize: 16,
            lineHeight: 1.4,
            fontFamily: "inherit",
            resize: "none",
            overflow: "auto",
          }}
        />
        <EmojiAffordance />
      </div>

      <SendButton armed={hasText} />
    </form>
  );
}

/** Left circular attach button · 52×52 · thin cyan border with subtle
 *  warm-orange edge highlight per the reference. Currently a visual
 *  affordance (disabled) · slice for image / file attach comes later. */
function AttachmentButton() {
  return (
    <button
      type="button"
      aria-label="Attach (coming soon)"
      title="Attach · coming soon"
      style={{
        flexShrink: 0,
        width: 52,
        height: 52,
        borderRadius: "50%",
        background: NEX.glassAttach,
        border: `1px solid ${NEX.attachRing}`,
        color: NEX.textPrimary,
        display: "grid",
        placeItems: "center",
        cursor: "not-allowed",
        padding: 0,
        marginBottom: 2,
        boxShadow: `0 0 0 1px rgba(255,120,0,0.14), 0 4px 14px rgba(0,0,0,0.35)`,
      }}
      disabled
    >
      <svg
        width={22}
        height={22}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
  );
}

/** Emoji affordance nested at the right edge of the input pill.
 *  Non-functional stub · reads as a real control per the reference. */
function EmojiAffordance() {
  return (
    <button
      type="button"
      aria-label="Emoji (coming soon)"
      title="Emoji · coming soon"
      style={{
        position: "absolute",
        right: 6,
        bottom: 10,
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "transparent",
        border: "none",
        color: NEX.textSecondary,
        display: "grid",
        placeItems: "center",
        cursor: "not-allowed",
        padding: 0,
      }}
      disabled
    >
      <svg
        width={22}
        height={22}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    </button>
  );
}

/** 60×60 send button · blue→purple→orange gradient · white paper plane.
 *  Scales 0.94 when disarmed, 1.0 when armed, 0.96 during press. */
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
        width: 60,
        height: 60,
        borderRadius: "50%",
        background: active
          ? "linear-gradient(135deg,#008CFF 0%,#4657FF 65%,#FF7A00 100%)"
          : pending
            ? "linear-gradient(135deg,#004a85 0%,#241f7a 65%,#7c3b00 100%)"
            : "rgba(125,155,192,0.14)",
        color: NEX.textPrimary,
        border: "none",
        display: "grid",
        placeItems: "center",
        cursor: pending ? "wait" : armed ? "pointer" : "not-allowed",
        transition:
          "background 200ms ease, transform 120ms ease, box-shadow 200ms ease, opacity 200ms ease",
        transform: active ? "scale(1)" : "scale(0.94)",
        boxShadow: active
          ? "0 8px 25px rgba(0,120,255,0.25)"
          : "0 4px 12px rgba(0,0,0,0.35)",
        padding: 0,
        marginBottom: 0,
        opacity: pending ? 0.9 : 1,
      }}
    >
      {pending ? (
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: NEX.textPrimary,
            animation: "nex-composer-pulse 1s ease-in-out infinite",
          }}
        />
      ) : (
        <svg
          width={25}
          height={25}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M22 2 11 13" />
          <path d="M22 2 15 22 11 13 2 9 22 2z" />
        </svg>
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
