"use client";

// Founder 2026-09-10 · TRUE-VISION cog wheel.
//
// GOLDEN RULE: this cog spins ONLY when the measured signal shows the
// room is actively harvesting. If nothing has happened in the last 30
// minutes, the cog goes still and greys out. Never fake motion. The
// founder trusts this icon to reflect reality.
//
// Signals it uses (in priority order):
//   1. last_harvested_age_sec ≤ 300 (5 min)   → SPINNING FAST · fresh
//   2. last_harvested_age_sec ≤ 1800 (30 min) → SPINNING · warm
//   3. growth_1h_pct > 0                      → SPINNING SLOW · growing
//   4. otherwise                              → STATIC GREY · idle

import type { CSSProperties } from "react";

export interface WorkingCogSignals {
  last_harvested_age_sec?: number | null;
  growth_1h_pct?: number | null;
}

export function WorkingCog({
  signals,
  size = 22,
  title,
}: {
  signals: WorkingCogSignals;
  size?: number;
  title?: string;
}) {
  const ageSec = signals.last_harvested_age_sec ?? null;
  const growth = signals.growth_1h_pct ?? null;

  // Determine state · MEASURED only, never guessed
  let state: "fresh" | "warm" | "growing" | "idle";
  if (ageSec != null && ageSec <= 300)              state = "fresh";
  else if (ageSec != null && ageSec <= 1800)        state = "warm";
  else if (growth != null && growth > 0)            state = "growing";
  else                                              state = "idle";

  const active = state !== "idle";
  const durationSec = state === "fresh" ? 2 : state === "warm" ? 4 : state === "growing" ? 6 : 0;
  const color = active ? "#22c55e" : "#475569";

  const spinStyle: CSSProperties = active ? {
    animation: `nex-cog-spin ${durationSec}s linear infinite`,
    transformOrigin: `${size / 2}px ${size / 2}px`,
  } : {};

  const tooltip = title ?? (
    active
      ? `Working · state=${state}${ageSec != null ? ` · last harvest ${ageSec < 60 ? ageSec + "s" : Math.round(ageSec / 60) + "m"} ago` : ""}`
      : `Idle · no harvest in last 30 min${growth != null ? ` · growth ${growth.toFixed(2)}%/h` : ""}`
  );

  return (
    <>
      <style>{`
        @keyframes nex-cog-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      <svg
        width={size} height={size} viewBox="0 0 24 24"
        style={{ display: "block", flexShrink: 0 }}
        aria-label={tooltip}
      >
        <title>{tooltip}</title>
        <g style={spinStyle} fill={color}>
          {/* 8-tooth cog · centered on (12,12) */}
          <path
            d="M12 2 L13.5 5.5 L17 4.5 L17 8 L20.5 9.5 L18.5 12 L20.5 14.5 L17 16 L17 19.5 L13.5 18.5 L12 22 L10.5 18.5 L7 19.5 L7 16 L3.5 14.5 L5.5 12 L3.5 9.5 L7 8 L7 4.5 L10.5 5.5 Z"
            opacity="0.85"
          />
          <circle cx="12" cy="12" r="3.2" fill="#0a0d10" />
          <circle cx="12" cy="12" r="1.6" fill={color} opacity="0.6" />
        </g>
        {active && (
          <circle cx="20" cy="4" r="2.4" fill={color}>
            <animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
    </>
  );
}
