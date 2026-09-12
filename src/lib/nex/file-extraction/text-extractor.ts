// src/lib/nex/file-extraction/text-extractor.ts
//
// Founder Phase 15 · P15-3 · text/* + application/json + text-like MIMEs.
//
// Direct UTF-8 decode · truncated to 500KB text length to prevent
// runaway extractions from user-uploaded logs.

import type { FileExtractor, FileExtractRequest, FileExtractResult } from "./contract";
import { hashFileContent } from "./contract";

const MAX_TEXT_LEN = 500_000;

function looksTextual(mime: string): boolean {
  return (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml" ||
    mime === "application/x-yaml" ||
    mime === "application/x-toml" ||
    mime === "application/javascript" ||
    mime === "application/typescript"
  );
}

export function makeTextExtractor(): FileExtractor {
  return {
    name: "text-plain",
    supports(mime: string): boolean {
      return looksTextual(mime);
    },
    async extract(input: FileExtractRequest, buffer: Buffer): Promise<FileExtractResult> {
      const t0 = performance.now();
      const file_hash = hashFileContent(input.content_base64);
      const decoded = buffer.toString("utf8");
      const text = decoded.length > MAX_TEXT_LEN ? decoded.slice(0, MAX_TEXT_LEN) : decoded;
      return {
        extraction_id: `ext:${file_hash}`,
        text,
        provider: "text-plain",
        mime_type: input.mime_type,
        filename: input.filename ?? null,
        file_hash,
        bytes: buffer.length,
        text_length: text.length,
        page_count: null,
        request_ms: Math.round(performance.now() - t0),
        completed: text.length > 0,
      };
    },
  };
}
