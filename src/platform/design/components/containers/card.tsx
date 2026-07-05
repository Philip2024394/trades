// Design component: containers.card
//
// Card container — bordered rounded surface with padding + optional
// elevation. Distinct from the shadcn Card COMPONENT: this is a
// LAYOUT wrapper (children go inside), not a content component.

"use client";

import type { ReactNode } from "react";
import { useDesignTheme } from "../../theme/context";
import { designSystemRegistry } from "../../registry";

type CardProps = {
  padding: "sm" | "md" | "lg" | "xl";
  radius: "xs" | "sm" | "md" | "lg" | "xl";
  elevation: "none" | "sm" | "md" | "lg" | "xl";
  bordered: boolean;
  background: "surface" | "surfaceElevated" | "subtle";
  gap: "xs" | "sm" | "md" | "lg";
};

type CardContent = { childrenSlots?: string[] };

function CardRenderer({
  props,
  children
}: {
  props: CardProps;
  content: CardContent;
  children?: ReactNode;
}) {
  const theme = useDesignTheme();
  return (
    <div
      style={{
        background: theme.color[props.background],
        borderRadius: theme.radius[props.radius],
        padding: theme.spacing[props.padding],
        border: props.bordered ? `1px solid ${theme.color.border}` : "none",
        boxShadow: theme.shadow[props.elevation],
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing[props.gap],
        width: "100%"
      }}
    >
      {children}
    </div>
  );
}

designSystemRegistry.register<CardProps, CardContent>({
  id: "containers.card",
  name: "Card",
  category: "containers",
  tier: "content",
  description:
    "Rounded bordered surface. The layout wrapper used to group related content (feature card, pricing card, testimonial card).",
  version: "1.0.0",
  contentShape: "container",
  editableProps: [
    {
      key: "padding",
      label: "Padding",
      type: {
        kind: "select",
        options: [
          { value: "sm", label: "Small" },
          { value: "md", label: "Medium" },
          { value: "lg", label: "Large" },
          { value: "xl", label: "Extra large" }
        ]
      },
      default: "md"
    },
    {
      key: "radius",
      label: "Corner radius",
      type: {
        kind: "select",
        options: [
          { value: "xs", label: "XS" },
          { value: "sm", label: "SM" },
          { value: "md", label: "MD" },
          { value: "lg", label: "LG" },
          { value: "xl", label: "XL" }
        ]
      },
      default: "md"
    },
    {
      key: "elevation",
      label: "Elevation",
      type: {
        kind: "select",
        options: [
          { value: "none", label: "None" },
          { value: "sm", label: "Small" },
          { value: "md", label: "Medium" },
          { value: "lg", label: "Large" },
          { value: "xl", label: "Extra large" }
        ]
      },
      default: "sm"
    },
    {
      key: "bordered",
      label: "Border",
      type: { kind: "boolean" },
      default: true
    },
    {
      key: "background",
      label: "Background",
      type: {
        kind: "select",
        options: [
          { value: "surface", label: "Surface" },
          { value: "surfaceElevated", label: "Elevated" },
          { value: "subtle", label: "Subtle" }
        ]
      },
      default: "surface"
    },
    {
      key: "gap",
      label: "Inner gap",
      type: {
        kind: "select",
        options: [
          { value: "xs", label: "XS" },
          { value: "sm", label: "SM" },
          { value: "md", label: "MD" },
          { value: "lg", label: "LG" }
        ]
      },
      default: "sm"
    }
  ],
  themeTokensUsed: [
    "spacing.sm",
    "spacing.md",
    "spacing.lg",
    "radius.md",
    "shadow.sm",
    "color.surface",
    "color.border"
  ],
  animations: ["none", "fade-in", "hover-lift"],
  responsive: {
    mobile: "unchanged",
    tablet: "unchanged",
    desktop: "unchanged"
  },
  searchKeywords: ["card", "container", "surface", "panel", "tile"],
  supportedDevices: ["mobile", "tablet", "desktop"],
  accessibilityStatus: "wcag-aa",
  performanceCost: "low",
  compatibleContainers: ["*"],
  defaultProps: () => ({
    padding: "md",
    radius: "md",
    elevation: "sm",
    bordered: true,
    background: "surface",
    gap: "sm"
  }),
  defaultContent: () => ({ childrenSlots: [] }),
  renderer: CardRenderer
});
