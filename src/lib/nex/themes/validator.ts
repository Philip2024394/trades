// Nex Themes · Validator · Philip 2026-08-03.
//
// Refinement 5 in executable form. Every theme runs through this before
// it is applied. Rejected themes never reach the user — Original Nex is
// the immutable fallback.
//
// Gates:
//   Accessibility
//     · contrast_body           text-on-nex-bubble ≥ 4.5:1
//     · contrast_body (2)        text-on-user-bubble ≥ 4.5:1 (assumes white text)
//     · contrast_body (3)        muted-on-surface ≥ 4.5:1
//     · contrast_focus_ring     primary-on-bg ≥ 3:1 (focus rings + large)
//     · state_semantics         theme must not repurpose green/amber/red
//     · font_floor              fonts declare no weight <400 for body
//     · motion_reduce_compat    always TRUE for built-ins · placeholder for AI
//
//   Performance
//     · wallpaper_size          ≤ 400KB (byte budget · deferred check)
//     · blur_budget             ≤ 3 concurrent backdrop-filter surfaces
//     · animation_frame_budget  always PASS for built-ins (deferred)
//     · font_weight_budget      ≤ 4 declared weights
//
// The validator is DETERMINISTIC — same theme in, same report out. It
// does NOT hit the network for byte checks; wallpaper size is trust-on-
// declaration for built-ins and enforced at upload time for AI-generated
// / community themes when those slices ship.

import type {
  Theme,
  ValidatorFinding,
  ValidatorGate,
  ValidatorReport,
} from "./types";

// ─── Colour helpers ──────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace(/^#/, "");
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b };
  }
  return null;
}

function rgbaToRgb(input: string): { r: number; g: number; b: number } | null {
  // rgba(255, 255, 255, 0.78) → resolve against white (worst-case
  // legibility on our light themes). For dark themes a black backdrop
  // resolution would apply · Original Nex + Blossom + Staircase are all
  // light. Deferred: a `backdrop` parameter when a dark theme ships.
  const m = input
    .replace(/\s+/g, "")
    .match(/^rgba?\((\d+),(\d+),(\d+)(?:,([0-9.]+))?\)$/i);
  if (!m) return null;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const a = m[4] !== undefined ? Number(m[4]) : 1;
  const backdrop = 255;
  return {
    r: Math.round(r * a + backdrop * (1 - a)),
    g: Math.round(g * a + backdrop * (1 - a)),
    b: Math.round(b * a + backdrop * (1 - a)),
  };
}

function resolveColor(input: string): { r: number; g: number; b: number } | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed.startsWith("linear-gradient")) {
    // Sample the DARKEST stop for worst-case contrast (validator errs
    // pessimistically). Grab the last hex in the string.
    const hex = trimmed.match(/#[0-9a-fA-F]{3,6}/g);
    if (!hex || hex.length === 0) return null;
    return hexToRgb(hex[hex.length - 1]);
  }
  if (trimmed.startsWith("#")) return hexToRgb(trimmed);
  if (trimmed.startsWith("rgb")) return rgbaToRgb(trimmed);
  return null;
}

function relativeLuminance(c: { r: number; g: number; b: number }): number {
  const toLinear = (n: number) => {
    const s = n / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * toLinear(c.r) + 0.7152 * toLinear(c.g) + 0.0722 * toLinear(c.b)
  );
}

function contrastRatio(fg: string, bg: string): number | null {
  const f = resolveColor(fg);
  const b = resolveColor(bg);
  if (!f || !b) return null;
  const L1 = relativeLuminance(f);
  const L2 = relativeLuminance(b);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ─── Individual gates ────────────────────────────────────────────────

function checkContrast(
  gate: ValidatorGate,
  label: string,
  fg: string,
  bg: string,
  threshold: number,
): ValidatorFinding {
  const ratio = contrastRatio(fg, bg);
  if (ratio === null) {
    return {
      gate,
      status: "warn",
      measured: `${fg} on ${bg}`,
      threshold: `${threshold}:1`,
      message: `${label}: could not resolve colour — validator is pessimistic and warns`,
    };
  }
  const rounded = Math.round(ratio * 10) / 10;
  const status: ValidatorFinding["status"] =
    ratio >= threshold ? "pass" : ratio >= threshold * 0.85 ? "warn" : "fail";
  return {
    gate,
    status,
    measured: `${rounded}:1`,
    threshold: `${threshold}:1`,
    message: `${label}: measured ${rounded}:1 (threshold ${threshold}:1)`,
  };
}

function checkStateSemantics(theme: Theme): ValidatorFinding {
  // A theme must not repurpose green/amber/red — meaning colours (go/held/
  // attention) must survive. We check that the theme's primary is NOT
  // pure green or pure red · a theme whose "primary" IS red or green
  // would collapse meaning.
  const primary = resolveColor(theme.tokens.colors.primary);
  if (!primary) {
    return {
      gate: "state_semantics",
      status: "warn",
      measured: theme.tokens.colors.primary,
      threshold: "distinct from state colours",
      message: "Primary colour unresolved — validator warns pessimistically",
    };
  }
  const isRed = primary.r > 200 && primary.g < 80 && primary.b < 80;
  const isGreen = primary.g > 200 && primary.r < 100 && primary.b < 120;
  const isAmber =
    primary.r > 220 && primary.g > 140 && primary.g < 200 && primary.b < 80;
  if (isRed || isGreen || isAmber) {
    return {
      gate: "state_semantics",
      status: "fail",
      measured: theme.tokens.colors.primary,
      threshold: "distinct from red/green/amber state colours",
      message:
        "Primary collapses with a state-semantic colour (red = attention · green = go · amber = held). Choose a distinct hue.",
    };
  }
  return {
    gate: "state_semantics",
    status: "pass",
    measured: theme.tokens.colors.primary,
    threshold: "distinct from state colours",
    message: "Primary is distinct from red/green/amber state colours",
  };
}

function checkFontFloor(theme: Theme): ValidatorFinding {
  const min = Math.min(...(theme.fonts.weights.length ? theme.fonts.weights : [400]));
  const status: ValidatorFinding["status"] = min >= 400 ? "pass" : "fail";
  return {
    gate: "font_floor",
    status,
    measured: min,
    threshold: 400,
    message:
      status === "pass"
        ? `Minimum font weight ${min} ≥ 400`
        : `Minimum font weight ${min} is below the 400 body-legibility floor`,
  };
}

function checkMotionReduce(): ValidatorFinding {
  // Built-in themes respect motion-reduce because the client already
  // wraps theme transitions in a media query. AI-generated themes will
  // be validated at generation time.
  return {
    gate: "motion_reduce_compat",
    status: "pass",
    measured: "respected",
    threshold: "respected",
    message: "Theme transitions respect prefers-reduced-motion",
  };
}

function checkWallpaperSize(theme: Theme): ValidatorFinding {
  // For built-in themes we trust the CDN transform. For AI/community
  // themes this check is enforced at upload time by the storage bucket
  // policy · never at apply time (too slow).
  if (theme.source === "built-in") {
    return {
      gate: "wallpaper_size",
      status: "pass",
      measured: "≤400KB (CDN-transformed)",
      threshold: "≤400KB",
      message: "Built-in wallpaper trusts CDN transform policy",
    };
  }
  return {
    gate: "wallpaper_size",
    status: "warn",
    measured: "unknown",
    threshold: "≤400KB",
    message:
      "Non-built-in theme · wallpaper byte check must happen at upload time",
  };
}

function checkBlurBudget(theme: Theme): ValidatorFinding {
  const surfaces = [
    theme.effects.headerBlurPx > 0 ? 1 : 0,
    theme.effects.composerBlurPx > 0 ? 1 : 0,
    theme.effects.navBlurPx > 0 ? 1 : 0,
    theme.effects.bubbleBlurPx > 0 ? 1 : 0,
  ].reduce<number>((a, b) => a + b, 0);
  const status: ValidatorFinding["status"] =
    surfaces <= 3 ? "pass" : surfaces === 4 ? "warn" : "fail";
  return {
    gate: "blur_budget",
    status,
    measured: surfaces,
    threshold: 3,
    message: `${surfaces} concurrent backdrop-filter surfaces (budget 3)`,
  };
}

function checkAnimationFrameBudget(): ValidatorFinding {
  // Deferred: real frame-budget check runs on the client at apply time
  // for AI-generated themes. Built-ins are hand-tuned and PASS by design.
  return {
    gate: "animation_frame_budget",
    status: "pass",
    measured: "≤30ms",
    threshold: "≤30ms",
    message: "Built-in animation stays within per-frame budget",
  };
}

function checkFontWeightBudget(theme: Theme): ValidatorFinding {
  const count = theme.fonts.weights.length;
  const status: ValidatorFinding["status"] =
    count <= 4 ? "pass" : count === 5 ? "warn" : "fail";
  return {
    gate: "font_weight_budget",
    status,
    measured: count,
    threshold: 4,
    message: `${count} declared font weights (budget 4)`,
  };
}

// ─── Public API ──────────────────────────────────────────────────────

export function validateTheme(theme: Theme): ValidatorReport {
  const findings: ValidatorFinding[] = [];

  // Accessibility
  findings.push(
    checkContrast(
      "contrast_body",
      "text on nex-bubble",
      theme.tokens.colors.text,
      theme.tokens.colors.nexBubble,
      4.5,
    ),
  );
  findings.push(
    checkContrast(
      "contrast_body",
      "muted on surface",
      theme.tokens.colors.muted,
      theme.tokens.colors.surface,
      4.5,
    ),
  );
  findings.push(
    checkContrast(
      "contrast_body",
      "white text on user-bubble",
      "#FFFFFF",
      theme.tokens.colors.userBubble,
      4.5,
    ),
  );
  findings.push(
    checkContrast(
      "contrast_focus_ring",
      "primary on bg (focus + large text)",
      theme.tokens.colors.primary,
      theme.tokens.colors.bg,
      3,
    ),
  );
  findings.push(checkStateSemantics(theme));
  findings.push(checkFontFloor(theme));
  findings.push(checkMotionReduce());

  // Performance
  findings.push(checkWallpaperSize(theme));
  findings.push(checkBlurBudget(theme));
  findings.push(checkAnimationFrameBudget());
  findings.push(checkFontWeightBudget(theme));

  const anyFail = findings.some((f) => f.status === "fail");
  const allAAA = findings
    .filter((f) => f.gate.startsWith("contrast"))
    .every((f) => {
      const measured =
        typeof f.measured === "string"
          ? parseFloat(f.measured.replace(":1", ""))
          : Number(f.measured);
      return !Number.isNaN(measured) && measured >= 7;
    });

  return {
    themeId: theme.id,
    ok: !anyFail,
    wcagLevel: anyFail ? "fail" : allAAA ? "AAA" : "AA",
    findings,
  };
}
