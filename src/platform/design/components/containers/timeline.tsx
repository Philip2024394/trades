// Design component: containers.timeline
//
// Vertical timeline layout — dot + line + slot per event. Suitable
// for project history, process pages, before/after journeys.
// Container tier: content (per Constitution Amendment 6 §RGP-7).

"use client";

import type { ReactNode } from "react";
import { useDesignTheme } from "../../theme/context";
import { designSystemRegistry } from "../../registry";

type TimelineProps = {
  density: "compact" | "normal" | "spacious";
  markerStyle: "dot" | "ring" | "number" | "check";
  linePosition: "left" | "center";
  background: "surface" | "subtle" | "transparent";
};

type TimelineContent = { childrenSlots?: string[] };

const GAP_MAP: Record<TimelineProps["density"], keyof ReturnType<typeof useDesignTheme>["spacing"]> = {
  compact: "md",
  normal: "lg",
  spacious: "xl"
};

function TimelineRenderer({
  props,
  children
}: {
  props: TimelineProps;
  content: TimelineContent;
  children?: ReactNode;
}) {
  const theme = useDesignTheme();
  const bg =
    props.background === "transparent"
      ? "transparent"
      : theme.color[props.background];
  const gap = theme.spacing[GAP_MAP[props.density]];
  const items = children ? [children].flat() : [];
  const centered = props.linePosition === "center";
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap,
        background: bg,
        width: "100%",
        padding: `${theme.spacing.lg}px ${theme.spacing.md}px`
      }}
    >
      {/* Timeline rail */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: centered ? "50%" : `${theme.spacing.md + 6}px`,
          transform: centered ? "translateX(-1px)" : undefined,
          width: 2,
          background: theme.color.border
        }}
      />
      {items.map((c, i) => (
        <div
          key={i}
          style={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: centered
              ? `1fr 24px 1fr`
              : `24px 1fr`,
            gap: theme.spacing.sm,
            alignItems: "start"
          }}
        >
          {centered && (
            <div style={{ textAlign: "right", paddingRight: theme.spacing.sm }} />
          )}
          {/* Marker */}
          <div
            aria-hidden
            style={{
              width: 24,
              height: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: theme.radius.full,
              background: theme.color.surface,
              border: `2px solid ${theme.color.primary}`,
              color: theme.color.primary,
              fontSize: 12,
              fontWeight: theme.font.weightExtraBold ?? 800
            }}
          >
            {props.markerStyle === "number"
              ? i + 1
              : props.markerStyle === "check"
                ? "✓"
                : props.markerStyle === "ring"
                  ? "○"
                  : "●"}
          </div>
          {/* Slot */}
          <div style={{ minWidth: 0 }}>{c}</div>
        </div>
      ))}
    </div>
  );
}

designSystemRegistry.register<TimelineProps, TimelineContent>({
  id: "containers.timeline",
  name: "Timeline",
  category: "containers",
  tier: "content",
  description:
    "Vertical timeline with token-driven marker + connecting line. Children render as steps. Use for project history, process pages, before/after journeys.",
  version: "1.0.0",
  contentShape: "container",
  editableProps: [
    {
      key: "density",
      label: "Density",
      type: {
        kind: "select",
        options: [
          { value: "compact", label: "Compact" },
          { value: "normal", label: "Normal" },
          { value: "spacious", label: "Spacious" }
        ]
      },
      default: "normal"
    },
    {
      key: "markerStyle",
      label: "Marker style",
      type: {
        kind: "select",
        options: [
          { value: "dot", label: "Dot" },
          { value: "ring", label: "Ring" },
          { value: "number", label: "Number" },
          { value: "check", label: "Check" }
        ]
      },
      default: "dot"
    },
    {
      key: "linePosition",
      label: "Line position",
      type: {
        kind: "select",
        options: [
          { value: "left", label: "Left rail" },
          { value: "center", label: "Center rail" }
        ]
      },
      default: "left"
    },
    {
      key: "background",
      label: "Background",
      type: {
        kind: "select",
        options: [
          { value: "surface", label: "Surface" },
          { value: "subtle", label: "Subtle" },
          { value: "transparent", label: "Transparent" }
        ]
      },
      default: "transparent"
    }
  ],
  themeTokensUsed: [
    "spacing.md",
    "spacing.lg",
    "spacing.xl",
    "color.border",
    "color.primary",
    "color.surface",
    "radius.full"
  ],
  animations: ["none", "fade-in", "stagger"],
  responsive: {
    mobile: "unchanged",
    tablet: "unchanged",
    desktop: "unchanged"
  },
  searchKeywords: [
    "timeline",
    "history",
    "process",
    "steps",
    "journey",
    "milestones"
  ],
  supportedDevices: ["mobile", "tablet", "desktop"],
  accessibilityStatus: "wcag-aa",
  performanceCost: "low",
  compatibleContainers: ["*"],
  compatibleThemes: ["*"],
  defaultProps: () => ({
    density: "normal",
    markerStyle: "dot",
    linePosition: "left",
    background: "transparent"
  }),
  defaultContent: () => ({ childrenSlots: [] }),
  renderer: TimelineRenderer
});
