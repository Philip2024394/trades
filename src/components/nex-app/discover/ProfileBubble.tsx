"use client";

// ProfileBubble — one round floating avatar in the universe canvas.
// Owns:
//   - Long-press-to-dismiss (5s countdown displayed on the bubble)
//   - Selected-state visuals (yellow glowing rim + slight scale-up)
//   - Dismissing animation (dissolve + fade out)
// Position is controlled by the parent universe via direct DOM
// transform mutation on the mounted div ref.

import { useEffect, useRef, useState } from "react";
import type { DiscoverProfile } from "@/lib/nex/discover/_types";

const DISMISS_HOLD_MS = 5000;
const QUICK_TAP_MS    = 350;    // release faster than this = tap → select

export type BubbleController = {
  focus: () => void;
};

export function ProfileBubble({
  slotId,
  profile,
  radius,
  selected,
  dismissing,
  onPressStart,
  onPressEnd,
  onDismiss,
  onMount,
  onUnmount
}: {
  slotId:       string;
  profile:      DiscoverProfile;
  radius:       number;
  selected:     boolean;
  dismissing:   boolean;
  onPressStart: () => void;                          // parent freezes bubble
  onPressEnd:   (wasQuickTap: boolean) => void;      // parent selects if quick, else unfreezes
  onDismiss:    () => void;
  onMount:      (el: HTMLDivElement, ctrl: BubbleController) => void;
  onUnmount:    () => void;
}) {
  const wrapperRef     = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef       = useRef<number | null>(null);
  const intervalRef    = useRef<number | null>(null);
  const pressStartRef  = useRef<number | null>(null);

  useEffect(() => {
    if (wrapperRef.current) {
      onMount(wrapperRef.current, {
        focus: () => wrapperRef.current?.focus()
      });
    }
    return () => onUnmount();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startPress(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pressStartRef.current = Date.now();
    onPressStart();                       // parent freezes bubble immediately
    setCountdown(5);
    intervalRef.current = window.setInterval(() => {
      setCountdown((c) => (c == null ? c : Math.max(0, c - 1)));
    }, 1000);
    timerRef.current = window.setTimeout(() => {
      clearCountdown();
      onDismiss();
    }, DISMISS_HOLD_MS);
  }

  function clearCountdown() {
    setCountdown(null);
    if (timerRef.current != null)    { window.clearTimeout(timerRef.current); timerRef.current = null; }
    if (intervalRef.current != null) { window.clearInterval(intervalRef.current); intervalRef.current = null; }
  }

  function endPress() {
    const startedAt = pressStartRef.current;
    pressStartRef.current = null;
    const stillPressing = timerRef.current != null;
    clearCountdown();
    if (!stillPressing || dismissing) return;
    const heldMs = startedAt != null ? Date.now() - startedAt : 0;
    const wasQuickTap = heldMs < QUICK_TAP_MS;
    onPressEnd(wasQuickTap);
  }

  return (
    <div
      ref={wrapperRef}
      data-slot-id={slotId}
      className="absolute select-none"
      style={{
        width:  radius * 2,
        height: radius * 2,
        top:    0,
        left:   0,
        willChange: "transform",
        touchAction: "none",
        zIndex: selected ? 30 : 10,
        pointerEvents: dismissing ? "none" : "auto"
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label={`${profile.first_name} — hold to remove, tap to open`}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onPointerCancel={endPress}
        onContextMenu={(e) => e.preventDefault()}
        className="group relative block h-full w-full rounded-full transition-transform"
        style={{
          transform: dismissing
            ? "scale(1.15)"
            : selected
              ? "scale(1.12)"
              : "scale(1)",
          opacity: dismissing ? 0 : 1,
          transitionDuration: dismissing ? "500ms" : "220ms",
          transitionTimingFunction: "var(--nex-ease-signature)"
        }}
      >
        {/* Yellow glowing rim on selected */}
        {selected && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full nex-bubble-glow"
          />
        )}
        {/* Long-press progress rim */}
        {countdown != null && (
          <span
            aria-hidden
            className="absolute inset-[-4px] rounded-full"
            style={{
              border: "3px solid var(--nex-error-500)",
              boxShadow: "0 0 12px rgba(239, 68, 68, 0.6)",
              animation: "nex-bubble-pulse 1s ease-in-out infinite"
            }}
          />
        )}
        {/* Avatar photo */}
        <span
          className="relative block h-full w-full overflow-hidden rounded-full"
          style={{
            border: "3px solid var(--nex-neutral-0)",
            boxShadow: "var(--nex-shadow-md)"
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={profile.photo_url}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {profile.online && !selected && countdown == null && (
            <span
              aria-label="Online"
              className="absolute bottom-1 right-1 h-3 w-3 rounded-full"
              style={{
                background: "var(--nex-success-500)",
                border: "2px solid var(--nex-neutral-0)"
              }}
            />
          )}
          {/* Long-press countdown number over the photo */}
          {countdown != null && (
            <span
              aria-hidden
              className="absolute inset-0 grid place-items-center"
              style={{
                background: "rgba(239, 68, 68, 0.65)",
                color: "var(--nex-neutral-0)",
                fontSize: radius * 0.9,
                fontWeight: 900,
                lineHeight: 1
              }}
            >
              {countdown}
            </span>
          )}
          {/* Dismiss dissolve — extra particles that spray outward */}
          {dismissing && (
            <>
              {[0, 60, 120, 180, 240, 300].map((angle) => (
                <span
                  key={angle}
                  aria-hidden
                  className="absolute rounded-full nex-bubble-particle"
                  style={{
                    left: "50%",
                    top: "50%",
                    width: 8,
                    height: 8,
                    background: "var(--nex-accent-500)",
                    ["--nex-particle-x" as string]: `${Math.cos(angle * Math.PI / 180) * (radius + 20)}px`,
                    ["--nex-particle-y" as string]: `${Math.sin(angle * Math.PI / 180) * (radius + 20)}px`
                  }}
                />
              ))}
            </>
          )}
        </span>
      </button>
      {/* Name + age beneath the bubble — dating-app convention.
          Occupation is intentionally NOT shown here; it lives in the
          speech card (detail view) so the browse view stays clean. */}
      {!dismissing && (
        <div
          className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-center"
          style={{ pointerEvents: "none" }}
        >
          <div
            className="text-[11px] font-bold leading-tight"
            style={{ color: "var(--nex-neutral-900)" }}
          >
            {profile.first_name}{profile.age ? `, ${profile.age}` : ""}
          </div>
        </div>
      )}
    </div>
  );
}
