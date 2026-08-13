// KPE Stage 4 · Document Classifier
//
// Assigns ONE label from a configurable taxonomy. Reference implementation
// uses keyword scoring — the CSA position is that the classifier's categories
// must be data-driven (NEX's real traffic is customer dumps about staircases,
// review responses, marketing copy · not the generic "specification/manual/
// changelog" taxonomy the KPE mission statement listed).
//
// The default taxonomy below is a NEX-specific starting point. Swap by
// registering a different classifier plugin.

import type { ClassifierInput, ClassifierOutput, PipelineStage } from "../types";

type CategoryDef = { label: string; keywords: string[]; weight?: number };

const DEFAULT_CATEGORIES: CategoryDef[] = [
  { label: "staircase-knowledge", keywords: ["staircase", "tread", "riser", "newel", "handrail", "balustrade", "string", "nosing"], weight: 1.0 },
  { label: "kitchen-knowledge",   keywords: ["kitchen", "worktop", "cabinet", "splashback", "carcass", "hob", "extractor"] },
  { label: "door-knowledge",      keywords: ["door", "hinge", "jamb", "frame", "architrave", "handleset"] },
  { label: "quote-request",       keywords: ["quote", "estimate", "price", "cost", "how much", "budget"] },
  { label: "customer-message",    keywords: ["hello", "hi", "thanks", "please", "regards", "kind regards"] },
  { label: "review-response",     keywords: ["review", "rating", "stars", "feedback", "reply", "response"] },
  { label: "marketing-copy",      keywords: ["campaign", "launch", "sale", "offer", "promotion", "headline"] },
  { label: "meeting-notes",       keywords: ["meeting", "attendees", "action items", "agenda", "next steps"] },
  { label: "policy",              keywords: ["policy", "compliance", "gdpr", "must", "shall", "prohibited"] },
  { label: "specification",       keywords: ["specification", "spec", "requirements", "dimensions", "mm", "load bearing"] },
  { label: "code-snippet",        keywords: ["function", "const", "return", "import", "class", "```"] },
  { label: "unclassified",        keywords: [], weight: 0.001 },   // absorbs the tail
];

function tokenise(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9][a-z0-9-]{1,}/g) ?? [];
}

function scoreCategory(tokens: string[], cat: CategoryDef): number {
  if (cat.keywords.length === 0) return cat.weight ?? 0;
  const found = cat.keywords.filter((k) => {
    // Multi-word keywords match on substring; single-word tokens match strictly.
    if (k.includes(" ")) return tokens.join(" ").includes(k);
    return tokens.includes(k);
  }).length;
  const base = found / cat.keywords.length;
  return base * (cat.weight ?? 1.0);
}

export const ClassifierStage: PipelineStage<ClassifierInput, ClassifierOutput> = {
  name: "classifier",
  version: "1.0.0",
  async run(input: ClassifierInput): Promise<ClassifierOutput> {
    const text = `${input.title ?? ""} ${input.normalised_content}`.slice(0, 8000);
    const tokens = tokenise(text);
    const scored = DEFAULT_CATEGORIES
      .map((cat) => ({ label: cat.label, score: scoreCategory(tokens, cat) }))
      .sort((a, b) => b.score - a.score);
    const top = scored[0];
    // Confidence = margin between #1 and #2 · higher margin = more decisive
    const margin = top.score - (scored[1]?.score ?? 0);
    const confidence = Math.min(1, Math.max(0, top.score * 0.7 + margin * 0.3));
    return {
      label: top.label,
      confidence: Math.round(confidence * 1000) / 1000,
      alternatives: scored.slice(1, 4),
    };
  },
};
