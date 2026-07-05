// Strategy Explainer — service.
//
// Turns a ResolvedStrategy into human-readable "what the platform
// decided and why" for the merchant-facing "Why is my website built
// this way?" button.
//
// Deterministic — no LLM. Any missing vocabulary is silently skipped
// rather than emitting jargon.

import { evidenceRegistry } from "../evidence";
import { bandForConfidence, patternRegistry } from "../patterns";
import { playbookRegistry } from "../playbooks";
import type { ResolvedStrategy } from "../resolver";
import { tradeIntelligenceRegistry } from "../trades";
import {
  labelForGoal,
  labelForTrade,
  PHRASE_RULES
} from "./vocabulary";
import type {
  DecisionExplanation,
  ExplanationLine,
  StrategyExplanation
} from "./types";

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

  // If Trade Intelligence exists, prepend a Content decision citing
  // it — the merchant sees WHY the base site skeleton looks this way.
  const trade = tradeIntelligenceRegistry.get(profile.trade);
  if (trade) {
    if (trade.imageStrategy.galleryMix) {
      const mix = Object.entries(trade.imageStrategy.galleryMix)
        .map(([k, v]) => `${v}% ${k.replace(/-/g, " ")}`)
        .join(" / ");
      decisions.push({
        bucket: "Content",
        sentence: `Weight your gallery ${mix} — the mix that suits ${tradeLabel.toLowerCase()}`,
        citedPlaybooks: [`trade:${trade.slug}`],
        confidence: trade.evidence.confidence
      });
    }
    decisions.push({
      bucket: "Content",
      sentence: `Prioritise ${trade.imageStrategy.priorityOrder
        .slice(0, 3)
        .join(" then ")} imagery on the home page`,
      citedPlaybooks: [`trade:${trade.slug}`],
      confidence: trade.evidence.confidence
    });
  }

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
    // Trade contributions are prefixed `trade:` and aren't in
    // playbookRegistry — the confidence comes from tradeIntelligenceRegistry.
    const strongestPlaybook = citedPlaybooks
      .filter((slug) => !slug.startsWith("trade:") && !slug.startsWith("recipe:"))
      .map((slug) => playbookRegistry.get(slug))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .sort((a, b) => b.evidence.confidence - a.evidence.confidence)[0];
    const tradeCited = citedPlaybooks.find((s) => s.startsWith("trade:"));
    const confidence =
      strongestPlaybook?.evidence.confidence ??
      (tradeCited ? trade?.evidence.confidence : undefined);

    decisions.push({
      bucket: rule.bucket,
      sentence: rule.sentence(facet),
      citedPlaybooks,
      confidence
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

const STRENGTH_LABEL: Record<string, string> = {
  insufficient: "Insufficient (no supporting evidence — treat as a suggestion)",
  emerging: "Emerging (early signals — worth trying, not proven)",
  moderate: "Moderate (competitor observation, awaiting measurement)",
  high: "High (supported by platform research and reviewed evidence)",
  "very-high": "Very high (supported by measured outcomes across the platform)"
};

/** Deep-dive per-decision "Why?" — pulls the strongest playbook's
 *  rationale + cited patterns + evidence. Everything is derived from
 *  registries so nothing is fabricated. */
export function explainDecision(
  strategy: ResolvedStrategy,
  domain: string,
  field: string
): DecisionExplanation | undefined {
  const facet = strategy.get(domain, field) as
    | Record<string, unknown>
    | undefined;
  if (!facet) return undefined;

  const kindSlug = `${domain}.${field}`;
  const prov = strategy.provenance.find((p) => p.kind === kindSlug);
  const contributedBy = prov?.contributedBy ?? [];

  // Recommendation phrase — reuse PHRASE_RULES vocabulary.
  const rule = PHRASE_RULES.find(
    (r) => r.domain === domain && r.field === field
  );
  const recommendationText = rule
    ? rule.sentence(facet)
    : `${domain}.${field} configured`;

  // Playbook citations (excluding trade: / recipe:).
  const playbookSlugs = contributedBy.filter(
    (s) => !s.startsWith("trade:") && !s.startsWith("recipe:")
  );
  const playbooks = playbookSlugs
    .map((slug) => playbookRegistry.get(slug))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const strongest = playbooks
    .slice()
    .sort((a, b) => b.evidence.confidence - a.evidence.confidence)[0];

  // Patterns cited by the strongest playbook's rationale.
  const patternSlugs = strongest?.rationale?.citesPatterns ?? [];
  const patterns = patternSlugs
    .map((slug) => {
      const p = patternRegistry.get(slug);
      if (!p) return undefined;
      return {
        slug: p.slug,
        title: p.title,
        statement: p.statement,
        derivedConfidence: patternRegistry.confidenceOf(p.slug)
      };
    })
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  // Evidence cited by the strongest playbook's rationale.
  const evidenceSlugs = strongest?.rationale?.citesEvidence ?? [];
  const evidence = evidenceSlugs
    .map((slug) => {
      const e = evidenceRegistry.get(slug);
      if (!e) return undefined;
      return {
        slug: e.slug,
        title: e.title,
        state: e.validation.state,
        sourceKind: e.source.kind
      };
    })
    .filter((e): e is NonNullable<typeof e> => Boolean(e));

  // Reasoning: prefer the playbook's own rationale.reasoning; fall
  // back to a synthesised sentence.
  const reasoning =
    strongest?.rationale?.reasoning ??
    `This is derived from ${
      playbooks.length
        ? `${playbooks.length} playbook${
            playbooks.length === 1 ? "" : "s"
          } (${playbooks.map((p) => p.name).join(", ")})`
        : "your trade's baseline patterns"
    } applied to your growth strategy.`;

  // Overall strength — take the max of pattern derived confidences,
  // playbook confidences, and trade evidence confidence.
  const trade = tradeIntelligenceRegistry.get(strategy.inputs.profile.trade);
  const candidates: number[] = [
    ...patterns.map((p) => p.derivedConfidence),
    ...playbooks.map((p) => p.evidence.confidence),
    ...(trade && contributedBy.some((s) => s.startsWith("trade:"))
      ? [trade.evidence.confidence]
      : [])
  ];
  const strengthNumber = candidates.length ? Math.max(...candidates) : 0;
  const band = bandForConfidence(strengthNumber);

  return Object.freeze({
    domain,
    field,
    recommendation: recommendationText,
    reasoning,
    citedPlaybooks: playbooks.map((p) => ({
      slug: p.slug,
      name: p.name,
      confidence: p.evidence.confidence,
      rationaleStatement: p.rationale?.statement
    })),
    citedPatterns: patterns,
    citedEvidence: evidence,
    strengthBand: band,
    strengthLabel: STRENGTH_LABEL[band] ?? band
  });
}
