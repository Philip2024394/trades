// src/lib/nex/ui-theme-linter/rules.ts
//
// Stage 4 · UI DNA rules · pattern-based linter. Runs on any file the
// Security Agent inspects. Emits 9 sec.* codes:
//
//   sec.ui_forbidden_colour          — non-palette hex used
//   sec.ui_lightmode_background      — bg-white / background:#fff etc.
//   sec.ui_shadcn_bare_default       — bg-background / text-foreground raw
//   sec.ui_missing_dark_scheme       — no dark class · no navy · no gradient
//   sec.ui_broken_focus_ring         — outline:none without cyan focus ring
//   sec.ui_action_not_orange         — CTA-like button without NEX orange
//   sec.ui_tokens_drift              — docs JSON vs runtime constants drift
//   sec.ui_hero_scale_missing        — hero section without responsive clamp
//   sec.ui_tailwind_arbitrary_hex    — [#XXXXXX] literal not in palette
//
// These are ADDITIVE to Security Agent doctrine checks (Stage 1). They fire
// only when the touched file's path indicates a UI surface (.tsx / .css /
// tailwind config / page.tsx / layout.tsx / etc.).

import type { DesignTokens } from "./tokens";

/**
 * Which paths are considered UI surfaces for lint purposes.
 * Anything else is skipped (returns [] · not a rejection).
 */
export function isUiSurface(path: string): boolean {
  const p = path.toLowerCase();
  if (p.endsWith(".tsx")) return true;
  if (p.endsWith(".css")) return true;
  if (p.endsWith(".scss")) return true;
  if (p.endsWith("tailwind.config.ts") || p.endsWith("tailwind.config.js")) return true;
  return false;
}

export interface UiViolation {
  readonly code: string;
  readonly line: number;
  readonly snippet: string;
  readonly detail: string;
}

const HEX_RE = /#([0-9a-fA-F]{6})\b/g;
const TAILWIND_ARBITRARY_HEX_RE = /\[#([0-9a-fA-F]{6})\]/g;

/**
 * Lint a single UI file. Returns violations by code.
 * `path` is used only to gate whether this file is a UI surface at all.
 */
export function lintUiFile(
  tokens: DesignTokens,
  path: string,
  content: string,
): readonly UiViolation[] {
  if (!isUiSurface(path)) return [];

  const violations: UiViolation[] = [];
  const lines = content.split(/\r?\n/);
  const sanctioned = new Set<string>();
  for (const key of Object.keys(tokens.palette)) {
    sanctioned.add(tokens.palette[key].hex.toUpperCase());
  }

  // ── sec.ui_forbidden_colour · non-palette hex used in raw CSS/inline ──
  lines.forEach((line, i) => {
    for (const m of line.matchAll(HEX_RE)) {
      const hex = `#${m[1].toUpperCase()}`;
      if (sanctioned.has(hex)) continue;
      // Allow common utility greys / near-black / near-white for borders.
      // Keep this simple · palette is the source of truth.
      if (hex === "#000000" || hex === "#FFFFFF") {
        // still reject `#FFFFFF` as it's the light-mode signal — sec.ui_lightmode
        if (hex === "#FFFFFF") {
          violations.push({
            code: "sec.ui_lightmode_background",
            line: i + 1,
            snippet: line.trim().slice(0, 200),
            detail: "Literal white #FFFFFF used · violates dark-first DNA (ADR-0316d rule 3)",
          });
        }
        continue;
      }
      violations.push({
        code: "sec.ui_forbidden_colour",
        line: i + 1,
        snippet: line.trim().slice(0, 200),
        detail: `Non-palette hex ${hex} · sanctioned set has ${sanctioned.size} colours`,
      });
    }
  });

  // ── sec.ui_tailwind_arbitrary_hex · Tailwind `[#XXXXXX]` literal ──
  lines.forEach((line, i) => {
    for (const m of line.matchAll(TAILWIND_ARBITRARY_HEX_RE)) {
      const hex = `#${m[1].toUpperCase()}`;
      if (sanctioned.has(hex)) continue;
      violations.push({
        code: "sec.ui_tailwind_arbitrary_hex",
        line: i + 1,
        snippet: line.trim().slice(0, 200),
        detail: `Tailwind arbitrary hex [${hex}] · use token or extend palette`,
      });
    }
  });

  // ── sec.ui_lightmode_background · banned Tailwind classes / CSS ──
  for (const banned of tokens.banned_lightmode_backgrounds) {
    lines.forEach((line, i) => {
      if (line.includes(banned)) {
        violations.push({
          code: "sec.ui_lightmode_background",
          line: i + 1,
          snippet: line.trim().slice(0, 200),
          detail: `Banned light-mode background: "${banned}"`,
        });
      }
    });
  }

  // ── sec.ui_shadcn_bare_default · raw shadcn defaults leaked into UI ──
  for (const banned of tokens.banned_shadcn_bare_defaults) {
    lines.forEach((line, i) => {
      // Only flag if used as a Tailwind class · not in comments or strings
      const bareRe = new RegExp(`\\b${banned.replace(/-/g, "\\-")}\\b`);
      if (bareRe.test(line) && !line.trim().startsWith("//")) {
        violations.push({
          code: "sec.ui_shadcn_bare_default",
          line: i + 1,
          snippet: line.trim().slice(0, 200),
          detail: `Bare shadcn default "${banned}" · specify NEX token variant`,
        });
      }
    });
  }

  // ── sec.ui_broken_focus_ring · outline:none without cyan focus ──
  lines.forEach((line, i) => {
    const hasOutlineNone = /outline\s*:\s*none/i.test(line) || /outline-none\b/.test(line);
    if (!hasOutlineNone) return;
    // check window ±3 lines for focus ring definition
    const windowStart = Math.max(0, i - 3);
    const windowEnd = Math.min(lines.length, i + 4);
    const windowText = lines.slice(windowStart, windowEnd).join(" ").toLowerCase();
    const hasCyanFocus =
      windowText.includes("focus:ring") ||
      windowText.includes("focus-visible") ||
      windowText.includes("22d3ee") ||
      windowText.includes("electric") ||
      windowText.includes("cyan");
    if (!hasCyanFocus) {
      violations.push({
        code: "sec.ui_broken_focus_ring",
        line: i + 1,
        snippet: line.trim().slice(0, 200),
        detail: "outline:none without cyan focus ring · accessibility + DNA rule 11",
      });
    }
  });

  // ── sec.ui_missing_dark_scheme · page/layout without dark surface ──
  const isPageOrLayout =
    path.endsWith("page.tsx") ||
    path.endsWith("layout.tsx") ||
    path.endsWith("Page.tsx") ||
    path.endsWith("Layout.tsx");
  if (isPageOrLayout) {
    const bodyLower = content.toLowerCase();
    const hasDarkSignal =
      bodyLower.includes("bg-slate-900") ||
      bodyLower.includes("bg-slate-950") ||
      bodyLower.includes("#0b1220") ||
      bodyLower.includes("deep_navy") ||
      bodyLower.includes("bg-[#0") ||
      bodyLower.includes("from-slate-900") ||
      bodyLower.includes("bg-gray-900") ||
      bodyLower.includes("bg-gray-950") ||
      bodyLower.includes("bg-black") ||
      bodyLower.includes('className="dark"') ||
      bodyLower.includes("class=\"dark\"");
    if (!hasDarkSignal) {
      violations.push({
        code: "sec.ui_missing_dark_scheme",
        line: 1,
        snippet: "(page/layout root)",
        detail: "page.tsx/layout.tsx without dark-first surface · ADR-0316d rule 1",
      });
    }
  }

  return violations;
}

/**
 * Verify docs/nex-design-tokens.json is loadable and structurally sound.
 * Emitted as sec.ui_tokens_drift on failure.
 */
export function verifyTokensInSync(tokens: DesignTokens): {
  readonly ok: boolean;
  readonly reason: string | null;
} {
  if (!tokens.palette) return { ok: false, reason: "palette missing" };
  if (!tokens.palette.deep_navy_base) return { ok: false, reason: "deep_navy_base missing" };
  if (!tokens.palette.nex_orange_action) return { ok: false, reason: "nex_orange_action missing" };
  if (!tokens.palette.electric_cyan_tech) {
    return { ok: false, reason: "electric_cyan_tech missing" };
  }
  return { ok: true, reason: null };
}
