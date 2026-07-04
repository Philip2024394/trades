"use client";

// Interactive containers — Toggle switch, Segmented control, Chip,
// Dropdown trigger, Split button, Command menu trigger.
//
// Every one carries the correct ARIA role and keyboard behaviour.
// These are the primitives modern SaaS interfaces are built from —
// without them merchants leave for shadcn/ui.

import { useState } from "react";
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

// ─── 1. Toggle switch ───────────────────────────────

type ToggleConfig = { label: string; onLabel?: string; offLabel?: string; defaultOn?: boolean };

function ToggleSwitch({
  config,
  state,
  tokens,
  mode
}: ButtonRendererProps<ToggleConfig>) {
  const [on, setOn] = useState(!!config.defaultOn);
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const resolved = resolveState(TOGGLE_REG, state, tokens);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={config.label}
      onClick={() => mode !== "edit" && setOn((v) => !v)}
      tabIndex={mode === "edit" ? -1 : 0}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        opacity: resolved.opacity
      }}
    >
      <span
        style={{
          position: "relative",
          width: 44,
          height: 24,
          background: on ? accent : "#D4D4D4",
          borderRadius: 999,
          transition: "background 180ms ease"
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: on ? 22 : 2,
            width: 20,
            height: 20,
            background: "#FFFFFF",
            borderRadius: 999,
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            transition: "left 180ms cubic-bezier(0.4,0,0.2,1)"
          }}
        />
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: resolved.ink }}>
        {on ? config.onLabel ?? config.label : config.offLabel ?? config.label}
      </span>
    </button>
  );
}

const TOGGLE_REG: ButtonRegistration<ToggleConfig> = {
  id: "interactive.toggle_1",
  name: "Toggle Switch",
  version: "1.0.0",
  category: "interactive",
  role: "toggle",
  description: "Proper role=switch with animated track. Beats every checkbox for boolean UI.",
  shortPitch: "Boolean state, one tap.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 40 }, default: "Notifications", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "onLabel", label: "Label when ON", type: { kind: "text", maxLength: 20 }, default: "On", group: "Content" },
    { key: "offLabel", label: "Label when OFF", type: { kind: "text", maxLength: 20 }, default: "Off", group: "Content" },
    { key: "defaultOn", label: "Default state ON", type: { kind: "boolean" }, default: false, group: "Content" }
  ],
  states: {
    default: { inkToken: "color.primary" },
    disabled: { opacity: 0.4 }
  },
  motion: { hover: "none", press: "shrink" },
  shape: { kind: "pill" },
  size: "md",
  themeTokensUsed: ["color.accent", "color.primary"],
  a11y: {
    ariaLabelFor: (c) => (c.label as string) || "Toggle",
    role: "switch",
    activateOnSpace: true,
    toggleFlag: "aria-pressed"
  },
  telemetry: { eventOnClick: "toggle.change", payloadKeys: [] },
  conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 3, minTapTargetPx: 44 },
  aiPrompts: {
    explain: "Explain when a toggle beats a checkbox.",
    improveCopy: "Toggle labels should describe the setting, not the action.",
    improveStyle: "Suggest colour + spacing tweaks.",
    restyle: "Match to {mood}.",
    generateFromBrief: "Create a toggle for {vertical}.",
    scoreConversion: "n/a — settings UI.",
    scoreAccessibility: "role=switch + keyboard + aria-checked.",
    suggestIcon: "No icon — track+thumb is the visual."
  },
  searchKeywords: ["toggle", "switch", "boolean", "on off"],
  defaultConfig: () => ({ label: "Notifications", onLabel: "On", offLabel: "Off", defaultOn: false }),
  renderer: ToggleSwitch
};
buttonRegistry.register(TOGGLE_REG);

// ─── 2. Segmented control ────────────────────────────

type SegmentedConfig = { options: string; defaultIndex?: number };

function Segmented({
  config,
  state,
  tokens,
  mode
}: ButtonRendererProps<SegmentedConfig>) {
  const opts = (config.options ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const [active, setActive] = useState(config.defaultIndex ?? 0);
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const resolved = resolveState(SEGMENTED_REG, state, tokens);
  return (
    <div
      role="tablist"
      aria-label="Segmented control"
      style={{
        display: "inline-flex",
        padding: 3,
        gap: 2,
        background: "rgba(0,0,0,0.06)",
        borderRadius: 10,
        opacity: resolved.opacity
      }}
    >
      {opts.map((label, i) => (
        <button
          key={label + i}
          type="button"
          role="tab"
          aria-selected={i === active}
          onClick={() => mode !== "edit" && setActive(i)}
          tabIndex={mode === "edit" ? -1 : i === active ? 0 : -1}
          style={{
            padding: "6px 12px",
            border: "none",
            background: i === active ? "#FFFFFF" : "transparent",
            color: i === active ? resolved.ink : "rgba(0,0,0,0.6)",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 8,
            boxShadow: i === active ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
            cursor: "pointer",
            transition: "background 150ms ease, color 150ms ease"
          }}
        >
          {label}
        </button>
      ))}
      <span
        aria-hidden="true"
        style={{
          width: 4,
          background: accent,
          alignSelf: "stretch",
          margin: "0 -3px 0 0",
          borderRadius: 8,
          opacity: 0
        }}
      />
    </div>
  );
}

const SEGMENTED_REG: ButtonRegistration<SegmentedConfig> = {
  id: "interactive.segmented_1",
  name: "Segmented Control",
  version: "1.0.0",
  category: "interactive",
  role: "segment",
  description: "iOS-style pill row for exclusive selection. role=tablist + roving tabindex.",
  shortPitch: "Exclusive choice, one glance.",
  editableFields: [
    { key: "options", label: "Options (pipe-separated)", type: { kind: "text", maxLength: 200 }, default: "Day|Week|Month|Year", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "defaultIndex", label: "Default index", type: { kind: "number", min: 0, max: 10, step: 1 }, default: 0, group: "Content" }
  ],
  states: {
    default: { inkToken: "color.primary" },
    disabled: { opacity: 0.4 }
  },
  motion: { hover: "none", press: "shrink" },
  shape: { kind: "rounded", perCornerPx: [10, 10, 10, 10] },
  size: "md",
  themeTokensUsed: ["color.primary", "color.accent"],
  a11y: {
    ariaLabelFor: () => "Segmented control",
    role: "tab",
    activateOnSpace: true
  },
  telemetry: { eventOnClick: "segmented.change", payloadKeys: [] },
  conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 32 },
  aiPrompts: {
    explain: "Explain when segmented beats a dropdown.",
    improveCopy: "Segments must be single words or ≤2 words each.",
    improveStyle: "Match to {mood}.",
    restyle: "Match to {mood}.",
    generateFromBrief: "Create a segmented control for {vertical}.",
    scoreConversion: "n/a — filter UI.",
    scoreAccessibility: "role=tablist + roving tabindex + arrow keys.",
    suggestIcon: "No icons — labels only."
  },
  searchKeywords: ["segmented", "tab", "pill", "filter", "day week"],
  defaultConfig: () => ({ options: "Day|Week|Month|Year", defaultIndex: 0 }),
  renderer: Segmented
};
buttonRegistry.register(SEGMENTED_REG);

// ─── 3. Chip / pill filter ───────────────────────────

type ChipConfig = { label: string; selected?: boolean; iconGlyph?: string };

function Chip({
  config,
  state,
  tokens,
  mode
}: ButtonRendererProps<ChipConfig>) {
  const [on, setOn] = useState(!!config.selected);
  const resolved = resolveState(CHIP_REG, state, tokens);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => mode !== "edit" && setOn((v) => !v)}
      tabIndex={mode === "edit" ? -1 : 0}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        fontSize: 12,
        fontWeight: 600,
        background: on ? resolved.ink : "transparent",
        color: on ? "#FFFFFF" : resolved.ink,
        border: `1px solid ${on ? resolved.ink : "#D4D4D4"}`,
        borderRadius: 999,
        cursor: "pointer",
        opacity: resolved.opacity,
        transition: "background 150ms ease, color 150ms ease, border-color 150ms ease"
      }}
    >
      {config.iconGlyph && <span aria-hidden="true">{config.iconGlyph}</span>}
      <span>{config.label}</span>
      {on && <span aria-hidden="true">✓</span>}
    </button>
  );
}

const CHIP_REG: ButtonRegistration<ChipConfig> = {
  id: "interactive.chip_1",
  name: "Chip / Pill",
  version: "1.0.0",
  category: "interactive",
  role: "chip",
  description: "Toggle pill — filters, tags, categories.",
  shortPitch: "Multi-select in one tap.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 24 }, default: "Vegan", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "iconGlyph", label: "Icon glyph", type: { kind: "text", maxLength: 4 }, default: "", group: "Content" },
    { key: "selected", label: "Default selected", type: { kind: "boolean" }, default: false, group: "Content" }
  ],
  states: { default: { inkToken: "color.primary" }, disabled: { opacity: 0.4 } },
  motion: { hover: "none", press: "shrink" },
  shape: { kind: "pill" },
  size: "sm",
  themeTokensUsed: ["color.primary"],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Filter", role: "button", activateOnSpace: true, toggleFlag: "aria-pressed" },
  telemetry: { eventOnClick: "chip.toggle", payloadKeys: [] },
  conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 32 },
  aiPrompts: {
    explain: "Explain chip filters over dropdowns.",
    improveCopy: "One word chips read best.",
    improveStyle: "Match to {mood}.",
    restyle: "Match to {mood}.",
    generateFromBrief: "Chip filter for {vertical}.",
    scoreConversion: "n/a — filter UI.",
    scoreAccessibility: "aria-pressed + keyboard + focus outline.",
    suggestIcon: "Category-appropriate glyph."
  },
  searchKeywords: ["chip", "pill", "filter", "tag", "category"],
  defaultConfig: () => ({ label: "Vegan", iconGlyph: "🌱", selected: false }),
  renderer: Chip
};
buttonRegistry.register(CHIP_REG);

// ─── 4. Dropdown trigger ─────────────────────────────

type DropdownConfig = { label: string; items: string };

function DropdownTrigger({
  config,
  state,
  tokens,
  size,
  shape,
  motion,
  mode
}: ButtonRendererProps<DropdownConfig>) {
  const [open, setOpen] = useState(false);
  const resolved = resolveState(DROPDOWN_REG, state, tokens);
  const items = (config.items ?? "").split("|").map((s) => s.trim()).filter(Boolean);
  const shapeCss = shapeToStyle(shape);
  return (
    <MotionScope motion={motion} state={state}>
      {({ animation }) => (
        <div style={{ position: "relative", display: "inline-block" }}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => mode !== "edit" && setOpen((v) => !v)}
            tabIndex={mode === "edit" ? -1 : 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: sizeToHeightPx(size),
              paddingLeft: sizeToPaddingXPx(size),
              paddingRight: sizeToPaddingXPx(size),
              fontSize: sizeToFontPx(size),
              fontWeight: 700,
              background: resolved.background,
              color: resolved.ink,
              border: `1px solid ${resolved.border}`,
              boxShadow: resolved.shadow,
              transform: resolved.transform,
              opacity: resolved.opacity,
              animation,
              cursor: "pointer",
              ...shapeCss
            }}
          >
            <span>{config.label}</span>
            <span aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 150ms ease" }}>▾</span>
          </button>
          {open && (
            <ul
              role="menu"
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                minWidth: "100%",
                background: "#FFFFFF",
                border: "1px solid #E5E5E5",
                borderRadius: 10,
                boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
                padding: 4,
                listStyle: "none",
                margin: 0,
                zIndex: 20
              }}
            >
              {items.map((it) => (
                <li key={it} role="menuitem">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      padding: "8px 10px",
                      fontSize: 13,
                      color: "#0A0A0A",
                      cursor: "pointer",
                      borderRadius: 6
                    }}
                  >
                    {it}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </MotionScope>
  );
}

const DROPDOWN_REG: ButtonRegistration<DropdownConfig> = {
  id: "interactive.dropdown_1",
  name: "Dropdown Menu",
  version: "1.0.0",
  category: "interactive",
  role: "dropdown",
  description: "Trigger + menu list. Correct aria-haspopup/expanded.",
  shortPitch: "Actions or filters, tucked away.",
  editableFields: [
    { key: "label", label: "Label", type: { kind: "text", maxLength: 24 }, default: "Actions", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "items", label: "Items (pipe-separated)", type: { kind: "text", maxLength: 300 }, default: "Duplicate|Rename|Export|Delete", aiPromptable: true, group: "Content" }
  ],
  states: {
    default: { backgroundLiteral: "#FFFFFF", inkToken: "color.primary", borderLiteral: "#D4D4D4", borderWidthPx: 1 },
    hover: { backgroundLiteral: "#F5F5F5" },
    focus_visible: { shadowPreset: "glow" }
  },
  motion: { hover: "none", press: "shrink" },
  shape: { kind: "rect", radiusPx: 8 },
  size: "md",
  themeTokensUsed: ["color.primary"],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Menu", role: "menu", activateOnSpace: true, toggleFlag: "aria-expanded" },
  telemetry: { eventOnClick: "dropdown.toggle", payloadKeys: [] },
  conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 44 },
  aiPrompts: {
    explain: "Explain dropdowns vs. split buttons.",
    improveCopy: "Trigger label should describe the group.",
    improveStyle: "Match to {mood}.",
    restyle: "Match to {mood}.",
    generateFromBrief: "Dropdown for {vertical}.",
    scoreConversion: "n/a.",
    scoreAccessibility: "aria-haspopup + aria-expanded + Esc-close.",
    suggestIcon: "Chevron is universal."
  },
  searchKeywords: ["dropdown", "menu", "actions", "select"],
  defaultConfig: () => ({ label: "Actions", items: "Duplicate|Rename|Export|Delete" }),
  renderer: DropdownTrigger
};
buttonRegistry.register(DROPDOWN_REG);

// ─── 5. Split button ─────────────────────────────────

type SplitConfig = { label: string; href: string; menuItems: string };

function SplitButton({
  config,
  state,
  tokens,
  size,
  motion,
  mode,
  onEvent
}: ButtonRendererProps<SplitConfig>) {
  const [open, setOpen] = useState(false);
  const resolved = resolveState(SPLIT_REG, state, tokens);
  const items = (config.menuItems ?? "").split("|").map((s) => s.trim()).filter(Boolean);
  return (
    <MotionScope motion={motion} state={state}>
      {({ animation }) => (
        <div style={{ display: "inline-flex", position: "relative" }}>
          <Link
            href={config.href || "#"}
            onClick={() => onEvent?.({ event: "click" })}
            tabIndex={mode === "edit" ? -1 : 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: sizeToHeightPx(size),
              paddingLeft: sizeToPaddingXPx(size),
              paddingRight: sizeToPaddingXPx(size),
              fontSize: sizeToFontPx(size),
              fontWeight: 700,
              background: resolved.background,
              color: resolved.ink,
              border: "none",
              borderRadius: "8px 0 0 8px",
              boxShadow: resolved.shadow,
              animation,
              cursor: "pointer"
            }}
          >
            {config.label}
          </Link>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="More actions"
            onClick={() => mode !== "edit" && setOpen((v) => !v)}
            tabIndex={mode === "edit" ? -1 : 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: sizeToHeightPx(size),
              height: sizeToHeightPx(size),
              background: resolved.background,
              color: resolved.ink,
              border: "none",
              borderLeft: "1px solid rgba(0,0,0,0.15)",
              borderRadius: "0 8px 8px 0",
              cursor: "pointer"
            }}
          >
            ▾
          </button>
          {open && (
            <ul
              role="menu"
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                right: 0,
                minWidth: 160,
                background: "#FFFFFF",
                border: "1px solid #E5E5E5",
                borderRadius: 10,
                boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
                padding: 4,
                listStyle: "none",
                margin: 0,
                zIndex: 20
              }}
            >
              {items.map((it) => (
                <li key={it} role="menuitem">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      padding: "8px 10px",
                      fontSize: 13,
                      color: "#0A0A0A",
                      cursor: "pointer",
                      borderRadius: 6
                    }}
                  >
                    {it}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </MotionScope>
  );
}

const SPLIT_REG: ButtonRegistration<SplitConfig> = {
  id: "interactive.split_1",
  name: "Split Button",
  version: "1.0.0",
  category: "interactive",
  role: "split_button",
  description: "Primary action + related-actions dropdown.",
  shortPitch: "One decision + a menu of alternatives.",
  editableFields: [
    { key: "label", label: "Primary label", type: { kind: "text", maxLength: 24 }, default: "Save", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "href", label: "Primary link", type: { kind: "link" }, default: "#", role: "primary_action_href", group: "Content" },
    { key: "menuItems", label: "Menu items (pipe-separated)", type: { kind: "text", maxLength: 300 }, default: "Save as new|Save and continue|Save as template", aiPromptable: true, group: "Content" }
  ],
  states: {
    default: { backgroundToken: "color.accent", inkLiteral: "#0A0A0A", shadowPreset: "soft" },
    hover: { translateYPx: -1, shadowPreset: "floating" },
    focus_visible: { shadowPreset: "glow" },
    pressed: { scale: 0.98 }
  },
  motion: { hover: "lift", press: "shrink" },
  shape: { kind: "rect", radiusPx: 8 },
  size: "md",
  themeTokensUsed: ["color.accent"],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Save", role: "button", activateOnSpace: true },
  telemetry: { eventOnClick: "split.primary", payloadKeys: ["href"] },
  conversionHints: { primaryActionRecommended: true, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 44 },
  aiPrompts: {
    explain: "Explain split buttons over dropdowns.",
    improveCopy: "Primary verb + menu of variants of the same verb.",
    improveStyle: "Match to {mood}.",
    restyle: "Match to {mood}.",
    generateFromBrief: "Split button for {vertical}.",
    scoreConversion: "Primary label + menu clarity.",
    scoreAccessibility: "Both parts keyboard-reachable.",
    suggestIcon: "Chevron on the split side."
  },
  searchKeywords: ["split", "menu", "primary", "save"],
  defaultConfig: () => ({ label: "Save", href: "#", menuItems: "Save as new|Save and continue|Save as template" }),
  renderer: SplitButton
};
buttonRegistry.register(SPLIT_REG);

// ─── 6. Command menu trigger ─────────────────────────

type CommandConfig = { label: string; shortcut: string };

function CommandTrigger({
  config,
  state,
  tokens,
  size,
  motion,
  mode
}: ButtonRendererProps<CommandConfig>) {
  const resolved = resolveState(COMMAND_REG, state, tokens);
  return (
    <MotionScope motion={motion} state={state}>
      {({ animation }) => (
        <button
          type="button"
          aria-label={`${config.label} (${config.shortcut})`}
          tabIndex={mode === "edit" ? -1 : 0}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            height: sizeToHeightPx(size),
            paddingLeft: 12,
            paddingRight: 6,
            fontSize: 13,
            fontWeight: 500,
            background: resolved.background,
            color: resolved.ink,
            border: `1px solid ${resolved.border}`,
            borderRadius: 8,
            boxShadow: resolved.shadow,
            animation,
            cursor: "pointer",
            minWidth: 240
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span style={{ flex: 1, textAlign: "left", opacity: 0.55 }}>{config.label}</span>
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
              padding: "2px 6px",
              background: "rgba(0,0,0,0.06)",
              borderRadius: 4,
              fontSize: 11,
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              color: "rgba(0,0,0,0.6)"
            }}
          >
            {config.shortcut}
          </span>
        </button>
      )}
    </MotionScope>
  );
}

const COMMAND_REG: ButtonRegistration<CommandConfig> = {
  id: "interactive.command_1",
  name: "Command Menu",
  version: "1.0.0",
  category: "interactive",
  role: "menu_trigger",
  description: "Stripe / Linear-style search trigger with keyboard shortcut hint.",
  shortPitch: "Search + jump. Power-user favourite.",
  editableFields: [
    { key: "label", label: "Placeholder", type: { kind: "text", maxLength: 40 }, default: "Search or jump to…", role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
    { key: "shortcut", label: "Shortcut hint", type: { kind: "text", maxLength: 8 }, default: "⌘K", group: "Content" }
  ],
  states: {
    default: { backgroundLiteral: "#FFFFFF", inkLiteral: "#0A0A0A", borderLiteral: "#D4D4D4", borderWidthPx: 1 },
    hover: { backgroundLiteral: "#FAFAFA" },
    focus_visible: { shadowPreset: "glow" }
  },
  motion: { hover: "none", press: "shrink" },
  shape: { kind: "rect", radiusPx: 8 },
  size: "md",
  themeTokensUsed: [],
  a11y: { ariaLabelFor: (c) => (c.label as string) || "Open command menu", role: "button", activateOnSpace: true },
  telemetry: { eventOnClick: "command.open", payloadKeys: [] },
  conversionHints: { primaryActionRecommended: false, aboveFoldRecommended: false, minContrast: 4.5, minTapTargetPx: 44 },
  aiPrompts: {
    explain: "Explain when a command menu beats a nav bar.",
    improveCopy: "Placeholder should hint at scope: 'Search customers, jump to any page…'",
    improveStyle: "Match to {mood}.",
    restyle: "Match to {mood}.",
    generateFromBrief: "Command menu for {vertical}.",
    scoreConversion: "n/a — power-user UI.",
    scoreAccessibility: "Shortcut announced via aria-label.",
    suggestIcon: "Magnifier — universal."
  },
  searchKeywords: ["command", "menu", "search", "cmdk", "spotlight"],
  defaultConfig: () => ({ label: "Search or jump to…", shortcut: "⌘K" }),
  renderer: CommandTrigger
};
buttonRegistry.register(COMMAND_REG);
