"use client";

// src/app/nex-native/chat/_reactions.tsx
//
// Bridge 72 · Message reactions UI.
// ---------------------------------
// Two pieces:
//   · ReactionsChipRow · renders below the bubble · one pill per
//     emoji with its count · tap to toggle · self's own emojis get
//     a subtle blue rim so the user can tell what they picked.
//   · ReactionAddButton + ReactionPickerModal · a small "+😊" chip
//     that opens a floating picker with the six quick emojis · tap
//     one to attach.
//
// Both talk to the same bound Server Action (`toggleMessageReactionAction`
// bound with peerAccountId · takes message_id + emoji form fields).
// Optimistic updates aren't wired yet — the server action revalidates
// the chat page so the row re-renders with the new count on the next
// paint. Adding live realtime broadcast (so peers see each other's
// reactions without a reload) is a small follow-up on the existing
// message-events channel.

import * as React from "react";
import type { NexPeerMessageReactions } from "@/lib/nex-native/peer-message-reactions";
import { NEX_PEER_MESSAGE_QUICK_REACTIONS } from "@/lib/nex-native/peer-message-reactions";

const NEX = {
  chipBg: "rgba(4,20,36,0.72)",
  chipBorder: "rgba(139,169,209,0.25)",
  chipBorderMine: "rgba(0,159,239,0.55)",
  chipText: "#DDE9FA",
  addBg: "rgba(4,20,36,0.55)",
  addBorder: "rgba(139,169,209,0.30)",
  addText: "#8BA9D1",
  pickerBg: "rgba(4,20,36,0.96)",
  pickerBorder: "rgba(139,169,209,0.30)",
};

export interface ReactionsRowProps {
  messageId: string;
  selfAccountId: string;
  reactions: NexPeerMessageReactions;
  toggleAction: (formData: FormData) => Promise<never> | void | Promise<void>;
  /** Align the row under the correct bubble edge. */
  mine: boolean;
}

export function ReactionsChipRow(props: ReactionsRowProps): React.JSX.Element {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const entries = Object.entries(props.reactions).filter(([, ids]) => ids.length > 0);
  const hasReactions = entries.length > 0;

  return (
    <>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          marginTop: hasReactions ? 3 : 0,
          alignSelf: props.mine ? "flex-end" : "flex-start",
        }}
      >
        {entries.map(([emoji, ids]) => {
          const selfIn = ids.includes(props.selfAccountId);
          return (
            <ReactionChipForm
              key={emoji}
              messageId={props.messageId}
              emoji={emoji}
              count={ids.length}
              selfSelected={selfIn}
              toggleAction={props.toggleAction}
            />
          );
        })}
        {/* Inline "add reaction" chip · shows when the bubble is hovered
            or the row already has reactions. Always tappable on touch
            devices via a small hit target. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPickerOpen(true);
          }}
          aria-label="Add reaction"
          title="Add reaction"
          data-nex-reaction-add
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            padding: 0,
            borderRadius: 999,
            background: NEX.addBg,
            border: `1px solid ${NEX.addBorder}`,
            color: NEX.addText,
            cursor: "pointer",
            fontSize: 13,
            lineHeight: 1,
            opacity: hasReactions ? 0.85 : 0.55,
            transition: "opacity 140ms ease",
            backdropFilter: "blur(6px)",
          }}
        >
          <SmileIcon />
        </button>
      </div>
      {pickerOpen && (
        <ReactionPickerModal
          messageId={props.messageId}
          toggleAction={props.toggleAction}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

function SmileIcon(): React.JSX.Element {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.9}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx={12} cy={12} r={10} />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1={9} y1={9} x2={9.01} y2={9} />
      <line x1={15} y1={9} x2={15.01} y2={9} />
    </svg>
  );
}

function ReactionChipForm({
  messageId,
  emoji,
  count,
  selfSelected,
  toggleAction,
}: {
  messageId: string;
  emoji: string;
  count: number;
  selfSelected: boolean;
  toggleAction: (formData: FormData) => Promise<never> | void | Promise<void>;
}): React.JSX.Element {
  return (
    <form action={toggleAction} style={{ margin: 0 }}>
      <input type="hidden" name="message_id" value={messageId} />
      <input type="hidden" name="emoji" value={emoji} />
      <button
        type="submit"
        aria-label={`Toggle ${emoji} · ${count}`}
        title={selfSelected ? "Remove your reaction" : `React with ${emoji}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 8px 2px 6px",
          borderRadius: 999,
          background: NEX.chipBg,
          border: `1px solid ${selfSelected ? NEX.chipBorderMine : NEX.chipBorder}`,
          color: NEX.chipText,
          cursor: "pointer",
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          backdropFilter: "blur(6px)",
        }}
      >
        <span aria-hidden style={{ fontSize: 13 }}>{emoji}</span>
        <span>{count}</span>
      </button>
    </form>
  );
}

export interface ReactionAddButtonProps {
  messageId: string;
  mine: boolean;
  toggleAction: (formData: FormData) => Promise<never> | void | Promise<void>;
}

export function ReactionAddButton(props: ReactionAddButtonProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const anchorRef = React.useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Add reaction"
        title="Add reaction"
        data-nex-reaction-add
        style={{
          position: "absolute",
          top: -8,
          [props.mine ? "left" : "right"]: -8,
          width: 22,
          height: 22,
          borderRadius: 999,
          background: NEX.addBg,
          border: `1px solid ${NEX.addBorder}`,
          color: NEX.addText,
          fontSize: 12,
          lineHeight: 1,
          padding: 0,
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          opacity: 0,
          transition: "opacity 140ms ease, transform 120ms ease",
          zIndex: 3,
          backdropFilter: "blur(6px)",
        }}
      >
        😊
      </button>
      {open && (
        <ReactionPickerModal
          messageId={props.messageId}
          toggleAction={props.toggleAction}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ReactionPickerModal({
  messageId,
  toggleAction,
  onClose,
}: {
  messageId: string;
  toggleAction: (formData: FormData) => Promise<never> | void | Promise<void>;
  onClose: () => void;
}): React.JSX.Element {
  // Close on backdrop click or ESC. Emoji buttons close automatically
  // because the form submits + we redirect.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 900,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          gap: 6,
          padding: "10px 12px",
          borderRadius: 999,
          background: NEX.pickerBg,
          border: `1px solid ${NEX.pickerBorder}`,
          boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
        }}
      >
        {NEX_PEER_MESSAGE_QUICK_REACTIONS.map((emoji) => (
          <form
            key={emoji}
            action={toggleAction}
            style={{ margin: 0 }}
          >
            <input type="hidden" name="message_id" value={messageId} />
            <input type="hidden" name="emoji" value={emoji} />
            <button
              type="submit"
              aria-label={`React with ${emoji}`}
              title={emoji}
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                border: "none",
                background: "transparent",
                color: "#F4F7FC",
                fontSize: 26,
                lineHeight: 1,
                cursor: "pointer",
                transition: "transform 120ms ease, background 120ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.2)";
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              {emoji}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
