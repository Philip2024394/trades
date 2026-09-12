// src/lib/nex/live-chat-completion/vision/index.ts
//
// Founder BEGIN Phase 3.8 · env-selected default vision provider.
//
// Selection precedence:
//   NEX_VISION=off                     → null (feature disabled)
//   NEX_VISION_PROVIDER=mock           → mock (regression)
//   otherwise                          → Ollama vision provider (real)

import { makeMockVisionProvider } from "./mock-provider";
import { makeOllamaVisionProvider } from "./ollama-provider";
import type { VisionProvider, VisionExtractedFact } from "./contract";
import { hashImageBase64 } from "./contract";
import type { EvidenceItem } from "@/lib/nex/live-chat-completion/llm-rescue/contract";

export function makeDefaultVisionProvider(): VisionProvider | null {
  const enabled = process.env.NEX_VISION;
  if (enabled === "off" || enabled === "0" || enabled === "false") return null;
  const kind = (process.env.NEX_VISION_PROVIDER ?? "ollama").toLowerCase();
  if (kind === "mock") return makeMockVisionProvider();
  return makeOllamaVisionProvider();
}

/**
 * Convert vision-extracted facts to EvidenceItem entries the LLM rescue
 * bundle can consume. Trust CAPPED at "evidence_provisional" by policy
 * (Founder Phase 3.8 · vision claims are always candidates, never canonical).
 * Deterministic source_ref shape: vision:<image_hash>:<idx>.
 */
export function visionFactsToEvidence(
  image_base64: string,
  facts: readonly VisionExtractedFact[],
): EvidenceItem[] {
  const image_hash = hashImageBase64(image_base64);
  return facts.map((f, idx) => ({
    ref_id: `vision:${image_hash}:${idx}`,
    source_type: "vision" as const,
    entity_ref: null,
    intent_slug: null,
    text: `[vision:${f.category}] ${f.claim_text}`,
    confidence: Math.min(0.75, Math.max(0, f.confidence)), // hard cap at 0.75 · never elevate to canonical
    verified_at: new Date().toISOString(),
    source_reference: `image:${image_hash}`,
  }));
}

export { hashImageBase64 };
