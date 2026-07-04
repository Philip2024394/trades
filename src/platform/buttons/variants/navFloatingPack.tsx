"use client";

// Navigation + Floating packs — Previous, Next, Back, Continue (nav);
// FAB, Sticky Bottom CTA, Scroll to Top, Corner Button (floating).

import Link from "next/link";
import { buttonRegistry } from "../buttonRegistry";
import {
  resolveState,
  shapeToStyle,
  sizeToFontPx,
  sizeToHeightPx,
  sizeToPaddingXPx
} from "../themeAdapter";
import type {
  ButtonRegistration,
  ButtonRendererProps,
  ButtonRole
} from "../types";

type Nav = { label: string; href: string };

// ─── Navigation ─────────────────────────────────────

function NavArrow({
  reg,
  glyph,
  glyphPosition,
  ...props
}: {
  reg: ButtonRegistration<Nav>;
  glyph: string;
  glyphPosition: "leading" | "trailing";
} & ButtonRendererProps<Nav>) {
  const { config, state, tokens, size, shape, mode, onEvent } = props;
  const resolved = resolveState(reg, state, tokens);
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
        gap: 6,
        height,
        paddingLeft: paddingX,
        paddingRight: paddingX,
        fontSize: font,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        background: resolved.background,
        color: resolved.ink,
        border: resolved.borderWidth ? `${resolved.borderWidth}px solid ${resolved.border}` : "none",
        boxShadow: resolved.shadow,
        transform: resolved.transform,
        opacity: resolved.opacity,
        cursor: "pointer",
        transition: "transform 150ms ease-out",
        ...shapeCss
      }}
    >
      {glyphPosition === "leading" && <span aria-hidden="true">{glyph}</span>}
      <span>{config.label}</span>
      {glyphPosition === "trailing" && <span aria-hidden="true">{glyph}</span>}
    </Link>
  );
}

function makeNav(
  id: string,
  name: string,
  role: ButtonRole,
  defaultLabel: string,
  glyph: string,
  glyphPosition: "leading" | "trailing",
  shortPitch: string
): ButtonRegistration<Nav> {
  return {
    id,
    name,
    version: "1.0.0",
    category: "navigation",
    role,
    description: `${name} — pagination or wizard control.`,
    shortPitch,
    editableFields: [
      { key: "label", label: "Label", type: { kind: "text", maxLength: 24 }, default: defaultLabel, role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
      { key: "href", label: "Link", type: { kind: "link" }, default: "#", role: "primary_action_href", group: "Content" }
    ],
    states: {
      default: { backgroundLiteral: "transparent", inkToken: "color.primary", borderToken: "color.primary", borderWidthPx: 1.5 },
      hover: { backgroundLiteral: "rgba(0,0,0,0.04)", translateXPx: glyphPosition === "trailing" ? 2 : -2 },
      focus_visible: { shadowPreset: "glow" },
      pressed: { scale: 0.99 },
      disabled: { opacity: 0.4 }
    },
    motion: { hover: glyphPosition === "trailing" ? "arrow_reveal" : "icon_slide", press: "shrink" },
    shape: { kind: "rect", radiusPx: 8 },
    size: "sm",
    themeTokensUsed: ["color.primary"],
    a11y: { ariaLabelFor: (c) => (c.label as string) || name, role: "link", activateOnSpace: false },
    telemetry: { eventOnClick: role, payloadKeys: ["href"] },
    conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 44 },
    aiPrompts: {
      explain: `Explain a ${name} nav button pattern.`,
      improveCopy: "Rewrite label as a single verb or arrow-glyph.",
      improveStyle: "Suggest tighter padding on nav bars.",
      restyle: "Match to {mood}.",
      generateFromBrief: `Create a ${name} nav for {vertical}.`,
      scoreConversion: "Nav clarity, target tap size.",
      scoreAccessibility: "Focus outline visibility on light + dark bg.",
      suggestIcon: "Arrow direction matching the intent."
    },
    searchKeywords: [role, name.toLowerCase(), "nav", "pagination"],
    defaultConfig: () => ({ label: defaultLabel, href: "#" }),
    renderer: (props) => (
      <NavArrow
        reg={NAV_REGS[id]}
        glyph={glyph}
        glyphPosition={glyphPosition}
        {...props}
      />
    )
  };
}

const NAV_REGS: Record<string, ButtonRegistration<Nav>> = {};

const NAV_SPECS: [string, string, ButtonRole, string, string, "leading" | "trailing", string][] = [
  ["nav.previous_1", "Previous", "nav_previous", "Previous", "←", "leading", "Back one step."],
  ["nav.next_1", "Next", "nav_next", "Next", "→", "trailing", "Forward one step."],
  ["nav.back_1", "Back", "nav_back", "Back", "◀", "leading", "Return."],
  ["nav.continue_1", "Continue", "nav_continue", "Continue", "→", "trailing", "Forward with commitment."]
];

for (const [id, name, role, label, glyph, position, pitch] of NAV_SPECS) {
  const reg = makeNav(id, name, role, label, glyph, position, pitch);
  NAV_REGS[id] = reg;
  buttonRegistry.register(reg);
}

// ─── Floating ───────────────────────────────────────

function FabRenderer({
  reg,
  glyph,
  ...props
}: {
  reg: ButtonRegistration<Nav>;
  glyph: string;
} & ButtonRendererProps<Nav>) {
  const { config, state, tokens, shape, mode, onEvent } = props;
  const resolved = resolveState(reg, state, tokens);
  const shapeCss = shapeToStyle(shape);
  return (
    <Link
      href={config.href || "#"}
      aria-label={config.label}
      onClick={() => onEvent?.({ event: "click" })}
      tabIndex={mode === "edit" ? -1 : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 56,
        height: 56,
        background: resolved.background,
        color: resolved.ink,
        boxShadow: resolved.shadow,
        transform: resolved.transform,
        opacity: resolved.opacity,
        cursor: "pointer",
        border: "none",
        fontSize: 22,
        transition: "transform 150ms ease-out, box-shadow 150ms ease-out",
        ...shapeCss
      }}
    >
      {glyph}
    </Link>
  );
}

function makeFloating(
  id: string,
  name: string,
  role: ButtonRole,
  defaultLabel: string,
  glyph: string,
  shortPitch: string
): ButtonRegistration<Nav> {
  return {
    id,
    name,
    version: "1.0.0",
    category: "floating",
    role,
    description: `${name} — persistent, one-tap access.`,
    shortPitch,
    editableFields: [
      { key: "label", label: "Accessible label", type: { kind: "text", maxLength: 40 }, default: defaultLabel, role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
      { key: "href", label: "Link", type: { kind: "link" }, default: "#", role: "primary_action_href", group: "Content" }
    ],
    states: {
      default: { backgroundToken: "color.primary", inkLiteral: "#FFFFFF", shadowPreset: "floating" },
      hover: { scale: 1.05, shadowPreset: "layered" },
      focus_visible: { shadowPreset: "glow" },
      pressed: { scale: 0.95 },
      disabled: { opacity: 0.4 }
    },
    motion: { hover: "grow", press: "shrink" },
    shape: { kind: "circle" },
    size: "lg",
    themeTokensUsed: ["color.primary"],
    a11y: { ariaLabelFor: (c) => (c.label as string) || name, role: "button", activateOnSpace: true },
    telemetry: { eventOnClick: role, payloadKeys: ["href"] },
    conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 56 },
    aiPrompts: {
      explain: `Explain when a ${name} floating action helps conversion.`,
      improveCopy: "Aria-label MUST describe the action.",
      improveStyle: "Suggest position (bottom-right vs. corner).",
      restyle: "Match to {mood}.",
      generateFromBrief: `Create a ${name} for {vertical}.`,
      scoreConversion: "Visibility on scroll + persistence.",
      scoreAccessibility: "Aria-label + 56px min + focus outline.",
      suggestIcon: "Universal glyph for the intent."
    },
    searchKeywords: [role, "floating", "sticky", "fab", name.toLowerCase()],
    defaultConfig: () => ({ label: defaultLabel, href: "#" }),
    renderer: (props) => (
      <FabRenderer reg={FLOAT_REGS[id]} glyph={glyph} {...props} />
    )
  };
}

const FLOAT_REGS: Record<string, ButtonRegistration<Nav>> = {};

const FLOAT_SPECS: [string, string, ButtonRole, string, string, string][] = [
  ["floating.fab_1", "FAB — Add", "floating_action", "Create new", "+", "The classic Material FAB."],
  ["floating.sticky_cta_1", "Sticky Bottom CTA", "sticky_cta", "Get a quote", "▸", "Bottom-fixed on mobile."],
  ["floating.scroll_top_1", "Scroll to Top", "scroll_to_top", "Back to top", "▲", "Long-page rescue."],
  ["floating.corner_wa_1", "Corner WhatsApp", "cta_whatsapp", "Chat on WhatsApp", "💬", "Persistent messenger."]
];

for (const [id, name, role, label, glyph, pitch] of FLOAT_SPECS) {
  const reg = makeFloating(id, name, role, label, glyph, pitch);
  FLOAT_REGS[id] = reg;
  buttonRegistry.register(reg);
}
