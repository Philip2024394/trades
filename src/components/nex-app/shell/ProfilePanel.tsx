"use client";

// src/components/nex-app/shell/ProfilePanel.tsx
//
// NEX Profile · Phase D · In-shell identity surface
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase D §5
//
// §5 immutable · Profile and Control Center are DISTINCT surfaces.
// The three-dot opens Control Center. The Profile avatar opens THIS panel.
//
// This panel is deliberately minimal until the real Profile slice is
// authorised. Per §4 (no fake pages) it shows only what is genuinely
// knowable and marks everything else as "coming soon" honestly.
//
// Positioning matches ControlCenterPanel · absolute inset-0 anchored to
// the nearest positioned ancestor (AppShell root). It NEVER escapes the
// max-w-md phone frame.

import { useCallback, useEffect, useRef } from "react";

export type ProfilePanelProps = {
  isOpen: boolean;
  onClose: () => void;
  panelId: string;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
};

export function ProfilePanel({ isOpen, onClose, panelId, returnFocusRef }: ProfilePanelProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  // Escape closes + restores focus
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

  // Outside click closes · shares data-profile-entry marker so the
  // toggle button doesn't fight the outside handler
  useEffect(() => {
    if (!isOpen) return;
    const handler = (ev: MouseEvent | TouchEvent) => {
      const target = ev.target as Node | null;
      if (!target || !rootRef.current) return;
      if (rootRef.current.contains(target)) return;
      const entries = document.querySelectorAll("[data-profile-entry]");
      for (const entry of Array.from(entries)) {
        if (entry.contains(target)) return;
      }
      onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [isOpen, onClose]);

  // Focus close button on open
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => closeBtnRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [isOpen]);

  const handleBackdrop = useCallback((ev: React.MouseEvent<HTMLDivElement>) => {
    if (ev.target === ev.currentTarget) onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={rootRef}
      id={panelId}
      role="dialog"
      aria-modal="false"
      aria-label="NEX Profile"
      data-testid="nex-profile-panel"
      data-scope="phone-frame"
      className={[
        // Phase D · scoped to phone frame · matches Control Center pattern
        "absolute inset-0 z-50 flex items-end",
        "bg-black/40 backdrop-blur-sm",
        "animate-[nex-profile-fade_140ms_ease-out]",
      ].join(" ")}
      onClick={handleBackdrop}
    >
      <div
        className={[
          "w-full",
          "bg-white text-neutral-900",
          "rounded-t-2xl",
          "shadow-[0_-4px_40px_rgba(0,0,0,0.25)]",
          "pb-[env(safe-area-inset-bottom,0px)]",
          "animate-[nex-profile-slide_160ms_ease-out]",
        ].join(" ")}
      >
        {/* Grabber (mobile sheet convention) */}
        <div className="grid place-items-center pt-2 pb-1">
          <span className="h-1 w-10 rounded-full bg-neutral-300" aria-hidden="true" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-2 pb-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-500">You</div>
            <div className="text-lg font-semibold">NEX Profile</div>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="rounded-full bg-neutral-100 hover:bg-neutral-200 h-9 w-9 grid place-items-center text-xl leading-none"
            aria-label="Close Profile"
            data-testid="nex-profile-close"
          >
            ×
          </button>
        </div>

        {/* Honest identity strip */}
        <div className="px-5 pb-4">
          <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-3 py-3">
            <div
              aria-hidden="true"
              className="h-12 w-12 rounded-full bg-neutral-200 grid place-items-center text-neutral-500 text-sm font-semibold"
            >
              NX
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">Signed-in NEX user</div>
              <div className="text-[11px] text-neutral-500">
                Profile details ship in the authorised Profile slice.
              </div>
            </div>
          </div>
        </div>

        {/* Honest availability chips */}
        <div className="px-5 pb-4 space-y-2">
          <UnavailableRow label="Edit profile" />
          <UnavailableRow label="My published content" />
          <UnavailableRow label="Following" />
          <UnavailableRow label="Sign out" />
        </div>

        {/* Footer · §4 immutable */}
        <div className="px-5 pb-5 pt-1 text-[10px] text-neutral-400 border-t border-neutral-100">
          NEX will never fabricate profile data. These options unlock as
          each surface is authorised and shipped.
        </div>

        <style>{`
          @keyframes nex-profile-fade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes nex-profile-slide { from { transform: translateY(100%); } to { transform: translateY(0); } }
        `}</style>
      </div>
    </div>
  );
}

function UnavailableRow({ label }: { label: string }) {
  return (
    <div
      className="flex items-center justify-between rounded-lg px-3 py-2 bg-neutral-50"
      data-testid={`nex-profile-row-${label.toLowerCase().replace(/\s+/g, "-")}`}
      data-availability="NOT_YET_AVAILABLE"
    >
      <span className="text-sm text-neutral-400">{label}</span>
      <span className="text-[10px] uppercase tracking-wider text-neutral-400 bg-neutral-100 rounded-full px-2 py-0.5">
        Not available yet
      </span>
    </div>
  );
}
