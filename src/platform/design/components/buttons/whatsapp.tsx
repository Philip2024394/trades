"use client";

// Design component: buttons.whatsapp
//
// Trade-specific button — WhatsApp is the dominant lead channel for UK
// trades. Locks the surface to WhatsApp green so customers instantly
// recognise it, but respects the theme's radius + spacing + font so the
// button feels native to whatever palette the merchant runs.

import { useDesignTheme } from "../../theme/context";
import { designSystemRegistry } from "../../registry";

type WhatsAppButtonProps = {
  size: "sm" | "md" | "lg";
  fullWidth: boolean;
  showIcon: boolean;
  radius: "sm" | "md" | "lg" | "full";
};

type WhatsAppButtonContent = {
  label: string;
  href: string;
  phone?: string;
  message?: string;
};

// Platform standard: WhatsApp CTAs render in BRAND_GREEN_DARK #166534,
// NOT WhatsApp brand green #25D366. Philip 2026-07-17 rule
// (feedback_whatsapp_button_dark_green.md + feedback_dark_green_only.md).
const WHATSAPP_GREEN = "#166534";
const WHATSAPP_GREEN_HOVER = "#14532D";

function WhatsAppIcon({ size }: { size: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M20.52 3.449C12.831-3.984.106 1.407.101 11.893c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652c7.29 3.925 16.436-1.322 16.437-10.348-.001-3.166-1.233-6.144-3.253-8.55zm-8.62 17.204c-1.796 0-3.554-.482-5.09-1.395l-.365-.217-3.79.988 1.01-3.677-.237-.379a10.001 10.001 0 01-1.53-5.339c.003-7.72 7.955-11.582 13.395-6.14 5.44 5.441 1.594 13.44-6.14 13.44z" />
    </svg>
  );
}

function WhatsAppButtonRenderer({
  props,
  content
}: {
  props: WhatsAppButtonProps;
  content: WhatsAppButtonContent;
}) {
  const theme = useDesignTheme();
  const heightMap = { sm: 36, md: 44, lg: 52 } as const;
  const paddingMap = { sm: 12, md: 16, lg: 20 } as const;
  const fontSizeMap = { sm: 12, md: 13, lg: 15 } as const;
  const iconMap = { sm: 16, md: 18, lg: 20 } as const;

  const styles: React.CSSProperties = {
    display: props.fullWidth ? "flex" : "inline-flex",
    width: props.fullWidth ? "100%" : "auto",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    height: heightMap[props.size],
    paddingInline: paddingMap[props.size],
    background: WHATSAPP_GREEN,
    color: "#FFFFFF",
    borderRadius: theme.radius[props.radius],
    fontFamily: theme.font.family,
    fontSize: `${fontSizeMap[props.size] * theme.font.scale}px`,
    fontWeight: 800,
    textDecoration: "none",
    transition: `background ${theme.motion.fast}`
  };

  return (
    <a
      href={content.href}
      style={styles}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = WHATSAPP_GREEN_HOVER;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = WHATSAPP_GREEN;
      }}
    >
      {props.showIcon && <WhatsAppIcon size={iconMap[props.size]} />}
      <span>{content.label}</span>
    </a>
  );
}

designSystemRegistry.register<WhatsAppButtonProps, WhatsAppButtonContent>({
  id: "buttons.whatsapp",
  name: "WhatsApp Button",
  category: "buttons",
  description:
    "Instant recognition WhatsApp CTA — locked to WhatsApp green so customers know exactly what will happen. Radius, size and spacing inherit from theme.",
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
      key: "showIcon",
      label: "Show WhatsApp icon",
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
      default: "full"
    }
  ],
  themeTokensUsed: [
    "font.family",
    "radius.sm",
    "radius.md",
    "radius.lg",
    "radius.full",
    "spacing.sm",
    "motion.fast"
  ],
  animations: ["none", "hover-darken", "press-scale"],
  responsive: { mobile: "unchanged" },
  searchKeywords: [
    "whatsapp",
    "wa",
    "chat",
    "message",
    "contact",
    "enquire"
  ],
  compatibleLayouts: [
    "containers.single-column",
    "containers.two-column",
    "cards.service",
    "cards.product"
  ],
  defaultProps: () => ({
    size: "md",
    fullWidth: false,
    showIcon: true,
    radius: "full"
  }),
  defaultContent: () => ({
    label: "WhatsApp us",
    href: "https://wa.me/",
    message: "Hi! I'd like a quote."
  }),
  renderer: WhatsAppButtonRenderer
});
