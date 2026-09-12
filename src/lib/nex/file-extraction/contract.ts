// src/lib/nex/file-extraction/contract.ts
//
// Founder Phase 15 · P15-1 · File extraction contract.
//
// ═══════════════════════════════════════════════════════════════════
// FILE DOCTRINE
// ═══════════════════════════════════════════════════════════════════
//   "EXTRACTED TEXT IS INPUT · NEVER ESTABLISHES TRUTH"
//
// Text pulled from a PDF/DOCX/txt upload becomes bundle.user_context —
// it flows through the same Fabrication Gate v2 as any other user turn.
// Never promoted to EvidenceItem, never bypasses the Truth Engine.
//
// This mirrors voice transcripts (Phase 12) and image outputs (Phase 8).

import { z } from "zod";

export const FileExtractRequestSchema = z.object({
  content_base64: z.string().min(4).max(50_000_000),      // ~37 MB base64 → ~28 MB binary
  mime_type: z.string().min(1).max(120),
  filename: z.string().max(255).optional(),
  conversation_id: z.string().max(120).optional(),
  budget_ms: z.number().int().min(500).max(120_000).default(30_000),
});
export type FileExtractRequest = z.infer<typeof FileExtractRequestSchema>;

export interface FileExtractResult {
  extraction_id: string;                                  // ext:<hash>
  text: string;
  provider: string;                                       // docx-unzipper | pdf-parse | pdf-naive | text-plain
  mime_type: string;
  filename: string | null;
  file_hash: string;
  bytes: number;
  text_length: number;
  page_count: number | null;
  request_ms: number;
  completed: boolean;
  error?: string;
}

export interface FileExtractor {
  name: string;
  supports(mime: string): boolean;
  extract(input: FileExtractRequest, buffer: Buffer): Promise<FileExtractResult>;
}

// ═══════════════════════════════════════════════════════════════════
// Hash helper
// ═══════════════════════════════════════════════════════════════════

export function hashFileContent(content_base64: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(content_base64).digest("hex").slice(0, 16);
}
