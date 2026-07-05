// Strategy Explainer — service.
//
// Turns a ResolvedStrategy into human-readable "what the platform
// decided and why" for the merchant-facing "Why is my website built
// this way?" button.
//
// Deterministic — no LLM. Any missing vocabulary is silently skipped
// rather than emitting jargon.

import { playbookRegistry } from "../playbooks";
import type { ResolvedStrategy } from "../resolver";
import {
  labelForGoal,
  labelForTrade,
  PHRASE_RULES
} from "./vocabulary";
import type { ExplanationLine, StrategyExplanation } from "./types";

export function explainStrategy(strategy: ResolvedStrategy): StrategyExplanation {
  const profile = strategy.inputs.profile;
  const growth = strategy.inputs.strategy;
  const recipe = strategy.inputs.recipe;

  // ─── Context ────────────────────────────────────────────────
  const tradeLabel = labelForTrade(profile.trade);
  const goalLabel = labelForGoal(growth.currentGoal);

  const summary = `Your current growth strategy is ${goalLabel} for ${tradeLabel}.`;

  // ─── Provenance ─────────────────────────────────────────────
  const playbookSlugs = recipe.playbooks ?? [];
  const playbooks = playbookSlugs
    .map((slug) => {
      const p = playbookRegistry.get(slug);
      if (!p) return null;
      return {
        slug: p.slug,
        name: p.name,
        confidence: p.evidence.confidence
      };
    })
    .filter((x): x is { slug: string; name: string; confidence: number } => x !== null);

  // ─── Decisions ──────────────────────────────────────────────
  const decisions: ExplanationLine[] = [];

  for (const rule of PHRASE_RULES) {
    const facet = strategy.get(rule.domain, rule.field) as
      | Record<string, unknown>
      | undefined;
    if (!facet) continue;
    if (rule.whenValueEquals !== undefined) {
      const compared = rule.compareKey ? facet[rule.compareKey] : facet;
      if (compared !== rule.whenValueEquals) continue;
    }
    // Find provenance for this facet.
    const kindSlug = `${rule.domain}.${rule.field}`;
    const prov = strategy.provenance.find((p) => p.kind === kindSlug);
    const citedPlaybooks = prov?.contributedBy ?? [];
    const strongest = citedPlaybooks
      .map((slug) => playbookRegistry.get(slug))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .sort((a, b) => b.evidence.confidence - a.evidence.confidence)[0];

    decisions.push({
      bucket: rule.bucket,
      sentence: rule.sentence(facet),
      citedPlaybooks,
      confidence: strongest?.evidence.confidence
    });
  }

  return Object.freeze({
    summary,
    context: {
      trade: profile.trade,
      tradeLabel,
      goal: growth.currentGoal,
      goalLabel,
      pushServices: growth.pushServices ?? [],
      positioning: profile.positioning
    },
    provenance: {
      recipe: { slug: recipe.slug, name: recipe.name },
      playbooks
    },
    decisions,
    generatedAt: new Date().toISOString()
  });
}

/** Group decisions by bucket — useful for UI rendering. */
export function groupDecisionsByBucket(
  explanation: StrategyExplanation
): Record<string, readonly ExplanationLine[]> {
  const out: Record<string, ExplanationLine[]> = {};
  for (const decision of explanation.decisions) {
    (out[decision.bucket] ??= []).push(decision);
  }
  return out;
}
