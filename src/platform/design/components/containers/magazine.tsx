// Design component: containers.magazine
//
// Editorial multi-column layout — think print magazine. First child
// spans the full width as a lead; remaining children flow into columns
// below. Good for long-form content, feature pages, blog templates.

"use client";

import type { ReactNode } from "react";
import { useDesignTheme } from "../../theme/context";
import { designSystemRegistry } from "../../registry";

type MagazineProps = {
  bodyColumns: 2 | 3;
  gap: "md" | "lg" | "xl";
  paddingBlock: "md" | "lg" | "xl";
  showRule: boolean;
};

type MagazineContent = { childrenSlots?: string[] };

function MagazineRenderer({
  props,
  children
}: {
  props: MagazineProps;
  content: MagazineContent;
  children?: ReactNode;
}) {
  const theme = useDesignTheme();
  const childArray = children ? [children].flat() : [];
  const lead = childArray[0];
  const body = childArray.slice(1);
  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: theme.spacing[props.gap],
          paddingBlock: theme.spacing[props.paddingBlock],
          width: "100%"
        }}
      >
        {lead && <div>{lead}</div>}
        {props.showRule && lead && (
          <hr style={{ border: 0, borderTop: `1px solid ${theme.color.border}` }} />
        )}
        {body.length > 0 && (
          <div
            className="dsr-magazine-body"
            style={{
              columnCount: 1,
              columnGap: theme.spacing[props.gap]
            }}
          >
            {body.map((c, i) => (
              <div
                key={i}
                style={{
                  breakInside: "avoid",
                  marginBottom: theme.spacing[props.gap]
                }}
              >
                {c}
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`
        @media (min-width: 1024px) {
          .dsr-magazine-body { column-count: ${props.bodyColumns} !important; }
        }
      `}</style>
    </>
  );
}

designSystemRegistry.register<MagazineProps, MagazineContent>({
  id: "containers.magazine",
  name: "Magazine",
  category: "containers",
  tier: "layout",
  description:
    "Editorial multi-column layout. First child spans full-width as a lead; remaining children flow into columns. Print-magazine aesthetic for long-form content.",
  version: "1.0.0",
  contentShape: "container",
  editableProps: [
    {
      key: "bodyColumns",
      label: "Body columns (desktop)",
      type: {
        kind: "select",
        options: [
          { value: "2", label: "2 columns" },
          { value: "3", label: "3 columns" }
        ]
      },
      default: "2"
    },
    {
      key: "gap",
      label: "Gap",
      type: {
        kind: "select",
        options: [
          { value: "md", label: "Medium" },
          { value: "lg", label: "Large" },
          { value: "xl", label: "Extra large" }
        ]
      },
      default: "lg"
    },
    {
      key: "paddingBlock",
      label: "Vertical padding",
      type: {
        kind: "select",
        options: [
          { value: "md", label: "Medium" },
          { value: "lg", label: "Large" },
          { value: "xl", label: "Extra large" }
        ]
      },
      default: "lg"
    },
    {
      key: "showRule",
      label: "Show divider under lead",
      type: { kind: "boolean" },
      default: true
    }
  ],
  themeTokensUsed: [
    "spacing.md",
    "spacing.lg",
    "spacing.xl",
    "color.border"
  ],
  animations: ["none", "fade-in"],
  responsive: {
    mobile: "collapse",
    tablet: "unchanged",
    desktop: "unchanged"
  },
  searchKeywords: ["magazine", "editorial", "columns", "print", "long-form", "blog"],
  supportedDevices: ["mobile", "tablet", "desktop"],
  accessibilityStatus: "wcag-aa",
  performanceCost: "low",
  compatibleContainers: ["*"],
  defaultProps: () => ({
    bodyColumns: 2,
    gap: "lg",
    paddingBlock: "lg",
    showRule: true
  }),
  defaultContent: () => ({ childrenSlots: [] }),
  renderer: MagazineRenderer
});
