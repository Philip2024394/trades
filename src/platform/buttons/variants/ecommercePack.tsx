"use client";

// Ecommerce pack — Add to Cart (with success stitcher), Checkout,
// Wishlist, Quick View, Compare, Pre-order, Notify Me, Out of Stock.

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
  ButtonRendererProps,
  ButtonRole
} from "../types";

type Ecomm = { label: string; href: string };

function makeEcomm(
  id: string,
  name: string,
  role: ButtonRole,
  defaultLabel: string,
  glyph: string,
  shortPitch: string,
  disabled: boolean = false
): ButtonRegistration<Ecomm> {
  return {
    id,
    name,
    version: "1.0.0",
    category: "ecommerce",
    role,
    description: `${name} — the ecommerce moment, one tap.`,
    shortPitch,
    editableFields: [
      { key: "label", label: "Label", type: { kind: "text", maxLength: 32 }, default: defaultLabel, role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
      { key: "href", label: "Link", type: { kind: "link" }, default: "#", role: "primary_action_href", group: "Content" }
    ],
    states: {
      default: {
        backgroundToken: disabled ? "color.muted" : "color.primary",
        inkLiteral: "#FFFFFF",
        shadowPreset: "soft",
        opacity: disabled ? 0.7 : 1
      },
      hover: disabled ? {} : { translateYPx: -1, shadowPreset: "floating" },
      focus_visible: { shadowPreset: "glow" },
      pressed: { scale: 0.98 },
      loading: { backgroundToken: "color.muted", opacity: 0.85 },
      success: {
        backgroundLiteral: "#10B981",
        inkLiteral: "#FFFFFF",
        shadowPreset: "glow"
      },
      error: {
        backgroundLiteral: "#DC2626",
        inkLiteral: "#FFFFFF"
      },
      disabled: { opacity: 0.4 }
    },
    motion: {
      hover: "lift",
      press: "shrink",
      loading: "spinner",
      success: "checkmark_morph",
      error: "shake"
    },
    shape: { kind: "rect", radiusPx: 10 },
    size: "md",
    themeTokensUsed: ["color.primary"],
    a11y: {
      ariaLabelFor: (c) => (c.label as string) || name,
      role: "button",
      activateOnSpace: true
    },
    telemetry: { eventOnClick: role, payloadKeys: ["href"] },
    conversionHints: {
      primaryActionRecommended: role === "add_to_cart" || role === "checkout" || role === "buy_now",
      aboveFoldRecommended: false,
      minContrast: 4.5,
      minTapTargetPx: 44
    },
    aiPrompts: {
      explain: `Explain when ${name} outperforms a generic Buy Now.`,
      improveCopy: "Verb-first, ≤4 words, minimal punctuation.",
      improveStyle: "Suggest state-machine stitching (add success confetti sparingly).",
      restyle: "Match to {mood}.",
      generateFromBrief: `Create a ${name} button for {vertical}.`,
      scoreConversion: "Assess friction: fewer clicks between intent and confirmation.",
      scoreAccessibility: "Loading + success + error must be aria-live announced.",
      suggestIcon: "Cart / bag / heart glyphs as appropriate."
    },
    searchKeywords: [role, name.toLowerCase(), "ecommerce", "shop"],
    defaultConfig: () => ({ label: defaultLabel, href: "#" }),
    renderer: (props) => <EcommRenderer reg={REGS[id]} glyph={glyph} {...props} />
  };
}

function EcommRenderer({
  reg,
  glyph,
  config,
  state,
  tokens,
  size,
  shape,
  motion,
  mode,
  onEvent
}: {
  reg: ButtonRegistration<Ecomm>;
  glyph: string;
} & ButtonRendererProps<Ecomm>) {
  const resolved = resolveState(reg, state, tokens);
  const height = sizeToHeightPx(size);
  const paddingX = sizeToPaddingXPx(size);
  const font = sizeToFontPx(size);
  const shapeCss = shapeToStyle(shape);
  const stateLabel =
    state === "loading"
      ? "…"
      : state === "success"
        ? "Added ✓"
        : state === "error"
          ? "Try again"
          : config.label;
  return (
    <MotionScope motion={motion} state={state}>
      {({ animation }) => (
        <Link
          href={config.href || "#"}
          onClick={() => onEvent?.({ event: "click" })}
          tabIndex={mode === "edit" ? -1 : undefined}
          aria-live={state === "loading" || state === "success" || state === "error" ? "polite" : undefined}
          style={{
            display: "inline-flex",
            alignItems: "center",
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
            boxShadow: resolved.shadow,
            transform: resolved.transform,
            opacity: resolved.opacity,
            transition: "transform 150ms ease-out, box-shadow 150ms ease-out, background 150ms ease-out",
            animation,
            cursor: "pointer",
            border: "none",
            ...shapeCss
          }}
        >
          <span aria-hidden="true">{glyph}</span>
          <span>{stateLabel}</span>
        </Link>
      )}
    </MotionScope>
  );
}

const REGS: Record<string, ButtonRegistration<Ecomm>> = {};

const ECOMM_SPECS: [string, string, ButtonRole, string, string, string, boolean][] = [
  ["ecomm.add_to_cart_1", "Add to Cart", "add_to_cart", "Add to cart", "🛒", "The workhorse.", false],
  ["ecomm.checkout_1", "Checkout", "checkout", "Checkout", "→", "Money-moment button.", false],
  ["ecomm.wishlist_1", "Wishlist", "wishlist", "Save for later", "♡", "Low-friction saved.", false],
  ["ecomm.quick_view_1", "Quick View", "quick_view", "Quick view", "👁", "Preview without leaving.", false],
  ["ecomm.compare_1", "Compare", "compare", "Compare", "⇄", "Side-by-side decision aid.", false],
  ["ecomm.preorder_1", "Pre-order", "preorder", "Pre-order", "◐", "Future-dated commitment.", false],
  ["ecomm.notify_me_1", "Notify Me", "notify_me", "Notify me", "🔔", "Restock promise.", false],
  ["ecomm.out_of_stock_1", "Out of Stock", "notify_me", "Out of stock", "⊘", "Disabled by default; ask for notify-me.", true]
];

for (const [id, name, role, label, glyph, pitch, disabled] of ECOMM_SPECS) {
  const reg = makeEcomm(id, name, role, label, glyph, pitch, disabled);
  REGS[id] = reg;
  buttonRegistry.register(reg);
}
