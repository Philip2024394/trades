"use client";

// Icon-only button — circular, tap-target-safe.

import Link from "next/link";
import { buttonRegistry } from "../buttonRegistry";
import { resolveState, shapeToStyle, sizeToHeightPx } from "../themeAdapter";
import type { ButtonRegistration, ButtonRendererProps } from "../types";

type Config = { ariaLabel: string; href: string; iconName: string };

function IconOnly({
  config,
  state,
  tokens,
  size,
  shape,
  mode,
  onEvent
}: ButtonRendererProps<Config>) {
  const resolved = resolveState(REGISTRATION, state, tokens);
  const height = Math.max(44, sizeToHeightPx(size)); // enforce 44px min
  const shapeCss = shapeToStyle(shape);
  return (
    <Link
      href={config.href || "#"}
      aria-label={config.ariaLabel}
      onClick={() => onEvent?.({ event: "click" })}
      tabIndex={mode === "edit" ? -1 : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: height,
        height,
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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </Link>
  );
}

const REGISTRATION: ButtonRegistration<Config> = {
  id: "icon.only_1",
  name: "Icon Only — Circle",
  version: "1.0.0",
  category: "basic",
  role: "util_share",
  description: "Circular icon-only button. Enforced 44px min. Always carries aria-label.",
  shortPitch: "Compact + accessible.",
  editableFields: [
    { key: "ariaLabel", label: "Accessible label", type: { kind: "text", maxLength: 40 }, default: "Add item", description: "Required — screen readers announce this in place of the icon.", group: "Content" },
    { key: "iconName", label: "Icon", type: { kind: "icon" }, default: "plus", group: "Content" },
    { key: "href", label: "Link", type: { kind: "link" }, default: "#", group: "Content" }
  ],
  states: {
    default: {
      backgroundToken: "color.primary",
      inkLiteral: "#FFFFFF",
      shadowPreset: "soft"
    },
    hover: { scale: 1.05, shadowPreset: "floating" },
    focus_visible: { shadowPreset: "glow" },
    pressed: { scale: 0.95 },
    disabled: { opacity: 0.4 }
  },
  motion: { hover: "grow", press: "shrink", focus: "glow" },
  shape: { kind: "circle" },
  size: "md",
  themeTokensUsed: ["color.primary"],
  a11y: {
    ariaLabelFor: (c) => (c.ariaLabel as string) || "Action",
    role: "button",
    activateOnSpace: true
  },
  telemetry: { eventOnClick: "util.icon", payloadKeys: ["href", "iconName"] },
  conversionHints: {
    primaryActionRecommended: false,
    aboveFoldRecommended: false,
    minContrast: 4.5,
    minTapTargetPx: 44
  },
  aiPrompts: {
    explain: "Explain when icon-only outperforms label-only.",
    improveCopy: "Rewrite aria-label as a verb + object ('add item', 'copy link').",
    improveStyle: "Suggest size vs. shape for the enclosing card.",
    restyle: "Match to {mood}.",
    generateFromBrief: "Create an icon-only utility button for {vertical}.",
    scoreConversion: "Check for icon-recognition ambiguity.",
    scoreAccessibility: "Require aria-label + focus outline + 44px.",
    suggestIcon: "Pick the most universally recognised glyph for the intent."
  },
  searchKeywords: ["icon", "circle", "add", "utility"],
  defaultConfig: () => ({ ariaLabel: "Add item", href: "#", iconName: "plus" }),
  renderer: IconOnly
};

buttonRegistry.register(REGISTRATION);
