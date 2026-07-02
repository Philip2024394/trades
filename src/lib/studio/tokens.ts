// Studio design tokens — client-safe constants + validation.
//
// This file MUST NOT import `server-only` modules — it's used from
// BrandTokensEditor (client) AND from the server preview loader.
// The DB fetch lives in `tokensLoader.ts` (server-only).
//
// The token model is a flat `Record<string, unknown>` keyed by
// `"{kind}.{key}"` — the same shape `BrandTokens` renderers already
// consume via `tokens["color.accent"]`.

import type { BrandTokens } from "./sectionTypes";

// ─── Default token set ─────────────────────────────────────────

export const DEFAULT_TOKENS: BrandTokens = {
  // Colours
  "color.primary": "#0A0A0A",
  "color.secondary": "#404040",
  "color.accent": "#FFB300",
  "color.surface": "#FFFFFF",
  "color.text": "#0A0A0A",
  "color.muted": "#737373",
  "color.danger": "#DC2626",
  "color.success": "#10B981",

  // Fonts — CSS font-family strings.
  "font.heading":
    "system-ui, -apple-system, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
  "font.body":
    "system-ui, -apple-system, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
  // Font weights — CSS font-weight values (100 to 900). Used for
  // per-instance typography overrides in Module 6's typography modal
  // AND as brand-wide defaults in the Global panel.
  "font.heading.weight": 800,
  "font.body.weight": 500,

  // Radius (px)
  "radius.none": 0,
  "radius.sm": 4,
  "radius.md": 8,
  "radius.lg": 16,
  "radius.xl": 24,
  "radius.full": 999,

  // Spacing (px)
  "spacing.xs": 4,
  "spacing.sm": 8,
  "spacing.md": 16,
  "spacing.lg": 24,
  "spacing.xl": 32,
  "spacing.2xl": 48
};

// ─── Groupings for the editor UI ───────────────────────────────

export type TokenKind = "color" | "radius" | "spacing" | "font";

export const TOKEN_GROUPS: {
  kind: TokenKind;
  label: string;
  description: string;
  keys: string[];
}[] = [
  {
    kind: "color",
    label: "Colours",
    description:
      "Change once, every button / heading / card that binds to a colour repaints.",
    keys: [
      "primary",
      "secondary",
      "accent",
      "surface",
      "text",
      "muted",
      "danger",
      "success"
    ]
  },
  {
    kind: "radius",
    label: "Corner radius",
    description: "Roundness for cards, buttons, images, and rims.",
    keys: ["none", "sm", "md", "lg", "xl", "full"]
  },
  {
    kind: "spacing",
    label: "Spacing scale",
    description: "The steps used for padding, margin, and gaps.",
    keys: ["xs", "sm", "md", "lg", "xl", "2xl"]
  },
  {
    kind: "font",
    label: "Fonts",
    description: "System-safe stacks by default. Paste a Google font stack to swap.",
    keys: ["heading", "body"]
  }
];

// ─── Merge / validation ────────────────────────────────────────

export function mergeTokens(
  defaults: BrandTokens,
  rows: { kind: string; key: string; value_json: unknown }[]
): BrandTokens {
  const out: BrandTokens = { ...defaults };
  for (const row of rows) {
    out[`${row.kind}.${row.key}`] = row.value_json;
  }
  return out;
}

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function isValidTokenKind(v: unknown): v is TokenKind {
  return v === "color" || v === "radius" || v === "spacing" || v === "font";
}

export function isValidTokenValue(kind: TokenKind, value: unknown): boolean {
  if (kind === "color") {
    return typeof value === "string" && HEX_RE.test(value);
  }
  if (kind === "radius" || kind === "spacing") {
    return typeof value === "number" && value >= 0 && value < 1000;
  }
  if (kind === "font") {
    return typeof value === "string" && value.length > 0 && value.length < 500;
  }
  return false;
}
