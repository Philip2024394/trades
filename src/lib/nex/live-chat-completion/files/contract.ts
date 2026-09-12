// src/lib/nex/live-chat-completion/files/contract.ts
//
// Founder BEGIN Phase 3.9 · File upload retrieval contract.
//
// User attaches one or more files (PDF brochure, image menu, business
// card, plain-text booking confirmation). NEX extracts structured facts
// and feeds them as evidence into the same Truth-Engine-gated pipeline
// vision + web + semantic use.
//
// Contract rules:
//   1. Every extracted fact has a category (booking / brochure / menu /
//      contact / policy / receipt / plain_text / other).
//   2. Every fact has a confidence 0..1 · providers must be honest.
//   3. Trust cap on file-derived evidence = evidence_provisional (never
//      canonical_verified). Owner-verified files may be elevated in a
//      future BEGIN when owner-identity lands.
//   4. Every fact has a stable source_ref (file:<file_hash>:<page>:<idx>)
//      so the Fabrication Gate validates like every other source.
//   5. Providers must return structured JSON matching the Zod schema.
//      Non-conforming output → zero extracted facts.

import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════
// Fact categories
// ═══════════════════════════════════════════════════════════════════

export type FileFactCategory =
  | "booking"       // booking confirmation
  | "brochure"      // property/service brochure
  | "menu"          // food/drink pricing
  | "contact"       // business card, contact page
  | "policy"        // cancellation / house rules / T&Cs
  | "receipt"       // paid receipt / invoice
  | "plain_text"    // extracted from plaintext file
  | "identity_document"
  | "other";

// ═══════════════════════════════════════════════════════════════════
// Zod-strict output shape
// ═══════════════════════════════════════════════════════════════════

export const FileExtractedFactSchema = z.object({
  claim_text: z.string().min(1).max(500),
  category: z.enum([
    "booking", "brochure", "menu", "contact", "policy",
    "receipt", "plain_text", "identity_document", "other",
  ]),
  confidence: z.number().min(0).max(1),
  /** Zero-based page number where the fact was found. Optional. */
  page: z.number().int().min(0).max(2000).optional(),
});
export type FileExtractedFact = z.infer<typeof FileExtractedFactSchema>;

export const FileProviderOutputSchema = z.object({
  facts: z.array(FileExtractedFactSchema).max(50),
  overall_caption: z.string().max(500).optional(),
  extraction_confidence: z.number().min(0).max(1).default(0.5),
});
export type FileProviderOutput = z.infer<typeof FileProviderOutputSchema>;

// ═══════════════════════════════════════════════════════════════════
// Provider interface
// ═══════════════════════════════════════════════════════════════════

export type SupportedMimeType =
  | "application/pdf"
  | "image/jpeg" | "image/png" | "image/webp"
  | "text/plain";

export interface FileExtractInput {
  /** Raw base64 (no data-URI prefix). */
  content_base64: string;
  /** File name including extension · used for observability + heuristics. */
  filename?: string;
  /** MIME type · used by provider to pick decoder. */
  mime_type: SupportedMimeType | string;
  /** Free-text hint the user typed alongside the upload. */
  hint?: string;
  language?: "en" | "id";
  budget_ms: number;
  signal?: AbortSignal;
}

export interface FileExtractResult {
  output: FileProviderOutput | null;
  provider_meta: {
    provider: string;
    request_ms: number;
    completed: boolean;
    error?: string;
    file_hash: string;   // deterministic short id of the source file
    file_size_bytes: number;
    mime_type: string;
  };
}

export interface FileProvider {
  name: string;
  extract(input: FileExtractInput): Promise<FileExtractResult>;
}

// ═══════════════════════════════════════════════════════════════════
// Deterministic file hash · sha256 first 16 hex chars of base64 payload
// ═══════════════════════════════════════════════════════════════════

export function hashFileBase64(content_base64: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(content_base64).digest("hex").slice(0, 16);
}
