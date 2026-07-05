// Design component: containers.sticky
//
// Sticky positioning wrapper — keeps children pinned when scrolling
// past. Used for CTA bars, floating booking widgets, sticky nav.

"use client";

import type { ReactNode } from "react";
import { useDesignTheme } from "../../theme/context";
import { designSystemRegistry } from "../../registry";

type StickyProps = {
  position: "top" | "bottom";
  offset: 0 | 8 | 16 | 24 | 48;
  zIndex: 10 | 30 | 50;
  background: "surface" | "surfaceElevated" | "transparent";
  addShadow: boolean;
};

type StickyContent = { childrenSlots?: string[] };

function StickyRenderer({
  props,
  children
}: {
  props: StickyProps;
  content: StickyContent;
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
        position: "sticky",
        [props.position]: `${props.offset}px`,
        zIndex: props.zIndex,
        background: bg,
        boxShadow: props.addShadow ? theme.shadow.md : undefined,
        width: "100%"
      }}
    >
      {children}
    </div>
  );
}

designSystemRegistry.register<StickyProps, StickyContent>({
  id: "containers.sticky",
  name: "Sticky",
  category: "containers",
  tier: "utility",
  description:
    "Sticky-positioned wrapper. Pins children to the top or bottom of the viewport as the page scrolls. Use for booking CTAs, floating nav, back-to-top bars.",
  version: "1.0.0",
  contentShape: "container",
  editableProps: [
    {
      key: "position",
      label: "Anchor",
      type: {
        kind: "select",
        options: [
          { value: "top", label: "Top" },
          { value: "bottom", label: "Bottom" }
        ]
      },
      default: "top"
    },
    {
      key: "offset",
      label: "Offset (px)",
      type: {
        kind: "select",
        options: [
          { value: "0", label: "0" },
          { value: "8", label: "8" },
          { value: "16", label: "16" },
          { value: "24", label: "24" },
          { value: "48", label: "48" }
        ]
      },
      default: "0"
    },
    {
      key: "zIndex",
      label: "Layer (z-index)",
      type: {
        kind: "select",
        options: [
          { value: "10", label: "Below modals" },
          { value: "30", label: "Above content" },
          { value: "50", label: "Top layer" }
        ]
      },
      default: "30"
    },
    {
      key: "background",
      label: "Background",
      type: {
        kind: "select",
        options: [
          { value: "surface", label: "Surface" },
          { value: "surfaceElevated", label: "Elevated" },
          { value: "transparent", label: "Transparent" }
        ]
      },
      default: "surface"
    },
    {
      key: "addShadow",
      label: "Show shadow",
      type: { kind: "boolean" },
      default: true
    }
  ],
  themeTokensUsed: [
    "color.surface",
    "color.surfaceElevated",
    "shadow.md"
  ],
  animations: ["none"],
  responsive: {
    mobile: "unchanged",
    tablet: "unchanged",
    desktop: "unchanged"
  },
  searchKeywords: ["sticky", "pinned", "floating", "top", "bottom", "cta", "nav"],
  supportedDevices: ["mobile", "tablet", "desktop"],
  accessibilityStatus: "wcag-aa",
  performanceCost: "low",
  compatibleContainers: ["*"],
  defaultProps: () => ({
    position: "top",
    offset: 0,
    zIndex: 30,
    background: "surface",
    addShadow: true
  }),
  defaultContent: () => ({ childrenSlots: [] }),
  renderer: StickyRenderer
});
