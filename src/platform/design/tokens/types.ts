// Design Token Registry — types.
//
// Constitution v1 Amendment 1: "The token system is the backbone of
// the Design System. Every component consumes tokens. Never hard-code
// values."
//
// A DesignToken is a single named value with a category, a semantic
// role, and a runtime value. Tokens are addressed by dotted path
// (`color.primary`, `spacing.md`, `shadow.lg`) and are consumed by
// components via `useDesignTheme()` or the shared `resolveToken()`
// helper.

export type TokenCategory =
  | "color"
  | "typography"
  | "spacing"
  | "sizing"
  | "radius"
  | "border"
  | "shadow"
  | "opacity"
  | "motion"
  | "transition"
  | "z-index"
  | "icon"
  | "illustration"
  | "image"
  | "breakpoint"
  | "gradient"
  | "pattern";

export type TokenValueKind = "string" | "number" | "url";

export type DesignToken = {
  /** Dotted path — `color.primary`, `spacing.md`. Must be lowercase. */
  path: string;
  category: TokenCategory;
  /** Runtime value. Types allowed: string (CSS values, URLs, gradients),
   *  number (px sizes, unitless scales). */
  value: string | number;
  valueKind: TokenValueKind;
  /** Human description — what a merchant sees in the token picker. */
  description?: string;
  /** Semantic role hint — free-text. Used by AI when choosing tokens
   *  for a specific purpose (e.g. "callout background"). */
  role?: string;
  /** True if this token is authored by a merchant brand override
   *  rather than the platform default. */
  brandOverride?: boolean;
};

/** A named set of tokens applied together — a theme. The registry
 *  holds `DesignTokenSet`s and each set can be activated at render. */
export type DesignTokenSet = {
  id: string;
  name: string;
  description: string;
  version: string;
  tokens: DesignToken[];
};
