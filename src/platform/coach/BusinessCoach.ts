// BusinessCoach — the assessment + backlog service.
//
// Pure. Given a CoachContext it:
//   • Walks every recommendation
//   • Evaluates each condition
//   • Groups triggered recommendations by dimension
//   • Computes each dimension's score
//   • Emits a transparent BusinessHealthScore + prioritised backlog
//
// No I/O. Persistence is a separate concern (studio_coach_assessments).

import type {
  BacklogItem,
  BacklogTimeframe,
  BusinessHealthScore,
  CoachBacklog,
  CoachContext,
  ExpectedImpact,
  HealthDimension,
  HealthScoreEntry,
  ImpactBand,
  RecommendationEvaluation
} from "./types";
import { DIMENSION_LABEL, HEALTH_DIMENSIONS, IMPACT_WEIGHT } from "./types";
import { recommendationRegistry } from "./recommendations";
import type { FrozenRecommendationManifest } from "./recommendations";

type Triggered = {
  manifest: FrozenRecommendationManifest;
  detail: string;
  expectedImpact?: ExpectedImpact;
  titleOverride?: string;
  slugSuffix?: string;
};

function evaluateAll(ctx: CoachContext): Triggered[] {
  const results: Triggered[] = [];
  const trade = ctx.strategy.inputs.profile.trade;
  const goal = ctx.strategy.inputs.strategy.currentGoal;

  for (const rec of recommendationRegistry.list()) {
    // Scope filtering.
    const scope = rec.scope;
    if (!scope.trades.includes("*") && !scope.trades.includes(trade)) continue;
    if (scope.goals && scope.goals.length && !scope.goals.includes(goal)) {
      continue;
    }
    if (scope.profileFlags?.length) {
      const profile = ctx.strategy.inputs.profile;
      const flagsHeld = new Set<string>();
      if (profile.isPremium) flagsHeld.add("premium");
      if (profile.isLuxury) flagsHeld.add("luxury");
      if (profile.isEmergency) flagsHeld.add("emergency");
      if (profile.isCommercial) flagsHeld.add("commercial");
      if (profile.isResidential) flagsHeld.add("residential");
      const match = scope.profileFlags.some((f) => flagsHeld.has(f));
      if (!match) continue;
    }

    // Condition check.
    let evaluation: RecommendationEvaluation;
    try {
      evaluation = rec.condition.check(ctx);
    } catch (err) {
      // Never crash the coach on a bad recommendation — surface as a
      // warning-level triggered item so ops can debug.
      evaluation = {
        triggered: true,
        detail: `Recommendation "${rec.slug}" threw during evaluation: ${
          (err as Error).message
        }`
      };
    }
    // A single evaluation may return multiple triggered items via
    // slugSuffix — but our RecommendationCondition returns one
    // evaluation. Per-instance fan-out is handled by the recommendation
    // registering multiple triggers via multiple items when its check
    // returns them serialized. For v1 we accept one evaluation per
    // recommendation and let per-service recommendations short-circuit
    // by producing the most-severe row (the seed handles the loop).
    if (evaluation.triggered) {
      results.push({
        manifest: rec,
        detail: evaluation.detail,
        expectedImpact: evaluation.expectedImpact,
        titleOverride: evaluation.titleOverride,
        slugSuffix: evaluation.slugSuffix
      });
    }
  }
  return results;
}

/** Derive a backlog timeframe from priority + impact — deterministic
 *  so the merchant sees a consistent plan. */
function timeframeFor(
  priority: 1 | 2 | 3 | 4 | 5,
  impact: ImpactBand
): BacklogTimeframe {
  if (priority >= 4 && impact === "high") return "this-week";
  if (priority >= 3) return "this-month";
  return "this-quarter";
}

function scoreDimension(
  dim: HealthDimension,
  triggered: readonly Triggered[]
): HealthScoreEntry {
  const inDim = triggered.filter((t) => t.manifest.dimension === dim);
  let score = 100;
  for (const t of inDim) {
    score -= IMPACT_WEIGHT[t.manifest.estimatedImpact];
  }
  if (score < 0) score = 0;

  const reasoning = inDim.length
    ? inDim
        .slice(0, 3)
        .map((t) => t.manifest.title.toLowerCase())
        .join("; ")
    : "no gaps detected";

  return Object.freeze({
    dimension: dim,
    score,
    reasoning: reasoning.charAt(0).toUpperCase() + reasoning.slice(1) + ".",
    triggeredRecommendations: Object.freeze(inDim.map((t) => t.manifest.slug))
  });
}

function overallScore(dimensions: readonly HealthScoreEntry[]): number {
  if (!dimensions.length) return 0;
  const sum = dimensions.reduce((a, d) => a + d.score, 0);
  return Math.round(sum / dimensions.length);
}

function toBacklogItem(t: Triggered): BacklogItem {
  const m = t.manifest;
  const slug = t.slugSuffix ? `${m.slug}--${t.slugSuffix}` : m.slug;
  return Object.freeze({
    recommendationSlug: slug,
    title: t.titleOverride ?? m.title,
    dimension: m.dimension,
    priority: m.priority,
    estimatedImpact: m.estimatedImpact,
    timeframe: timeframeFor(m.priority, m.estimatedImpact),
    detail: t.detail,
    actionLabel: m.action.label,
    autoFix: m.action.autoFix,
    citedPlaybooks: m.citesPlaybooks ?? [],
    citedPatterns: m.citesPatterns ?? [],
    citedEvidence: m.citesEvidence ?? [],
    whyItMatters: m.rationale.whyItMatters,
    expectedOutcome: m.rationale.expectedOutcome,
    expectedImpactHeadline: t.expectedImpact?.headline,
    expectedImpactSource: t.expectedImpact?.source,
    expectedImpactRange: t.expectedImpact?.range
  });
}

/** Assess business health. Returns a transparent, per-dimension
 *  scorecard. Every dimension traces back to the recommendations
 *  that fired. */
export function assess(ctx: CoachContext): BusinessHealthScore {
  const triggered = evaluateAll(ctx);
  const dimensions = HEALTH_DIMENSIONS.map((dim) =>
    scoreDimension(dim, triggered)
  );
  const strategy = ctx.strategy;

  return Object.freeze({
    overall: overallScore(dimensions),
    dimensions,
    strategySnapshot: {
      profileSlug: strategy.inputs.profile.slug,
      strategySlug: strategy.inputs.strategy.slug,
      recipeSlug: strategy.inputs.recipe.slug,
      tradeSlug: strategy.inputs.profile.trade,
      goal: strategy.inputs.strategy.currentGoal
    },
    generatedAt: new Date().toISOString()
  });
}

/** Prioritised backlog for the given timeframe. Items are ordered by
 *  (priority DESC, impact-weight DESC, slug ASC for stability). */
export function backlog(
  ctx: CoachContext,
  timeframe: CoachBacklog["timeframe"] = "this-month"
): CoachBacklog {
  const triggered = evaluateAll(ctx);
  const items = triggered
    .map(toBacklogItem)
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const bWeight = IMPACT_WEIGHT[b.estimatedImpact];
      const aWeight = IMPACT_WEIGHT[a.estimatedImpact];
      if (bWeight !== aWeight) return bWeight - aWeight;
      return a.recommendationSlug.localeCompare(b.recommendationSlug);
    });

  return Object.freeze({
    timeframe,
    items: Object.freeze(items),
    generatedAt: new Date().toISOString()
  });
}

/** Re-export DIMENSION_LABEL for convenience — the UI needs it. */
export { DIMENSION_LABEL };

export const BusinessCoach = { assess, backlog };
