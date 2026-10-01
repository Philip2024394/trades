"use client";

// src/app/nex-native/_trust-scan/TrustScanReveal.tsx
//
// Cinematic lead-in · theme-neutral · runs in two phases:
//   1. receiving  (3s)   · circular progress ring 0→100% · counter + label
//   2. revealing  (1.5s) · optional full-screen image (from skin) + "ACCOUNT
//                          IDENTIFIED" tag · corner HUD brackets
//
// The actual Trust Scan report is NOT inside this component · once the
// cinematic finishes, the orchestrator (TrustScan) swaps to the full
// four-block report. Every colour / label / image / glyph is pulled from
// the skin so themes can style the sequence without forking the engine.

import * as React from "react";
import type { TrustScanData, TrustScanSkin } from "./trust-scan-types";
import { summariseSignals } from "./trust-scan-types";

const T_RECEIVING_MS = 3000;
const T_REVEALING_MS = 2200;

export function TrustScanReveal({
  skin,
  data,
  onDone,
}: {
  skin: TrustScanSkin;
  /** Fetched data · usually ready by the time receiving completes.
   *  Null = still fetching, UI gracefully shows a "FINALISING…" state
   *  during the reveal phase until it arrives. */
  data: TrustScanData | null;
  onDone: () => void;
}): React.JSX.Element {
  const [phase, setPhase] = React.useState<"receiving" | "revealing">(
    "receiving",
  );
  React.useEffect(() => {
    const t1 = window.setTimeout(() => setPhase("revealing"), T_RECEIVING_MS);
    const t2 = window.setTimeout(onDone, T_RECEIVING_MS + T_REVEALING_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <style>{`
        @keyframes trust-scan-phase-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes trust-scan-pulse {
          0%, 100% { opacity: 0.75; letter-spacing: 0.28em; }
          50%      { opacity: 1;    letter-spacing: 0.34em; }
        }
        @keyframes trust-scan-reveal-zoom {
          0%   { transform: scale(0.94); opacity: 0; }
          100% { transform: scale(1);    opacity: 1; }
        }
      `}</style>
      {phase === "receiving" && <ReceivingPhase skin={skin} />}
      {phase === "revealing" && <RevealingPhase skin={skin} data={data} />}
    </div>
  );
}

function ReceivingPhase({ skin }: { skin: TrustScanSkin }): React.JSX.Element {
  const [pct, setPct] = React.useState(0);
  React.useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const next = Math.min(100, Math.floor((elapsed / T_RECEIVING_MS) * 100));
      setPct(next);
      if (next >= 100) window.clearInterval(id);
    }, 40);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        animation: "trust-scan-phase-in 320ms ease-out both",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        <ProgressRing pct={pct} skin={skin} />
        <div
          style={{
            color: skin.colors.accent,
            fontSize: 11,
            letterSpacing: "0.28em",
            fontWeight: 700,
            animation: "trust-scan-pulse 900ms ease-in-out infinite",
            textShadow: `0 0 10px ${skin.colors.accent}99`,
            fontFamily: skin.fontMono,
          }}
        >
          {skin.cinematic.receivingLabel}
        </div>
        <div
          style={{
            color: skin.colors.textMuted,
            fontSize: 9,
            letterSpacing: "0.22em",
            fontFamily: skin.fontMono,
          }}
        >
          {skin.cinematic.receivingSubtitle}
        </div>
      </div>
    </div>
  );
}

function ProgressRing({
  pct,
  skin,
}: {
  pct: number;
  skin: TrustScanSkin;
}): React.JSX.Element {
  const SIZE = 196;
  const R = 86;
  const CIRC = 2 * Math.PI * R;
  const dashOffset = CIRC * (1 - pct / 100);
  return (
    <div style={{ position: "relative", width: SIZE, height: SIZE }}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{
          transform: "rotate(-90deg)",
          filter: `drop-shadow(0 0 14px ${skin.colors.accent}80)`,
        }}
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R + 10}
          fill="none"
          stroke={`${skin.colors.accent}33`}
          strokeWidth={1}
          strokeDasharray="2 4"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={5}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={skin.colors.accent}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 40ms linear" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              color: skin.colors.textPrimary,
              lineHeight: 1,
              letterSpacing: "0.01em",
              fontVariantNumeric: "tabular-nums",
              fontFamily: skin.fontMono,
              textShadow: `0 0 12px ${skin.colors.accent}80`,
            }}
          >
            {pct}
            <span
              style={{
                fontSize: 24,
                color: skin.colors.accent,
                marginLeft: 2,
              }}
            >
              %
            </span>
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 8,
              letterSpacing: "0.3em",
              color: skin.colors.textMuted,
              fontFamily: skin.fontMono,
            }}
          >
            SCAN DEPTH
          </div>
        </div>
      </div>
    </div>
  );
}

function RevealingPhase({
  skin,
  data,
}: {
  skin: TrustScanSkin;
  data: TrustScanData | null;
}): React.JSX.Element {
  const summary = data ? summariseSignals(data.signals) : null;
  // Sealed Phase 2 copy · the badge describes THE SIGNALS, never
  // declares the account itself safe or unsafe.
  const badge = (() => {
    if (!summary) return null;
    switch (summary.dominant) {
      case "warning":
        return {
          color: skin.colors.danger,
          label: "SIGNALS NEED ATTENTION",
          sub: `${summary.warning} warning${summary.warning === 1 ? "" : "s"} · ${summary.caution} caution`,
        };
      case "caution":
        return {
          color: skin.colors.warn,
          label: "REVIEW SIGNALS",
          sub: `${summary.caution} caution item${summary.caution === 1 ? "" : "s"} · ${summary.ok} positive`,
        };
      case "ok":
        return {
          color: skin.colors.success,
          label: "NO WARNINGS",
          sub: `${summary.ok} positive signal${summary.ok === 1 ? "" : "s"} · 0 warnings`,
        };
      default:
        return {
          color: skin.colors.textMuted,
          label: "LIMITED SIGNALS",
          sub: "NEX has little information on this account yet",
        };
    }
  })();
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        padding: "80px 36px",
        animation: "trust-scan-phase-in 320ms ease-out both",
      }}
    >
      {/* Soft accent wash behind the chrome */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 50% 45%, ${skin.colors.accent}33 0%, transparent 72%)`,
        }}
      />
      {/* Corner HUD · frames the account like a scanner locking on */}
      <HudCorner pos="tl" skin={skin} />
      <HudCorner pos="tr" skin={skin} />
      <HudCorner pos="bl" skin={skin} />
      <HudCorner pos="br" skin={skin} />
      {/* Top-left status eyebrow · skin-controlled copy */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          color: skin.colors.accent,
          fontSize: 10,
          letterSpacing: "0.28em",
          fontWeight: 700,
          textShadow: `0 0 10px ${skin.colors.accent}aa`,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          animation: "trust-scan-pulse 700ms ease-in-out infinite",
          fontFamily: skin.fontMono,
        }}
      >
        <div>▌ {skin.cinematic.revealLabel}</div>
        <div
          style={{
            color: skin.colors.textMuted,
            fontSize: 9,
            letterSpacing: "0.22em",
          }}
        >
          {skin.cinematic.revealSubtitle}
        </div>
      </div>

      {/* Account chrome · avatar + name + signal badge */}
      {data ? (
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            animation: "trust-scan-reveal-zoom 420ms cubic-bezier(.2,.7,.2,1) both",
            textAlign: "center",
          }}
        >
          <AccountAvatar
            name={data.displayName}
            avatarUrl={data.avatarUrl ?? null}
            ring={badge?.color ?? skin.colors.accent}
            skin={skin}
          />
          <div
            style={{
              color: skin.colors.textPrimary,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "0.01em",
              fontFamily: skin.fontDisplay,
              textShadow: `0 0 12px ${skin.colors.accent}66`,
            }}
          >
            {data.displayName}
          </div>
          {badge && (
            <div
              style={{
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                padding: "10px 18px",
                borderRadius: 999,
                background: `${badge.color}22`,
                border: `1px solid ${badge.color}aa`,
                color: badge.color,
                boxShadow: `0 0 24px ${badge.color}55`,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.26em",
                  fontWeight: 700,
                  fontFamily: skin.fontMono,
                }}
              >
                {badge.label}
              </div>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: "0.14em",
                  color: skin.colors.textMuted,
                  fontFamily: skin.fontMono,
                }}
              >
                {badge.sub}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            color: skin.colors.textMuted,
            fontSize: 11,
            letterSpacing: "0.22em",
            fontFamily: skin.fontMono,
          }}
        >
          FINALISING SCAN…
        </div>
      )}
    </div>
  );
}

function AccountAvatar({
  name,
  avatarUrl,
  ring,
  skin,
}: {
  name: string;
  avatarUrl: string | null;
  ring: string;
  skin: TrustScanSkin;
}): React.JSX.Element {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      aria-hidden
      style={{
        width: 128,
        height: 128,
        borderRadius: "50%",
        background: avatarUrl
          ? `center/cover no-repeat url(${avatarUrl})`
          : "rgba(255,255,255,0.08)",
        border: `2px solid ${ring}`,
        boxShadow: `0 0 24px ${ring}66, inset 0 0 20px rgba(0,0,0,0.5)`,
        display: "grid",
        placeItems: "center",
        color: skin.colors.textPrimary,
        fontSize: 48,
        fontWeight: 700,
        fontFamily: skin.fontDisplay,
        letterSpacing: 0,
      }}
    >
      {avatarUrl ? "" : initial}
    </div>
  );
}

function HudCorner({
  pos,
  skin,
}: {
  pos: "tl" | "tr" | "bl" | "br";
  skin: TrustScanSkin;
}): React.JSX.Element {
  const base: React.CSSProperties = {
    position: "absolute",
    width: 42,
    height: 42,
    borderColor: skin.colors.accent,
    borderStyle: "solid",
    opacity: 0.85,
    filter: `drop-shadow(0 0 6px ${skin.colors.accent}99)`,
  };
  const corner = (() => {
    switch (pos) {
      case "tl":
        return { top: 56, left: 20, borderWidth: "2px 0 0 2px" };
      case "tr":
        return { top: 56, right: 20, borderWidth: "2px 2px 0 0" };
      case "bl":
        return { bottom: 56, left: 20, borderWidth: "0 0 2px 2px" };
      case "br":
        return { bottom: 56, right: 20, borderWidth: "0 2px 2px 0" };
    }
  })();
  return <div style={{ ...base, ...corner }} />;
}
