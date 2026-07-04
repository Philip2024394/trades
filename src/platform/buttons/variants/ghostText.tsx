"use client";

// Ghost / text button — no chrome, just underline on hover.

import Link from "next/link";
import { buttonRegistry } from "../buttonRegistry";
import {
  resolveState,
  sizeToFontPx,
  sizeToHeightPx,
  sizeToPaddingXPx
} from "../themeAdapter";
import type { ButtonRegistration, ButtonRendererProps } from "../types";

type Config = { label: string; href: string };

function GhostText({
  config,
  state,
  tokens,
  size,
  mode,
  onEvent
}: ButtonRendererProps<Config>) {
  const resolved = resolveState(REGISTRATION, state, tokens);
  const height = sizeToHeightPx(size);
  const paddingX = sizeToPaddingXPx(size) / 2;
  const font = sizeToFontPx(size);
  return (
    <Link
      href={config.href || "#"}
      onClick={() => onEvent?.({ event: "click" })}
      tabIndex={mode === "edit" ? -1 : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height,
        paddingLeft: paddingX,
        paddingRight: paddingX,
        fontSize: font,
        fontWeight: 700,
        letterSpacing: "0.06em",
        background: "transparent",
        color: resolved.ink,
        textDecoration: state === "hover" ? "underline" : "none",
        textUnderlineOffset: 4,
        opacity: resolved.opacity,
        cursor: "pointer",
        border: "none"
      }}
    >
      {config.label}
    </Link>
  );
}

const REGISTRATION: ButtonRegistration<Config> = {
  id: "ghost.text_1",
  name: "Ghost Text",
  version: "1.0.0",
  category: "basic",
  role: "cta_learn_more",
  description: "Type-only, subtle, gets out of the way.",
  shortPitch: "Type-first, chrome-free.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 32 }, default: "Read the guide", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "href", label: "Link", type: { kind: "link" }, default: "#", role: "primary_action_href", group: "Content" }
  ],
  states: {
    default: { inkToken: "color.primary" },
    hover: { inkToken: "color.accent" },
    disabled: { opacity: 0.4 }
  },
  motion: { hover: "underline_grow" },
  shape: { kind: "rect", radiusPx: 0 },
  size: "sm",
  themeTokensUsed: ["color.primary", "color.accent"],
  a11y: {
    ariaLabelFor: (c) => (c.label as string) || "Read more",
    role: "link",
    activateOnSpace: false
  },
  telemetry: { eventOnClick: "cta.ghost", payloadKeys: ["href"] },
  conversionHints: {
    primaryActionRecommended: false,
    aboveFoldRecommended: false,
    minContrast: 4.5,
    minTapTargetPx: 32
  },
  aiPrompts: {
    explain: "Explain the ghost pattern for tertiary reads.",
    improveCopy: "Turn label into 2 words.",
    improveStyle: "Suggest a hover accent that matches the brand.",
    restyle: "Match {mood}.",
    generateFromBrief: "Generate a ghost link for {vertical}.",
    scoreConversion: "Rate for scanning-context clarity.",
    scoreAccessibility: "Check focus-visible outline and hover contrast.",
    suggestIcon: "Suggest arrow or nothing."
  },
  searchKeywords: ["ghost", "text", "link", "tertiary"],
  defaultConfig: () => ({ label: "Read the guide", href: "#" }),
  renderer: GhostText
};

buttonRegistry.register(REGISTRATION);
