// Design component: containers.grid
//
// N-column responsive grid. Columns scale down at breakpoints — a
// 4-col grid becomes 2-col at tablet, 1-col at mobile.

"use client";

import type { ReactNode } from "react";
import { useDesignTheme } from "../../theme/context";
import { designSystemRegistry } from "../../registry";

type GridProps = {
  columns: 2 | 3 | 4 | 6;
  gap: "sm" | "md" | "lg";
  mobileColumns: 1 | 2;
  tabletColumns: 2 | 3;
};

type GridContent = { childrenSlots?: string[] };

function GridRenderer({
  props,
  children
}: {
  props: GridProps;
  content: GridContent;
  children?: ReactNode;
}) {
  const theme = useDesignTheme();
  return (
    <>
      <div
        className="dsr-grid"
        style={{
          display: "grid",
          gap: theme.spacing[props.gap],
          gridTemplateColumns: `repeat(${props.mobileColumns}, 1fr)`,
          width: "100%"
        }}
      >
        {children}
      </div>
      <style>{`
        @media (min-width: 768px) {
          .dsr-grid { grid-template-columns: repeat(${props.tabletColumns}, 1fr) !important; }
        }
        @media (min-width: 1024px) {
          .dsr-grid { grid-template-columns: repeat(${props.columns}, 1fr) !important; }
        }
      `}</style>
    </>
  );
}

designSystemRegistry.register<GridProps, GridContent>({
  id: "containers.grid",
  name: "Grid",
  category: "containers",
  tier: "content",
  aliases: ["gallery", "pricing"],
  description:
    "N-column responsive grid. Columns collapse at breakpoints so a desktop 4-col becomes tablet 2-col becomes mobile 1-col.",
  version: "1.0.0",
  contentShape: "container",
  editableProps: [
    {
      key: "columns",
      label: "Desktop columns",
      type: {
        kind: "select",
        options: [
          { value: "2", label: "2" },
          { value: "3", label: "3" },
          { value: "4", label: "4" },
          { value: "6", label: "6" }
        ]
      },
      default: "3"
    },
    {
      key: "tabletColumns",
      label: "Tablet columns",
      type: {
        kind: "select",
        options: [
          { value: "2", label: "2" },
          { value: "3", label: "3" }
        ]
      },
      default: "2"
    },
    {
      key: "mobileColumns",
      label: "Mobile columns",
      type: {
        kind: "select",
        options: [
          { value: "1", label: "1" },
          { value: "2", label: "2" }
        ]
      },
      default: "1"
    },
    {
      key: "gap",
      label: "Gap",
      type: {
        kind: "select",
        options: [
          { value: "sm", label: "Small" },
          { value: "md", label: "Medium" },
          { value: "lg", label: "Large" }
        ]
      },
      default: "md"
    }
  ],
  themeTokensUsed: ["spacing.sm", "spacing.md", "spacing.lg"],
  animations: ["none", "fade-in", "stagger"],
  responsive: {
    mobile: "collapse",
    tablet: "collapse",
    desktop: "unchanged"
  },
  searchKeywords: ["grid", "columns", "responsive", "cards", "layout"],
  supportedDevices: ["mobile", "tablet", "desktop"],
  accessibilityStatus: "wcag-aa",
  performanceCost: "low",
  compatibleContainers: ["*"],
  defaultProps: () => ({
    columns: 3,
    tabletColumns: 2,
    mobileColumns: 1,
    gap: "md"
  }),
  defaultContent: () => ({ childrenSlots: [] }),
  renderer: GridRenderer
});
