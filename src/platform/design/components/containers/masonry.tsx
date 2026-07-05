// Design component: containers.masonry
//
// CSS column-based masonry layout. Children flow into columns filling
// gaps naturally. Good for portfolio, gallery, testimonial walls where
// heights vary.

"use client";

import type { ReactNode } from "react";
import { useDesignTheme } from "../../theme/context";
import { designSystemRegistry } from "../../registry";

type MasonryProps = {
  columns: 2 | 3 | 4;
  gap: "sm" | "md" | "lg";
  mobileColumns: 1 | 2;
};

type MasonryContent = { childrenSlots?: string[] };

function MasonryRenderer({
  props,
  children
}: {
  props: MasonryProps;
  content: MasonryContent;
  children?: ReactNode;
}) {
  const theme = useDesignTheme();
  return (
    <>
      <div
        className="dsr-masonry"
        style={{
          columnCount: props.mobileColumns,
          columnGap: theme.spacing[props.gap],
          width: "100%"
        }}
      >
        {children}
      </div>
      <style>{`
        .dsr-masonry > * { break-inside: avoid; margin-bottom: ${theme.spacing[props.gap]}px; display: inline-block; width: 100%; }
        @media (min-width: 1024px) {
          .dsr-masonry { column-count: ${props.columns} !important; }
        }
      `}</style>
    </>
  );
}

designSystemRegistry.register<MasonryProps, MasonryContent>({
  id: "containers.masonry",
  name: "Masonry",
  category: "containers",
  tier: "content",
  description:
    "CSS-column masonry layout. Children of varying heights flow into columns filling gaps. Use for gallery grids, portfolio walls, testimonial mosaics.",
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
          { value: "4", label: "4" }
        ]
      },
      default: "3"
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
    tablet: "unchanged",
    desktop: "unchanged"
  },
  searchKeywords: ["masonry", "gallery", "portfolio", "pinterest", "columns"],
  supportedDevices: ["mobile", "tablet", "desktop"],
  accessibilityStatus: "wcag-aa",
  performanceCost: "low",
  compatibleContainers: ["*"],
  defaultProps: () => ({
    columns: 3,
    mobileColumns: 1,
    gap: "md"
  }),
  defaultContent: () => ({ childrenSlots: [] }),
  renderer: MasonryRenderer
});
