// Design component: containers.dashboard-shell
//
// Full-page dashboard frame — top nav + optional sidebar + main
// content grid. Holds dashboardBlockRegistry blocks in a 4-column
// responsive grid. Container tier: layout (page-scale root).

"use client";

import type { ReactNode } from "react";
import { useDesignTheme } from "../../theme/context";
import { designSystemRegistry } from "../../registry";

type DashboardShellProps = {
  navMode: "top-only" | "top-and-sidebar" | "sidebar-only";
  gridColumns: 3 | 4 | 6;
  gap: "sm" | "md" | "lg";
  background: "surface" | "subtle";
  maxContentWidth: 1200 | 1400 | 1600 | 0;
};

type DashboardShellContent = { childrenSlots?: string[] };

function DashboardShellRenderer({
  props,
  children
}: {
  props: DashboardShellProps;
  content: DashboardShellContent;
  children?: ReactNode;
}) {
  const theme = useDesignTheme();
  const maxW = props.maxContentWidth === 0 ? undefined : `${props.maxContentWidth}px`;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: theme.color[props.background],
        color: theme.color.ink
      }}
    >
      {/* Top slot — first child = top nav (if navMode includes top). */}
      {(props.navMode === "top-only" || props.navMode === "top-and-sidebar") && (
        <div
          style={{
            borderBottom: `1px solid ${theme.color.border}`,
            background: theme.color.surface
          }}
        >
          {/* Consumers pass their nav as the first child. */}
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            props.navMode === "top-and-sidebar" ||
            props.navMode === "sidebar-only"
              ? "260px 1fr"
              : "1fr",
          flex: 1
        }}
      >
        {(props.navMode === "top-and-sidebar" ||
          props.navMode === "sidebar-only") && (
          <aside
            style={{
              background: theme.color.surface,
              borderRight: `1px solid ${theme.color.border}`,
              padding: theme.spacing.md
            }}
          />
        )}
        <main
          style={{
            padding: theme.spacing.lg,
            maxWidth: maxW,
            width: "100%",
            marginInline: "auto"
          }}
        >
          <div
            className="dsr-dashboard-grid"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(1, 1fr)`,
              gap: theme.spacing[props.gap]
            }}
          >
            {children}
          </div>
          <style>{`
            @media (min-width: 768px) {
              .dsr-dashboard-grid { grid-template-columns: repeat(2, 1fr) !important; }
            }
            @media (min-width: 1024px) {
              .dsr-dashboard-grid { grid-template-columns: repeat(${props.gridColumns}, 1fr) !important; }
            }
          `}</style>
        </main>
      </div>
    </div>
  );
}

designSystemRegistry.register<DashboardShellProps, DashboardShellContent>({
  id: "containers.dashboard-shell",
  name: "Dashboard Shell",
  category: "containers",
  tier: "layout",
  description:
    "Full-page dashboard frame with top nav + optional sidebar + responsive content grid. Holds dashboardBlockRegistry blocks.",
  version: "1.0.0",
  contentShape: "container",
  editableProps: [
    {
      key: "navMode",
      label: "Nav mode",
      type: {
        kind: "select",
        options: [
          { value: "top-only", label: "Top only" },
          { value: "top-and-sidebar", label: "Top + sidebar" },
          { value: "sidebar-only", label: "Sidebar only" }
        ]
      },
      default: "top-and-sidebar"
    },
    {
      key: "gridColumns",
      label: "Grid columns (desktop)",
      type: {
        kind: "select",
        options: [
          { value: "3", label: "3" },
          { value: "4", label: "4" },
          { value: "6", label: "6" }
        ]
      },
      default: "4"
    },
    {
      key: "gap",
      label: "Grid gap",
      type: {
        kind: "select",
        options: [
          { value: "sm", label: "Small" },
          { value: "md", label: "Medium" },
          { value: "lg", label: "Large" }
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
          { value: "subtle", label: "Subtle" }
        ]
      },
      default: "subtle"
    },
    {
      key: "maxContentWidth",
      label: "Max content width (px)",
      type: {
        kind: "select",
        options: [
          { value: "0", label: "Unbounded" },
          { value: "1200", label: "1200" },
          { value: "1400", label: "1400" },
          { value: "1600", label: "1600" }
        ]
      },
      default: "1400"
    }
  ],
  themeTokensUsed: [
    "spacing.md",
    "spacing.lg",
    "color.surface",
    "color.subtle",
    "color.border",
    "color.ink"
  ],
  animations: ["none", "fade-in"],
  responsive: {
    mobile: "stack",
    tablet: "unchanged",
    desktop: "unchanged"
  },
  searchKeywords: [
    "dashboard",
    "admin",
    "shell",
    "frame",
    "sidebar",
    "top-nav"
  ],
  supportedDevices: ["tablet", "desktop"],
  accessibilityStatus: "wcag-aa",
  performanceCost: "low",
  compatibleContainers: [],
  compatibleThemes: ["*"],
  defaultProps: () => ({
    navMode: "top-and-sidebar",
    gridColumns: 4,
    gap: "md",
    background: "subtle",
    maxContentWidth: 1400
  }),
  defaultContent: () => ({ childrenSlots: [] }),
  renderer: DashboardShellRenderer
});
