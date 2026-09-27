"use client";

// src/app/nex-native/chat/_message-bubble-client.tsx
//
// Bridge 5 + 6 · gesture wrapper around each message bubble.
// -----------------------------------------------------------
//   · swipe-right on incoming bubble → capture as reply target
//   · swipe-left on outgoing bubble → capture your own message
//   · long-press on YOUR OWN bubble (< 1 hour old) → confirm delete
//     modal · confirms send retract via deletePeerMessageAction
//
// Both gestures share the same pointer handlers. Long-press timer
// cancels the moment the user moves > 10px so swipes take
// precedence. Long-press fires at 500ms if the pointer stayed still.
//
// Reply state is URL-driven (?reply=<id>). Delete uses a server
// action bound at the client level to the peer id + message id.

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const NEX = {
  cyan: "#00AFFF",
  orange: "#FF7800",
  panel: "#03101D",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  red: "#FF3355",
};

const SWIPE_THRESHOLD = 60;
const SWIPE_MAX = 96;
const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;
const DELETE_WINDOW_MS = 60 * 60 * 1000;

export function MessageBubbleClient({
  messageId,
  mine,
  sentAtMs,
  deletedForEveryone,
  deleteAction,
  children,
}: {
  messageId: string;
  mine: boolean;
  /** Message send time as epoch ms · used to decide whether the
   *  1-hour delete window has elapsed. When omitted, long-press
   *  delete is disabled for this bubble. */
  sentAtMs?: number;
  /** True when the message has already been retracted · disables
   *  both swipe-to-reply and long-press-to-delete. */
  deletedForEveryone?: boolean;
  /** Bridge 6 · Server Action bound to the peer id · fires with a
   *  hidden `message_id` field on confirm. */
  deleteAction?: (formData: FormData) => Promise<never> | void | Promise<void>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const startX = React.useRef<number | null>(null);
  const startY = React.useRef<number | null>(null);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const longPressFired = React.useRef(false);
  const [dragX, setDragX] = React.useState(0);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setMounted(true), []);

  const swipeSign = mine ? -1 : 1;
  const canDelete =
    mine &&
    !!deleteAction &&
    !deletedForEveryone &&
    typeof sentAtMs === "number" &&
    Date.now() - sentAtMs < DELETE_WINDOW_MS;

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (deletedForEveryone) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    longPressFired.current = false;
    wrapperRef.current?.setPointerCapture(e.pointerId);
    if (canDelete) {
      longPressTimer.current = setTimeout(() => {
        longPressFired.current = true;
        setDeleteOpen(true);
        setDragX(0);
      }, LONG_PRESS_MS);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (startX.current == null || startY.current == null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    // Any movement past MOVE_CANCEL_PX cancels the pending long-press.
    if (Math.abs(dx) > MOVE_CANCEL_PX || Math.abs(dy) > MOVE_CANCEL_PX) {
      clearLongPress();
    }
    const dir = dx * swipeSign;
    if (dir <= 0) {
      setDragX(0);
      return;
    }
    const clamped = Math.min(dir, SWIPE_MAX);
    setDragX(clamped * swipeSign);
  };

  const finishSwipe = () => {
    clearLongPress();
    if (longPressFired.current) {
      // Long-press already handled · don't also fire a swipe.
      startX.current = null;
      startY.current = null;
      setDragX(0);
      return;
    }
    if (startX.current == null) return;
    const distance = Math.abs(dragX);
    startX.current = null;
    startY.current = null;
    setDragX(0);
    if (distance >= SWIPE_THRESHOLD && !deletedForEveryone) {
      const params = new URLSearchParams(search.toString());
      params.set("reply", messageId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  };

  return (
    <div
      ref={wrapperRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishSwipe}
      onPointerCancel={finishSwipe}
      style={{
        position: "relative",
        // This wrapper is the direct child of the message-list flex
        // column · alignSelf lives HERE, not on the bubble inside,
        // otherwise every bubble stays left-aligned inside a
        // full-width wrapper (Bridge 5 regression, fixed 2026-09-27).
        alignSelf: mine ? "flex-end" : "flex-start",
        // Incoming bubbles get an extra 35px to breathe · sender
        // header + reply quotes + longer message previews all live
        // in the incoming slot. Founder direction 2026-09-27.
        maxWidth: mine ? "78%" : "calc(78% + 35px)",
        touchAction: "pan-y",
        transform: `translateX(${dragX}px)`,
        transition:
          dragX === 0 ? "transform 220ms cubic-bezier(.2,.7,.2,1)" : "none",
      }}
    >
      {/* Reveal reply icon behind the bubble · fades in with drag */}
      {Math.abs(dragX) > 6 && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: "50%",
            [mine ? "right" : "left"]: -32,
            transform: "translateY(-50%)",
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "rgba(0,175,255,0.18)",
            border: `1px solid ${NEX.cyan}`,
            color: NEX.cyan,
            display: "grid",
            placeItems: "center",
            opacity: Math.min(1, Math.abs(dragX) / SWIPE_THRESHOLD),
          }}
        >
          <ReplyIcon />
        </span>
      )}
      {children}

      {/* Bridge 6 · delete confirm modal · portaled to body to
          escape any parent stacking context (bubbles have
          backdrop-filter which creates its own context). */}
      {deleteOpen && mounted && deleteAction &&
        createPortal(
          <DeleteConfirmModal
            messageId={messageId}
            action={deleteAction}
            onClose={() => setDeleteOpen(false)}
          />,
          document.body,
        )}
    </div>
  );
}

function DeleteConfirmModal({
  messageId,
  action,
  onClose,
}: {
  messageId: string;
  action: (formData: FormData) => Promise<never> | void | Promise<void>;
  onClose: () => void;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <style>{`
        @keyframes nex-delete-modal-in {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.94); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
      <div
        role="button"
        aria-label="Cancel"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2,9,20,0.75)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          zIndex: 900,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Delete this message?"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(320px, calc(100vw - 24px))",
          padding: "22px 22px 18px",
          background: NEX.panel,
          border: `1px solid ${NEX.red}`,
          borderRadius: 20,
          zIndex: 901,
          animation: "nex-delete-modal-in 220ms cubic-bezier(.2,.7,.2,1) both",
          boxShadow: `0 24px 60px rgba(0,0,0,0.65), 0 0 40px ${NEX.red}22`,
          color: NEX.text,
          fontFamily: "inherit",
        }}
      >
        <div style={{ fontSize: 28, textAlign: "center", marginBottom: 8 }}>
          🚫
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            textAlign: "center",
            marginBottom: 6,
          }}
        >
          Delete this message?
        </div>
        <div
          style={{
            fontSize: 12,
            color: NEX.textDim,
            textAlign: "center",
            lineHeight: 1.55,
            marginBottom: 20,
          }}
        >
          It disappears for both of you. Everyone sees a placeholder
          where this message was. You can only retract within an hour
          of sending.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: 10,
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: NEX.text,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <form action={action} style={{ flex: 1, display: "flex" }}>
            <input type="hidden" name="message_id" value={messageId} />
            <button
              type="submit"
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: 10,
                background: NEX.red,
                border: `1px solid ${NEX.red}`,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.02em",
              }}
            >
              Delete
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

function ReplyIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 00-4-4H4" />
    </svg>
  );
}
