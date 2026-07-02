"use client";

// Design component: typography.paragraph

import { useDesignTheme } from "../../theme/context";
import { designSystemRegistry } from "../../registry";

type ParagraphProps = {
  size: number;
  weight: "normal" | "medium" | "bold";
  align: "left" | "center" | "right";
  color: "ink" | "muted";
  maxWidth: number;
};

type ParagraphContent = {
  text: string;
};

function ParagraphRenderer({
  props,
  content
}: {
  props: ParagraphProps;
  content: ParagraphContent;
}) {
  const theme = useDesignTheme();
  const weightMap = { normal: 400, medium: 500, bold: 700 } as const;
  return (
    <p
      style={{
        fontFamily: theme.font.body,
        fontSize: `${props.size * theme.font.scale}px`,
        fontWeight: weightMap[props.weight],
        textAlign: props.align,
        color: props.color === "muted" ? theme.color.muted : theme.color.ink,
        maxWidth: props.maxWidth ? `${props.maxWidth}px` : undefined,
        lineHeight: 1.6,
        margin: 0
      }}
    >
      {content.text}
    </p>
  );
}

designSystemRegistry.register<ParagraphProps, ParagraphContent>({
  id: "typography.paragraph",
  name: "Paragraph",
  category: "typography",
  description:
    "Body copy. Long-form text with comfortable line-height and a max-width for readability. Colour toggles between ink and muted.",
  version: "1.0.0",
  contentShape: "typography",
  editableProps: [
    {
      key: "size",
      label: "Size",
      type: { kind: "number", min: 12, max: 24, step: 1, unit: "px" },
      default: 15
    },
    {
      key: "weight",
      label: "Weight",
      type: {
        kind: "select",
        options: [
          { value: "normal", label: "Normal" },
          { value: "medium", label: "Medium" },
          { value: "bold", label: "Bold" }
        ]
      },
      default: "normal"
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
      default: "left"
    },
    {
      key: "color",
      label: "Colour",
      type: {
        kind: "select",
        options: [
          { value: "ink", label: "Ink (primary text)" },
          { value: "muted", label: "Muted (secondary text)" }
        ]
      },
      default: "ink"
    },
    {
      key: "maxWidth",
      label: "Max width",
      type: { kind: "number", min: 0, max: 1200, step: 20, unit: "px" },
      default: 640,
      description: "Set 0 for full width."
    }
  ],
  themeTokensUsed: [
    "color.ink",
    "color.muted",
    "font.body",
    "font.scale"
  ],
  animations: ["none", "fade-in"],
  responsive: {
    mobile: "compact",
    tablet: "unchanged",
    desktop: "unchanged"
  },
  searchKeywords: [
    "paragraph",
    "body",
    "text",
    "copy",
    "description",
    "long text"
  ],
  defaultProps: () => ({
    size: 15,
    weight: "normal",
    align: "left",
    color: "ink",
    maxWidth: 640
  }),
  defaultContent: () => ({
    text: "Add your body copy here. Keep it short and clear — trades customers scan, they don't read."
  }),
  renderer: ParagraphRenderer
});
