// Provenance helpers — every ContentBlock must carry provenance.
// This module centralises how it's constructed so specialists don't
// invent their own shapes.

import { bandForConfidence, playbookRegistry } from "@/platform/business";
import type { ResolvedStrategy } from "@/platform/business/resolver";
import type {
  ContentAudience,
  ContentBlock,
  ContentBlockKind,
  ContentProvenance,
  ContentPurpose,
  RegenerationHints,
  RegenerationScope
} from "./types";

/** Compute the strength band for a set of playbook slugs by taking
 *  the max confidence of the underlying playbooks. Returns
 *  "insufficient" when nothing cites anything. */
export function bandForPlaybooks(playbookSlugs: readonly string[]): ReturnType<typeof bandForConfidence> {
  const confidences: number[] = [];
  for (const slug of playbookSlugs) {
    const p = playbookRegistry.get(slug);
    if (p) confidences.push(p.evidence.confidence);
  }
  const max = confidences.length ? Math.max(...confidences) : 0;
  return bandForConfidence(max);
}

/** Build a provenance record from a ResolvedStrategy + the composer's
 *  own metadata + block-specific intent. */
export function buildProvenance(input: {
  strategy: ResolvedStrategy;
  composer: { slug: string; version: string; backend: "template" | "llm" | "hybrid" };
  purpose: ContentPurpose;
  audience?: ContentAudience;
  /** Extra playbook slugs that were consulted beyond the recipe's. */
  extraPlaybooks?: readonly string[];
  /** Optional evidence + pattern slugs cited by the strongest playbook. */
  patterns?: readonly string[];
  evidence?: readonly string[];
  /** Knowledge Package refs consumed. */
  knowledgeRefs?: readonly string[];
}): ContentProvenance {
  const { strategy, composer, purpose, audience, extraPlaybooks, patterns, evidence, knowledgeRefs } = input;
  const playbooks = [
    ...strategy.inputs.recipe.playbooks,
    ...(extraPlaybooks ?? [])
  ];
  return Object.freeze({
    generatedBy: composer.slug,
    generatorVersion: composer.version,
    generatorBackend: composer.backend,
    sources: {
      profileSlug: strategy.inputs.profile.slug,
      strategySlug: strategy.inputs.strategy.slug,
      recipeSlug: strategy.inputs.recipe.slug,
      tradeSlug: strategy.inputs.profile.trade,
      playbooks,
      patterns,
      evidence,
      knowledgeRefs
    },
    purpose,
    audience,
    primaryGoal: strategy.inputs.strategy.currentGoal,
    confidenceBand: bandForPlaybooks(playbooks),
    generatedAt: new Date().toISOString()
  });
}

const DEFAULT_SCOPES: readonly RegenerationScope[] = ["block", "manifest"];

/** Standard regeneration hints for a block. Every specialist should
 *  call this so the shape is uniform. */
export function buildRegenerationHints(input: {
  scopes?: readonly RegenerationScope[];
  editableFields: readonly string[];
  invalidatedBy: readonly string[];
  regenerationHint?: string;
}): RegenerationHints {
  return Object.freeze({
    scopes: input.scopes ?? DEFAULT_SCOPES,
    editableFields: input.editableFields,
    invalidatedBy: input.invalidatedBy,
    regenerationHint: input.regenerationHint
  });
}

/** Convenience — build a ContentBlock with provenance + hints in one call. */
export function buildBlock<TData>(input: {
  slug: string;
  kind: ContentBlockKind;
  data: TData;
  provenance: ContentProvenance;
  regeneration: RegenerationHints;
}): ContentBlock<TData> {
  return Object.freeze({
    slug: input.slug,
    kind: input.kind,
    data: Object.freeze(input.data as object) as TData,
    provenance: input.provenance,
    regeneration: input.regeneration
  });
}
