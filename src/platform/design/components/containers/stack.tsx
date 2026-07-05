// Design component: containers.stack
//
// Vertical stack — flex-col with gap. The default composition primitive
// when you have N items that should render top-to-bottom with consistent
// spacing. Responsive: gap collapses on mobile.

"use client";

import type { ReactNode } from "react";
import { useDesignTheme } from "../../theme/context";
import { designSystemRegistry } from "../../registry";

type StackProps = {
  gap: "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
  align: "start" | "center" | "end" | "stretch";
  paddingBlock: "sm" | "md" | "lg" | "xl";
  background: "surface" | "subtle" | "surfaceElevated" | "transparent";
};

type StackContent = { childrenSlots?: string[] };

function StackRenderer({
  props,
  children
}: {
  props: StackProps;
  content: StackContent;
  children?: ReactNode;
}) {
  const theme = useDesignTheme();
  const bg =
    props.background === "transparent"
      ? "transparent"
      : theme.color[props.background];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems:
          props.align === "start"
            ? "flex-start"
            : props.align === "end"
              ? "flex-end"
              : props.align === "stretch"
                ? "stretch"
                : "center",
        gap: theme.spacing[props.gap],
        background: bg,
        paddingBlock: theme.spacing[props.paddingBlock],
        width: "100%"
      }}
    >
      {children}
    </div>
  );
}

designSystemRegistry.register<StackProps, StackContent>({
  id: "containers.stack",
  name: "Stack",
  category: "containers",
  tier: "content",
  description:
    "Vertical stack layout. Children render top-to-bottom with token-driven gap. The atomic 'items in a column' container.",
  version: "1.0.0",
  contentShape: "container",
  editableProps: [
    {
      key: "gap",
      label: "Gap",
      type: {
        kind: "select",
        options: [
          { value: "xs", label: "Extra small" },
          { value: "sm", label: "Small" },
          { value: "md", label: "Medium" },
          { value: "lg", label: "Large" },
          { value: "xl", label: "Extra large" },
          { value: "xxl", label: "Huge" }
        ]
      },
      default: "md"
    },
    {
      key: "align",
      label: "Alignment",
      type: {
        kind: "select",
        options: [
          { value: "start", label: "Start" },
          { value: "center", label: "Center" },
          { value: "end", label: "End" },
          { value: "stretch", label: "Stretch" }
        ]
      },
      default: "stretch"
    },
    {
      key: "paddingBlock",
      label: "Vertical padding",
      type: {
        kind: "select",
        options: [
          { value: "sm", label: "Small" },
          { value: "md", label: "Medium" },
          { value: "lg", label: "Large" },
          { value: "xl", label: "Extra large" }
        ]
      },
      default: "md"
    },
    {
      key: "background",
      label: "Background",
      type: {
        kind: "select",
        options: [
          { value: "surface", label: "Surface" },
          { value: "surfaceElevated", label: "Elevated" },
          { value: "subtle", label: "Subtle" },
          { value: "transparent", label: "Transparent" }
        ]
      },
      default: "transparent"
    }
  ],
  themeTokensUsed: [
    "spacing.xs",
    "spacing.sm",
    "spacing.md",
    "spacing.lg",
    "spacing.xl",
    "spacing.xxl",
    "color.surface",
    "color.surfaceElevated",
    "color.subtle"
  ],
  animations: ["none", "fade-in", "stagger"],
  responsive: {
    mobile: "unchanged",
    tablet: "unchanged",
    desktop: "unchanged"
  },
  searchKeywords: ["stack", "vertical", "column", "flex", "gap"],
  supportedDevices: ["mobile", "tablet", "desktop"],
  accessibilityStatus: "wcag-aa",
  performanceCost: "low",
  compatibleContainers: ["*"],
  defaultProps: () => ({
    gap: "md",
    align: "stretch",
    paddingBlock: "md",
    background: "transparent"
  }),
  defaultContent: () => ({ childrenSlots: [] }),
  renderer: StackRenderer
});
