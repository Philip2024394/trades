// Design component: containers.comparison
//
// 2- to 4-column side-by-side comparison shell with a sticky header
// row. Suitable for feature-vs-competitor pages, service tier
// comparisons, before/after side-by-sides.

"use client";

import type { ReactNode } from "react";
import { useDesignTheme } from "../../theme/context";
import { designSystemRegistry } from "../../registry";

type ComparisonProps = {
  columns: 2 | 3 | 4;
  emphasiseColumn: 0 | 1 | 2 | 3 | -1;
  showDivider: boolean;
  stickyHeader: boolean;
};

type ComparisonContent = { childrenSlots?: string[] };

function ComparisonRenderer({
  props,
  children
}: {
  props: ComparisonProps;
  content: ComparisonContent;
  children?: ReactNode;
}) {
  const theme = useDesignTheme();
  const items = children ? [children].flat() : [];
  return (
    <>
      <div
        className="dsr-comparison"
        style={{
          display: "grid",
          gridTemplateColumns: `1fr`,
          gap: theme.spacing.md,
          width: "100%",
          padding: `${theme.spacing.md}px 0`
        }}
      >
        {items.map((c, i) => {
          const emphasised = i === props.emphasiseColumn;
          return (
            <div
              key={i}
              style={{
                borderRight:
                  props.showDivider && i < items.length - 1
                    ? `1px solid ${theme.color.border}`
                    : "none",
                background: emphasised ? theme.color.subtle : "transparent",
                borderRadius: emphasised ? theme.radius.md : 0,
                padding: theme.spacing.md,
                position: props.stickyHeader ? "relative" : undefined
              }}
            >
              {c}
            </div>
          );
        })}
      </div>
      <style>{`
        @media (min-width: 768px) {
          .dsr-comparison { grid-template-columns: repeat(${props.columns}, 1fr) !important; }
        }
      `}</style>
    </>
  );
}

designSystemRegistry.register<ComparisonProps, ComparisonContent>({
  id: "containers.comparison",
  name: "Comparison",
  category: "containers",
  tier: "content",
  description:
    "Side-by-side comparison shell (2-4 columns). Optional emphasised column, sticky header rail. Feature-vs-competitor, service tiers, before/after.",
  version: "1.0.0",
  contentShape: "container",
  editableProps: [
    {
      key: "columns",
      label: "Columns",
      type: {
        kind: "select",
        options: [
          { value: "2", label: "2" },
          { value: "3", label: "3" },
          { value: "4", label: "4" }
        ]
      },
      default: "3"
    },
    {
      key: "emphasiseColumn",
      label: "Emphasise column",
      type: {
        kind: "select",
        options: [
          { value: "-1", label: "None" },
          { value: "0", label: "First" },
          { value: "1", label: "Second" },
          { value: "2", label: "Third" },
          { value: "3", label: "Fourth" }
        ]
      },
      default: "-1"
    },
    {
      key: "showDivider",
      label: "Show divider between columns",
      type: { kind: "boolean" },
      default: true
    },
    {
      key: "stickyHeader",
      label: "Sticky first-row on scroll",
      type: { kind: "boolean" },
      default: false
    }
  ],
  themeTokensUsed: [
    "spacing.md",
    "color.border",
    "color.subtle",
    "radius.md"
  ],
  animations: ["none", "fade-in"],
  responsive: {
    mobile: "stack",
    tablet: "unchanged",
    desktop: "unchanged"
  },
  searchKeywords: [
    "comparison",
    "compare",
    "features",
    "vs",
    "tiers",
    "before-after"
  ],
  supportedDevices: ["mobile", "tablet", "desktop"],
  accessibilityStatus: "wcag-aa",
  performanceCost: "low",
  compatibleContainers: ["*"],
  compatibleThemes: ["*"],
  defaultProps: () => ({
    columns: 3,
    emphasiseColumn: -1,
    showDivider: true,
    stickyHeader: false
  }),
  defaultContent: () => ({ childrenSlots: [] }),
  renderer: ComparisonRenderer
});
