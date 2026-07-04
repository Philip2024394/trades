// Button conversion score engine.
//
// Six sub-scores (0–100 each), combined into a headline 0–100. Pure,
// deterministic, dependency-free — safe to run per render + across CI.
//
// Sub-scores:
//   1. contrast     — WCAG ratio ink vs background
//   2. visibility   — size × padding × role priority × surface distinction
//   3. copy         — verb-first, short, active, no marketing fluff
//   4. a11y         — aria-label, tap target, activate-on-space, focus
//   5. mobile       — same rules at mobile breakpoint
//   6. performance  — animation cost + shadow layers + background weight
//
// Every failure carries a `fix` string — the "Fix top issue" affordance
// in the toolbar reads the LOWEST-scoring axis's `fix`.

import {
  contrastRatioOf,
  meetsContrast
} from "../contrast/autoTune";
import type {
  ButtonRegistration,
  ButtonSize,
  ButtonState,
  MotionSpec
} from "../types";

// ─── Public API ─────────────────────────────────────────────

export type ButtonScoreAxis =
  | "contrast"
  | "visibility"
  | "copy"
  | "a11y"
  | "mobile"
  | "performance";

export type AxisResult = {
  axis: ButtonScoreAxis;
  score: number; // 0-100
  passed: boolean;
  reason: string;
  fix: string | null;
};

export type ButtonScoreResult = {
  headline: number; // weighted 0-100
  tier: "green" | "amber" | "red";
  axes: AxisResult[];
  worst: AxisResult | null;
};

export type ScoreInput = {
  registration: Pick<
    ButtonRegistration,
    "role" | "states" | "conversionHints" | "motion" | "a11y" | "size" | "editableFields"
  >;
  config: Record<string, unknown>;
  /** The surface colour the button sits on. If unknown, pass the brand
   *  surface token — the score falls back to a neutral pass. */
  surfaceBehind: string;
  /** Resolved ink/background for the default state — passed in so the
   *  engine doesn't re-run themeAdapter for a signature it already has. */
  resolvedInk: string;
  resolvedBackground: string;
  /** Concrete pixel height of the button as rendered. */
  heightPx: number;
  /** True if the button is above the fold on its host page. Rendered
   *  from a heuristic in Studio (first section). */
  aboveFold: boolean;
  mode: "desktop" | "mobile";
};

export function scoreButton(input: ScoreInput): ButtonScoreResult {
  const axes: AxisResult[] = [
    scoreContrast(input),
    scoreVisibility(input),
    scoreCopy(input),
    scoreA11y(input),
    scoreMobile(input),
    scorePerformance(input)
  ];
  // Weighting: contrast + a11y + copy are load-bearing for conversion +
  // WCAG. Visibility, mobile, performance are important but secondary.
  const weights: Record<ButtonScoreAxis, number> = {
    contrast: 0.2,
    visibility: 0.15,
    copy: 0.2,
    a11y: 0.2,
    mobile: 0.15,
    performance: 0.1
  };
  let headline = 0;
  for (const a of axes) headline += a.score * weights[a.axis];
  headline = Math.round(headline);
  const tier = headline >= 85 ? "green" : headline >= 70 ? "amber" : "red";
  const worst = [...axes]
    .filter((a) => !a.passed)
    .sort((a, b) => a.score - b.score)[0] ?? null;
  return { headline, tier, axes, worst };
}

// ─── Individual axes ─────────────────────────────────────────

function scoreContrast(i: ScoreInput): AxisResult {
  const target = i.registration.conversionHints.minContrast;
  const ratio = contrastRatioOf(i.resolvedInk, i.resolvedBackground);
  const score = Math.max(
    0,
    Math.min(100, Math.round(((ratio - 1) / (target - 1)) * 100))
  );
  const passed = ratio >= target;
  return {
    axis: "contrast",
    score: passed ? Math.max(85, score) : score,
    passed,
    reason: `Ink vs background ratio ${ratio.toFixed(2)}:1 (target ${target}:1).`,
    fix: passed ? null : "Tune ink toward pure black or pure white; the auto-tuner can do it in one tap."
  };
}

function scoreVisibility(i: ScoreInput): AxisResult {
  const contrastVsSurface = contrastRatioOf(
    i.resolvedBackground,
    i.surfaceBehind
  );
  const isPrimary = i.registration.conversionHints.primaryActionRecommended;
  const idealHeight = isPrimary ? 52 : 44;
  const heightScore =
    i.heightPx >= idealHeight
      ? 100
      : Math.max(0, Math.round((i.heightPx / idealHeight) * 100));
  // Distinction vs surface — a primary should stand out more.
  const distinctScore = Math.min(
    100,
    Math.round((contrastVsSurface - 1) * 25)
  );
  const score = Math.round((heightScore + distinctScore) / 2);
  const passed = score >= 70;
  const short =
    heightScore < 100
      ? `Under recommended ${idealHeight}px height for a ${isPrimary ? "primary" : "supporting"} action.`
      : "";
  return {
    axis: "visibility",
    score,
    passed,
    reason:
      `Height ${i.heightPx}px, distinction vs page surface ${contrastVsSurface.toFixed(2)}:1.` +
      (short ? ` ${short}` : ""),
    fix: passed
      ? null
      : isPrimary
        ? "Bump size to lg or adjust background so it stands off the page."
        : "Grow to md; contrast vs. surface can stay subtle."
  };
}

function scoreCopy(i: ScoreInput): AxisResult {
  const labelField = i.registration.editableFields.find(
    (f) => f.key === "label" || f.role?.endsWith("_action_label") || f.role === "cta_book" || f.role === "cta_whatsapp"
  );
  const label =
    (labelField ? (i.config[labelField.key] as string | undefined) : undefined) ||
    "";
  const trimmed = label.trim();
  if (!trimmed) {
    return {
      axis: "copy",
      score: 0,
      passed: false,
      reason: "Label is empty.",
      fix: "Add a 2–4 word action label ('Book my slot', 'Get a quote')."
    };
  }
  const words = trimmed.split(/\s+/);
  const isVerbFirst = /^(book|buy|call|get|hire|message|order|save|see|shop|start|talk|try|watch|read|join|download|contact|explore|discover|check|compare|preorder|reserve|schedule)/i.test(
    words[0]
  );
  const tooLong = words.length > 5;
  const isUppercaseWord = words.every((w) => w === w.toUpperCase());
  let score = 60;
  if (isVerbFirst) score += 20;
  if (!tooLong) score += 15;
  if (!/please|kindly|maybe/i.test(trimmed)) score += 5;
  // Penalise weak wording
  if (/click here|read more|find out/i.test(trimmed)) score -= 20;
  score = Math.max(0, Math.min(100, score));
  const passed = score >= 70;
  const fixes: string[] = [];
  if (!isVerbFirst) fixes.push("Start with a verb.");
  if (tooLong) fixes.push("Cut to 2–4 words.");
  if (isUppercaseWord && words.length > 2) fixes.push("Lowercase the middle words.");
  return {
    axis: "copy",
    score,
    passed,
    reason: isVerbFirst
      ? "Verb-first, action-oriented."
      : "Missing a strong verb up front.",
    fix: fixes.length > 0 ? fixes.join(" ") : null
  };
}

function scoreA11y(i: ScoreInput): AxisResult {
  const label =
    (i.config.label as string | undefined) ||
    (i.config.ariaLabel as string | undefined) ||
    "";
  const missingLabel = !label.trim();
  const belowTap = i.heightPx < i.registration.conversionHints.minTapTargetPx;
  let score = 100;
  if (missingLabel) score -= 40;
  if (belowTap) score -= 30;
  if (!i.registration.a11y.activateOnSpace && i.registration.a11y.role === "button") score -= 15;
  score = Math.max(0, Math.min(100, score));
  const passed = score >= 80;
  const fixes: string[] = [];
  if (missingLabel) fixes.push("Add an accessible label.");
  if (belowTap) fixes.push(`Grow to ${i.registration.conversionHints.minTapTargetPx}px minimum.`);
  return {
    axis: "a11y",
    score,
    passed,
    reason: `Tap ${i.heightPx}px vs ${i.registration.conversionHints.minTapTargetPx}px min; label ${missingLabel ? "missing" : "set"}.`,
    fix: fixes.length > 0 ? fixes.join(" ") : null
  };
}

function scoreMobile(i: ScoreInput): AxisResult {
  // Mobile-scored buttons need larger touch, tighter copy, and enough
  // contrast against a mobile viewport. We approximate by re-checking
  // contrast + tap on the mobile mode.
  const contrastOk = meetsContrast(
    i.resolvedInk,
    i.resolvedBackground,
    Math.max(3, i.registration.conversionHints.minContrast - 0.5)
  );
  const tapOk = i.heightPx >= 44;
  let score = 100;
  if (!contrastOk) score -= 30;
  if (!tapOk) score -= 30;
  if (i.mode === "mobile" && !i.aboveFold && i.registration.conversionHints.aboveFoldRecommended) {
    score -= 20;
  }
  score = Math.max(0, Math.min(100, score));
  const passed = score >= 75;
  return {
    axis: "mobile",
    score,
    passed,
    reason: "Mobile viewport, breakpoint-adjusted check.",
    fix: passed ? null : "Grow height on mobile, tighten label, ensure above-the-fold on hero pages."
  };
}

function scorePerformance(i: ScoreInput): AxisResult {
  const motion = i.registration.motion;
  let animationCost = 0;
  const motionKeys: (keyof MotionSpec)[] = ["entrance", "hover", "focus", "press", "loading", "success", "error", "idle"];
  for (const k of motionKeys) {
    const preset = motion[k];
    if (!preset || preset === "none") continue;
    animationCost += motionCostOf(preset);
  }
  let score = 100 - animationCost;
  score = Math.max(0, Math.min(100, score));
  const passed = score >= 80;
  return {
    axis: "performance",
    score,
    passed,
    reason: `Motion cost ${animationCost}/100 (heavier presets → lower score).`,
    fix: passed
      ? null
      : "Drop 'ripple', 'liquid_fill', or particle-heavy presets on entry-level tiers."
  };
}

// ─── Motion cost table ─────────────────────────────────────

function motionCostOf(preset: string): number {
  // Rough approximation. Not a benchmark — a directional signal so
  // merchants avoid piling heavy presets on every state.
  const heavy = new Set([
    "liquid_fill",
    "morph",
    "wave",
    "spotlight",
    "ripple",
    "gradient_shift",
    "flip",
    "border_draw",
    "mouse_follow"
  ]);
  const medium = new Set([
    "magnetic",
    "pulse",
    "bounce",
    "rotate",
    "stretch",
    "arrow_reveal",
    "icon_slide",
    "underline_grow"
  ]);
  if (heavy.has(preset)) return 10;
  if (medium.has(preset)) return 4;
  return 1;
}

// ─── Convenience for `size` → pixel height (independent of theme) ─

export function heightPxFor(size: ButtonSize): number {
  if (typeof size === "object") return size.customPx;
  return { xs: 28, sm: 36, md: 44, lg: 52, xl: 60 }[size];
}

/** Suggested next state to score-test (used by the toolbar's state
 *  preview). Just a convenience — the engine scores `default` by
 *  default; call scoreButton again with `state: "hover"` to preview. */
export function nextStateFor(current: ButtonState): ButtonState {
  const order: ButtonState[] = [
    "default", "hover", "focus_visible", "pressed", "loading", "success", "error", "disabled"
  ];
  const i = order.indexOf(current);
  return order[(i + 1) % order.length];
}
