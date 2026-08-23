// NEX four-corner slot · per pinned
// `project_nex_four_corners_functional_model_2026_08_21`.
//
// Four permanent architectural functions, one per corner:
//   top-left     = NEX      (the intelligence · always constant · never re-labelled)
//   top-right    = PERSON   (whoever you're talking with · profile/initial + status)
//   bottom-left  = DIRECTORY (world discovery · wheel + search + brain routing)
//   bottom-right = PEOPLE   (NEX network · contacts by NEX ID · + Connect)
//
// Bottom slots are interaction STATES not permanent menus — tapping opens
// a panel INSIDE the conversation frame, never navigates away.

"use client";

import type { CSSProperties } from "react";
import { NEX } from "@/lib/nexapp/tokens";

export type CornerKind = "nex" | "person" | "directory" | "people";
export type CornerPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";
/** 2026-08-23 (NEX composer refinement): "corner" = original absolute positioning
 *  around a `position:relative` parent (unchanged default · used by NEX + PERSON
 *  corners inside the conversation frame). "inline" = normal document flow so the
 *  button can sit as a flex child in the new composer row (Directory + Contacts). */
export type CornerLayout = "corner" | "inline";

const POSITION_OFFSET: Record<CornerPosition, CSSProperties> = {
  "top-left":     { top: -14, left: -12 },
  "top-right":    { top: -14, right: -12 },
  "bottom-left":  { bottom: -14, left: -12 },
  "bottom-right": { bottom: -14, right: -12 },
};

export function NexCornerSlot({
  kind,
  position,
  active,
  onTap,
  entityLabel,
  layout = "corner",
}: {
  kind: CornerKind;
  position: CornerPosition;
  active?: boolean;
  onTap?: () => void;
  /** For kind=person: single character (name initial). Rendered inside the circle. */
  entityLabel?: string;
  /** Layout mode · defaults to "corner" (absolute positioning · original behaviour).
   *  Set to "inline" for the composer row so the button sits as a normal flex child. */
  layout?: CornerLayout;
}) {
  // Top-left NEX corner uses the CHAT NEX-profile treatment (Philip
  // 2026-08-21) — dark surface + subtle grey border + "NE" white + "X"
  // orange wordmark. Same identity mark shown next to NEX message
  // bubbles in the chat. Makes NEX feel like ONE consistent identity
  // across surfaces rather than a different button in a different place.
  const isNex = kind === "nex";
  // Bottom-right label = "Contacts" (Philip 2026-08-21 rename from
  // "People" → "Contacts"). Internal `kind` enum stays as "people" so
  // existing code paths don't need to churn — this is a display-only
  // rename until the full Contacts UI ships at Priority 4+.
  const label = kind === "nex" ? "" // NEX wordmark IS the label
              : kind === "person" ? ""
              : kind === "directory" ? "Explore"
              : "Contacts";
  // 2026-08-23 refinement: "inline" layout skips absolute positioning so the
  // button can sit as a normal flex child (used by the new composer row).
  const positionStyle: CSSProperties = layout === "inline"
    ? { position: "relative", flex: "0 0 auto" }
    : { position: "absolute", ...POSITION_OFFSET[position] };
  return (
    <button
      onClick={onTap}
      style={{
        ...positionStyle,
        width: 46,
        height: 46,
        borderRadius: "50%",
        // All 4 corner rims are gray (Philip 2026-08-21: "the 4 round
        // buttons on the corners change the button rim to gray color").
        // Rims quiet the corners into subtle access points — the
        // pinned Four Corners doctrine calls for quiet corners around
        // a dominant central conversation. Active state keeps a soft
        // orange glow as the "on" signal for open panels; rim colour
        // stays gray in all states.
        background: isNex
          ? NEX.bgSurface
          : (active ? "rgba(249, 115, 22, 0.10)" : "rgba(13, 13, 13, 0.9)"),
        border: `1.5px solid ${NEX.borderMuted}`,
        boxShadow: active
          ? `0 0 14px ${NEX.orangeGlowLo}`
          : "none",
        color: NEX.orange,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        cursor: onTap ? "pointer" : "default",
        padding: 0,
        transition: "background 180ms ease, box-shadow 180ms ease",
        zIndex: 3,
      }}
      aria-label={kind === "nex" ? "NEX identity"
                 : kind === "person" ? "You"
                 : kind === "directory" ? "Explore categories"
                 : "Your NEX contacts"}
    >
      <CornerIcon kind={kind} entityLabel={entityLabel} />
      {label && (
        <span style={{ fontSize: 7.5, fontWeight: 500, letterSpacing: 0.2 }}>{label}</span>
      )}
    </button>
  );
}

function CornerIcon({ kind, entityLabel }: { kind: CornerKind; entityLabel?: string }) {
  if (kind === "nex") {
    // NEX wordmark — "NE" white + "X" orange · exact same treatment as
    // the chat message-list NEX profile round (see NexAppHome
    // MessageBubble). Consistency across surfaces per Philip 2026-08-21.
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.4,
          color: NEX.text,
          lineHeight: 1,
        }}
        aria-hidden
      >
        <span>NE</span>
        <span style={{ color: NEX.orange, marginLeft: 1 }}>X</span>
      </div>
    );
  }
  if (kind === "person") {
    // If we know the user's name initial, render it inside a soft circle.
    // Fallback: a subtle person glyph. NEX-to-NEX chat (Priority 4+) will
    // eventually swap this for a real profile photo.
    if (entityLabel) {
      return (
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: `linear-gradient(180deg, ${NEX.orange} 0%, rgba(249,115,22,0.7) 100%)`,
            color: "#0a0a0a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0,
          }}
          aria-hidden
        >
          {entityLabel}
        </div>
      );
    }
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={NEX.orange} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
      </svg>
    );
  }
  if (kind === "directory") {
    // Compass / world discovery icon.
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={NEX.orange} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M16 8l-2.5 5.5L8 16l2.5-5.5L16 8z" fill={NEX.orange} stroke="none" />
      </svg>
    );
  }
  // people
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={NEX.orange} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20a7 7 0 0 1 14 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15 20a5 5 0 0 1 7 0" />
    </svg>
  );
}
