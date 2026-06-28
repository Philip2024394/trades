"use client";

// App Studio — animated tile pickers for effect choices that text labels
// can't really describe. Each tile renders a tiny, live preview of the
// actual animation a buyer will see on the public profile, so a
// non-technical tradesperson picks by sight, not by reading
// "pulse vs shake".
//
// Keyframes mirror the production components:
//   CTA:    XratedCtaButton.tsx (xcta-pulse / xcta-shake / glow hover)
//   Hero:   HeroTextOverlay.tsx (xhero-shimmer / xhero-dance / xhero-underline)
//   Avatar: AvatarFrame.tsx     (xaf-pulse / xaf-dance)
// Keep them in sync — these tiles are the contract.

import type { CSSProperties } from "react";

const THEME = "#FFB300";

function TileShell({
  selected,
  label,
  onClick,
  children
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex h-28 flex-col items-center justify-between rounded-xl border-2 bg-white p-2 transition active:scale-[0.98] ${
        selected
          ? "border-[color:#FFB300] shadow-md"
          : "border-neutral-200 hover:border-neutral-400"
      }`}
    >
      {selected && (
        <span
          aria-hidden="true"
          className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold text-neutral-900"
          style={{ background: THEME }}
        >
          ✓
        </span>
      )}
      <span className="flex h-16 w-full items-center justify-center overflow-hidden">
        {children}
      </span>
      <span className="text-[12px] font-extrabold uppercase tracking-wider text-neutral-900">
        {label}
      </span>
    </button>
  );
}

// ─── CTA effect ─────────────────────────────────────────────────────────

export function CtaEffectPicker({
  value,
  onChange
}: {
  value: "none" | "pulse" | "glow" | "shake";
  onChange: (v: "none" | "pulse" | "glow" | "shake") => void;
}) {
  const options: { value: "none" | "pulse" | "glow" | "shake"; label: string; className: string }[] = [
    { value: "none", label: "None", className: "" },
    { value: "pulse", label: "Pulse", className: "tp-cta-pulse" },
    { value: "glow", label: "Glow", className: "tp-cta-glow" },
    { value: "shake", label: "Shake", className: "tp-cta-shake" }
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((o) => (
          <TileShell
            key={o.value}
            selected={value === o.value}
            label={o.label}
            onClick={() => onChange(o.value)}
          >
            <span
              className={`tp-cta inline-flex h-9 items-center justify-center rounded-xl px-3 text-[11px] font-extrabold text-neutral-900 ${o.className}`}
              style={{ background: THEME } as CSSProperties}
            >
              Contact
            </span>
          </TileShell>
        ))}
      </div>
      <style>{`
        .tp-cta-pulse { animation: tp-cta-pulse 2s ease-in-out infinite; }
        .tp-cta-glow  { box-shadow: 0 0 14px 4px ${THEME}66; }
        .tp-cta-shake { animation: tp-cta-shake 4s ease-in-out infinite; }
        @keyframes tp-cta-pulse {
          0%   { box-shadow: 0 0 0 0 ${THEME}55; }
          70%  { box-shadow: 0 0 0 10px ${THEME}00; }
          100% { box-shadow: 0 0 0 0 ${THEME}00; }
        }
        @keyframes tp-cta-shake {
          0%, 84%, 100% { transform: translateX(0); }
          85% { transform: translateX(-2px); }
          86% { transform: translateX(2px); }
          87% { transform: translateX(-2px); }
          88% { transform: translateX(2px); }
          89% { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

// ─── Hero text effect ───────────────────────────────────────────────────

export function HeroEffectPicker({
  value,
  onChange
}: {
  value: "none" | "shimmer" | "dance" | "underline";
  onChange: (v: "none" | "shimmer" | "dance" | "underline") => void;
}) {
  const options: { value: "none" | "shimmer" | "dance" | "underline"; label: string }[] = [
    { value: "none", label: "None" },
    { value: "shimmer", label: "Shimmer" },
    { value: "dance", label: "Dance" },
    { value: "underline", label: "Underline" }
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((o) => (
          <TileShell
            key={o.value}
            selected={value === o.value}
            label={o.label}
            onClick={() => onChange(o.value)}
          >
            <HeroPreview kind={o.value} />
          </TileShell>
        ))}
      </div>
      <style>{`
        @keyframes tp-hero-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes tp-hero-dance {
          0%   { transform: rotate(-2deg); }
          50%  { transform: rotate(2deg); }
          100% { transform: rotate(-2deg); }
        }
        @keyframes tp-hero-underline {
          0%   { width: 0; }
          70%  { width: 100%; }
          100% { width: 100%; }
        }
      `}</style>
    </>
  );
}

function HeroPreview({ kind }: { kind: "none" | "shimmer" | "dance" | "underline" }) {
  const base: CSSProperties = {
    fontWeight: 900,
    fontSize: 18,
    color: "#0A0A0A"
  };
  if (kind === "shimmer") {
    return (
      <span
        style={{
          ...base,
          backgroundImage: `linear-gradient(90deg, ${THEME} 0%, #0A0A0A 50%, ${THEME} 100%)`,
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          animation: "tp-hero-shimmer 2.4s linear infinite"
        }}
      >
        Brand
      </span>
    );
  }
  if (kind === "dance") {
    return (
      <span
        style={{
          ...base,
          color: THEME,
          display: "inline-block",
          animation: "tp-hero-dance 3s ease-in-out infinite",
          transformOrigin: "center"
        }}
      >
        Brand
      </span>
    );
  }
  if (kind === "underline") {
    return (
      <span style={{ ...base, position: "relative", display: "inline-block" }}>
        Brand
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            bottom: -2,
            height: 3,
            width: 0,
            background: THEME,
            animation: "tp-hero-underline 2.4s ease-out infinite"
          }}
        />
      </span>
    );
  }
  return <span style={base}>Brand</span>;
}

// ─── Avatar frame style ─────────────────────────────────────────────────

export function AvatarFramePicker({
  value,
  onChange
}: {
  value: "none" | "ring" | "pulse" | "dance";
  onChange: (v: "none" | "ring" | "pulse" | "dance") => void;
}) {
  const options: { value: "none" | "ring" | "pulse" | "dance"; label: string }[] = [
    { value: "none", label: "None" },
    { value: "ring", label: "Ring" },
    { value: "pulse", label: "Pulse" },
    { value: "dance", label: "Dance" }
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((o) => (
          <TileShell
            key={o.value}
            selected={value === o.value}
            label={o.label}
            onClick={() => onChange(o.value)}
          >
            <AvatarPreview kind={o.value} />
          </TileShell>
        ))}
      </div>
      <style>{`
        @keyframes tp-af-pulse {
          0%   { transform: scale(1);    opacity: 1; }
          50%  { transform: scale(1.08); opacity: 0.65; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes tp-af-dance {
          0%   { transform: rotate(-2deg); }
          50%  { transform: rotate(2deg); }
          100% { transform: rotate(-2deg); }
        }
      `}</style>
    </>
  );
}

function AvatarPreview({ kind }: { kind: "none" | "ring" | "pulse" | "dance" }) {
  const size = 44;
  const ring = kind !== "none";
  const ringStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: "9999px",
    border: `3px solid ${THEME}`,
    boxSizing: "border-box",
    ...(kind === "pulse"
      ? { animation: "tp-af-pulse 2s ease-in-out infinite", transformOrigin: "center" }
      : {})
  };
  const innerInset = ring ? 5 : 0;
  const innerStyle: CSSProperties = {
    position: "absolute",
    inset: innerInset,
    borderRadius: "9999px",
    background: "#0A0A0A",
    color: THEME,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 14,
    ...(kind === "dance"
      ? { animation: "tp-af-dance 3s ease-in-out infinite", transformOrigin: "center" }
      : {})
  };
  return (
    <span
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "inline-block"
      }}
    >
      {ring && <span aria-hidden="true" style={ringStyle} />}
      <span style={innerStyle}>X</span>
    </span>
  );
}
