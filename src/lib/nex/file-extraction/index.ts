// src/lib/nex/file-extraction/index.ts
//
// Founder Phase 15 · File extraction aggregator.
//
// Routes an incoming file to the first extractor that supports() its mime.

import type { FileExtractor, FileExtractRequest, FileExtractResult } from "./contract";
import { makeDocxExtractor } from "./docx-extractor";
import { makePdfExtractor } from "./pdf-extractor";
import { makeTextExtractor } from "./text-extractor";
import { makeOcrExtractor } from "./ocr-extractor";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";
import { hashFileContent } from "./contract";

export * from "./contract";

let _extractors: FileExtractor[] | null = null;

function extractors(): FileExtractor[] {
  if (_extractors) return _extractors;
  _extractors = [
    makeDocxExtractor(),
    makePdfExtractor(),
    makeOcrExtractor(),                // routes image/* mimes to Tesseract
    makeTextExtractor(),
  ];
  return _extractors;
}

export async function extractFile(input: FileExtractRequest): Promise<FileExtractResult> {
  const buffer = Buffer.from(input.content_base64, "base64");
  const file_hash = hashFileContent(input.content_base64);

  for (const ex of extractors()) {
    if (ex.supports(input.mime_type)) {
      return ex.extract(input, buffer);
    }
  }
  // Unsupported mime · return honest UNKNOWN.
  return {
    extraction_id: `ext:${file_hash}`,
    text: "",
    provider: "unsupported",
    mime_type: input.mime_type,
    filename: input.filename ?? null,
    file_hash,
    bytes: buffer.length,
    text_length: 0,
    page_count: null,
    request_ms: 0,
    completed: false,
    error: `unsupported_mime:${input.mime_type}`,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Provenance · fire-and-forget
// ═══════════════════════════════════════════════════════════════════

export function persistExtraction(
  result: FileExtractResult,
  ctx: { conversation_id: string | null; user_id: string | null; sanitiser_neutralised: number },
): void {
  void (async () => {
    try {
      const pool = getKnowledgeFactoryDbPool();
      await pool.query(
        `INSERT INTO nex.file_extraction
           (extraction_id, conversation_id, user_id, provider, mime_type, file_hash,
            filename, bytes, text_length, page_count, request_ms, completed, error,
            sanitiser_neutralised)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (extraction_id) DO NOTHING`,
        [result.extraction_id, ctx.conversation_id, ctx.user_id, result.provider,
         result.mime_type, result.file_hash, result.filename, result.bytes,
         result.text_length, result.page_count, result.request_ms, result.completed,
         result.error ?? null, ctx.sanitiser_neutralised],
      );
    } catch { /* provenance is best-effort */ }
  })();
}
