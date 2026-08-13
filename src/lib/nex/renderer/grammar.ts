// Marketing Grammar runtime · validates a BannerSpecification against personality rules.
//
// Grammar violations produce warnings · they NEVER block rendering. The Nex Brain
// decides whether to accept violations (e.g. brand experiments) or fix them.
//
// Doctrine: docs/brains/nex-pattern-library-grammar-journey-philip-2026-08-04.md

import type { BannerSpecification, BrandPersonality, GrammarViolation, TextLayer } from "./types";

type GrammarRule = {
  personality: BrandPersonality;
  headline_max_words?: number;
  headline_max_lines?: number;
  features_min?: number;
  features_max?: number;
  cta_max_words?: number;
  forbid_all_caps_cta?: boolean;
  forbid_discount_badge?: boolean;
  forbid_urgency_bar?: boolean;
  require_hero_dominance_min?: number;   // hero width_ratio · 0.5 = 50% of canvas
};

const GRAMMAR_RULES: Record<BrandPersonality, GrammarRule> = {
  luxury: {
    personality: "luxury",
    headline_max_words: 8,
    headline_max_lines: 2,
    features_min: 3,
    features_max: 4,
    cta_max_words: 3,
    forbid_all_caps_cta: true,
    forbid_discount_badge: true,
    forbid_urgency_bar: true,
    require_hero_dominance_min: 0.5,
  },
  professional: {
    personality: "professional",
    headline_max_words: 10,
    headline_max_lines: 2,
    features_min: 3,
    features_max: 5,
    cta_max_words: 4,
    forbid_all_caps_cta: false,
    forbid_discount_badge: false,
    forbid_urgency_bar: false,
    require_hero_dominance_min: 0.4,
  },
  sales_event: {
    personality: "sales_event",
    headline_max_words: 12,
    headline_max_lines: 3,
    features_min: 4,
    features_max: 6,
    cta_max_words: 4,
    forbid_all_caps_cta: false,
    forbid_discount_badge: false,
    forbid_urgency_bar: false,
    require_hero_dominance_min: 0.35,
  },
  family: {
    personality: "family",
    headline_max_words: 10,
    headline_max_lines: 3,
    features_min: 4,
    features_max: 5,
    cta_max_words: 4,
    forbid_all_caps_cta: false,
    forbid_discount_badge: false,
    forbid_urgency_bar: false,
    require_hero_dominance_min: 0.4,
  },
  heritage: {
    personality: "heritage",
    headline_max_words: 8,
    headline_max_lines: 2,
    features_min: 3,
    features_max: 4,
    cta_max_words: 3,
    forbid_all_caps_cta: true,
    forbid_discount_badge: true,
    forbid_urgency_bar: true,
    require_hero_dominance_min: 0.5,
  },
  lifestyle: {
    personality: "lifestyle",
    headline_max_words: 8,
    headline_max_lines: 2,
    features_min: 3,
    features_max: 4,
    cta_max_words: 3,
    forbid_all_caps_cta: false,
    forbid_discount_badge: false,
    forbid_urgency_bar: true,
    require_hero_dominance_min: 0.45,
  },
};

/** Validate a spec against its personality's grammar rules. */
export function validateGrammar(spec: BannerSpecification): readonly GrammarViolation[] {
  const rule = GRAMMAR_RULES[spec.brand_personality];
  if (!rule) return [];
  const violations: GrammarViolation[] = [];

  // Locate headline text
  const headlineLayer = spec.layers.find((l): l is TextLayer => l.type === "text" && l.id === "headline");
  if (headlineLayer && rule.headline_max_words != null) {
    const wordCount = headlineLayer.text.split(/\s+/).filter(Boolean).length;
    if (wordCount > rule.headline_max_words) {
      violations.push({
        rule: `${rule.personality}.headline_max_words`,
        severity: "warn",
        layer_id: headlineLayer.id,
        message: `Headline has ${wordCount} words · ${rule.personality} grammar allows max ${rule.headline_max_words}.`,
      });
    }
  }

  // Locate CTA layer
  const ctaLayer = spec.layers.find((l): l is TextLayer => l.type === "text" && l.id === "cta");
  if (ctaLayer) {
    if (rule.cta_max_words != null) {
      const wordCount = ctaLayer.text.split(/\s+/).filter(Boolean).length;
      if (wordCount > rule.cta_max_words) {
        violations.push({
          rule: `${rule.personality}.cta_max_words`,
          severity: "warn",
          layer_id: ctaLayer.id,
          message: `CTA has ${wordCount} words · ${rule.personality} grammar allows max ${rule.cta_max_words}.`,
        });
      }
    }
    if (rule.forbid_all_caps_cta && ctaLayer.transform === "uppercase") {
      violations.push({
        rule: `${rule.personality}.forbid_all_caps_cta`,
        severity: "warn",
        layer_id: ctaLayer.id,
        message: `CTA uses uppercase · ${rule.personality} grammar forbids all-caps CTAs.`,
      });
    }
  }

  // Feature count
  const features = spec.layers.find((l) => l.type === "feature_list");
  if (features && features.type === "feature_list") {
    const count = features.items.length;
    if (rule.features_min != null && count < rule.features_min) {
      violations.push({
        rule: `${rule.personality}.features_min`,
        severity: "info",
        layer_id: features.id,
        message: `Feature list has ${count} items · ${rule.personality} grammar prefers min ${rule.features_min}.`,
      });
    }
    if (rule.features_max != null && count > rule.features_max) {
      violations.push({
        rule: `${rule.personality}.features_max`,
        severity: "warn",
        layer_id: features.id,
        message: `Feature list has ${count} items · ${rule.personality} grammar prefers max ${rule.features_max}.`,
      });
    }
  }

  // Discount badge / urgency bar
  if (rule.forbid_discount_badge) {
    const badge = spec.layers.find((l) => l.id === "discount_badge" || l.id.includes("discount"));
    if (badge) {
      violations.push({
        rule: `${rule.personality}.forbid_discount_badge`,
        severity: "warn",
        layer_id: badge.id,
        message: `Discount badge present · ${rule.personality} grammar forbids discount badges.`,
      });
    }
  }
  if (rule.forbid_urgency_bar) {
    const urgency = spec.layers.find((l) => l.id === "urgency_bar" || l.id.includes("urgency"));
    if (urgency) {
      violations.push({
        rule: `${rule.personality}.forbid_urgency_bar`,
        severity: "warn",
        layer_id: urgency.id,
        message: `Urgency bar present · ${rule.personality} grammar forbids urgency bars.`,
      });
    }
  }

  return violations;
}
