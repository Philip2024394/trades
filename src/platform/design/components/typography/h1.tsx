"use client";

// Design component: typography.h1
//
// Reference typography implementation. Every other typography
// component (h2/h3/h4/paragraph/caption/quote/badge/price/label) mirrors
// this pattern — no fixed colours, no fixed fonts, theme via context.

import { useDesignTheme } from "../../theme/context";
import { designSystemRegistry } from "../../registry";

type H1Props = {
  weight: "normal" | "bold" | "extrabold";
  size: number;
  align: "left" | "center" | "right";
  spacing: "tight" | "normal" | "loose";
};

type H1Content = {
  text: string;
};

function H1Renderer({
  props,
  content
}: {
  props: H1Props;
  content: H1Content;
}) {
  const theme = useDesignTheme();
  const weightMap = { normal: 400, bold: 700, extrabold: 800 } as const;
  const trackingMap = { tight: "-0.02em", normal: "0", loose: "0.02em" } as const;
  return (
    <h1
      style={{
        fontFamily: theme.font.heading,
        fontSize: `${props.size * theme.font.scale}px`,
        fontWeight: weightMap[props.weight],
        letterSpacing: trackingMap[props.spacing],
        textAlign: props.align,
        color: theme.color.ink,
        margin: 0,
        lineHeight: 1.1
      }}
    >
      {content.text}
    </h1>
  );
}

designSystemRegistry.register<H1Props, H1Content>({
  id: "typography.h1",
  name: "Heading 1",
  category: "typography",
  description:
    "Primary page heading. Renders as an <h1> element for SEO + accessibility. Inherits font family and ink colour from the active theme.",
  version: "1.0.0",
  contentShape: "typography",
  editableProps: [
    {
      key: "weight",
      label: "Weight",
      type: {
        kind: "select",
        options: [
          { value: "normal", label: "Normal (400)" },
          { value: "bold", label: "Bold (700)" },
          { value: "extrabold", label: "Extra bold (800)" }
        ]
      },
      default: "extrabold",
      group: "Type",
      aiConfigurable: true
    },
    {
      key: "size",
      label: "Size",
      type: { kind: "number", min: 16, max: 96, step: 2, unit: "px" },
      default: 40,
      group: "Type",
      aiConfigurable: true
    },
    {
      key: "align",
      label: "Align",
      type: {
        kind: "select",
        options: [
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" }
        ]
      },
      default: "left",
      group: "Layout",
      aiConfigurable: true
    },
    {
      key: "spacing",
      label: "Letter spacing",
      type: {
        kind: "select",
        options: [
          { value: "tight", label: "Tight" },
          { value: "normal", label: "Normal" },
          { value: "loose", label: "Loose" }
        ]
      },
      default: "normal",
      group: "Type"
    }
  ],
  themeTokensUsed: ["color.ink", "font.heading", "font.scale"],
  animations: ["none", "fade-in", "slide-up"],
  responsive: {
    mobile: "compact",
    tablet: "unchanged",
    desktop: "unchanged"
  },
  searchKeywords: [
    "heading",
    "title",
    "h1",
    "page title",
    "hero heading",
    "big text"
  ],
  defaultProps: () => ({
    weight: "extrabold",
    size: 40,
    align: "left",
    spacing: "normal"
  }),
  defaultContent: () => ({ text: "Welcome to your business" }),
  renderer: H1Renderer
});
