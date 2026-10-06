"use client";

// src/app/nex-native/themes/[id]/motion/_motion-client.tsx
//
// Animation Gallery · client component · sealed 2026-10-06.
// --------------------------------------------------------
// Toggle on/off cards for every animation. Multiple can be enabled
// simultaneously · each enabled variant mounts a live overlay above
// the gallery so the user sees exactly how it behaves without
// leaving the page.
//
// Universal Theme Colour Rule (sealed 2026-10-06):
//
//   Every surface tinted here — status strip · card background +
//   border · toggle · back link — derives from the active world's
//   `Required<ColourSystem>` passed in via props. No per-theme id
//   branches. A future world with a completely different palette
//   auto-tints every surface with zero code change.
//
// NEW badge · universal semantic exception (sealed 2026-10-06):
//
//   The NEW badge is DELIBERATELY NOT theme-coloured. It is a
//   universal NEX semantic indicator — "there is something new
//   here" — and must be instantly recognisable across every World.
//   One treatment everywhere: bright gold on near-black with a
//   subtle glow + pulse. See the NEW_BADGE_* constants below.
//
//   Architecture:
//     World ThemePackage colours  → animation cards + chrome
//     Universal NEX semantic       → NEW badge
//
//   Regression tests in `_motion-client.test.ts` section C enforce
//   both halves: the chrome stays theme-derived, the NEW badge
//   stays yellow/gold universal.

import * as React from "react";
import Link from "next/link";
import type { ColourSystem } from "@/app/nex-native/chat-standard/_engine/types";
import {
  JOKER_MOTION_INDEX,
  type JokerMotionVariant,
} from "../_joker-motion-data";
import { JokerMotionOverlay } from "../_joker-motion";

type ToggleState = Partial<Record<JokerMotionVariant, boolean>>;

// ─── Universal NEX NEW badge · theme-independent ──────────────────
//
// A single visual treatment used across every World so NEW stays
// instantly recognisable regardless of whether the surrounding
// atmosphere is Ocean blue, Café warm, Joker green, etc. Centralised
// here so if/when a shared NewBadge primitive is extracted to the
// lib layer the values move together.
const NEW_BADGE_GOLD = "#FFD54A";
const NEW_BADGE_INK = "#1A1300";
const NEW_BADGE_GLOW =
  "0 0 10px rgba(255,213,74,0.55), 0 0 20px rgba(255,213,74,0.28)";
const NEW_BADGE_PULSE_KEYFRAMES = `
@keyframes nex-new-badge-pulse {
  0%, 100% {
    box-shadow: 0 0 10px rgba(255,213,74,0.55), 0 0 20px rgba(255,213,74,0.28);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 14px rgba(255,213,74,0.72), 0 0 28px rgba(255,213,74,0.42);
    transform: scale(1.04);
  }
}
`;

// Local alpha helper · same shape as the engine's private hexToRgba.
// Lets us tint theme colours at various intensities without ever
// touching a generic black/white/grey rgba constant.
function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace(/^#/, "");
  if (clean.length !== 3 && clean.length !== 6) return hex;
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function MotionGalleryClient({
  themeId,
  colours,
}: {
  themeId: string;
  colours: Required<ColourSystem>;
}): React.JSX.Element {
  const [toggles, setToggles] = React.useState<ToggleState>({});

  const setToggle = (variant: JokerMotionVariant, next: boolean) => {
    setToggles((prev) => ({ ...prev, [variant]: next }));
  };

  const enabledCount = Object.values(toggles).filter(Boolean).length;
  const active = enabledCount > 0;

  return (
    <>
      {/* Universal NEW-badge pulse keyframes · mounted once per
          gallery render · theme-independent. */}
      <style>{NEW_BADGE_PULSE_KEYFRAMES}</style>

      {/* Status strip · theme-tinted · reflects live-count without
          generic greens/greys. */}
      <div
        style={{
          marginBottom: 20,
          padding: "10px 14px",
          borderRadius: 10,
          background: active
            ? withAlpha(colours.primary, 0.1)
            : withAlpha(colours.secondary, 0.06),
          border: `1px solid ${
            active
              ? withAlpha(colours.primary, 0.4)
              : withAlpha(colours.secondary, 0.22)
          }`,
          color: active ? colours.primary : colours.secondary,
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
        {active && (
          <button
            type="button"
            onClick={() => setToggles({})}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              background: withAlpha(colours.deep, 0.4),
              border: `1px solid ${withAlpha(colours.primary, 0.5)}`,
              color: colours.primary,
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

      {/* Card grid · each card tinted from the active world's palette. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
          marginBottom: 32,
        }}
      >
        {JOKER_MOTION_INDEX.map((row) => (
          <AnimationCard
            key={row.variant}
            variant={row.variant}
            label={row.label}
            description={row.description}
            isNew={!!row.isNew}
            enabled={!!toggles[row.variant]}
            onToggle={(next) => setToggle(row.variant, next)}
            colours={colours}
          />
        ))}
      </div>

      {/* Back to chat · theme-tinted so it still feels like part of
          this world even in a navigational control. */}
      <nav>
        <Link
          href={`/nex-native/themes/${themeId}`}
          style={{
            display: "inline-block",
            padding: "10px 16px",
            borderRadius: 999,
            background: "transparent",
            border: `1px solid ${withAlpha(colours.primary, 0.5)}`,
            color: colours.highlight,
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.04em",
          }}
        >
          ← Back to chat
        </Link>
      </nav>

      {/* Live overlays · one per enabled toggle. */}
      {JOKER_MOTION_INDEX.map((row) =>
        toggles[row.variant] ? (
          <JokerMotionOverlay key={row.variant} variant={row.variant} />
        ) : null,
      )}
    </>
  );
}

// ─── Animation card ────────────────────────────────────────────────

function AnimationCard({
  variant,
  label,
  description,
  isNew,
  enabled,
  onToggle,
  colours,
}: {
  variant: JokerMotionVariant;
  label: string;
  description: string;
  isNew: boolean;
  enabled: boolean;
  onToggle: (next: boolean) => void;
  colours: Required<ColourSystem>;
}): React.JSX.Element {
  return (
    <div
      data-nex-animation-card
      data-nex-animation-variant={variant}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        borderRadius: 14,
        background: enabled
          ? `linear-gradient(180deg, ${withAlpha(colours.primary, 0.18)} 0%, ${withAlpha(colours.primary, 0.06)} 100%)`
          : `linear-gradient(180deg, ${withAlpha(colours.deep, 0.85)} 0%, ${withAlpha(colours.deep, 0.92)} 100%)`,
        border: `1px solid ${
          enabled
            ? withAlpha(colours.primary, 0.6)
            : withAlpha(colours.primary, 0.2)
        }`,
        transition:
          "background 200ms ease-out, border-color 200ms ease-out, box-shadow 200ms ease-out",
        boxShadow: enabled
          ? `0 8px 24px ${withAlpha(colours.primary, 0.18)}`
          : `0 10px 24px ${withAlpha(colours.deep, 0.5)}`,
      }}
    >
      {/* Label + optional NEW badge + description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: colours.highlight,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.01em",
          }}
        >
          <span>{label}</span>
          {isNew && (
            <span
              data-nex-new-badge
              style={{
                display: "inline-block",
                padding: "3px 9px",
                borderRadius: 999,
                background: NEW_BADGE_GOLD,
                color: NEW_BADGE_INK,
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                lineHeight: 1,
                boxShadow: NEW_BADGE_GLOW,
                animation: "nex-new-badge-pulse 2.4s ease-in-out infinite",
                willChange: "transform, box-shadow",
              }}
            >
              New
            </span>
          )}
        </div>
        <div
          style={{
            color: colours.secondary,
            fontSize: 12,
            lineHeight: 1.45,
            marginTop: 4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {description}
        </div>
      </div>

      {/* Toggle · theme-primary gradient when on. */}
      <ToggleSwitch
        value={enabled}
        onChange={onToggle}
        ariaLabel={`${label} toggle`}
        colours={colours}
      />
    </div>
  );
}

// ─── Toggle switch · 44pt tap target · theme-tinted ────────────────

function ToggleSwitch({
  value,
  onChange,
  ariaLabel,
  colours,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
  colours: Required<ColourSystem>;
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
          ? `linear-gradient(180deg, ${colours.primary}, ${colours.secondary})`
          : withAlpha(colours.highlight, 0.1),
        border: `1px solid ${
          value
            ? withAlpha(colours.primary, 0.9)
            : withAlpha(colours.secondary, 0.3)
        }`,
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
          background: value ? colours.deep : colours.highlight,
          boxShadow: `0 1px 3px ${withAlpha(colours.deep, 0.5)}`,
          transition: "background 200ms ease-out",
        }}
      />
    </button>
  );
}
