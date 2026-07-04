"use client";

// Secondary Outline — supporting choice with a ring.

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

function SecondaryOutline({
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
  const paddingX = sizeToPaddingXPx(size);
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
        justifyContent: "center",
        height,
        paddingLeft: paddingX,
        paddingRight: paddingX,
        fontSize: font,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        background: resolved.background,
        color: resolved.ink,
        border: `${resolved.borderWidth || 1.5}px solid ${resolved.border}`,
        boxShadow: resolved.shadow,
        transform: resolved.transform,
        opacity: resolved.opacity,
        transition: "background 150ms ease-out, transform 150ms ease-out",
        cursor: "pointer",
        ...shapeCss
      }}
    >
      {config.label}
    </Link>
  );
}

const REGISTRATION: ButtonRegistration<Config> = {
  id: "secondary.outline_1",
  name: "Secondary Outline",
  version: "1.0.0",
  category: "basic",
  role: "secondary_action",
  description: "Ringed secondary. Reads at a glance, never fights the primary.",
  shortPitch: "Quiet, respectful, second choice.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 32 }, default: "Learn more", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "href", label: "Link", type: { kind: "link" }, default: "#", role: "primary_action_href", group: "Content" }
  ],
  states: {
    default: {
      backgroundLiteral: "transparent",
      inkToken: "color.primary",
      borderToken: "color.primary",
      borderWidthPx: 1.5
    },
    hover: { backgroundLiteral: "rgba(0,0,0,0.04)", translateYPx: -1 },
    focus_visible: { shadowPreset: "glow" },
    pressed: { scale: 0.99 },
    disabled: { opacity: 0.4 }
  },
  motion: { hover: "lift", focus: "glow", press: "shrink" },
  shape: { kind: "rect", radiusPx: 12 },
  size: "md",
  themeTokensUsed: ["color.primary"],
  a11y: {
    ariaLabelFor: (c) => (c.label as string) || "Learn more",
    role: "button",
    activateOnSpace: true
  },
  telemetry: { eventOnClick: "cta.secondary", payloadKeys: ["href"] },
  conversionHints: {
    primaryActionRecommended: false,
    aboveFoldRecommended: false,
    minContrast: 4.5,
    minTapTargetPx: 44
  },
  aiPrompts: {
    explain: "Explain when to pair this next to a primary CTA.",
    improveCopy: "Rewrite label to complement the primary without competing.",
    improveStyle: "Suggest thinner border or lighter weight if the pair feels loud.",
    restyle: "Match to {mood}.",
    generateFromBrief: "Create a secondary CTA for {vertical}.",
    scoreConversion: "Check for over-competing with the primary.",
    scoreAccessibility: "Check outline focus + hover legibility.",
    suggestIcon: "Suggest a subtle chevron or none."
  },
  searchKeywords: ["secondary", "outline", "ring", "ghost-adjacent"],
  defaultConfig: () => ({ label: "Learn more", href: "#" }),
  renderer: SecondaryOutline
};

buttonRegistry.register(REGISTRATION);
