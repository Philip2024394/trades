// Design component: containers.split
//
// Two-column split. Ratio controls left/right proportion. Reverses on
// mobile so photo-left / copy-right desktop layouts stack copy-first on
// mobile (better UX — content over media).

"use client";

import type { ReactNode } from "react";
import { useDesignTheme } from "../../theme/context";
import { designSystemRegistry } from "../../registry";

type SplitProps = {
  ratio: "50/50" | "60/40" | "40/60" | "70/30" | "30/70";
  gap: "sm" | "md" | "lg" | "xl";
  mobileOrder: "content-first" | "media-first";
  alignItems: "start" | "center" | "stretch";
};

type SplitContent = { childrenSlots?: string[] };

const RATIO_MAP: Record<SplitProps["ratio"], string> = {
  "50/50": "1fr 1fr",
  "60/40": "3fr 2fr",
  "40/60": "2fr 3fr",
  "70/30": "7fr 3fr",
  "30/70": "3fr 7fr"
};

function SplitRenderer({
  props,
  children
}: {
  props: SplitProps;
  content: SplitContent;
  children?: ReactNode;
}) {
  const theme = useDesignTheme();
  return (
    <div
      style={{
        display: "grid",
        gap: theme.spacing[props.gap],
        alignItems:
          props.alignItems === "start"
            ? "flex-start"
            : props.alignItems === "stretch"
              ? "stretch"
              : "center",
        gridTemplateColumns: "1fr",
        width: "100%"
      }}
      className={
        "[&]:lg:grid-cols-[var(--split-cols)] " +
        (props.mobileOrder === "media-first" ? "" : "[&>*:first-child]:order-first")
      }
    >
      <style>{`
        @media (min-width: 1024px) {
          .split-shell { grid-template-columns: ${RATIO_MAP[props.ratio]}; }
        }
      `}</style>
      {children}
    </div>
  );
}

designSystemRegistry.register<SplitProps, SplitContent>({
  id: "containers.split",
  name: "Split",
  category: "containers",
  tier: "content",
  description:
    "Two-column split with configurable ratio. Stacks on mobile; ratio applies on desktop. Choose whether content or media renders first on mobile.",
  version: "1.0.0",
  contentShape: "container",
  editableProps: [
    {
      key: "ratio",
      label: "Column ratio",
      type: {
        kind: "select",
        options: [
          { value: "50/50", label: "Even (50 / 50)" },
          { value: "60/40", label: "Left-heavy (60 / 40)" },
          { value: "40/60", label: "Right-heavy (40 / 60)" },
          { value: "70/30", label: "Left-anchored (70 / 30)" },
          { value: "30/70", label: "Right-anchored (30 / 70)" }
        ]
      },
      default: "50/50"
    },
    {
      key: "gap",
      label: "Gap",
      type: {
        kind: "select",
        options: [
          { value: "sm", label: "Small" },
          { value: "md", label: "Medium" },
          { value: "lg", label: "Large" },
          { value: "xl", label: "Extra large" }
        ]
      },
      default: "lg"
    },
    {
      key: "mobileOrder",
      label: "Mobile order",
      type: {
        kind: "select",
        options: [
          { value: "content-first", label: "Content on top" },
          { value: "media-first", label: "Media on top" }
        ]
      },
      default: "content-first"
    },
    {
      key: "alignItems",
      label: "Vertical alignment",
      type: {
        kind: "select",
        options: [
          { value: "start", label: "Top" },
          { value: "center", label: "Center" },
          { value: "stretch", label: "Stretch" }
        ]
      },
      default: "center"
    }
  ],
  themeTokensUsed: ["spacing.sm", "spacing.md", "spacing.lg", "spacing.xl"],
  animations: ["none", "fade-in", "slide-up"],
  responsive: {
    mobile: "stack",
    tablet: "unchanged",
    desktop: "unchanged"
  },
  searchKeywords: ["split", "two-column", "grid", "side-by-side", "50/50"],
  supportedDevices: ["mobile", "tablet", "desktop"],
  accessibilityStatus: "wcag-aa",
  performanceCost: "low",
  compatibleContainers: ["*"],
  defaultProps: () => ({
    ratio: "50/50",
    gap: "lg",
    mobileOrder: "content-first",
    alignItems: "center"
  }),
  defaultContent: () => ({ childrenSlots: [] }),
  renderer: SplitRenderer
});
