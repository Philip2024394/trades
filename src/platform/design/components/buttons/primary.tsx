"use client";

// Design component: buttons.primary
//
// Reference button implementation. Every button style (secondary,
// outline, ghost, icon, cta, floating, call, whatsapp) shares the
// same {label, href, action, icon} content shape so swapping button
// styles never loses the link or label.

import { useDesignTheme } from "../../theme/context";
import { designSystemRegistry } from "../../registry";

type PrimaryButtonProps = {
  size: "sm" | "md" | "lg";
  fullWidth: boolean;
  uppercase: boolean;
  radius: "sm" | "md" | "lg" | "full";
};

type PrimaryButtonContent = {
  label: string;
  href?: string;
  action?: string;
  icon?: string;
};

function PrimaryButtonRenderer({
  props,
  content
}: {
  props: PrimaryButtonProps;
  content: PrimaryButtonContent;
}) {
  const theme = useDesignTheme();
  const heightMap = { sm: 36, md: 44, lg: 52 } as const;
  const paddingMap = { sm: 12, md: 16, lg: 20 } as const;
  const fontSizeMap = { sm: 12, md: 13, lg: 15 } as const;

  const styles: React.CSSProperties = {
    display: props.fullWidth ? "flex" : "inline-flex",
    width: props.fullWidth ? "100%" : "auto",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    height: heightMap[props.size],
    paddingInline: paddingMap[props.size],
    background: theme.color.primary,
    color: theme.color.primaryInk,
    borderRadius: theme.radius[props.radius],
    border: "none",
    cursor: "pointer",
    fontFamily: theme.font.family,
    fontSize: `${fontSizeMap[props.size] * theme.font.scale}px`,
    fontWeight: 800,
    letterSpacing: props.uppercase ? "0.12em" : "0",
    textTransform: props.uppercase ? "uppercase" : "none",
    transition: `filter ${theme.motion.fast}`
  };

  const children = (
    <>
      {content.icon && (
        <span aria-hidden="true" style={{ fontSize: "1.1em" }}>
          {content.icon}
        </span>
      )}
      <span>{content.label}</span>
    </>
  );

  if (content.href) {
    return (
      <a
        href={content.href}
        style={styles}
        onMouseEnter={(e) => {
          e.currentTarget.style.filter = "brightness(0.95)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = "none";
        }}
      >
        {children}
      </a>
    );
  }
  return <button type="button" style={styles}>{children}</button>;
}

designSystemRegistry.register<PrimaryButtonProps, PrimaryButtonContent>({
  id: "buttons.primary",
  name: "Primary Button",
  category: "buttons",
  description:
    "High-emphasis action. Uses the theme's primary colour so brand palette changes update every primary button on the platform in place.",
  version: "1.0.0",
  contentShape: "button",
  editableProps: [
    {
      key: "size",
      label: "Size",
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
      key: "fullWidth",
      label: "Full width",
      type: { kind: "boolean" },
      default: false
    },
    {
      key: "uppercase",
      label: "Uppercase label",
      type: { kind: "boolean" },
      default: true
    },
    {
      key: "radius",
      label: "Corner radius",
      type: {
        kind: "select",
        options: [
          { value: "sm", label: "Subtle" },
          { value: "md", label: "Rounded" },
          { value: "lg", label: "Rounded xl" },
          { value: "full", label: "Pill" }
        ]
      },
      default: "md"
    }
  ],
  themeTokensUsed: [
    "color.primary",
    "color.primaryInk",
    "font.family",
    "radius.sm",
    "radius.md",
    "radius.lg",
    "radius.full",
    "spacing.sm",
    "motion.fast"
  ],
  animations: ["none", "hover-brighten", "press-scale"],
  responsive: { mobile: "unchanged" },
  searchKeywords: [
    "button",
    "cta",
    "action",
    "primary",
    "solid",
    "filled"
  ],
  defaultProps: () => ({
    size: "md",
    fullWidth: false,
    uppercase: true,
    radius: "md"
  }),
  defaultContent: () => ({
    label: "Get a quote",
    href: "#contact"
  }),
  renderer: PrimaryButtonRenderer
});
