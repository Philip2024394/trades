// Design component: containers.hero
//
// Full-bleed hero container. Banner-shaped by default (1600×800 target
// on desktop), auto-height on mobile. Owns background + content slot
// layering. Sections that USED to encode their own hero shell now
// compose over this container.

"use client";

import type { ReactNode } from "react";
import { useDesignTheme } from "../../theme/context";
import { designSystemRegistry } from "../../registry";

type HeroProps = {
  minHeightDesktop: 480 | 600 | 720 | 800;
  minHeightMobile: 300 | 400 | 500 | 600;
  contentAlign: "left" | "center" | "right";
  contentVAlign: "top" | "center" | "bottom";
  maxContentWidth: 640 | 800 | 960 | 1120;
  background: "surface" | "surfaceElevated" | "subtle" | "transparent";
  paddingBlock: "md" | "lg" | "xl";
};

type HeroContent = { childrenSlots?: string[] };

function HeroRenderer({
  props,
  children
}: {
  props: HeroProps;
  content: HeroContent;
  children?: ReactNode;
}) {
  const theme = useDesignTheme();
  const bg =
    props.background === "transparent"
      ? "transparent"
      : theme.color[props.background];
  return (
    <>
      <section
        className="dsr-hero"
        style={{
          position: "relative",
          width: "100%",
          minHeight: `${props.minHeightMobile}px`,
          background: bg,
          display: "flex",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: `${props.maxContentWidth}px`,
            margin: "0 auto",
            padding: `${theme.spacing[props.paddingBlock]}px ${theme.spacing.md}px`,
            display: "flex",
            flexDirection: "column",
            justifyContent:
              props.contentVAlign === "top"
                ? "flex-start"
                : props.contentVAlign === "bottom"
                  ? "flex-end"
                  : "center",
            alignItems:
              props.contentAlign === "left"
                ? "flex-start"
                : props.contentAlign === "right"
                  ? "flex-end"
                  : "center",
            textAlign: props.contentAlign,
            gap: theme.spacing.md,
            position: "relative",
            zIndex: 2
          }}
        >
          {children}
        </div>
      </section>
      <style>{`
        @media (min-width: 1024px) {
          .dsr-hero { min-height: ${props.minHeightDesktop}px !important; max-height: 900px; }
        }
      `}</style>
    </>
  );
}

designSystemRegistry.register<HeroProps, HeroContent>({
  id: "containers.hero",
  name: "Hero",
  category: "containers",
  tier: "layout",
  description:
    "Full-bleed hero shell. Banner-shaped on desktop (1600×800 target), auto-height on mobile. Owns content alignment + max width + background surface.",
  version: "1.0.0",
  contentShape: "container",
  editableProps: [
    {
      key: "minHeightDesktop",
      label: "Desktop min height (px)",
      type: {
        kind: "select",
        options: [
          { value: "480", label: "480" },
          { value: "600", label: "600 (default)" },
          { value: "720", label: "720" },
          { value: "800", label: "800" }
        ]
      },
      default: "600"
    },
    {
      key: "minHeightMobile",
      label: "Mobile min height (px)",
      type: {
        kind: "select",
        options: [
          { value: "300", label: "300" },
          { value: "400", label: "400" },
          { value: "500", label: "500" },
          { value: "600", label: "600" }
        ]
      },
      default: "400"
    },
    {
      key: "contentAlign",
      label: "Content horizontal align",
      type: {
        kind: "select",
        options: [
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" }
        ]
      },
      default: "center"
    },
    {
      key: "contentVAlign",
      label: "Content vertical align",
      type: {
        kind: "select",
        options: [
          { value: "top", label: "Top" },
          { value: "center", label: "Center" },
          { value: "bottom", label: "Bottom" }
        ]
      },
      default: "center"
    },
    {
      key: "maxContentWidth",
      label: "Max content width (px)",
      type: {
        kind: "select",
        options: [
          { value: "640", label: "640" },
          { value: "800", label: "800" },
          { value: "960", label: "960" },
          { value: "1120", label: "1120" }
        ]
      },
      default: "960"
    },
    {
      key: "background",
      label: "Background surface",
      type: {
        kind: "select",
        options: [
          { value: "surface", label: "Surface" },
          { value: "surfaceElevated", label: "Elevated" },
          { value: "subtle", label: "Subtle" },
          { value: "transparent", label: "Transparent" }
        ]
      },
      default: "surface"
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
      default: "xl"
    }
  ],
  themeTokensUsed: [
    "spacing.md",
    "spacing.lg",
    "spacing.xl",
    "color.surface",
    "color.surfaceElevated",
    "color.subtle"
  ],
  animations: ["none", "fade-in", "slide-up", "reveal"],
  responsive: {
    mobile: "unchanged",
    tablet: "unchanged",
    desktop: "unchanged"
  },
  searchKeywords: ["hero", "banner", "full-bleed", "landing", "top-of-page"],
  supportedDevices: ["mobile", "tablet", "desktop"],
  accessibilityStatus: "wcag-aa",
  performanceCost: "low",
  compatibleContainers: [],
  defaultProps: () => ({
    minHeightDesktop: 600,
    minHeightMobile: 400,
    contentAlign: "center",
    contentVAlign: "center",
    maxContentWidth: 960,
    background: "surface",
    paddingBlock: "xl"
  }),
  defaultContent: () => ({ childrenSlots: [] }),
  renderer: HeroRenderer
});
