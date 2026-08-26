// NEX Workspace · IDLE artifact.
//
// Renders inside the HUD frame's CENTRE workspace zone when no other artifact
// is active. Deliberately minimal per Philip's contextual workspace doctrine:
// the workspace should feel alive without becoming a dashboard, and the
// central read is the actual NEX interaction — never chrome for its own sake.
//
// Doctrine anchors:
//   project_nex_workspace_identity_doctrine_2026_08_25
//   project_nex_workspace_terminology_addendum_2026_08_25
//   project_nex_contextual_workspace_zone_doctrine_2026_08_25
//
// Future artifacts (chat transcript · discovery cards · booking form · image
// editor · document viewer · etc.) will each be their own small component
// swapped into this same slot. This file is the empty state.

"use client";

import React from "react";

interface Props {
  onAskTap?: () => void;
  greetingName?: string;
}

export function NexWorkspaceIdle({ onAskTap, greetingName }: Props = {}) {
  const salute = greetingName ? `Hi ${greetingName}.` : "Hi.";
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        gap: 14,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: -0.3,
          color: "rgba(245,245,245,0.95)",
          lineHeight: 1.15,
        }}
      >
        {salute}
      </div>
      <div
        style={{
          fontSize: 13,
          maxWidth: 260,
          color: "rgba(245,245,245,0.6)",
          lineHeight: 1.4,
        }}
      >
        Tap a vertical on the right to explore.
        <br />
        Tap Ask below to speak with NEX.
      </div>

      {onAskTap && (
        <button
          type="button"
          onClick={onAskTap}
          style={{
            marginTop: 6,
            appearance: "none",
            border: "1px solid rgba(249,115,22,0.4)",
            background: "rgba(249,115,22,0.10)",
            color: "#f97316",
            padding: "8px 18px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            cursor: "pointer",
            transition: "background 180ms ease, transform 180ms ease",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          Ask NEX
        </button>
      )}
    </div>
  );
}
