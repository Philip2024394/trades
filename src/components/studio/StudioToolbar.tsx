"use client";

// StudioToolbar — the floating contextual toolbar.
//
// Renders inside the iframe, anchored to the selected element via
// position:fixed + the element's bounding rect. Auto-appears on
// selection, auto-hides on deselect. Flips below the element when
// there isn't room above, and clamps horizontally to the viewport
// edges so it's never clipped.
//
// Tool set is priority-driven:
//   section       → Replace / BG / Duplicate / Save / Hide / Delete
//   text elem     → Edit / Style / Colour / Duplicate / Delete
//   image elem    → Replace / Crop / AI / Duplicate / Delete
//   button elem   → Text / Link / Colour / Radius / Delete
//   card / container elem → BG / Padding / Border / Duplicate / Delete
//
// Every button fires iframeEmit.toolAction(treeId, tool, kind, priority).
// Modules 5-9 register handlers editor-side; today they're stubbed as
// no-op so the shell can ship without waiting on tool implementations.

import { useLayoutEffect, useRef, useState } from "react";
import type { SerializedRect } from "@/lib/studio/treeTypes";
import { iframeEmit } from "@/lib/studio/bus";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";
const RED = "#DC2626";
const WHITE = "#FFFFFF";

type Tool = {
  id: string;
  label: string;
  icon: string;
  danger?: boolean;
};

type Priority = "text" | "image" | "button" | "card" | "container";
type Kind = "section" | "element";

const TOOLS_BY_PRIORITY: Record<Priority, Tool[]> = {
  text: [
    { id: "edit", label: "Edit", icon: "✎" },
    { id: "typography", label: "Style", icon: "T" },
    { id: "colour", label: "Colour", icon: "◉" },
    { id: "duplicate", label: "Copy", icon: "⧉" },
    { id: "delete", label: "Delete", icon: "✕", danger: true }
  ],
  image: [
    { id: "replace", label: "Replace", icon: "↑" },
    { id: "crop", label: "Crop", icon: "◫" },
    { id: "ai-generate", label: "AI", icon: "✦" },
    { id: "duplicate", label: "Copy", icon: "⧉" },
    { id: "delete", label: "Delete", icon: "✕", danger: true }
  ],
  button: [
    { id: "edit", label: "Text", icon: "✎" },
    { id: "link", label: "Link", icon: "↗" },
    { id: "colour", label: "Colour", icon: "◉" },
    { id: "radius", label: "Radius", icon: "◐" },
    { id: "delete", label: "Delete", icon: "✕", danger: true }
  ],
  card: [
    { id: "background", label: "BG", icon: "▨" },
    { id: "padding", label: "Padding", icon: "□" },
    { id: "border", label: "Border", icon: "▢" },
    { id: "duplicate", label: "Copy", icon: "⧉" },
    { id: "delete", label: "Delete", icon: "✕", danger: true }
  ],
  container: [
    { id: "background", label: "BG", icon: "▨" },
    { id: "padding", label: "Padding", icon: "□" },
    { id: "border", label: "Border", icon: "▢" },
    { id: "duplicate", label: "Copy", icon: "⧉" },
    { id: "delete", label: "Delete", icon: "✕", danger: true }
  ]
};

const SECTION_TOOLS: Tool[] = [
  { id: "replace-layout", label: "Replace", icon: "⇄" },
  { id: "ai-improve", label: "AI", icon: "✦" },
  { id: "background", label: "BG", icon: "▨" },
  { id: "duplicate", label: "Copy", icon: "⧉" },
  { id: "save-component", label: "Save", icon: "☆" },
  { id: "hide", label: "Hide", icon: "◐" }
];

type Props = {
  treeId: string;
  kind: Kind;
  priority: Priority | null;
  rect: SerializedRect;
  /** Optional local intercept. Return true to consume the click
   *  in-iframe (e.g. Text tool starts inline edit locally) — false
   *  or undefined falls through to the bus tool-action. */
  onTool?: (tool: string) => boolean;
};

const GAP = 8;

export function StudioToolbar({ treeId, kind, priority, rect, onTool }: Props) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<"above" | "below">("above");
  const [barWidth, setBarWidth] = useState(0);

  // Measure toolbar width once mounted so we can horizontally centre
  // + clamp against the viewport. useLayoutEffect avoids a flash of
  // wrong position between render and measure.
  useLayoutEffect(() => {
    if (!barRef.current) return;
    setBarWidth(barRef.current.offsetWidth);
  }, [treeId, kind, priority]);

  const tools =
    kind === "section"
      ? SECTION_TOOLS
      : priority
        ? TOOLS_BY_PRIORITY[priority]
        : null;

  if (!tools) return null;

  const toolbarHeight = 52;
  const viewportW = typeof window === "undefined" ? 1024 : window.innerWidth;

  // Flip below the element when there's not enough room above.
  const wantAbove = rect.top - toolbarHeight - GAP >= 4;
  const finalPlacement = wantAbove ? "above" : "below";
  if (finalPlacement !== placement) {
    // setState inside render is OK when it's a strict equality guard
    // — React re-renders once with the correct placement.
    setPlacement(finalPlacement);
  }

  const top =
    finalPlacement === "above"
      ? rect.top - toolbarHeight - GAP
      : rect.bottom + GAP;

  const centreX = rect.left + rect.width / 2;
  const rawLeft = centreX - barWidth / 2;
  const left = Math.max(8, Math.min(rawLeft, viewportW - barWidth - 8));

  return (
    <div
      ref={barRef}
      data-studio-chrome="true"
      role="toolbar"
      aria-label={`${kind === "section" ? "Section" : priority} toolbar`}
      style={{
        position: "fixed",
        top,
        left: barWidth > 0 ? left : centreX - 200, // rough placement pre-measure
        zIndex: 200,
        background: BLACK,
        color: WHITE,
        borderRadius: 999,
        padding: "6px",
        boxShadow: "0 12px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.08)",
        display: "flex",
        gap: 4,
        alignItems: "center",
        opacity: barWidth > 0 ? 1 : 0,
        transition: "opacity 120ms ease"
      }}
    >
      <span
        aria-hidden="true"
        style={{
          padding: "0 8px",
          fontSize: 9,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: YELLOW,
          whiteSpace: "nowrap"
        }}
      >
        {kind === "section" ? "Section" : priority?.toUpperCase()}
      </span>
      <span style={{ width: 1, height: 20, background: "rgba(255,255,255,0.12)" }} />
      {tools.map((tool) => (
        <ToolButton
          key={tool.id}
          tool={tool}
          onClick={() => {
            const handledLocally = onTool?.(tool.id) ?? false;
            if (handledLocally) return;
            iframeEmit.toolAction(
              treeId,
              tool.id,
              kind,
              priority ?? undefined
            );
          }}
        />
      ))}
    </div>
  );
}

function ToolButton({
  tool,
  onClick
}: {
  tool: Tool;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const bg = hover
    ? tool.danger
      ? RED
      : YELLOW
    : "transparent";
  const fg = hover ? (tool.danger ? WHITE : BLACK) : WHITE;
  return (
    <button
      type="button"
      data-studio-chrome="true"
      aria-label={tool.label}
      title={tool.label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 38,
        padding: "0 12px",
        borderRadius: 999,
        border: "none",
        background: bg,
        color: fg,
        cursor: "pointer",
        transition: "background 120ms ease, color 120ms ease",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.06em",
        whiteSpace: "nowrap"
      }}
    >
      <span
        aria-hidden="true"
        style={{ fontSize: 14, lineHeight: 1, fontWeight: 900 }}
      >
        {tool.icon}
      </span>
      <span>{tool.label}</span>
    </button>
  );
}
