"use client";

// src/components/nex-app/live/CreatorPanel.tsx
//
// NEX LIVE · Phase B · Creator panel (RECORD · UPLOAD · GO LIVE · EDIT · MY LIVE)
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · PHASE B
//
// The panel that opens from CreatorEntryButton. Sits above the lower-
// right corner of the NEX Live surface as a compact sheet — NOT a
// full-screen modal, NOT a hamburger menu, NOT a TikTok-style action
// carousel (§18).
//
// Behaviour (§9 · §10 · §11):
//   · Escape key closes
//   · Click outside closes
//   · Only one panel visible at a time (deduped via CreatorEntryButton
//     controlling `isOpen`)
//   · Focus is trapped only softly — Tab cycles inside the panel while
//     open; Shift+Tab reverses; Escape restores focus to the entry
//     button.
//   · Primary actions (Record, Upload, Go Live) render first with a
//     stronger visual weight; secondary (Edit, My Live) render below
//     with a hairline separator.
//   · Unavailable actions render dimmed with an honest "Not available
//     yet" chip (§7 · §14 · §17). They are NOT tappable — no fake
//     activation.

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import {
  partitionByPriority,
  isTappable,
  statusText,
  type CreatorAction,
} from "./creator-actions";

export type CreatorPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  panelId: string;
  /** Focus target to restore when the panel closes. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
};

export function CreatorPanel({ isOpen, onClose, panelId, returnFocusRef }: CreatorPanelProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const firstItemRef = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null);

  // Escape closes + restores focus.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        onClose();
        returnFocusRef?.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose, returnFocusRef]);

  // Click-outside closes.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (ev: MouseEvent | TouchEvent) => {
      const target = ev.target as Node | null;
      if (!target) return;
      if (rootRef.current && !rootRef.current.contains(target)) {
        // Do NOT close when the click was on the entry button — that
        // button toggles us; letting both fire would immediately re-open.
        const entry = document.querySelector('[data-testid="nex-live-creator-entry"]');
        if (entry && entry.contains(target)) return;
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [isOpen, onClose]);

  // Move focus to the first action when the panel opens.
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => firstItemRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, [isOpen]);

  if (!isOpen) return null;

  const { primary, secondary } = partitionByPriority();

  return (
    <div
      ref={rootRef}
      id={panelId}
      role="dialog"
      aria-modal="false"
      aria-label="Create for NEX Live"
      data-testid="nex-live-creator-panel"
      className={[
        // Positioning: anchored above the lower-right, respects safe
        // area on iOS. On very narrow viewports, still fits comfortably.
        "absolute",
        "right-4 bottom-20",
        "pb-[env(safe-area-inset-bottom,0px)]",
        "min-w-[220px] max-w-[280px]",
        // Visual: calm dark sheet, subtle border, no gradient noise.
        "rounded-2xl bg-neutral-950/95 backdrop-blur",
        "border border-white/10",
        "shadow-[0_10px_40px_rgba(0,0,0,0.6)]",
        "text-white",
        "z-40",
        // Motion: fast fade-in via CSS.
        "animate-[nex-panel-in_120ms_ease-out]",
        "select-none",
      ].join(" ")}
    >
      {/* Header · single line, restrained */}
      <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest text-white/40">
        Create for NEX Live
      </div>

      {/* Primary actions */}
      <ul className="px-1 pt-1 pb-1" role="list">
        {primary.map((a, idx) => (
          <ActionItem
            key={a.id}
            action={a}
            emphasis="primary"
            firstItemRef={idx === 0 ? firstItemRef : undefined}
            onNavigate={onClose}
          />
        ))}
      </ul>

      {/* Hairline separator */}
      <div className="mx-3 my-1 h-px bg-white/10" role="separator" />

      {/* Secondary actions */}
      <ul className="px-1 pt-1 pb-2" role="list">
        {secondary.map((a) => (
          <ActionItem key={a.id} action={a} emphasis="secondary" onNavigate={onClose} />
        ))}
      </ul>

      <style>{`
        @keyframes nex-panel-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </div>
  );
}

// ── ActionItem ────────────────────────────────────────────────────

function ActionItem({
  action,
  emphasis,
  firstItemRef,
  onNavigate,
}: {
  action: CreatorAction;
  emphasis: "primary" | "secondary";
  firstItemRef?: React.RefObject<HTMLAnchorElement | HTMLButtonElement | null>;
  onNavigate: () => void;
}) {
  const tappable = isTappable(action);
  const status = statusText(action);

  const contentInside = (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div
          className={[
            emphasis === "primary" ? "text-[15px] font-semibold" : "text-[14px] font-medium",
            tappable ? "text-white" : "text-white/40",
          ].join(" ")}
        >
          {action.label}
        </div>
        <div
          className={[
            "text-[11px]",
            tappable ? "text-white/50" : "text-white/25",
            "truncate",
          ].join(" ")}
        >
          {action.short_hint}
        </div>
      </div>
      {status && (
        <span
          className={[
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
            action.availability === "NOT_YET_AVAILABLE"
              ? "bg-white/5 text-white/40"
              : "bg-white/10 text-white/60",
          ].join(" ")}
        >
          {status}
        </span>
      )}
    </div>
  );

  const baseClasses = [
    "block w-full rounded-lg px-3 py-2 text-left",
    "focus:outline-none",
    tappable
      ? "hover:bg-white/8 active:bg-white/12 focus-visible:ring-2 focus-visible:ring-white/40"
      : "cursor-not-allowed",
  ].join(" ");

  if (tappable && action.href) {
    return (
      <li>
        <Link
          ref={firstItemRef as React.RefObject<HTMLAnchorElement>}
          href={action.href}
          onClick={onNavigate}
          data-testid={`nex-live-creator-action-${action.id}`}
          data-availability={action.availability}
          className={baseClasses}
        >
          {contentInside}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <button
        ref={firstItemRef as React.RefObject<HTMLButtonElement>}
        type="button"
        disabled
        aria-disabled="true"
        data-testid={`nex-live-creator-action-${action.id}`}
        data-availability={action.availability}
        className={baseClasses}
      >
        {contentInside}
      </button>
    </li>
  );
}
