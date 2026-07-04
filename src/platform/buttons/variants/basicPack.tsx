"use client";

// Basic pack — Filled, Rounded, Square, Text (link), Pill, Minimal.
// Register the remaining primitives so the Basic category ships full.
// Every variant shares label/href role annotations (primary_action_*)
// so smartSwap preserves content across them.

import Link from "next/link";
import { buttonRegistry } from "../buttonRegistry";
import {
  resolveState,
  shapeToStyle,
  sizeToFontPx,
  sizeToHeightPx,
  sizeToPaddingXPx
} from "../themeAdapter";
import { MotionScope } from "../motion/MotionScope";
import type {
  ButtonRegistration,
  ButtonRendererProps
} from "../types";

type Basic = { label: string; href: string };

// ─── Filled Rounded ─────────────────────────────────
function FilledRounded(props: ButtonRendererProps<Basic>) {
  return <SharedBasic reg={FILLED_ROUNDED} {...props} />;
}
const FILLED_ROUNDED: ButtonRegistration<Basic> = {
  id: "basic.filled_rounded_1",
  name: "Filled Rounded",
  version: "1.0.0",
  category: "basic",
  role: "primary_action",
  description: "Solid fill, generous corner radius — friendly, product-shipped feel.",
  shortPitch: "Friendly, product-app tone.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 32 }, default: "Continue", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "href", label: "Link", type: { kind: "link" }, default: "#", role: "primary_action_href", group: "Content" }
  ],
  states: {
    default: { backgroundToken: "color.primary", inkLiteral: "#FFFFFF", shadowPreset: "soft" },
    hover: { translateYPx: -1, shadowPreset: "floating" },
    focus_visible: { shadowPreset: "glow" },
    pressed: { scale: 0.98 },
    disabled: { opacity: 0.4 }
  },
  motion: { hover: "lift", press: "shrink", focus: "glow" },
  shape: { kind: "rect", radiusPx: 18 },
  size: "md",
  themeTokensUsed: ["color.primary"],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Continue", role: "button", activateOnSpace: true },
  telemetry: { eventOnClick: "basic.filled", payloadKeys: ["href"] },
  conversionHints: { primaryActionRecommended: true, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 44 },
  aiPrompts: sharedAiPrompts("filled rounded"),
  searchKeywords: ["filled", "rounded", "primary", "app-style"],
  defaultConfig: () => ({ label: "Continue", href: "#" }),
  renderer: FilledRounded
};
buttonRegistry.register(FILLED_ROUNDED);

// ─── Sharp Square ───────────────────────────────────
function SquareRegular(props: ButtonRendererProps<Basic>) {
  return <SharedBasic reg={SQUARE} {...props} />;
}
const SQUARE: ButtonRegistration<Basic> = {
  id: "basic.square_1",
  name: "Square (Sharp)",
  version: "1.0.0",
  category: "basic",
  role: "primary_action",
  description: "Zero radius — bold, construction / industrial aesthetic.",
  shortPitch: "Sharp, trade-tone, unambiguous.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 32 }, default: "Get a quote", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "href", label: "Link", type: { kind: "link" }, default: "#", role: "primary_action_href", group: "Content" }
  ],
  states: {
    default: { backgroundToken: "color.accent", inkLiteral: "#0A0A0A", shadowPreset: "hard" },
    hover: { translateYPx: -1, shadowPreset: "hard" },
    focus_visible: { shadowPreset: "glow" },
    pressed: { translateYPx: 1 },
    disabled: { opacity: 0.4 }
  },
  motion: { hover: "lift", press: "shrink" },
  shape: { kind: "rect", radiusPx: 0 },
  size: "md",
  themeTokensUsed: ["color.accent"],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Get a quote", role: "button", activateOnSpace: true },
  telemetry: { eventOnClick: "basic.square", payloadKeys: ["href"] },
  conversionHints: { primaryActionRecommended: true, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 44 },
  aiPrompts: sharedAiPrompts("sharp square"),
  searchKeywords: ["square", "sharp", "brutal", "construction", "trade"],
  defaultConfig: () => ({ label: "Get a quote", href: "#" }),
  renderer: SquareRegular
};
buttonRegistry.register(SQUARE);

// ─── Pill ───────────────────────────────────────────
function PillRegular(props: ButtonRendererProps<Basic>) {
  return <SharedBasic reg={PILL} {...props} />;
}
const PILL: ButtonRegistration<Basic> = {
  id: "basic.pill_1",
  name: "Pill",
  version: "1.0.0",
  category: "basic",
  role: "primary_action",
  description: "Radius:full — friendly, modern, works for anything.",
  shortPitch: "Universal, warm, modern.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 32 }, default: "Sign up", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "href", label: "Link", type: { kind: "link" }, default: "#", role: "primary_action_href", group: "Content" }
  ],
  states: {
    default: { backgroundToken: "color.primary", inkLiteral: "#FFFFFF", shadowPreset: "soft" },
    hover: { translateYPx: -1, shadowPreset: "floating" },
    focus_visible: { shadowPreset: "glow" },
    pressed: { scale: 0.98 },
    disabled: { opacity: 0.4 }
  },
  motion: { hover: "lift", press: "shrink" },
  shape: { kind: "pill" },
  size: "md",
  themeTokensUsed: ["color.primary"],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Sign up", role: "button", activateOnSpace: true },
  telemetry: { eventOnClick: "basic.pill", payloadKeys: ["href"] },
  conversionHints: { primaryActionRecommended: true, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 44 },
  aiPrompts: sharedAiPrompts("pill"),
  searchKeywords: ["pill", "rounded", "modern"],
  defaultConfig: () => ({ label: "Sign up", href: "#" }),
  renderer: PillRegular
};
buttonRegistry.register(PILL);

// ─── Text link ──────────────────────────────────────
function TextLink(props: ButtonRendererProps<Basic>) {
  const { config, state, tokens, size, mode, onEvent } = props;
  const resolved = resolveState(TEXT_LINK, state, tokens);
  return (
    <Link
      href={config.href || "#"}
      onClick={() => onEvent?.({ event: "click" })}
      tabIndex={mode === "edit" ? -1 : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: sizeToFontPx(size),
        fontWeight: 700,
        color: resolved.ink,
        textDecoration: "underline",
        textUnderlineOffset: 3,
        cursor: "pointer",
        opacity: resolved.opacity,
        background: "transparent",
        border: "none",
        padding: 0
      }}
    >
      {config.label}
    </Link>
  );
}
const TEXT_LINK: ButtonRegistration<Basic> = {
  id: "basic.text_link_1",
  name: "Text Link",
  version: "1.0.0",
  category: "basic",
  role: "cta_learn_more",
  description: "Just a link. Inline underline. Body copy heir.",
  shortPitch: "Inline, minimal, universal.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 40 }, default: "Read the guide", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "href", label: "Link", type: { kind: "link" }, default: "#", role: "primary_action_href", group: "Content" }
  ],
  states: {
    default: { inkToken: "color.primary" },
    hover: { inkToken: "color.accent" }
  },
  motion: { hover: "none" },
  shape: { kind: "rect", radiusPx: 0 },
  size: "sm",
  themeTokensUsed: ["color.primary", "color.accent"],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Read", role: "link", activateOnSpace: false },
  telemetry: { eventOnClick: "basic.text_link", payloadKeys: ["href"] },
  conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 20 },
  aiPrompts: sharedAiPrompts("inline text link"),
  searchKeywords: ["text", "link", "inline", "underline"],
  defaultConfig: () => ({ label: "Read the guide", href: "#" }),
  renderer: TextLink
};
buttonRegistry.register(TEXT_LINK);

// ─── Minimal (borderless, subtle bg) ────────────────
function MinimalButton(props: ButtonRendererProps<Basic>) {
  return <SharedBasic reg={MINIMAL} {...props} />;
}
const MINIMAL: ButtonRegistration<Basic> = {
  id: "basic.minimal_1",
  name: "Minimal",
  version: "1.0.0",
  category: "basic",
  role: "secondary_action",
  description: "Ultra-quiet fill. For tertiary decisions and quiet UIs.",
  shortPitch: "Quiet, respectful.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 32 }, default: "Cancel", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "href", label: "Link", type: { kind: "link" }, default: "#", role: "primary_action_href", group: "Content" }
  ],
  states: {
    default: { backgroundLiteral: "rgba(0,0,0,0.05)", inkToken: "color.primary" },
    hover: { backgroundLiteral: "rgba(0,0,0,0.08)" },
    focus_visible: { shadowPreset: "glow" },
    pressed: { scale: 0.99 },
    disabled: { opacity: 0.4 }
  },
  motion: { hover: "none", press: "shrink" },
  shape: { kind: "rect", radiusPx: 10 },
  size: "md",
  themeTokensUsed: ["color.primary"],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Cancel", role: "button", activateOnSpace: true },
  telemetry: { eventOnClick: "basic.minimal", payloadKeys: ["href"] },
  conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 44 },
  aiPrompts: sharedAiPrompts("minimal"),
  searchKeywords: ["minimal", "quiet", "tertiary"],
  defaultConfig: () => ({ label: "Cancel", href: "#" }),
  renderer: MinimalButton
};
buttonRegistry.register(MINIMAL);

// ─── Shared renderer ────────────────────────────────

function SharedBasic({
  reg,
  config,
  state,
  tokens,
  size,
  shape,
  motion,
  mode,
  onEvent
}: {
  reg: ButtonRegistration<Basic>;
} & ButtonRendererProps<Basic>) {
  const resolved = resolveState(reg, state, tokens);
  const height = sizeToHeightPx(size);
  const paddingX = sizeToPaddingXPx(size);
  const font = sizeToFontPx(size);
  const shapeCss = shapeToStyle(shape);
  return (
    <MotionScope motion={motion} state={state}>
      {({ animation }) => (
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
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            background: resolved.background,
            color: resolved.ink,
            border: resolved.borderWidth ? `${resolved.borderWidth}px solid ${resolved.border}` : "none",
            boxShadow: resolved.shadow,
            transform: resolved.transform,
            opacity: resolved.opacity,
            transition: "transform 150ms ease-out, box-shadow 150ms ease-out",
            animation,
            cursor: "pointer",
            ...shapeCss
          }}
        >
          {config.label}
        </Link>
      )}
    </MotionScope>
  );
}

// ─── Shared AI prompts ──────────────────────────────

function sharedAiPrompts(flavour: string): ButtonRegistration["aiPrompts"] {
  return {
    explain: `Explain when a ${flavour} basic button converts.`,
    improveCopy: "Verb-first, ≤4 words, active voice.",
    improveStyle: `Tighten padding or radius on the ${flavour} baseline.`,
    restyle: "Apply {mood}.",
    generateFromBrief: `Create a ${flavour} button for {vertical}.`,
    scoreConversion: "Score copy + contrast + placement.",
    scoreAccessibility: "Focus ring, tap target, contrast.",
    suggestIcon: "Pick a Lucide icon that matches the verb."
  };
}
