"use client";

// Book CTA — arrow-shape, opinionated verb-first copy.

import Link from "next/link";
import { buttonRegistry } from "../buttonRegistry";
import {
  resolveState,
  shapeToStyle,
  sizeToFontPx,
  sizeToHeightPx,
  sizeToPaddingXPx
} from "../themeAdapter";
import type { ButtonRegistration, ButtonRendererProps } from "../types";

type Config = { label: string; href: string };

function BookArrow({
  config,
  state,
  tokens,
  size,
  shape,
  mode,
  onEvent
}: ButtonRendererProps<Config>) {
  const resolved = resolveState(REGISTRATION, state, tokens);
  const height = sizeToHeightPx(size);
  const paddingX = sizeToPaddingXPx(size) + 8; // extra for arrow tail
  const font = sizeToFontPx(size);
  const shapeCss = shapeToStyle(shape);
  return (
    <Link
      href={config.href || "#"}
      onClick={() => onEvent?.({ event: "click" })}
      tabIndex={mode === "edit" ? -1 : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height,
        paddingLeft: paddingX,
        paddingRight: paddingX,
        fontSize: font,
        fontWeight: 800,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        background: resolved.background,
        color: resolved.ink,
        boxShadow: resolved.shadow,
        transform: resolved.transform,
        opacity: resolved.opacity,
        transition: "transform 150ms ease-out, box-shadow 150ms ease-out",
        cursor: "pointer",
        border: "none",
        ...shapeCss
      }}
    >
      <span aria-hidden="true">📅</span>
      <span>{config.label}</span>
    </Link>
  );
}

const REGISTRATION: ButtonRegistration<Config> = {
  id: "cta_book.arrow_1",
  name: "Book — Arrow",
  version: "1.0.0",
  category: "marketing",
  role: "cta_book",
  description: "Arrow-shaped booking CTA with calendar glyph. Reads as forward-motion.",
  shortPitch: "One tap to the diary.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 32 }, default: "Book my slot", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "href", label: "Link", type: { kind: "link" }, default: "/book", role: "primary_action_href", group: "Content" }
  ],
  states: {
    default: {
      backgroundToken: "color.primary",
      inkLiteral: "#FFFFFF",
      shadowPreset: "soft"
    },
    hover: { translateXPx: 2, shadowPreset: "floating" },
    focus_visible: { shadowPreset: "glow" },
    pressed: { translateXPx: 0, scale: 0.98 },
    disabled: { opacity: 0.4 }
  },
  motion: { hover: "arrow_reveal", press: "shrink" },
  shape: { kind: "arrow", direction: "right" },
  size: "md",
  themeTokensUsed: ["color.primary"],
  a11y: {
    ariaLabelFor: (c) => (c.label as string) || "Book my slot",
    role: "link",
    activateOnSpace: false
  },
  telemetry: { eventOnClick: "cta.book", payloadKeys: ["href"] },
  conversionHints: {
    primaryActionRecommended: true,
    aboveFoldRecommended: true,
    minContrast: 4.5,
    minTapTargetPx: 44
  },
  aiPrompts: {
    explain: "Explain why booking CTAs beat 'contact us' for time-boxed services.",
    improveCopy: "Rewrite label as verb-first, personal ('my') if possible.",
    improveStyle: "Suggest a subtle right-shift on hover.",
    restyle: "Apply {mood}.",
    generateFromBrief: "Create a booking CTA for {vertical}.",
    scoreConversion: "Assess urgency + clarity + verb strength.",
    scoreAccessibility: "Check arrow-shape doesn't hide the label from screen readers.",
    suggestIcon: "Calendar or clock — book-adjacent."
  },
  searchKeywords: ["book", "booking", "arrow", "cta", "appointment"],
  defaultConfig: () => ({ label: "Book my slot", href: "/book" }),
  renderer: BookArrow
};

buttonRegistry.register(REGISTRATION);
