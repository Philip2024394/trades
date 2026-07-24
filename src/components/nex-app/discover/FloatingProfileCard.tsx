"use client";

// FloatingProfileCard — one floating rounded-square profile card in
// the Discover universe. Replaces the old ProfileBubble circular
// avatar per the redesign brief.
//
// Visual anatomy:
//   · rounded-square (1:1) card, ~90–170px depending on depth layer
//   · white 3px inner frame around the photo
//   · gradient scrim at the bottom holding name + age
//   · NEX Verified pill top-right (only for profiles.verified)
//   · optional floating activity badge outside the card
//   · selected → warm orange glow rim + scale-up
//   · long-press → 5s red countdown → dissolve particles
//
// Position + rotation are controlled by the parent universe via
// direct DOM transform mutation on the mounted wrapper ref, so each
// frame is 60fps without React re-rendering.

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, Heart, MessageCircle, Sparkles } from "lucide-react";
import type { DiscoverProfile } from "@/lib/nex/discover/_types";

const DISMISS_HOLD_MS = 5000;
const QUICK_TAP_MS    = 350;
const DRAG_THRESHOLD  = 12;   // px — beyond this, treat as drag not tap/hold

export type CardController = {
  focus: () => void;
};

export type ActivityKind = "liked" | "viewing" | "sent-like" | "new-match";

// Small velocity sample buffer used to compute release velocity when
// the user flings a card. We take the last few samples so the fling
// direction feels correct even when the finger slows just before lift.
type PointerSample = { t: number; x: number; y: number };

export function FloatingProfileCard({
  slotId,
  profile,
  size,
  rotation,
  depth,
  activity,
  selected,
  dismissing,
  onPressStart,
  onPressEnd,
  onDismiss,
  onDragStart,
  onDrag,
  onFling,
  onMount,
  onUnmount
}: {
  slotId:       string;
  profile:      DiscoverProfile;
  size:         number;
  rotation:     number;
  depth:        0 | 1 | 2;
  activity?:    ActivityKind;
  selected:     boolean;
  dismissing:   boolean;
  onPressStart: () => void;
  onPressEnd:   (wasQuickTap: boolean) => void;
  onDismiss:    () => void;
  onDragStart:  () => void;
  onDrag:       (dx: number, dy: number) => void;
  onFling:      (vx: number, vy: number) => void;
  onMount:      (el: HTMLDivElement, ctrl: CardController) => void;
  onUnmount:    () => void;
}) {
  const wrapperRef    = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef      = useRef<number | null>(null);
  const intervalRef   = useRef<number | null>(null);
  const pressStartRef = useRef<number | null>(null);

  // Drag state
  const startXRef     = useRef<number>(0);
  const startYRef     = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const samplesRef    = useRef<PointerSample[]>([]);

  useEffect(() => {
    if (wrapperRef.current) {
      onMount(wrapperRef.current, { focus: () => wrapperRef.current?.focus() });
    }
    return () => onUnmount();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startPress(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
    pressStartRef.current = Date.now();
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    isDraggingRef.current = false;
    samplesRef.current = [{ t: performance.now(), x: e.clientX, y: e.clientY }];

    onPressStart();
    setCountdown(5);
    intervalRef.current = window.setInterval(() => {
      setCountdown((c) => (c == null ? c : Math.max(0, c - 1)));
    }, 1000);
    timerRef.current = window.setTimeout(() => {
      clearCountdown();
      if (!isDraggingRef.current) onDismiss();
    }, DISMISS_HOLD_MS);
  }
  function clearCountdown() {
    setCountdown(null);
    if (timerRef.current != null)    { window.clearTimeout(timerRef.current); timerRef.current = null; }
    if (intervalRef.current != null) { window.clearInterval(intervalRef.current); intervalRef.current = null; }
  }

  function movePointer(e: React.PointerEvent) {
    if (pressStartRef.current == null) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    // Sample buffer for velocity (keep only last ~80ms of samples)
    const now = performance.now();
    samplesRef.current.push({ t: now, x: e.clientX, y: e.clientY });
    while (samplesRef.current.length > 1 && now - samplesRef.current[0].t > 100) {
      samplesRef.current.shift();
    }

    if (!isDraggingRef.current) {
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        // Enter drag mode — cancel the hold countdown, hand over
        // position control to the parent.
        isDraggingRef.current = true;
        clearCountdown();
        onDragStart();
      } else {
        return;
      }
    }
    onDrag(dx, dy);
  }

  function endPress(e?: React.PointerEvent) {
    const startedAt = pressStartRef.current;
    pressStartRef.current = null;
    const stillPressing = timerRef.current != null || isDraggingRef.current;
    clearCountdown();

    if (isDraggingRef.current) {
      // Compute release velocity from the sample buffer
      const samples = samplesRef.current;
      let vx = 0, vy = 0;
      if (samples.length >= 2) {
        const first = samples[0];
        const last  = samples[samples.length - 1];
        const dt = Math.max(0.001, (last.t - first.t) / 1000);
        vx = (last.x - first.x) / dt;
        vy = (last.y - first.y) / dt;
      }
      isDraggingRef.current = false;
      samplesRef.current = [];
      onFling(vx, vy);
      return;
    }

    if (!stillPressing || dismissing) return;
    const heldMs = startedAt != null ? Date.now() - startedAt : 0;
    onPressEnd(heldMs < QUICK_TAP_MS);
    // Explicitly silence lint on the unused parameter — we could
    // release pointer capture here but modern browsers do it on
    // pointerup automatically.
    void e;
  }

  // Depth → visual atmosphere (opacity + blur)
  const depthOpacity = depth === 0 ? 0.72 : depth === 1 ? 0.9 : 1;
  const depthBlur    = depth === 0 ? 1.2  : depth === 1 ? 0.4 : 0;
  const depthZ       = depth === 0 ? 6    : depth === 1 ? 12  : 18;

  return (
    <div
      ref={wrapperRef}
      data-slot-id={slotId}
      className="absolute select-none"
      style={{
        width:  size,
        height: size,
        top:    0,
        left:   0,
        willChange: "transform, opacity",
        touchAction: "none",
        zIndex: selected ? 40 : depthZ,
        pointerEvents: dismissing ? "none" : "auto",
        opacity: dismissing ? 0 : depthOpacity,
        filter: `blur(${dismissing ? 0 : depthBlur}px)`,
        transition: "opacity 500ms, filter 400ms"
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label={`${profile.first_name} — tap to open, hold to remove`}
        onPointerDown={startPress}
        onPointerMove={movePointer}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onPointerCancel={endPress}
        onContextMenu={(e) => e.preventDefault()}
        className="group relative block h-full w-full"
        style={{
          transform: `rotate(${rotation}deg) scale(${dismissing ? 1.1 : selected ? 1.08 : 1})`,
          transition: "transform 260ms cubic-bezier(0.16,1,0.3,1)"
        }}
      >
        {/* Selected: warm orange glow rim */}
        {selected && (
          <span
            aria-hidden
            className="absolute -inset-1.5 rounded-[22px]"
            style={{
              background:
                "conic-gradient(from 0deg, rgba(251,191,36,0.6), rgba(245,158,11,0.9), rgba(251,191,36,0.6))",
              filter: "blur(10px)",
              animation: "nex-bubble-pulse 2.4s ease-in-out infinite"
            }}
          />
        )}
        {/* Long-press countdown rim */}
        {countdown != null && (
          <span
            aria-hidden
            className="absolute -inset-1 rounded-[20px]"
            style={{
              border: "3px solid var(--nex-error-500)",
              boxShadow: "0 0 14px rgba(239, 68, 68, 0.5)",
              animation: "nex-bubble-pulse 1s ease-in-out infinite"
            }}
          />
        )}

        {/* Card body — white frame + photo + bottom scrim */}
        <span
          className="relative block h-full w-full overflow-hidden rounded-[18px]"
          style={{
            background: "var(--nex-neutral-0)",
            border: "3px solid var(--nex-neutral-0)",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.8) inset, " +
              "0 10px 24px -8px rgba(24,18,10,0.25), " +
              "0 20px 44px -22px rgba(245,158,11,0.30)"
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={profile.photo_url}
            alt=""
            draggable={false}
            className="h-full w-full rounded-[14px] object-cover"
            loading="lazy"
          />

          {/* Bottom scrim + identity */}
          <div
            className="absolute inset-x-0 bottom-0 rounded-b-[14px] px-2.5 pt-6 pb-1.5"
            style={{
              background:
                "linear-gradient(180deg, rgba(24,18,10,0) 0%, rgba(24,18,10,0.65) 60%, rgba(24,18,10,0.85) 100%)"
            }}
          >
            <div
              className="truncate text-[11.5px] font-black leading-tight"
              style={{ color: "#FFFFFF", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}
            >
              {profile.first_name}{profile.age ? `, ${profile.age}` : ""}
            </div>
          </div>

          {/* NEX Verified pill — top-right, ONLY for verified profiles.
              This is the premium trust marker per the redesign brief. */}
          {profile.verified && (
            <span
              className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-widest text-[#141416]"
              style={{
                background: "linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)",
                boxShadow: "0 4px 10px -3px rgba(245,158,11,0.55)"
              }}
              aria-label="Verified by NEX"
            >
              <CheckCircle2 size={9} strokeWidth={2.75} fill="currentColor" />
              NEX
            </span>
          )}

          {/* Online dot */}
          {profile.online && !selected && countdown == null && (
            <span
              aria-label="Online"
              className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full"
              style={{
                background: "#22C55E",
                boxShadow: "0 0 0 2px rgba(255,255,255,0.9)"
              }}
            />
          )}

          {/* Long-press red overlay + count */}
          {countdown != null && (
            <span
              aria-hidden
              className="absolute inset-0 grid place-items-center rounded-[14px]"
              style={{
                background: "rgba(239, 68, 68, 0.55)",
                color: "#FFFFFF",
                fontSize: size * 0.4,
                fontWeight: 900,
                lineHeight: 1
              }}
            >
              {countdown}
            </span>
          )}

          {/* Dissolve particles */}
          {dismissing && (
            <>
              {[0, 60, 120, 180, 240, 300].map((angle) => (
                <span
                  key={angle}
                  aria-hidden
                  className="absolute rounded-full nex-bubble-particle"
                  style={{
                    left: "50%",
                    top:  "50%",
                    width: 8,
                    height: 8,
                    background: "var(--nex-accent-500)",
                    ["--nex-particle-x" as string]: `${Math.cos(angle * Math.PI / 180) * (size / 2 + 20)}px`,
                    ["--nex-particle-y" as string]: `${Math.sin(angle * Math.PI / 180) * (size / 2 + 20)}px`
                  }}
                />
              ))}
            </>
          )}
        </span>

        {/* Floating activity badge — outside the card, drifts with it */}
        {activity && !dismissing && !selected && countdown == null && (
          <ActivityBadge kind={activity} cardSize={size} />
        )}
      </button>
    </div>
  );
}

// ── Activity badge ─────────────────────────────────────────────────

function ActivityBadge({ kind, cardSize }: { kind: ActivityKind; cardSize: number }) {
  const meta = ACTIVITY_META[kind];
  return (
    <span
      className="pointer-events-none absolute flex items-center gap-1 rounded-full px-2 py-1 text-[9.5px] font-bold whitespace-nowrap"
      style={{
        top: -14,
        right: -cardSize * 0.28,
        background: "rgba(255,255,255,0.94)",
        color: "var(--nex-neutral-900)",
        border: "1px solid rgba(245,158,11,0.30)",
        boxShadow: "0 8px 20px -8px rgba(24,18,10,0.35), 0 2px 6px rgba(245,158,11,0.20)",
        backdropFilter: "blur(6px)",
        animation: "nex-activity-fade 5s ease-in-out forwards",
        zIndex: 50
      }}
    >
      <span style={{ color: meta.iconColor, display: "inline-flex" }}>
        {meta.icon}
      </span>
      {meta.text}
    </span>
  );
}

const ACTIVITY_META: Record<ActivityKind, { icon: React.ReactNode; text: string; iconColor: string }> = {
  liked:       { icon: <Heart         size={11} strokeWidth={0} fill="#EF4444" />, text: "Liked your photo", iconColor: "#EF4444" },
  viewing:     { icon: <Eye           size={11} strokeWidth={2} />,                 text: "Viewing you",      iconColor: "#F59E0B" },
  "sent-like": { icon: <MessageCircle size={11} strokeWidth={2} />,                 text: "Sent a like",      iconColor: "#F59E0B" },
  "new-match": { icon: <Sparkles      size={11} strokeWidth={2.25} />,              text: "New match",        iconColor: "#F59E0B" }
};
