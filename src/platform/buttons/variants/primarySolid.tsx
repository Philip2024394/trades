"use client";

// Primary Solid — the yellow-fill workhorse.

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
import type { ButtonRegistration, ButtonRendererProps } from "../types";

type Config = {
  label: string;
  href: string;
  iconName?: string;
  iconPosition?: "leading" | "trailing";
};

function PrimarySolid({
  config,
  state,
  tokens,
  size,
  shape,
  motion,
  mode,
  onEvent
}: ButtonRendererProps<Config>) {
  const resolved = resolveState(REGISTRATION, state, tokens);
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
            gap: 6,
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
            transition: "transform 150ms ease-out, box-shadow 150ms ease-out, background 150ms ease-out",
            animation,
            cursor: "pointer",
            ...shapeCss
          }}
        >
          {config.iconName && config.iconPosition !== "trailing" && (
            <span aria-hidden="true">▸</span>
          )}
          <span>{config.label}</span>
          {config.iconName && config.iconPosition === "trailing" && (
            <span aria-hidden="true">→</span>
          )}
        </Link>
      )}
    </MotionScope>
  );
}

const REGISTRATION: ButtonRegistration<Config> = {
  id: "primary.solid_1",
  name: "Primary Solid",
  version: "1.0.0",
  category: "basic",
  role: "primary_action",
  description: "The workhorse. Yellow-fill on any surface, uppercase label, arrow trailing.",
  shortPitch: "Loud, unmissable, brand-tone.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 32 }, default: "Get started", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "href", label: "Link", type: { kind: "link", allowInternal: true, allowExternal: true }, default: "#", role: "primary_action_href", group: "Content" },
    { key: "iconName", label: "Icon", type: { kind: "icon" }, default: "", group: "Content" },
    { key: "iconPosition", label: "Icon position", type: { kind: "select", options: [{ value: "leading", label: "Leading" }, { value: "trailing", label: "Trailing" }] }, default: "trailing", group: "Content" }
  ],
  states: {
    default: {
      backgroundToken: "color.accent",
      inkLiteral: "#0A0A0A",
      shadowPreset: "soft"
    },
    hover: { translateYPx: -1, shadowPreset: "floating" },
    focus_visible: { shadowPreset: "glow" },
    pressed: { scale: 0.98 },
    disabled: { opacity: 0.5 }
  },
  motion: { hover: "lift", focus: "glow", press: "shrink" },
  shape: { kind: "rect", radiusPx: 12 },
  size: "md",
  themeTokensUsed: ["color.accent"],
  a11y: {
    ariaLabelFor: (c) => (c.label as string) || "Action",
    role: "button",
    activateOnSpace: true
  },
  telemetry: { eventOnClick: "cta.primary", payloadKeys: ["href"] },
  conversionHints: {
    primaryActionRecommended: true,
    aboveFoldRecommended: true,
    minContrast: 4.5,
    minTapTargetPx: 44
  },
  aiPrompts: {
    explain: "Explain why a solid-fill primary CTA converts on this trade.",
    improveCopy: "Rewrite the label as a verb-first action ≤4 words.",
    improveStyle: "Suggest tighter shadow or radius for this brand's aesthetic.",
    restyle: "Apply {mood} preset — bold / luxury / minimal.",
    generateFromBrief: "Create a primary CTA for {vertical} with an outcome-first verb.",
    scoreConversion: "Score copy + contrast + placement for a primary CTA.",
    scoreAccessibility: "Check tap target, contrast, focus ring visibility.",
    suggestIcon: "Pick a Lucide icon that matches the verb in the label."
  },
  searchKeywords: ["primary", "cta", "yellow", "solid", "action"],
  defaultConfig: () => ({
    label: "Get started",
    href: "#",
    iconName: "arrow-right",
    iconPosition: "trailing"
  }),
  renderer: PrimarySolid
};

buttonRegistry.register(REGISTRATION);
