// Design component: containers.sidebar
//
// Aside + main layout. Sidebar collapses to bottom on mobile. Optional
// sticky positioning for the sidebar so it stays visible while the
// main column scrolls.

"use client";

import type { ReactNode } from "react";
import { useDesignTheme } from "../../theme/context";
import { designSystemRegistry } from "../../registry";

type SidebarProps = {
  position: "left" | "right";
  sidebarWidth: 220 | 260 | 300 | 340;
  gap: "sm" | "md" | "lg";
  sticky: boolean;
};

type SidebarContent = { childrenSlots?: string[] };

function SidebarRenderer({
  props,
  children
}: {
  props: SidebarProps;
  content: SidebarContent;
  children?: ReactNode;
}) {
  const theme = useDesignTheme();
  return (
    <>
      <div
        className="dsr-sidebar"
        style={{
          display: "grid",
          gap: theme.spacing[props.gap],
          gridTemplateColumns: "1fr",
          gridTemplateAreas:
            props.position === "left" ? `"main" "aside"` : `"main" "aside"`,
          width: "100%"
        }}
      >
        {children}
      </div>
      <style>{`
        @media (min-width: 1024px) {
          .dsr-sidebar {
            grid-template-columns: ${
              props.position === "left"
                ? `${props.sidebarWidth}px 1fr`
                : `1fr ${props.sidebarWidth}px`
            } !important;
            grid-template-areas: ${
              props.position === "left"
                ? `"aside main"`
                : `"main aside"`
            } !important;
          }
          .dsr-sidebar > *:first-child { grid-area: ${props.position === "left" ? "aside" : "main"}; }
          .dsr-sidebar > *:nth-child(2) { grid-area: ${props.position === "left" ? "main" : "aside"}; }
          ${
            props.sticky
              ? `.dsr-sidebar > *:${props.position === "left" ? "first-child" : "nth-child(2)"} { position: sticky; top: ${theme.spacing.md}px; align-self: start; }`
              : ""
          }
        }
      `}</style>
    </>
  );
}

designSystemRegistry.register<SidebarProps, SidebarContent>({
  id: "containers.sidebar",
  name: "Sidebar",
  category: "containers",
  tier: "content",
  description:
    "Aside + main layout with configurable sidebar position (left/right) and width. Sidebar can stick while main content scrolls. Collapses to stack on mobile.",
  version: "1.0.0",
  contentShape: "container",
  editableProps: [
    {
      key: "position",
      label: "Sidebar position",
      type: {
        kind: "select",
        options: [
          { value: "left", label: "Left" },
          { value: "right", label: "Right" }
        ]
      },
      default: "left"
    },
    {
      key: "sidebarWidth",
      label: "Sidebar width (px)",
      type: {
        kind: "select",
        options: [
          { value: "220", label: "220" },
          { value: "260", label: "260" },
          { value: "300", label: "300" },
          { value: "340", label: "340" }
        ]
      },
      default: "260"
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
      default: "lg"
    },
    {
      key: "sticky",
      label: "Sticky sidebar",
      type: { kind: "boolean" },
      default: false
    }
  ],
  themeTokensUsed: ["spacing.sm", "spacing.md", "spacing.lg"],
  animations: ["none", "fade-in"],
  responsive: {
    mobile: "stack",
    tablet: "stack",
    desktop: "unchanged"
  },
  searchKeywords: ["sidebar", "aside", "menu", "navigation", "docs", "settings"],
  supportedDevices: ["mobile", "tablet", "desktop"],
  accessibilityStatus: "wcag-aa",
  performanceCost: "low",
  compatibleContainers: ["*"],
  defaultProps: () => ({
    position: "left",
    sidebarWidth: 260,
    gap: "lg",
    sticky: false
  }),
  defaultContent: () => ({ childrenSlots: [] }),
  renderer: SidebarRenderer
});
