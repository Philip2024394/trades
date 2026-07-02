// Per-dimension heuristic scorers.
//
// Each function takes the section instance + its registration and
// returns { score, findings }. Deterministic, pure, side-effect free —
// easy to unit-test and reason about. AI-augmented dimensions (subtle
// design judgements) land in a later module and stack on top of these
// baselines.
//
// Scores are 0-100. Findings carry a severity + message; the modal
// groups them by dimension and highlights errors > warnings > info.

import type {
  AnySectionRegistration,
  BrandTokens,
  EditableField
} from "../sectionTypes";
import type { SectionInstance } from "../schema";
import { DEFAULT_TOKENS } from "../tokens";
import { contrastRatio, gradeContrast } from "./contrast";
import type { ScoreFinding } from "./types";

type Result = { score: number; findings: ScoreFinding[] };

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function fieldOf(reg: AnySectionRegistration, key: string): EditableField | undefined {
  return reg.editableFields.find((f) => f.key === key);
}

// ─── Loading ────────────────────────────────────────────────

export function scoreLoading(
  instance: SectionInstance,
  reg: AnySectionRegistration
): Result {
  const findings: ScoreFinding[] = [];
  let score = 100;

  const hints = reg.scoreHints?.loading;

  // Every image field populated adds "weight" to the page. We can't
  // measure real bytes without fetching, so we approximate: each
  // populated image incurs a small deduction if the aggregate exceeds
  // the registration's budget.
  const imageFields = reg.editableFields.filter((f) => f.type.kind === "image");
  const populatedImages = imageFields.filter(
    (f) => typeof instance.config[f.key] === "string" && instance.config[f.key] !== ""
  );

  if (hints?.imageWeightBudgetKb === 0 && populatedImages.length > 0) {
    findings.push({
      dimension: "loading",
      severity: "warn",
      message: "This section shouldn't carry image weight — remove images or move to a photo-heavy variant."
    });
    score -= 20;
  } else if (
    hints?.imageWeightBudgetKb &&
    populatedImages.length > 0
  ) {
    // Rough: each image costs ~1/6 of the budget (assuming compressed
    // JPEG). Section is fine at budget, over-budget below.
    const perImage = hints.imageWeightBudgetKb / 6;
    const est = populatedImages.length * perImage;
    if (est > hints.imageWeightBudgetKb) {
      findings.push({
        dimension: "loading",
        severity: "info",
        message: `${populatedImages.length} images may exceed the ${hints.imageWeightBudgetKb}KB budget — compress or use WebP.`
      });
      score -= 8;
    }
  }

  if (hints?.blockingResources && hints.blockingResources.length > 0) {
    for (const res of hints.blockingResources) {
      findings.push({
        dimension: "loading",
        severity: "info",
        message: `Contains a ${res} — place below the fold and lazy-load if possible.`
      });
      score -= 3;
    }
  }

  return { score: clamp(score), findings };
}

// ─── Accessibility ─────────────────────────────────────────

export function scoreAccessibility(
  instance: SectionInstance,
  reg: AnySectionRegistration
): Result {
  const findings: ScoreFinding[] = [];
  let score = 100;

  const hints = reg.scoreHints?.accessibility;

  // Missing alt text is the most common a11y miss.
  if (hints?.requiredAlt) {
    for (const altKey of hints.requiredAlt) {
      const altValue = instance.config[altKey];
      const imageField = reg.editableFields.find(
        (f) => f.key === altKey || f.key === altKey.replace("Alt", "ImageUrl")
      );
      // Only flag if the associated image is populated.
      const relatedImageKey = altKey.endsWith("Alt")
        ? altKey.replace("Alt", "ImageUrl")
        : altKey;
      const imageIsPopulated =
        typeof instance.config[relatedImageKey] === "string" &&
        instance.config[relatedImageKey] !== "";
      if (!imageIsPopulated) continue;
      if (typeof altValue !== "string" || !altValue.trim()) {
        findings.push({
          dimension: "accessibility",
          severity: "error",
          message: `Missing alt text: ${imageField?.label ?? altKey}`,
          fieldKey: altKey
        });
        score -= 15;
      }
    }
  }

  // Contrast between the section's foreground text token and its
  // background surface. Uses per-instance overrides on top of brand
  // defaults, matching what the renderer actually uses.
  if (hints?.contrastMin) {
    const merged: BrandTokens = {
      ...DEFAULT_TOKENS,
      ...(instance.tokenOverrides ?? {})
    };
    const fg = merged["color.text"] as string | undefined;
    const bg = merged["color.surface"] as string | undefined;
    if (typeof fg === "string" && typeof bg === "string") {
      const ratio = contrastRatio(fg, bg);
      if (ratio > 0) {
        const grade = gradeContrast(ratio);
        if (ratio < hints.contrastMin) {
          findings.push({
            dimension: "accessibility",
            severity: ratio < 3 ? "error" : "warn",
            message: `Text on surface contrast is ${ratio.toFixed(2)}:1 (${fg} on ${bg}) — below the WCAG AA target of ${hints.contrastMin}:1.`
          });
          score -= ratio < 3 ? 25 : 10;
        } else if (grade === "AAA") {
          findings.push({
            dimension: "accessibility",
            severity: "info",
            message: `Text on surface contrast is ${ratio.toFixed(2)}:1 — passes WCAG AAA.`
          });
        }
      }
    }
  }

  return { score: clamp(score), findings };
}

// ─── Sales ─────────────────────────────────────────────────

export function scoreSales(
  instance: SectionInstance,
  reg: AnySectionRegistration
): Result {
  const findings: ScoreFinding[] = [];
  let score = 100;

  const hints = reg.scoreHints?.sales;

  if (hints?.primaryActionRequired) {
    const buttonFields = reg.editableFields.filter((f) => f.priority === "button");
    const populated = buttonFields.filter(
      (f) => typeof instance.config[f.key] === "string" && instance.config[f.key] !== ""
    );
    if (populated.length === 0) {
      findings.push({
        dimension: "sales",
        severity: "error",
        message: "No CTA button populated — merchant can't act."
      });
      score -= 30;
    }
  }

  if (hints?.socialProofRecommended) {
    // Fields whose key or label hints at trust / rating / reviews.
    const socialFields = reg.editableFields.filter((f) => {
      const k = f.key.toLowerCase();
      return (
        k.includes("rating") ||
        k.includes("trust") ||
        k.includes("review") ||
        k.includes("aggregate")
      );
    });
    if (socialFields.length > 0) {
      const populated = socialFields.filter(
        (f) => Boolean(instance.config[f.key])
      );
      if (populated.length === 0) {
        findings.push({
          dimension: "sales",
          severity: "warn",
          message: "Social-proof fields (rating / trust line) are empty — fill in a real number if you have one."
        });
        score -= 10;
      }
    }
  }

  return { score: clamp(score), findings };
}

// ─── SEO ────────────────────────────────────────────────────

export function scoreSeo(
  instance: SectionInstance,
  reg: AnySectionRegistration
): Result {
  const findings: ScoreFinding[] = [];
  let score = 100;

  const hints = reg.scoreHints?.seo;

  if (hints?.headingLevel) {
    // Look for a heading-like field.
    const headingField =
      fieldOf(reg, "heading") ??
      reg.editableFields.find((f) => f.key.toLowerCase().includes("head"));
    if (headingField) {
      const value = instance.config[headingField.key];
      if (typeof value !== "string" || value.length < 5) {
        findings.push({
          dimension: "seo",
          severity: "warn",
          message: "Heading is empty or very short — less SEO signal."
        });
        score -= 15;
      } else if (value.length > 120) {
        findings.push({
          dimension: "seo",
          severity: "info",
          message: "Heading over 120 chars — trim for cleaner SERP display."
        });
        score -= 4;
      }
    }
  }

  if (hints?.structuredData) {
    findings.push({
      dimension: "seo",
      severity: "info",
      message: `Candidate for ${hints.structuredData} schema markup — free rich-result surface.`
    });
  }

  return { score: clamp(score), findings };
}

// ─── Mobile ────────────────────────────────────────────────

export function scoreMobile(
  instance: SectionInstance,
  reg: AnySectionRegistration
): Result {
  const findings: ScoreFinding[] = [];
  let score = 100;

  // Look for text fields nearing max length — likely to wrap awkwardly
  // at 420px viewport width.
  for (const f of reg.editableFields) {
    if (f.type.kind !== "text" && f.type.kind !== "rich_text") continue;
    const value = instance.config[f.key];
    if (typeof value !== "string" || !value) continue;
    const spec = f.type as { maxLength?: number };
    if (spec.maxLength && value.length > spec.maxLength * 0.9) {
      findings.push({
        dimension: "mobile",
        severity: "info",
        message: `${f.label} is near its max length (${value.length}/${spec.maxLength}) — may wrap awkwardly on mobile.`,
        fieldKey: f.key
      });
      score -= 3;
    }
  }

  return { score: clamp(score), findings };
}

// ─── Brand consistency ────────────────────────────────────

export function scoreBrandConsistency(
  instance: SectionInstance,
  reg: AnySectionRegistration
): Result {
  const findings: ScoreFinding[] = [];
  let score = 100;

  const overrides = instance.tokenOverrides ?? {};
  const overrideKeys = Object.keys(overrides);

  if (overrideKeys.length > 0) {
    findings.push({
      dimension: "brandConsistency",
      severity: "info",
      message: `${overrideKeys.length} per-instance token override${overrideKeys.length === 1 ? "" : "s"} — this section diverges from the brand tokens.`
    });
    score -= Math.min(30, overrideKeys.length * 5);
  }

  const boundTokens = reg.scoreHints?.brandConsistency?.boundTokens ?? [];
  if (boundTokens.length > 0 && overrideKeys.length === 0) {
    findings.push({
      dimension: "brandConsistency",
      severity: "info",
      message: `Fully bound to brand tokens: ${boundTokens.join(", ")}.`
    });
  }

  return { score: clamp(score), findings };
}
