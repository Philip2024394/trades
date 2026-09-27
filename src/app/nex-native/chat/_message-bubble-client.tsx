"use client";

// src/app/nex-native/chat/_message-bubble-client.tsx
//
// Bridge 5 · gesture wrapper around each message bubble.
// ------------------------------------------------------
// Handles the WhatsApp-style swipe-to-reply gesture:
//   · swipe-right on an incoming bubble → capture it as reply target
//   · swipe-left on an outgoing bubble → capture your own message
// A subtle arrow icon slides in as the user drags to signal the
// action. Threshold is 60px · below that the bubble snaps back.
//
// Reply state is carried in the URL (?reply=<id>) · single source of
// truth · survives refresh · no client state coordination needed
// between bubble list and composer.

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const NEX = {
  cyan: "#00AFFF",
};

const SWIPE_THRESHOLD = 60;
const SWIPE_MAX = 96;

export function MessageBubbleClient({
  messageId,
  mine,
  children,
}: {
  messageId: string;
  mine: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const startX = React.useRef<number | null>(null);
  const [dragX, setDragX] = React.useState(0);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  // Direction: incoming (not mine) swipes RIGHT (positive x). Outgoing
  // (mine) swipes LEFT (negative x). Direction is fixed per bubble.
  const swipeSign = mine ? -1 : 1;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    startX.current = e.clientX;
    wrapperRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (startX.current == null) return;
    const raw = e.clientX - startX.current;
    // Clamp to correct direction only.
    const dir = raw * swipeSign;
    if (dir <= 0) {
      setDragX(0);
      return;
    }
    const clamped = Math.min(dir, SWIPE_MAX);
    setDragX(clamped * swipeSign);
  };

  const finishSwipe = () => {
    if (startX.current == null) return;
    const distance = Math.abs(dragX);
    startX.current = null;
    setDragX(0);
    if (distance >= SWIPE_THRESHOLD) {
      const params = new URLSearchParams(search.toString());
      params.set("reply", messageId);
      // Preserve the messages scroll · shallow replace keeps state.
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
        touchAction: "pan-y",
        transform: `translateX(${dragX}px)`,
        transition:
          dragX === 0 ? "transform 220ms cubic-bezier(.2,.7,.2,1)" : "none",
      }}
    >
      {/* Reveal icon behind the bubble · fades in with drag progress */}
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
    </div>
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
