// Design component: containers.overlay
//
// Positioned overlay — children absolutely positioned over a background
// slot. Used for hero-with-content-over-image, badge-on-photo, floating
// callouts. First child = background, remaining = overlaid content.

"use client";

import type { ReactNode } from "react";
import { useDesignTheme } from "../../theme/context";
import { designSystemRegistry } from "../../registry";

type OverlayProps = {
  height: "auto" | "short" | "medium" | "tall" | "full";
  align: "top-left" | "top-center" | "top-right" | "center" | "bottom-left" | "bottom-center" | "bottom-right";
  overlayTint: "none" | "light" | "dark" | "gradient-dark" | "gradient-light";
  paddingInline: "sm" | "md" | "lg";
};

type OverlayContent = { childrenSlots?: string[] };

const HEIGHT_MAP: Record<OverlayProps["height"], string> = {
  auto: "auto",
  short: "40vh",
  medium: "60vh",
  tall: "80vh",
  full: "100vh"
};

const ALIGN_MAP: Record<OverlayProps["align"], string> = {
  "top-left": "flex-start flex-start",
  "top-center": "flex-start center",
  "top-right": "flex-start flex-end",
  center: "center center",
  "bottom-left": "flex-end flex-start",
  "bottom-center": "flex-end center",
  "bottom-right": "flex-end flex-end"
};

const TINT_MAP: Record<OverlayProps["overlayTint"], string> = {
  none: "transparent",
  light: "rgba(255,255,255,0.5)",
  dark: "rgba(10,10,10,0.55)",
  "gradient-dark":
    "linear-gradient(180deg, rgba(10,10,10,0.25) 0%, rgba(10,10,10,0.75) 100%)",
  "gradient-light":
    "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.85) 100%)"
};

function OverlayRenderer({
  props,
  children
}: {
  props: OverlayProps;
  content: OverlayContent;
  children?: ReactNode;
}) {
  const theme = useDesignTheme();
  const [justify, align] = ALIGN_MAP[props.align].split(" ");
  const childArray = children ? [children].flat() : [];
  const background = childArray[0];
  const overlaid = childArray.slice(1);
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: HEIGHT_MAP[props.height],
        overflow: "hidden"
      }}
    >
      {/* Background slot — first child fills the frame. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          display: "flex"
        }}
      >
        {background}
      </div>
      {/* Tint layer. */}
      {props.overlayTint !== "none" && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            pointerEvents: "none",
            background: TINT_MAP[props.overlayTint]
          }}
        />
      )}
      {/* Overlaid content. */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          justifyContent: justify,
          alignItems: align,
          minHeight: HEIGHT_MAP[props.height],
          paddingInline: theme.spacing[props.paddingInline],
          paddingBlock: theme.spacing.lg,
          gap: theme.spacing.md
        }}
      >
        {overlaid}
      </div>
    </div>
  );
}

designSystemRegistry.register<OverlayProps, OverlayContent>({
  id: "containers.overlay",
  name: "Overlay",
  category: "containers",
  tier: "utility",
  description:
    "Absolutely-positioned overlay container. First child is the background (photo, video, gradient); remaining children render on top with configurable alignment + optional tint.",
  version: "1.0.0",
  contentShape: "container",
  editableProps: [
    {
      key: "height",
      label: "Height",
      type: {
        kind: "select",
        options: [
          { value: "auto", label: "Auto" },
          { value: "short", label: "Short (40vh)" },
          { value: "medium", label: "Medium (60vh)" },
          { value: "tall", label: "Tall (80vh)" },
          { value: "full", label: "Full (100vh)" }
        ]
      },
      default: "medium"
    },
    {
      key: "align",
      label: "Content alignment",
      type: {
        kind: "select",
        options: [
          { value: "top-left", label: "Top-left" },
          { value: "top-center", label: "Top-center" },
          { value: "top-right", label: "Top-right" },
          { value: "center", label: "Center" },
          { value: "bottom-left", label: "Bottom-left" },
          { value: "bottom-center", label: "Bottom-center" },
          { value: "bottom-right", label: "Bottom-right" }
        ]
      },
      default: "center"
    },
    {
      key: "overlayTint",
      label: "Overlay tint",
      type: {
        kind: "select",
        options: [
          { value: "none", label: "None" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
          { value: "gradient-dark", label: "Gradient (dark)" },
          { value: "gradient-light", label: "Gradient (light)" }
        ]
      },
      default: "gradient-dark"
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
      default: "lg"
    }
  ],
  themeTokensUsed: ["spacing.sm", "spacing.md", "spacing.lg"],
  animations: ["none", "fade-in", "slide-up"],
  responsive: {
    mobile: "unchanged",
    tablet: "unchanged",
    desktop: "unchanged"
  },
  searchKeywords: ["overlay", "hero", "banner", "background", "positioned", "over"],
  supportedDevices: ["mobile", "tablet", "desktop"],
  accessibilityStatus: "wcag-aa",
  performanceCost: "medium",
  compatibleContainers: ["*"],
  defaultProps: () => ({
    height: "medium",
    align: "center",
    overlayTint: "gradient-dark",
    paddingInline: "lg"
  }),
  defaultContent: () => ({ childrenSlots: [] }),
  renderer: OverlayRenderer
});
