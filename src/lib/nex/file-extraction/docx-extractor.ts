// src/lib/nex/file-extraction/docx-extractor.ts
//
// Founder Phase 15 · P15-2 · DOCX → plain text.
//
// DOCX is a ZIP archive containing word/document.xml. We stream the zip
// with `unzipper`, pull document.xml out, and:
//   · replace <w:p> with newlines (paragraph boundaries)
//   · replace <w:tab/> with tabs
//   · strip every other <...> tag
//   · decode &amp; &lt; &gt; &quot; &apos; and numeric entities
//
// No external calls · fully deterministic · same DOCX → same text.

import type { FileExtractor, FileExtractRequest, FileExtractResult } from "./contract";
import { hashFileContent } from "./contract";

const DOCX_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",                                          // legacy alias (won't extract .doc content)
]);

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function xmlToText(xml: string): string {
  return decodeEntities(
    xml
      // Paragraphs → newline (match self-closing or paired)
      .replace(/<w:p\s*[^>]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      // Tabs → \t
      .replace(/<w:tab\s*[^>]*\/>/g, "\t")
      // Line breaks → \n
      .replace(/<w:br\s*[^>]*\/>/g, "\n")
      // Everything else: strip tags
      .replace(/<[^>]+>/g, "")
      // Collapse runs of horizontal whitespace but preserve newlines
      .replace(/[ \t]+/g, " ")
      // Collapse triple newlines
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

export function makeDocxExtractor(): FileExtractor {
  return {
    name: "docx-unzipper",
    supports(mime: string): boolean {
      return DOCX_MIMES.has(mime) || mime.endsWith(".document");
    },
    async extract(input: FileExtractRequest, buffer: Buffer): Promise<FileExtractResult> {
      const t0 = performance.now();
      const file_hash = hashFileContent(input.content_base64);
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const unzipper = require("unzipper") as typeof import("unzipper");
        const directory = await unzipper.Open.buffer(buffer);
        const docEntry = directory.files.find((f) => f.path === "word/document.xml");
        if (!docEntry) {
          return {
            extraction_id: `ext:${file_hash}`,
            text: "",
            provider: "docx-unzipper",
            mime_type: input.mime_type,
            filename: input.filename ?? null,
            file_hash,
            bytes: buffer.length,
            text_length: 0,
            page_count: null,
            request_ms: Math.round(performance.now() - t0),
            completed: false,
            error: "docx_missing_document_xml",
          };
        }
        const xmlBuf = await docEntry.buffer();
        const xml = xmlBuf.toString("utf8");
        const text = xmlToText(xml);
        return {
          extraction_id: `ext:${file_hash}`,
          text,
          provider: "docx-unzipper",
          mime_type: input.mime_type,
          filename: input.filename ?? null,
          file_hash,
          bytes: buffer.length,
          text_length: text.length,
          page_count: null,
          request_ms: Math.round(performance.now() - t0),
          completed: text.length > 0,
        };
      } catch (e) {
        return {
          extraction_id: `ext:${file_hash}`,
          text: "",
          provider: "docx-unzipper",
          mime_type: input.mime_type,
          filename: input.filename ?? null,
          file_hash,
          bytes: buffer.length,
          text_length: 0,
          page_count: null,
          request_ms: Math.round(performance.now() - t0),
          completed: false,
          error: e instanceof Error ? `docx_parse_error:${e.message.slice(0, 80)}` : "docx_parse_error",
        };
      }
    },
  };
}
