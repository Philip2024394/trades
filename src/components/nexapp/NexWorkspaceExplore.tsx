// NEX Workspace · EXPLORE artifact.
//
// Renders inside the CENTRE workspace zone when the user opens Explore.
// Shows what NEX is discovering right now — verticals, live workforce
// status, active city. Reuses the same live signal that feeds the
// contextual card in the below-workspace zone.
//
// Doctrine anchors:
//   project_nex_workspace_identity_doctrine_2026_08_25
//   project_nex_contextual_workspace_zone_doctrine_2026_08_25
//
// This is a workspace ARTIFACT · not a dashboard. Shows the live state
// of NEX discovery, not stats/settings/persistent widgets.

"use client";

import React from "react";
import { useGuidanceTarget } from "./hud/NexGuidance";

type Rollup = { recordsNew: number; cyclesCompleted: number; byVertical: Record<string, number> } | null;

interface Props {
  rollup24h: Rollup;
  onVerticalTap?: (vertical: string) => void;
}

const VERTICAL_META: Array<{ id: string; label: string; glyph: string }> = [
  { id: "food",          label: "Food",          glyph: "🍜" },
  { id: "accommodation", label: "Stay",          glyph: "🏨" },
  { id: "market",        label: "Market",        glyph: "🏪" },
  { id: "transport",     label: "Transport",     glyph: "🚕" },
];

/**
 * Vertical card · registers itself as a guidance target if guidanceTargetId
 * is provided so NEX can precision-beam to a specific card (e.g. the first
 * Food card as part of a restaurant recommendation flow).
 */
function VerticalCard({
  vertical: v,
  count,
  live,
  onTap,
  guidanceTargetId,
}: {
  vertical: { id: string; label: string; glyph: string };
  count: number;
  live: boolean;
  onTap: () => void;
  guidanceTargetId?: string;
}) {
  const attach = useGuidanceTarget(guidanceTargetId ?? `explore-card-${v.id}`);
  return (
    <button
      ref={attach as (el: HTMLButtonElement | null) => void}
      type="button"
      onClick={onTap}
      style={{
        appearance: "none",
        border: `1px solid ${live ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.08)"}`,
        background: "rgba(255,255,255,0.02)",
        borderRadius: 12,
        padding: 10,
        textAlign: "left",
        color: "rgba(245,245,245,0.9)",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 4,
        minHeight: 68,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
        <span aria-hidden style={{ fontSize: 16 }}>{v.glyph}</span>
        <span>{v.label}</span>
      </div>
      <div style={{ fontSize: 10, opacity: 0.6 }}>
        {live ? `${count} new · 24h` : "quiet · 24h"}
      </div>
    </button>
  );
}

export function NexWorkspaceExplore({ rollup24h, onVerticalTap }: Props) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        padding: 14,
        gap: 10,
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: "rgba(245,245,245,0.55)", fontWeight: 600 }}>
        Explore · live workforce
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flex: 1 }}>
        {VERTICAL_META.map((v, i) => {
          const count = rollup24h?.byVertical?.[v.id] ?? 0;
          const live = count > 0;
          const isFoodFirst = v.id === "food" && i === 0;
          return (
            <VerticalCard
              key={v.id}
              vertical={v}
              count={count}
              live={live}
              onTap={() => onVerticalTap?.(v.id)}
              guidanceTargetId={isFoodFirst ? "food-card-first" : undefined}
            />
          );
        })}
      </div>
      {rollup24h && (
        <div style={{ fontSize: 10, opacity: 0.5, textAlign: "center" }}>
          {rollup24h.recordsNew} records · {rollup24h.cyclesCompleted} cycles · last 24h
        </div>
      )}
    </div>
  );
}
