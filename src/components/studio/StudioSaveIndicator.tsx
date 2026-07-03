"use client";

// StudioSaveIndicator — the persistent save-state chip.
//
// Drop into any editor toolbar. Merchants always know whether their
// work is safe. Standard Shopify / Wix / Notion pattern.
//
// Four states:
//   idle      · nothing to save (no visible chip)
//   saving    · animation, "Saving…"
//   saved     · green tick, "Saved N seconds ago" (auto-updates)
//   error     · red, "Not saved — retry", clickable
//
// Consumers own the state; this is a presentational component. The
// autosave pipeline (e.g. StudioLiveMirror) passes savedAt/isSaving/
// error via the useSaveState() hook or props directly.

import { useEffect, useState } from "react";

export type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string; onRetry?: () => void };

const GREEN = "#10B981";
const RED = "#DC2626";
const AMBER = "#F59E0B";
const NEUTRAL = "#737373";

export function StudioSaveIndicator({ state }: { state: SaveState }) {
  // Auto-refresh the "N seconds ago" copy every 15s so the label
  // stays accurate without the parent re-rendering.
  const [, tick] = useState(0);
  useEffect(() => {
    if (state.kind !== "saved") return;
    const id = window.setInterval(() => tick((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, [state.kind]);

  if (state.kind === "idle") return null;

  if (state.kind === "saving") {
    return (
      <Chip
        dotColor={AMBER}
        dotSpinning
        label="Saving…"
        title="Persisting your latest edit"
      />
    );
  }

  if (state.kind === "saved") {
    return (
      <Chip
        dotColor={GREEN}
        label={`Saved ${formatAgo(state.at)}`}
        title={`Last save: ${new Date(state.at).toLocaleTimeString()}`}
      />
    );
  }

  // error
  const onClick =
    "onRetry" in state && state.onRetry
      ? state.onRetry
      : undefined;
  return (
    <Chip
      dotColor={RED}
      label="Not saved — retry"
      title={state.message}
      onClick={onClick}
      danger
    />
  );
}

function Chip({
  dotColor,
  dotSpinning,
  label,
  title,
  onClick,
  danger
}: {
  dotColor: string;
  dotSpinning?: boolean;
  label: string;
  title?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const clickable = !!onClick;
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={!clickable}
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-widest transition disabled:cursor-default disabled:opacity-100"
      style={{
        background: danger ? "#FEE2E2" : "#FFFFFF",
        borderColor: danger ? "#FCA5A5" : "#E5E5E5",
        color: danger ? "#7F1D1D" : NEUTRAL,
        cursor: clickable ? "pointer" : "default"
      }}
    >
      <span
        className={dotSpinning ? "save-indicator-spinning" : ""}
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: dotColor
        }}
        aria-hidden="true"
      />
      <span>{label}</span>
      {dotSpinning && (
        <style>{`
          @keyframes save-indicator-spin { to { transform: rotate(360deg); } }
          .save-indicator-spinning {
            transform-origin: center;
            animation: save-indicator-spin 1s linear infinite;
            box-shadow: 0 0 0 2px transparent, 0 0 0 3px ${AMBER}55;
          }
        `}</style>
      )}
    </button>
  );
}

function formatAgo(at: number): string {
  const secs = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}
