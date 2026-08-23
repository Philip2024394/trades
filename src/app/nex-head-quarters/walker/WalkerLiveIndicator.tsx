"use client";

// Task #86 (2026-08-22) · Walker Live Indicator · client component.
//
// Purpose: give the operator an INSTANT visual answer to
//   "Is Walker actually alive right now?"
// The animation MUST be driven by the real worker heartbeat age passed as a
// prop from the server component (which reads nex.worker_heartbeat). If Walker
// is genuinely stopped, the indicator says so honestly — never fake activity.
//
// Threshold semantics (matches Walker's 15-min cadence · Task #84):
//   age_s < 60           →  🟠 CURRENTLY RUNNING   · pulsing animation
//   60 ≤ age_s < 900     →  🟢 IDLE                · normal between-tick state
//   900 ≤ age_s < 1800   →  ⚠️ OVERDUE             · should have ticked by now
//   age_s ≥ 1800 or null →  🔴 STOPPED             · scheduler is off · Victus off · dead
//
// Doctrine anchor: project_nex_workers_machine_independent_24_7_2026_08_22
// (Victus OFF = Walker STOPS honestly · we show that reality)

import { useEffect, useState } from "react";

export type WalkerLiveState = {
  ageSeconds: number | null;
  lastHeartbeatAt: string | null;
  lastStatus: string | null;
  currentZone: string | null;
};

const IDLE_MAX_S     = 900;   // 15-min cadence · Walker's normal quiet window
const OVERDUE_MAX_S  = 1800;  // 30-min · beyond this Walker is stopped

function resolveState(ageSeconds: number | null): {
  label: string;
  glyph: string;
  color: string;
  bg: string;
  border: string;
  animate: boolean;
} {
  if (ageSeconds == null || ageSeconds >= OVERDUE_MAX_S) {
    return {
      label: "STOPPED",
      glyph: "🔴",
      color: "#b91c1c",
      bg: "rgba(239, 68, 68, 0.10)",
      border: "rgba(239, 68, 68, 0.45)",
      animate: false,
    };
  }
  if (ageSeconds >= IDLE_MAX_S) {
    return {
      label: "OVERDUE",
      glyph: "⚠️",
      color: "#a16207",
      bg: "rgba(250, 204, 21, 0.12)",
      border: "rgba(250, 204, 21, 0.45)",
      animate: false,
    };
  }
  if (ageSeconds >= 60) {
    return {
      label: "IDLE",
      glyph: "🟢",
      color: "#047857",
      bg: "rgba(16, 185, 129, 0.10)",
      border: "rgba(16, 185, 129, 0.45)",
      animate: false,
    };
  }
  return {
    label: "CURRENTLY RUNNING",
    glyph: "🟠",
    color: "#c2410c",
    bg: "rgba(249, 115, 22, 0.14)",
    border: "rgba(249, 115, 22, 0.55)",
    animate: true,
  };
}

function fmtAge(s: number | null): string {
  if (s == null) return "never";
  if (s < 60)       return `${s}s ago`;
  if (s < 3600)     return `${Math.round(s / 60)}m ago`;
  if (s < 86400)    return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export default function WalkerLiveIndicator({ state }: { state: WalkerLiveState }) {
  // Local age counter · advances every second so operator sees liveness even
  // between server-side refreshes. Reset from prop when a new heartbeat arrives.
  const [ageOffset, setAgeOffset] = useState(0);
  useEffect(() => {
    setAgeOffset(0);
    const t = setInterval(() => setAgeOffset((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [state.lastHeartbeatAt]);

  const liveAge = state.ageSeconds == null ? null : state.ageSeconds + ageOffset;
  const s = resolveState(liveAge);

  return (
    <div style={wrapperStyle}>
      <style>{keyframes}</style>
      <div style={{ ...dotStyle, background: s.color, animation: s.animate ? "walkerPulse 1.1s ease-in-out infinite" : "none" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 14px",
          borderRadius: 999,
          background: s.bg,
          color: s.color,
          border: `1px solid ${s.border}`,
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: 0.5,
        }}>
          {s.glyph} WALKER · {s.label}
        </div>
        <div style={{ fontSize: 11, color: "var(--nex-neutral-500)", marginLeft: 4 }}>
          heartbeat {fmtAge(liveAge)}
          {state.currentZone ? ` · last zone: ${state.currentZone}` : ""}
          {state.lastStatus ? ` · status: ${state.lastStatus}` : ""}
        </div>
      </div>
    </div>
  );
}

const wrapperStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const dotStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: "50%",
  flexShrink: 0,
};

const keyframes = `
@keyframes walkerPulse {
  0%   { transform: scale(1);   box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.55); }
  50%  { transform: scale(1.3); box-shadow: 0 0 0 8px rgba(249, 115, 22, 0); }
  100% { transform: scale(1);   box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); }
}`;
