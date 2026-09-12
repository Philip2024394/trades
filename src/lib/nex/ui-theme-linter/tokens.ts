// src/lib/nex/ui-theme-linter/tokens.ts
//
// Stage 4 · code-side mirror of docs/nex-design-tokens.json.
// If this drifts from the JSON, `verifyTokensInSync` reports sec.ui_tokens_drift.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface DesignTokens {
  readonly version: string;
  readonly palette: Readonly<Record<string, { readonly hex: string; readonly role: string }>>;
  readonly forbidden_hex_families: {
    readonly allow_family_prefixes: readonly string[];
  };
  readonly banned_lightmode_backgrounds: readonly string[];
  readonly banned_shadcn_bare_defaults: readonly string[];
}

let cached: DesignTokens | null = null;

export function loadDesignTokens(repoRoot?: string): DesignTokens {
  if (cached) return cached;
  const root = repoRoot ?? process.cwd();
  const path = resolve(root, "docs/nex-design-tokens.json");
  const raw = readFileSync(path, "utf8");
  cached = JSON.parse(raw) as DesignTokens;
  return cached;
}

/**
 * Set of exactly the hex codes sanctioned by the palette.
 */
export function sanctionedHexSet(tokens: DesignTokens): ReadonlySet<string> {
  const set = new Set<string>();
  for (const key of Object.keys(tokens.palette)) {
    set.add(tokens.palette[key].hex.toUpperCase());
  }
  return set;
}
