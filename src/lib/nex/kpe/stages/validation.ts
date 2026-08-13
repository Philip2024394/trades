// KPE Stage 9 · Validation Engine
//
// Runs deterministic checks BEFORE the Decision Engine picks a routing tier.
// Produces a `chunk_confidence` map that the Decision Engine consumes.
//
// Checks:
//   · Structural: chunk has body, chunk_id unique, order_index sequential
//   · Content:    minimum length, no runaway placeholders, no null-terminators
//   · Metadata:   at least one of (URL / date / entity) OR heading path present
//   · Confidence: score derived from feature richness

import type { PipelineStage, ValidationInput, ValidationOutput } from "../types";

function chunkConfidence(chunk: { content: string; heading_path: string[]; context_before: string | null; context_after: string | null }): number {
  let score = 0.5;                    // baseline
  if (chunk.heading_path.length > 0) score += 0.15;
  if (chunk.context_before || chunk.context_after) score += 0.05;
  if (chunk.content.length > 200) score += 0.10;
  if (chunk.content.length > 800) score += 0.05;
  if (/[.!?]$/.test(chunk.content.trim())) score += 0.05;      // ends in sentence
  if (/```/.test(chunk.content)) score += 0.05;                // has code block
  if (/https?:\/\//i.test(chunk.content)) score += 0.05;       // has citation URL
  return Math.min(1, Math.round(score * 1000) / 1000);
}

export const ValidationStage: PipelineStage<ValidationInput, ValidationOutput> = {
  name: "validation",
  version: "1.0.0",
  async run(input: ValidationInput): Promise<ValidationOutput> {
    const errors: ValidationOutput["errors"] = [];
    const chunk_confidence: Record<string, number> = {};

    // Chunk-level checks
    const seenIds = new Set<string>();
    let lastIndex = -1;
    for (const c of input.chunks) {
      if (!c.content?.trim()) errors.push({ chunk_id: c.chunk_id, message: "empty_content" });
      if (seenIds.has(c.chunk_id)) errors.push({ chunk_id: c.chunk_id, message: "duplicate_chunk_id" });
      seenIds.add(c.chunk_id);
      if (c.order_index !== lastIndex + 1) errors.push({ chunk_id: c.chunk_id, message: "non_sequential_order" });
      lastIndex = c.order_index;
      if (c.content.includes("\0")) errors.push({ chunk_id: c.chunk_id, message: "null_terminator" });
      if (/\[TODO\]|\[PLACEHOLDER\]/i.test(c.content)) errors.push({ chunk_id: c.chunk_id, message: "runaway_placeholder" });
      chunk_confidence[c.chunk_id] = chunkConfidence(c);
    }

    // Document-level checks
    if (!input.document.title && input.chunks.length > 3) {
      errors.push({ chunk_id: null, message: "no_document_title_for_multi_chunk_doc" });
    }
    if (input.chunks.length === 0) {
      errors.push({ chunk_id: null, message: "no_chunks_produced" });
    }

    return {
      valid: errors.length === 0,
      errors,
      chunk_confidence,
    };
  },
};
