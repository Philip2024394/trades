"use client";

// src/app/nex-native/business-setup/_your-choice-chip.tsx
//
// Three-state indicator chip (Rev 6 clarification #4). Pure renderer.
// Receives a precomputed ChipState and renders the corresponding chip
// or null. Owner can tell at a glance what came from recommendation,
// what's a saved choice, and what's a this-session change.

import { NEX, chipLabel, type ChipState } from "./_shared";

export function YourChoiceChip({ state }: { state: ChipState }) {
  if (state === "none") return null;
  const label = chipLabel(state);
  if (!label) return null;

  const style = chipStyle(state);
  return (
    <span
      role="status"
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        lineHeight: 1,
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: style.color as string,
        }}
      />
      {label}
    </span>
  );
}

function chipStyle(state: ChipState): React.CSSProperties {
  switch (state) {
    case "saved_on":
    case "saved_off":
      return {
        background: `${NEX.cyan}14`,
        border: `1px solid ${NEX.cyanSoft}`,
        color: NEX.cyan,
      };
    case "unsaved_on":
    case "unsaved_off":
      return {
        background: `${NEX.cyan}26`,
        border: `1px solid ${NEX.cyan}`,
        color: NEX.cyan,
      };
    case "will_remove":
      return {
        background: `${NEX.destructive}20`,
        border: `1px solid ${NEX.destructive}`,
        color: NEX.destructive,
      };
    case "none":
      return {};
  }
}
