"use client";

// Design component: containers.single-column
//
// The atomic layout container. Full-width, centered, max-width capped
// for readable line lengths, vertical rhythm via theme spacing.
// Every component in the containers.* family shares the same
// { childrenSlots?: string[] } content shape.

import type { ReactNode } from "react";
import { useDesignTheme } from "../../theme/context";
import { designSystemRegistry } from "../../registry";

type SingleColumnProps = {
  maxWidth: number;
  paddingBlock: "sm" | "md" | "lg" | "xl";
  paddingInline: "sm" | "md" | "lg";
  align: "start" | "center" | "end";
  gap: "sm" | "md" | "lg";
  background: "surface" | "subtle" | "surfaceElevated" | "transparent";
};

type SingleColumnContent = {
  /** Ordered ids of Design System component instances that render
   *  inside this container. Populated by Studio's layout store. */
  childrenSlots?: string[];
};

function SingleColumnRenderer({
  props,
  children
}: {
  props: SingleColumnProps;
  content: SingleColumnContent;
  /** Studio's layout renderer walks the childrenSlots and passes the
   *  materialised React children in here — the container renderer
   *  never resolves layout instances itself. */
  children?: ReactNode;
}) {
  const theme = useDesignTheme();
  const bg =
    props.background === "transparent" ? "transparent" : theme.color[props.background];
  return (
    <section
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        background: bg,
        paddingBlock: theme.spacing[props.paddingBlock]
      }}
    >
      <div
        style={{
          maxWidth: props.maxWidth ? `${props.maxWidth}px` : "100%",
          width: "100%",
          paddingInline: theme.spacing[props.paddingInline],
          display: "flex",
          flexDirection: "column",
          alignItems:
            props.align === "start"
              ? "flex-start"
              : props.align === "end"
                ? "flex-end"
                : "center",
          gap: theme.spacing[props.gap]
        }}
      >
        {children}
      </div>
    </section>
  );
}

designSystemRegistry.register<SingleColumnProps, SingleColumnContent>({
  id: "containers.single-column",
  name: "Single Column",
  category: "containers",
  description:
    "Full-width centered column with a readable max-width. The workhorse layout — used for hero copy, body content, form sections.",
  version: "1.0.0",
  contentShape: "container",
  editableProps: [
    {
      key: "maxWidth",
      label: "Max width",
      type: { kind: "number", min: 320, max: 1440, step: 20, unit: "px" },
      default: 960
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
      default: "lg"
    },
    {
      key: "paddingInline",
      label: "Horizontal padding",
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
      key: "align",
      label: "Align items",
      type: {
        kind: "select",
        options: [
          { value: "start", label: "Left" },
          { value: "center", label: "Center" },
          { value: "end", label: "Right" }
        ]
      },
      default: "center"
    },
    {
      key: "gap",
      label: "Gap between children",
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
          { value: "surfaceElevated", label: "Elevated surface" },
          { value: "subtle", label: "Subtle" },
          { value: "transparent", label: "Transparent" }
        ]
      },
      default: "surface"
    }
  ],
  themeTokensUsed: [
    "spacing.sm",
    "spacing.md",
    "spacing.lg",
    "spacing.xl",
    "color.surface",
    "color.surfaceElevated",
    "color.subtle"
  ],
  animations: ["none", "fade-in"],
  responsive: {
    mobile: "unchanged",
    tablet: "unchanged",
    desktop: "unchanged"
  },
  searchKeywords: [
    "container",
    "column",
    "single",
    "layout",
    "wrapper",
    "section"
  ],
  defaultProps: () => ({
    maxWidth: 960,
    paddingBlock: "lg",
    paddingInline: "md",
    align: "center",
    gap: "md",
    background: "surface"
  }),
  defaultContent: () => ({ childrenSlots: [] }),
  renderer: SingleColumnRenderer
});
