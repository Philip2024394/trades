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

// 2026-08-24 PM · corner buttons SIT ON the frame corner points. Chat window
// chrome is now CSS-native (charcoal fill + orange border · see
// conversationFrameStyle in NexAppHome), so buttons anchor to the true div
// corners with no PNG-margin compensation.
const POSITION_OFFSET: Record<CornerPosition, CSSProperties> = {
  "top-left":     { top: -23, left: -23 },
  "top-right":    { top: -23, right: -23 },
  "bottom-left":  { bottom: -23, left: -23 },
  "bottom-right": { bottom: -23, right: -23 },
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
        // 2026-08-24 PM · all 4 corner buttons unified to solid black with
        // orange rim + NEX wordmark inside (Philip explicit). Icons and
        // labels removed · every corner reads as "an instance of the NEX
        // identity mark". Active state deepens the orange rim + adds a
        // soft outer glow so an open panel is still visible.
        background: "#000000",
        border: `1.5px solid ${active ? NEX.orange : "rgba(249, 115, 22, 0.55)"}`,
        boxShadow: active
          ? `0 0 14px ${NEX.orangeGlow}, inset 0 0 10px rgba(249, 115, 22, 0.28)`
          : "0 2px 8px rgba(0, 0, 0, 0.45)",
        color: NEX.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: onTap ? "pointer" : "default",
        padding: 0,
        transition: "border-color 180ms ease, box-shadow 180ms ease",
        zIndex: 3,
      }}
      aria-label={kind === "nex" ? "NEX identity"
                 : kind === "person" ? "You"
                 : kind === "directory" ? "Explore categories"
                 : "Your NEX contacts"}
    >
      {kind === "directory" ? (
        <ExploreIcon />
      ) : kind === "people" ? (
        <ContactsIcon />
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
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
      )}
    </button>
  );
}

// Explore (bottom-left · directory) · compass with orange needle inside
// a white ring. Two-tone matches the NEX identity palette on the corner
// black+orange rim.
function ExploreIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="#FFFFFF" strokeWidth="1.8" />
      <path d="M16 8l-2.5 5.5L8 16l2.5-5.5L16 8z" fill={NEX.orange} />
    </svg>
  );
}

// Contacts (bottom-right · people) · two overlapping silhouettes. Front
// figure white (primary contact), back figure orange (network).
function ContactsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      {/* back figure · orange */}
      <circle cx="17" cy="9" r="2.5" stroke={NEX.orange} strokeWidth="1.8" />
      <path d="M15 20a5 5 0 0 1 7 0" stroke={NEX.orange} strokeWidth="1.8" strokeLinecap="round" />
      {/* front figure · white */}
      <circle cx="9" cy="8" r="3" stroke="#FFFFFF" strokeWidth="1.8" />
      <path d="M2 20a7 7 0 0 1 14 0" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

