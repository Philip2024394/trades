"use client";

// Live countdown for the themes-trial active banner.
// Doctrine 2026-10-04 · one 7-day trial per account · FREE pulse pill
// replaces the gift emoji · unlimited theme swaps during the window
// (updateChatThemeAction has no per-use counter · effectiveTier returns
// "bisnis" for the whole 7 days).

import * as React from "react";
import Link from "next/link";

const NEX = {
  cyan: "#00AFFF",
  orange: "#FF7800",
  green: "#16D66B",
  text: "#F4F7FC",
  bgSoft: "rgba(22,214,107,0.14)",
  bgSoftB: "rgba(0,175,255,0.10)",
};

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function TrialCountdownBanner({
  expiresIso,
}: {
  expiresIso: string;
}) {
  const expiresMs = React.useMemo(
    () => new Date(expiresIso).getTime(),
    [expiresIso],
  );
  const [remaining, setRemaining] = React.useState<number>(() =>
    Math.max(0, expiresMs - Date.now()),
  );

  React.useEffect(() => {
    const tick = () =>
      setRemaining(Math.max(0, expiresMs - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresMs]);

  if (remaining <= 0) return null;

  const label = formatRemaining(remaining);

  return (
    <div
      style={{
        marginBottom: 18,
        padding: "12px 16px",
        borderRadius: 12,
        background: `linear-gradient(135deg, ${NEX.bgSoft} 0%, ${NEX.bgSoftB} 100%)`,
        border: "1px solid rgba(22,214,107,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-block",
              padding: "3px 8px",
              borderRadius: 999,
              background: `linear-gradient(180deg, #FF9033 0%, ${NEX.orange} 100%)`,
              color: "#0B0F1A",
              fontSize: 9.5,
              fontWeight: 900,
              letterSpacing: "0.14em",
              animation:
                "nex-themes-trial-free-pulse 2.4s ease-in-out infinite",
            }}
          >
            FREE
          </span>
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: NEX.green,
              fontWeight: 800,
            }}
          >
            Trial active
          </span>
        </div>
        <div
          style={{
            fontSize: 13,
            color: NEX.text,
            lineHeight: 1.5,
          }}
        >
          Switch between every premium theme as often as you like.
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 15,
            color: NEX.green,
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.02em",
          }}
          aria-live="polite"
          aria-atomic="true"
        >
          {label} left
        </div>
      </div>
      <Link
        href="/nex-native/settings/tier"
        style={{
          padding: "9px 14px",
          borderRadius: 10,
          background:
            "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
          color: "#0B0F1A",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          textDecoration: "none",
          whiteSpace: "nowrap",
          boxShadow: "0 6px 14px rgba(255,120,0,0.35)",
        }}
      >
        Keep after trial
      </Link>
    </div>
  );
}
