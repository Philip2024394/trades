// src/lib/nex/file-extraction/ocr-extractor.ts
//
// Founder Phase 22 · P22-1 · OCR extractor for image inputs.
//
// Uses tesseract.js when available. If the library or its language data
// isn't installed, falls back to honest UNKNOWN with error="ocr_not_available"
// — never fabricates text.
//
// Discipline mirror of docx-extractor / pdf-extractor · consistent
// FileExtractor contract · so /api/nex/file/extract can route to it
// transparently for any image/* mime.

import type { FileExtractor, FileExtractRequest, FileExtractResult } from "./contract";
import { hashFileContent } from "./contract";

const IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/bmp",
  "image/tiff",
]);

let _workerPromise: Promise<{
  recognize: (buf: Buffer) => Promise<{ data: { text: string; confidence?: number } }>;
  terminate?: () => Promise<void>;
} | null> | null = null;

async function getWorker(): Promise<{
  recognize: (buf: Buffer) => Promise<{ data: { text: string; confidence?: number } }>;
  terminate?: () => Promise<void>;
} | null> {
  if (_workerPromise) return _workerPromise;
  _workerPromise = (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const tess = require("tesseract.js") as typeof import("tesseract.js");
      const langs = (process.env.NEX_OCR_LANGS ?? "eng").trim();
      const worker = await tess.createWorker(langs, undefined, {
        // keep tesseract quiet · we surface errors ourselves
        logger: () => { /* silent */ },
        errorHandler: () => { /* silent */ },
      });
      return worker as unknown as { recognize: (b: Buffer) => Promise<{ data: { text: string; confidence?: number } }>; terminate?: () => Promise<void> };
    } catch {
      return null;
    }
  })();
  return _workerPromise;
}

export function makeOcrExtractor(): FileExtractor {
  return {
    name: "ocr-tesseract",
    supports(mime: string): boolean {
      return IMAGE_MIMES.has(mime);
    },
    async extract(input: FileExtractRequest, buffer: Buffer): Promise<FileExtractResult> {
      const t0 = performance.now();
      const file_hash = hashFileContent(input.content_base64);
      const worker = await getWorker();
      if (!worker) {
        return {
          extraction_id: `ext:${file_hash}`,
          text: "",
          provider: "ocr-not-available",
          mime_type: input.mime_type,
          filename: input.filename ?? null,
          file_hash,
          bytes: buffer.length,
          text_length: 0,
          page_count: 1,
          request_ms: Math.round(performance.now() - t0),
          completed: false,
          error: "ocr_binary_not_available",
        };
      }
      try {
        const r = await worker.recognize(buffer);
        const text = (r?.data?.text ?? "").trim();
        return {
          extraction_id: `ext:${file_hash}`,
          text,
          provider: "ocr-tesseract",
          mime_type: input.mime_type,
          filename: input.filename ?? null,
          file_hash,
          bytes: buffer.length,
          text_length: text.length,
          page_count: 1,
          request_ms: Math.round(performance.now() - t0),
          completed: text.length > 0,
          error: text.length === 0 ? "ocr_no_text_detected" : undefined,
        };
      } catch (e) {
        return {
          extraction_id: `ext:${file_hash}`,
          text: "",
          provider: "ocr-tesseract",
          mime_type: input.mime_type,
          filename: input.filename ?? null,
          file_hash,
          bytes: buffer.length,
          text_length: 0,
          page_count: 1,
          request_ms: Math.round(performance.now() - t0),
          completed: false,
          error: e instanceof Error ? `ocr_error:${e.message.slice(0, 80)}` : "ocr_error",
        };
      }
    },
  };
}
