// Design component: containers.floating
//
// Absolute-positioned wrapper for FAB (Floating Action Button),
// floating callouts, corner CTAs. Utility tier — does not own content
// layout, only positions its children.

"use client";

import type { ReactNode } from "react";
import { useDesignTheme } from "../../theme/context";
import { designSystemRegistry } from "../../registry";

type FloatingProps = {
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  offsetX: 8 | 16 | 24 | 32;
  offsetY: 8 | 16 | 24 | 32;
  zIndex: 20 | 40 | 60 | 100;
  respectSafeArea: boolean;
};

type FloatingContent = { childrenSlots?: string[] };

function FloatingRenderer({
  props,
  children
}: {
  props: FloatingProps;
  content: FloatingContent;
  children?: ReactNode;
}) {
  const theme = useDesignTheme();
  const position: React.CSSProperties = { position: "fixed", zIndex: props.zIndex };
  if (props.corner.startsWith("top")) position.top = `${props.offsetY}px`;
  else position.bottom = `${props.offsetY}px`;
  if (props.corner.endsWith("left")) position.left = `${props.offsetX}px`;
  else position.right = `${props.offsetX}px`;
  const safeArea = props.respectSafeArea
    ? {
        paddingTop: "env(safe-area-inset-top, 0)",
        paddingBottom: "env(safe-area-inset-bottom, 0)",
        paddingLeft: "env(safe-area-inset-left, 0)",
        paddingRight: "env(safe-area-inset-right, 0)"
      }
    : {};
  return (
    <div
      style={{
        ...position,
        ...safeArea,
        // Small default shadow to visually elevate; real elevation
        // decisions belong to the child.
        boxShadow: theme.shadow.none
      }}
    >
      {children}
    </div>
  );
}

designSystemRegistry.register<FloatingProps, FloatingContent>({
  id: "containers.floating",
  name: "Floating",
  category: "containers",
  tier: "utility",
  description:
    "Absolute-positioned wrapper. Corner + offset props; z-index and safe-area supported. Use for FAB, floating callouts, sticky mobile CTAs.",
  version: "1.0.0",
  contentShape: "container",
  editableProps: [
    {
      key: "corner",
      label: "Corner",
      type: {
        kind: "select",
        options: [
          { value: "top-left", label: "Top-left" },
          { value: "top-right", label: "Top-right" },
          { value: "bottom-left", label: "Bottom-left" },
          { value: "bottom-right", label: "Bottom-right" }
        ]
      },
      default: "bottom-right"
    },
    {
      key: "offsetX",
      label: "Horizontal offset (px)",
      type: {
        kind: "select",
        options: [
          { value: "8", label: "8" },
          { value: "16", label: "16" },
          { value: "24", label: "24" },
          { value: "32", label: "32" }
        ]
      },
      default: "24"
    },
    {
      key: "offsetY",
      label: "Vertical offset (px)",
      type: {
        kind: "select",
        options: [
          { value: "8", label: "8" },
          { value: "16", label: "16" },
          { value: "24", label: "24" },
          { value: "32", label: "32" }
        ]
      },
      default: "24"
    },
    {
      key: "zIndex",
      label: "Layer (z-index)",
      type: {
        kind: "select",
        options: [
          { value: "20", label: "Above content" },
          { value: "40", label: "Above sticky" },
          { value: "60", label: "Above modal chrome" },
          { value: "100", label: "Top layer" }
        ]
      },
      default: "40"
    },
    {
      key: "respectSafeArea",
      label: "Respect iOS / notch safe-area",
      type: { kind: "boolean" },
      default: true
    }
  ],
  themeTokensUsed: ["shadow.none"],
  animations: ["none", "fade-in", "slide-up"],
  responsive: {
    mobile: "unchanged",
    tablet: "unchanged",
    desktop: "unchanged"
  },
  searchKeywords: ["floating", "fab", "corner", "cta", "callout"],
  supportedDevices: ["mobile", "tablet", "desktop"],
  accessibilityStatus: "wcag-aa",
  performanceCost: "low",
  compatibleContainers: ["*"],
  compatibleThemes: ["*"],
  defaultProps: () => ({
    corner: "bottom-right",
    offsetX: 24,
    offsetY: 24,
    zIndex: 40,
    respectSafeArea: true
  }),
  defaultContent: () => ({ childrenSlots: [] }),
  renderer: FloatingRenderer
});
