"use client";

// WhatsApp pill — dark green #166534 (platform standard), white text,
// WhatsApp glyph. NOT WhatsApp brand green — per Philip 2026-07-17
// "WhatsApp button dark green always" + feedback_dark_green_only.md.

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

const WA_GREEN = "#166534";

type Config = { label: string; phoneOrHref: string };

function WhatsAppPill({
  config,
  state,
  tokens,
  size,
  shape,
  data,
  mode,
  onEvent
}: ButtonRendererProps<Config>) {
  const resolved = resolveState(REGISTRATION, state, tokens);
  const height = sizeToHeightPx(size);
  const paddingX = sizeToPaddingXPx(size);
  const font = sizeToFontPx(size);
  const shapeCss = shapeToStyle(shape);
  const href =
    config.phoneOrHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.phoneOrHref || "#";
  return (
    <Link
      href={href}
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
      <WhatsAppIcon />
      <span>{config.label}</span>
    </Link>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.5 3.5A11.7 11.7 0 0 0 12 0C5.4 0 0 5.4 0 12c0 2.1.6 4.1 1.6 5.9L0 24l6.3-1.6a12 12 0 0 0 5.7 1.5C18.6 24 24 18.6 24 12c0-3.2-1.2-6.2-3.5-8.5zM12 22a10 10 0 0 1-5.1-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A10 10 0 1 1 22 12a10 10 0 0 1-10 10zm5.5-7.5c-.3-.2-1.8-.9-2-.9s-.5-.2-.7.1l-1 1.3c-.2.2-.4.3-.7.1-.3-.2-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5.4-.5c.1-.2.1-.4 0-.5-.1-.2-.7-1.8-1-2.5-.3-.6-.5-.5-.7-.5H8c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.2 3.1c.2.2 2 3.1 5 4.3.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.5-.3z"/>
    </svg>
  );
}

const REGISTRATION: ButtonRegistration<Config> = {
  id: "whatsapp.pill_1",
  name: "WhatsApp Pill",
  version: "1.0.0",
  category: "marketing",
  role: "cta_whatsapp",
  description: "Canonical WhatsApp green pill with the WA glyph. Matches every live Thenetworkers template.",
  shortPitch: "Universally recognisable, one-tap message.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 32 }, default: "Message on WhatsApp", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "phoneOrHref", label: "Link (#whatsapp for merchant's default)", type: { kind: "link" }, default: "#whatsapp", role: "primary_action_href", description: "Use #whatsapp to auto-fill the merchant's WhatsApp number.", group: "Content" }
  ],
  states: {
    default: {
      backgroundLiteral: WA_GREEN,
      inkLiteral: "#FFFFFF",
      shadowPreset: "soft"
    },
    hover: { translateYPx: -1, shadowPreset: "floating" },
    focus_visible: { shadowPreset: "glow" },
    pressed: { scale: 0.98 },
    disabled: { opacity: 0.4 }
  },
  motion: { hover: "lift", press: "shrink" },
  shape: { kind: "pill" },
  size: "md",
  themeTokensUsed: [],
  a11y: {
    ariaLabelFor: (c) => (c.label as string) || "Message us on WhatsApp",
    role: "link",
    activateOnSpace: false
  },
  telemetry: { eventOnClick: "cta.whatsapp", payloadKeys: ["phoneOrHref"] },
  conversionHints: {
    primaryActionRecommended: true,
    aboveFoldRecommended: true,
    minContrast: 3, // WhatsApp green + white is 2.66:1 by brand; codebase pattern allows it
    minTapTargetPx: 44
  },
  aiPrompts: {
    explain: "Explain why WhatsApp CTAs convert for local trades in ID/UK/BR.",
    improveCopy: "Rewrite label into a warm, one-tap invitation.",
    improveStyle: "Only change padding or size — brand green is protected.",
    restyle: "Only palette variant that changes here is dark-mode.",
    generateFromBrief: "Create a WhatsApp CTA for {vertical}.",
    scoreConversion: "Check whether the label communicates 'no forms, one message.'",
    scoreAccessibility: "Confirm brand-brand contrast + focus outline visibility.",
    suggestIcon: "WhatsApp glyph — non-negotiable for recognition."
  },
  searchKeywords: ["whatsapp", "wa", "message", "chat", "quote", "phone"],
  defaultConfig: () => ({ label: "Message on WhatsApp", phoneOrHref: "#whatsapp" }),
  renderer: WhatsAppPill
};

buttonRegistry.register(REGISTRATION);
