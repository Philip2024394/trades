// src/lib/nex/file-extraction/pdf-extractor.ts
//
// Founder Phase 15 · P15-3 · PDF → plain text.
//
// Strategy (honest fallback ladder):
//   1. Try `pdf-parse` (best · handles most PDFs)
//   2. Fallback: naive stream scan (matches text between BT...ET blocks
//      for simple, uncompressed text PDFs — the kind produced by
//      "print-to-PDF from browser")
//   3. If both fail: completed=false with error="pdf_extractor_not_available"
//
// The fallback is intentionally naive · marked as such in provider name
// (pdf-naive) so downstream consumers know to trust text quality is lower.

import type { FileExtractor, FileExtractRequest, FileExtractResult } from "./contract";
import { hashFileContent } from "./contract";

const PDF_MIMES = new Set(["application/pdf", "application/x-pdf"]);

// ═══════════════════════════════════════════════════════════════════
// Naive fallback · extracts text between (...) inside BT...ET blocks
// ═══════════════════════════════════════════════════════════════════

function naiveExtract(buffer: Buffer): { text: string; page_count: number | null } {
  const s = buffer.toString("latin1");                        // preserve every byte
  const textParts: string[] = [];
  // Match every BT ... ET block
  const btEtRe = /BT\s([\s\S]*?)\sET/g;
  let m: RegExpExecArray | null;
  while ((m = btEtRe.exec(s)) !== null) {
    const block = m[1];
    // Text operator: (some text) Tj  |  [...] TJ
    const strRe = /\(((?:\\.|[^\\)])*)\)\s*(?:Tj|TJ|'|")/g;
    let sm: RegExpExecArray | null;
    while ((sm = strRe.exec(block)) !== null) {
      const raw = sm[1];
      // Decode standard PDF escapes
      const decoded = raw
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\")
        .replace(/\\(\d{1,3})/g, (_x, n: string) => String.fromCharCode(parseInt(n, 8)));
      textParts.push(decoded);
    }
    textParts.push("\n");
  }
  const pageMatches = s.match(/\/Type\s*\/Page\b/g);
  const page_count = pageMatches ? pageMatches.length : null;
  return { text: textParts.join("").replace(/\n{3,}/g, "\n\n").trim(), page_count };
}

// ═══════════════════════════════════════════════════════════════════
// Provider
// ═══════════════════════════════════════════════════════════════════

export function makePdfExtractor(): FileExtractor {
  return {
    name: "pdf",
    supports(mime: string): boolean {
      return PDF_MIMES.has(mime);
    },
    async extract(input: FileExtractRequest, buffer: Buffer): Promise<FileExtractResult> {
      const t0 = performance.now();
      const file_hash = hashFileContent(input.content_base64);

      // Try pdf-parse first · dynamic import so absence is not fatal at module load.
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require("pdf-parse") as (b: Buffer) => Promise<{ text: string; numpages: number }>;
        const out = await pdfParse(buffer);
        return {
          extraction_id: `ext:${file_hash}`,
          text: out.text.trim(),
          provider: "pdf-parse",
          mime_type: input.mime_type,
          filename: input.filename ?? null,
          file_hash,
          bytes: buffer.length,
          text_length: out.text.trim().length,
          page_count: out.numpages ?? null,
          request_ms: Math.round(performance.now() - t0),
          completed: out.text.trim().length > 0,
        };
      } catch { /* fall through to naive */ }

      // Naive fallback.
      try {
        const { text, page_count } = naiveExtract(buffer);
        return {
          extraction_id: `ext:${file_hash}`,
          text,
          provider: "pdf-naive",
          mime_type: input.mime_type,
          filename: input.filename ?? null,
          file_hash,
          bytes: buffer.length,
          text_length: text.length,
          page_count,
          request_ms: Math.round(performance.now() - t0),
          completed: text.length > 0,
          error: text.length === 0 ? "pdf_naive_no_text_extracted" : undefined,
        };
      } catch (e) {
        return {
          extraction_id: `ext:${file_hash}`,
          text: "",
          provider: "pdf-naive",
          mime_type: input.mime_type,
          filename: input.filename ?? null,
          file_hash,
          bytes: buffer.length,
          text_length: 0,
          page_count: null,
          request_ms: Math.round(performance.now() - t0),
          completed: false,
          error: e instanceof Error ? `pdf_naive_error:${e.message.slice(0, 80)}` : "pdf_extractor_not_available",
        };
      }
    },
  };
}
