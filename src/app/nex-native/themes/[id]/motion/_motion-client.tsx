"use client";

// src/app/nex-native/themes/[id]/motion/_motion-client.tsx
//
// Theme motion gallery · toggle on/off cards · founder-sealed
// 2026-10-05. Replaces the earlier tap-through list with the same
// toggle-card UX the JokerController's lower-right dancing-dots
// panel used to expose. The 3-dots entry point was retired in
// favour of the universal + menu → Animation · this page now hosts
// every animation toggle in one place.
//
// Multiple toggles can be on at the same time · each enabled
// variant mounts a live overlay on top of the gallery so the
// founder sees exactly how it behaves without leaving the page.

import * as React from "react";
import Link from "next/link";
import {
  JOKER_MOTION_INDEX,
  type JokerMotionVariant,
} from "../_joker-motion-data";
import { JokerMotionOverlay } from "../_joker-motion";

type ToggleState = Partial<Record<JokerMotionVariant, boolean>>;

export function MotionGalleryClient({
  themeId,
}: {
  themeId: string;
}): React.JSX.Element {
  const [toggles, setToggles] = React.useState<ToggleState>({});

  const setToggle = (variant: JokerMotionVariant, next: boolean) => {
    setToggles((prev) => ({ ...prev, [variant]: next }));
  };

  const enabledCount = Object.values(toggles).filter(Boolean).length;

  return (
    <>
      {/* Toggle grid · landscape AnimationCard pattern · same shape
          as the JokerController's cards for continuity. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
          marginBottom: 32,
        }}
      >
        {JOKER_MOTION_INDEX.map((row, i) => (
          <AnimationCard
            key={row.variant}
            number={i + 1}
            variant={row.variant}
            label={row.label}
            description={row.description}
            enabled={!!toggles[row.variant]}
            onToggle={(next) => setToggle(row.variant, next)}
          />
        ))}
      </div>

      {/* Status strip · how many are running right now */}
      <div
        style={{
          marginBottom: 32,
          padding: "10px 14px",
          borderRadius: 10,
          background:
            enabledCount > 0
              ? "rgba(143,255,110,0.08)"
              : "rgba(139,169,209,0.05)",
          border:
            enabledCount > 0
              ? "1px solid rgba(143,255,110,0.3)"
              : "1px solid rgba(139,169,209,0.2)",
          color: enabledCount > 0 ? "#8FFF6E" : "#8BA9D1",
          fontSize: 12,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span>
          {enabledCount === 0
            ? "No animations running"
            : enabledCount === 1
              ? "1 animation live"
              : `${enabledCount} animations running simultaneously`}
        </span>
        {enabledCount > 0 && (
          <button
            type="button"
            onClick={() => setToggles({})}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(143,255,110,0.4)",
              color: "#8FFF6E",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Turn all off
          </button>
        )}
      </div>

      {/* Back to chat · same pattern as the sealed older page */}
      <nav>
        <Link
          href={`/nex-native/themes/${themeId}`}
          style={{
            display: "inline-block",
            padding: "10px 16px",
            borderRadius: 999,
            background: "transparent",
            border: "1px solid rgba(139,169,209,0.35)",
            color: "#DDE9FA",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.04em",
          }}
        >
          ← Back to chat
        </Link>
      </nav>

      {/* Live overlays · one per enabled toggle · same JokerMotionOverlay
          component used by the sealed Joker runtime. Multiple can run
          at once; pointer-events are off at the overlay root so taps
          still reach the toggle cards above. */}
      {JOKER_MOTION_INDEX.map((row) =>
        toggles[row.variant] ? (
          <JokerMotionOverlay key={row.variant} variant={row.variant} />
        ) : null,
      )}
    </>
  );
}

// ─── Animation card · same shape as the JokerController's card ─────

function AnimationCard({
  number,
  variant,
  label,
  description,
  enabled,
  onToggle,
}: {
  number: number;
  variant: JokerMotionVariant;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: (next: boolean) => void;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        borderRadius: 14,
        background: enabled
          ? "linear-gradient(180deg, rgba(143,255,110,0.18) 0%, rgba(143,255,110,0.06) 100%)"
          : "linear-gradient(180deg, rgba(10,22,36,0.9) 0%, rgba(6,14,24,0.92) 100%)",
        border: enabled
          ? "1px solid rgba(143,255,110,0.6)"
          : "1px solid rgba(143,255,110,0.22)",
        transition:
          "background 200ms ease-out, border-color 200ms ease-out, box-shadow 200ms ease-out",
        boxShadow: enabled
          ? "0 8px 24px rgba(143,255,110,0.15)"
          : "0 10px 24px rgba(0,0,0,0.4)",
      }}
    >
      {/* Number badge */}
      <div
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: 10,
          background: enabled
            ? "rgba(143,255,110,0.2)"
            : "rgba(0,0,0,0.4)",
          border: enabled
            ? "1px solid rgba(143,255,110,0.6)"
            : "1px solid rgba(143,255,110,0.3)",
          display: "grid",
          placeItems: "center",
          color: "#8FFF6E",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.05em",
        }}
      >
        #{String(number).padStart(2, "0")}
      </div>

      {/* Label + description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: "#F4F7FC",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.01em",
          }}
        >
          {label}
        </div>
        <div
          style={{
            color: "#8BA9D1",
            fontSize: 11,
            lineHeight: 1.4,
            marginTop: 3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {description}
        </div>
      </div>

      {/* Toggle */}
      <ToggleSwitch
        value={enabled}
        onChange={onToggle}
        ariaLabel={`${label} toggle`}
      />
    </div>
  );
}

// ─── Toggle switch · 44pt tap target ───────────────────────────────

function ToggleSwitch({
  value,
  onChange,
  ariaLabel,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={ariaLabel}
      onClick={() => onChange(!value)}
      style={{
        flexShrink: 0,
        width: 48,
        height: 28,
        borderRadius: 999,
        padding: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: value ? "flex-end" : "flex-start",
        background: value
          ? "linear-gradient(180deg, #8FFF6E, #5fcf3f)"
          : "rgba(255,255,255,0.1)",
        border: value
          ? "1px solid rgba(143,255,110,0.9)"
          : "1px solid rgba(139,169,209,0.3)",
        cursor: "pointer",
        transition:
          "background 200ms ease-out, border-color 200ms ease-out, justify-content 200ms ease-out",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: value ? "#0A2010" : "#F4F7FC",
          boxShadow: value
            ? "0 1px 3px rgba(0,0,0,0.6)"
            : "0 1px 3px rgba(0,0,0,0.4)",
          transition: "background 200ms ease-out",
        }}
      />
    </button>
  );
}
