"use client";

// Marketing pack — Buy Now, Book Now, Contact, Download, Subscribe,
// Join Today, Get Started, Learn More, Call, Email.
//
// Every variant has role annotations so smartSwap carries label + href.

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

type BasicCta = { label: string; href: string };

function makeCta(
  id: string,
  name: string,
  role: ButtonRole,
  defaultLabel: string,
  defaultHref: string,
  glyph: string,
  shortPitch: string
): ButtonRegistration<BasicCta> {
  return {
    id,
    name,
    version: "1.0.0",
    category: "marketing",
    role,
    description: `${name} CTA — verb-first, on-brand, ready to drop in.`,
    shortPitch,
    editableFields: [
      { key: "label", label: "Label", type: { kind: "text", maxLength: 32 }, default: defaultLabel, role: "primary_action_label", priority: "text", aiPromptable: true, group: "Content" },
      { key: "href", label: "Link", type: { kind: "link" }, default: defaultHref, role: "primary_action_href", group: "Content" }
    ],
    states: {
      default: { backgroundToken: "color.accent", inkLiteral: "#0A0A0A", shadowPreset: "soft" },
      hover: { translateYPx: -1, shadowPreset: "floating" },
      focus_visible: { shadowPreset: "glow" },
      pressed: { scale: 0.98 },
      disabled: { opacity: 0.4 }
    },
    motion: { hover: "lift", press: "shrink", focus: "glow" },
    shape: { kind: "rect", radiusPx: 12 },
    size: "md",
    themeTokensUsed: ["color.accent"],
    a11y: {
      ariaLabelFor: (c) => (c.label as string) || name,
      role: "link",
      activateOnSpace: false
    },
    telemetry: { eventOnClick: `cta.${role}`, payloadKeys: ["href"] },
    conversionHints: {
      primaryActionRecommended: true,
      aboveFoldRecommended: true,
      minContrast: 4.5,
      minTapTargetPx: 44
    },
    aiPrompts: {
      explain: `Explain when a ${name} CTA is the highest-converting action.`,
      improveCopy: "Rewrite label into 2-4 words, verb-first, personal ('my') if possible.",
      improveStyle: "Suggest a subtle style tweak that keeps role clarity.",
      restyle: "Match to {mood} preset.",
      generateFromBrief: `Create a ${name} CTA for {vertical} with a strong verb.`,
      scoreConversion: "Assess verb strength, clarity, contrast.",
      scoreAccessibility: "Confirm tap target, focus outline, contrast.",
      suggestIcon: "Pick a glyph that matches the verb — no cliché."
    },
    searchKeywords: [role, name.toLowerCase(), "cta", "marketing"],
    defaultConfig: () => ({ label: defaultLabel, href: defaultHref }),
    renderer: (props) => <MarketingRenderer reg={REGS[id]} glyph={glyph} {...props} />
  };
}

function MarketingRenderer({
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
  reg: ButtonRegistration<BasicCta>;
  glyph: string;
} & ButtonRendererProps<BasicCta>) {
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
            transition: "transform 150ms ease-out, box-shadow 150ms ease-out",
            animation,
            cursor: "pointer",
            border: "none",
            ...shapeCss
          }}
        >
          <span aria-hidden="true">{glyph}</span>
          <span>{config.label}</span>
        </Link>
      )}
    </MotionScope>
  );
}

// ─── Registrations (10 marketing variants) ───────────

const REGS: Record<string, ButtonRegistration<BasicCta>> = {};

const MARKETING_SPECS: [
  string,
  string,
  ButtonRole,
  string,
  string,
  string,
  string
][] = [
  ["marketing.buy_now_1", "Buy Now", "buy_now", "Buy now", "/checkout", "🛒", "One-tap purchase intent."],
  ["marketing.contact_1", "Contact", "cta_contact", "Contact us", "/contact", "✉", "The universal reach-out."],
  ["marketing.download_1", "Download", "cta_download", "Download PDF", "/downloads", "⬇", "Guides, brochures, price lists."],
  ["marketing.subscribe_1", "Subscribe", "cta_subscribe", "Subscribe", "/newsletter", "✦", "Own the relationship, not just the visit."],
  ["marketing.join_1", "Join Today", "cta_join", "Join today", "/join", "★", "Communities, memberships, waitlists."],
  ["marketing.get_started_1", "Get Started", "primary_action", "Get started", "/start", "▸", "The universal onboarding CTA."],
  ["marketing.learn_more_1", "Learn More", "cta_learn_more", "Learn more", "/learn", "?", "The 'tell me more' link with a chip."],
  ["marketing.call_1", "Call Now", "cta_call", "Call now", "tel:+441000000000", "☎", "One-tap dial for emergency and local."],
  ["marketing.email_1", "Email", "cta_email", "Email us", "mailto:hello@example.com", "@", "Formal, low-pressure reach."],
  ["marketing.request_quote_1", "Request Quote", "cta_quote", "Request a quote", "/quote", "£", "The trade favourite."]
];

for (const [id, name, role, label, href, glyph, pitch] of MARKETING_SPECS) {
  const reg = makeCta(id, name, role, label, href, glyph, pitch);
  REGS[id] = reg;
  buttonRegistry.register(reg);
}
