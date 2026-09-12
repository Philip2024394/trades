// src/lib/nex/live-chat-completion/files/index.ts
//
// Founder BEGIN Phase 3.9 · env-selected default file provider + evidence mapper.
//
// Selection precedence:
//   NEX_FILES=off                     → null (feature disabled)
//   NEX_FILE_PROVIDER=mock            → mock (regression)
//   otherwise                         → real provider (routes text/image/pdf)
//
// Contract rule (Truth Engine): file-derived evidence is capped at
// `evidence_provisional` — never canonical_verified. Owner-uploaded
// evidence can be elevated in a future BEGIN when owner-identity lands.

import { makeMockFileProvider } from "./mock-provider";
import { makeRealFileProvider } from "./real-provider";
import type { FileProvider, FileExtractedFact, SupportedMimeType } from "./contract";
import { hashFileBase64 } from "./contract";
import type { EvidenceItem } from "@/lib/nex/live-chat-completion/llm-rescue/contract";

export function makeDefaultFileProvider(): FileProvider | null {
  const enabled = process.env.NEX_FILES;
  if (enabled === "off" || enabled === "0" || enabled === "false") return null;
  const kind = (process.env.NEX_FILE_PROVIDER ?? "real").toLowerCase();
  if (kind === "mock") return makeMockFileProvider();
  return makeRealFileProvider();
}

/**
 * Convert file-extracted facts to EvidenceItem entries the LLM rescue
 * bundle + Fabrication Gate can consume. Trust CAPPED at
 * "evidence_provisional" — file claims are candidates, never canonical.
 * Deterministic source_ref shape: file:<file_hash>:<page>:<idx>.
 */
export function fileFactsToEvidence(
  content_base64: string,
  facts: readonly FileExtractedFact[],
  meta?: { filename?: string; mime_type?: string },
): EvidenceItem[] {
  const file_hash = hashFileBase64(content_base64);
  return facts.map((f, idx) => ({
    ref_id: `file:${file_hash}:${f.page ?? 0}:${idx}`,
    source_type: "file" as const,
    entity_ref: null,
    intent_slug: null,
    text: `[file:${f.category}] ${f.claim_text}`,
    confidence: Math.min(0.75, Math.max(0, f.confidence)), // hard cap · never elevate to canonical
    verified_at: new Date().toISOString(),
    source_reference: meta?.filename
      ? `file:${file_hash}:${meta.filename}`
      : `file:${file_hash}`,
  }));
}

export { hashFileBase64 };
export type { FileProvider, FileExtractedFact, SupportedMimeType };
