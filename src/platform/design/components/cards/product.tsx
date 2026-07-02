"use client";

// Design component: cards.product
//
// Reference product card. Every other card component (team, review,
// service, gallery, pricing, machine) shares the same content shape
// { title, subtitle, image, body, actionLabel, actionHref } so
// swapping card designs never loses the image or CTA.

import { useDesignTheme } from "../../theme/context";
import { designSystemRegistry } from "../../registry";

type ProductCardProps = {
  imageAspect: "1:1" | "4:3" | "16:9";
  cornerRadius: "sm" | "md" | "lg";
  shadow: "none" | "sm" | "md" | "lg";
  showCta: boolean;
  padding: "sm" | "md" | "lg";
};

type ProductCardContent = {
  title?: string;
  subtitle?: string;
  image?: string;
  body?: string;
  actionLabel?: string;
  actionHref?: string;
  price?: string;
};

function ProductCardRenderer({
  props,
  content
}: {
  props: ProductCardProps;
  content: ProductCardContent;
}) {
  const theme = useDesignTheme();
  const aspect =
    props.imageAspect === "1:1"
      ? "1 / 1"
      : props.imageAspect === "4:3"
        ? "4 / 3"
        : "16 / 9";

  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        background: theme.color.surface,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius[props.cornerRadius],
        boxShadow: theme.shadow[props.shadow],
        overflow: "hidden",
        transition: `box-shadow ${theme.motion.fast}, transform ${theme.motion.fast}`
      }}
    >
      {content.image && (
        <div
          style={{
            width: "100%",
            aspectRatio: aspect,
            background: theme.color.subtle,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden"
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={content.image}
            alt={content.title ?? ""}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain"
            }}
          />
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: theme.spacing.sm,
          padding: theme.spacing[props.padding]
        }}
      >
        {content.subtitle && (
          <p
            style={{
              margin: 0,
              fontSize: `${10 * theme.font.scale}px`,
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: theme.color.muted,
              fontFamily: theme.font.body
            }}
          >
            {content.subtitle}
          </p>
        )}
        {content.title && (
          <h3
            style={{
              margin: 0,
              fontSize: `${16 * theme.font.scale}px`,
              fontWeight: 800,
              color: theme.color.ink,
              fontFamily: theme.font.heading,
              lineHeight: 1.25
            }}
          >
            {content.title}
          </h3>
        )}
        {content.body && (
          <p
            style={{
              margin: 0,
              fontSize: `${13 * theme.font.scale}px`,
              lineHeight: 1.55,
              color: theme.color.muted,
              fontFamily: theme.font.body
            }}
          >
            {content.body}
          </p>
        )}
        {content.price && (
          <p
            style={{
              margin: 0,
              fontSize: `${18 * theme.font.scale}px`,
              fontWeight: 800,
              color: theme.color.ink,
              fontFamily: theme.font.heading
            }}
          >
            {content.price}
          </p>
        )}
        {props.showCta && content.actionLabel && content.actionHref && (
          <a
            href={content.actionHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: theme.spacing.sm,
              paddingBlock: theme.spacing.sm,
              paddingInline: theme.spacing.md,
              background: theme.color.primary,
              color: theme.color.primaryInk,
              borderRadius: theme.radius.md,
              fontFamily: theme.font.family,
              fontSize: `${12 * theme.font.scale}px`,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              textDecoration: "none"
            }}
          >
            {content.actionLabel}
          </a>
        )}
      </div>
    </article>
  );
}

designSystemRegistry.register<ProductCardProps, ProductCardContent>({
  id: "cards.product",
  name: "Product Card",
  category: "cards",
  description:
    "Image + title + subtitle + body + price + CTA. Merchant content preserved when swapping to any other card design (team, service, gallery).",
  version: "1.0.0",
  contentShape: "card",
  editableProps: [
    {
      key: "imageAspect",
      label: "Image aspect",
      type: {
        kind: "select",
        options: [
          { value: "1:1", label: "Square" },
          { value: "4:3", label: "Classic" },
          { value: "16:9", label: "Wide" }
        ]
      },
      default: "4:3"
    },
    {
      key: "cornerRadius",
      label: "Corner radius",
      type: {
        kind: "select",
        options: [
          { value: "sm", label: "Subtle" },
          { value: "md", label: "Rounded" },
          { value: "lg", label: "Rounded xl" }
        ]
      },
      default: "md"
    },
    {
      key: "shadow",
      label: "Shadow",
      type: {
        kind: "select",
        options: [
          { value: "none", label: "None" },
          { value: "sm", label: "Subtle" },
          { value: "md", label: "Medium" },
          { value: "lg", label: "Large" }
        ]
      },
      default: "sm"
    },
    {
      key: "showCta",
      label: "Show CTA button",
      type: { kind: "boolean" },
      default: true
    },
    {
      key: "padding",
      label: "Body padding",
      type: {
        kind: "select",
        options: [
          { value: "sm", label: "Small" },
          { value: "md", label: "Medium" },
          { value: "lg", label: "Large" }
        ]
      },
      default: "md"
    }
  ],
  themeTokensUsed: [
    "color.surface",
    "color.subtle",
    "color.border",
    "color.ink",
    "color.muted",
    "color.primary",
    "color.primaryInk",
    "font.heading",
    "font.body",
    "font.family",
    "font.scale",
    "radius.sm",
    "radius.md",
    "radius.lg",
    "shadow.sm",
    "shadow.md",
    "shadow.lg",
    "spacing.sm",
    "spacing.md",
    "spacing.lg",
    "motion.fast"
  ],
  animations: ["none", "hover-lift", "hover-shadow"],
  responsive: {
    mobile: "stack",
    tablet: "unchanged",
    desktop: "unchanged"
  },
  searchKeywords: [
    "card",
    "product",
    "item",
    "listing",
    "tile",
    "shop"
  ],
  defaultProps: () => ({
    imageAspect: "4:3",
    cornerRadius: "md",
    shadow: "sm",
    showCta: true,
    padding: "md"
  }),
  defaultContent: () => ({
    title: "Your product name",
    subtitle: "Category",
    image: "",
    body: "Short product description — one or two sentences.",
    actionLabel: "View details",
    actionHref: "#",
    price: "£0.00"
  }),
  renderer: ProductCardRenderer
});
