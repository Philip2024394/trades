// GPT Image 1 backend — Stage 7 (Model Optimiser) + Stage 12
// (Model Router adapter). Adapts the neutral PromptSection[] into
// the shape GPT Image 1 rewards: natural language, section headers
// preserved as loose paragraphs, negative constraints woven in as
// positive-preservation language per the compiler spec.

import type { DesignIR } from "../ir";
import type { CompiledPrompt, PromptSection } from "../types";
import { renderSections } from "../stages/prompt-assembly";
import { estimateGenerationPence } from "@/lib/openai/imageGen";

export const GPT_IMAGE_BACKEND_VERSION = "1.0.0";

const SYSTEM_PROMPT = [
  "You are a senior commercial vehicle wrap designer for a UK trades platform.",
  "Produce agency-grade output suitable for a £5,000 professional vehicle wrap.",
  "Follow every section of the brief. Preserve everything the brief tells you to preserve.",
  "Use positive requirements over negative constraints. Studio backdrop, photorealistic, sharp focus."
].join(" ");

export function compileForGptImage(ir: DesignIR, sections: PromptSection[]): CompiledPrompt {
  const userPrompt = renderSections(sections);

  const negativeConstraints = ir.constraints
    .filter((c) => c.kind === "forbid")
    .map((c) => `no ${c.target.replace(/_/g, " ")}`);

  const output = ir.outputs[0];
  const quality = output.quality;
  const references = ir.photography.photo_urls.map((url) => ({
    kind: "portfolio-photo" as const,
    url
  }));

  return {
    model:               "gpt-image-1",
    systemPrompt:        SYSTEM_PROMPT,
    userPrompt,
    sections,
    negativeConstraints,
    references,
    qualityProfile:      quality,
    estimatedCostUsd:    estimateGenerationPence(quality, 1) / 100 / 0.79, // pence → USD roughly
    estimatedTokens:     Math.ceil(userPrompt.length / 4),
    compilerVersion:     GPT_IMAGE_BACKEND_VERSION,
    version: {
      compilerVersion:  GPT_IMAGE_BACKEND_VERSION,
      layoutVersion:    "1.0.0",
      tradeVersion:     "1.0.0",
      vehicleVersion:   "1.0.0",
      brandVersion:     "1.0.0",
      criticVersion:    "1.0.0"
    },
    cacheKey:            "",   // set by cache layer
    explainability:      sections.map((s) => ({
      section: s.name,
      source:  s.source,
      reason:  s.reason,
      version: s.version
    }))
  };
}
