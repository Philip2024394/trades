// src/lib/nex/live-chat-completion/files/real-provider.ts
//
// Founder BEGIN Phase 3.9 · Real file provider.
//
// Routes by mime_type:
//   text/plain             → decode base64 · chunk lines · return plain_text facts
//   image/jpeg|png|webp    → delegate to Ollama vision provider (Phase 3.8)
//   application/pdf        → honest fallback · returns 0 facts + note
//                            (text extraction from arbitrary PDFs requires
//                             a text-parser dependency · future BEGIN)
//
// Zero paid API. Non-fatal on any failure (honest empty output).

import type { FileProvider, FileExtractInput, FileExtractResult, FileExtractedFact } from "./contract";
import { hashFileBase64 } from "./contract";
import { makeOllamaVisionProvider } from "@/lib/nex/live-chat-completion/vision/ollama-provider";
import type { VisionExtractedFact } from "@/lib/nex/live-chat-completion/vision/contract";

const _vision = makeOllamaVisionProvider();

const MAX_TEXT_FACTS = 30;
const CHUNK_MIN_CHARS = 20;

export function makeRealFileProvider(): FileProvider {
  return {
    name: "real-file",
    async extract(input: FileExtractInput): Promise<FileExtractResult> {
      const t0 = performance.now();
      const hash = hashFileBase64(input.content_base64);
      const raw = Buffer.from(input.content_base64, "base64");
      const sizeBytes = raw.length;

      // ── text/plain ────────────────────────────────────────────────
      if (input.mime_type === "text/plain") {
        const text = raw.toString("utf8");
        const lines = text.split(/\n+/).map((l) => l.trim()).filter((l) => l.length >= CHUNK_MIN_CHARS).slice(0, MAX_TEXT_FACTS);
        const facts: FileExtractedFact[] = lines.map((l) => ({
          claim_text: l.slice(0, 500),
          category: "plain_text" as const,
          confidence: 0.6,
        }));
        return {
          output: {
            facts,
            overall_caption: `Plain-text file · ${lines.length} lines extracted`,
            extraction_confidence: facts.length > 0 ? 0.6 : 0.3,
          },
          provider_meta: {
            provider: "real-file",
            request_ms: Math.round(performance.now() - t0),
            completed: true,
            file_hash: hash,
            file_size_bytes: sizeBytes,
            mime_type: input.mime_type,
          },
        };
      }

      // ── image · delegate to vision ────────────────────────────────
      if (["image/jpeg", "image/png", "image/webp"].includes(input.mime_type)) {
        try {
          const v = await _vision.extract({
            image_base64: input.content_base64,
            mime_type: input.mime_type,
            hint: input.hint,
            language: input.language,
            budget_ms: input.budget_ms,
            signal: input.signal,
          });
          const mapped: FileExtractedFact[] = (v.output?.facts ?? []).map((f: VisionExtractedFact) => ({
            claim_text: f.claim_text,
            // Map vision categories → file categories (best-effort · same enum where they overlap).
            category: (f.category === "menu" || f.category === "receipt" || f.category === "contact") ? f.category : "other",
            confidence: f.confidence,
          }));
          return {
            output: {
              facts: mapped,
              overall_caption: v.output?.overall_caption ?? "Image file · vision-extracted",
              extraction_confidence: v.output?.extraction_confidence ?? 0.5,
            },
            provider_meta: {
              provider: "real-file",
              request_ms: Math.round(performance.now() - t0),
              completed: v.provider_meta.completed,
              error: v.provider_meta.error,
              file_hash: hash,
              file_size_bytes: sizeBytes,
              mime_type: input.mime_type,
            },
          };
        } catch (e) {
          return honestEmpty(t0, hash, sizeBytes, input.mime_type,
            e instanceof Error ? `vision_delegate_error:${e.message.slice(0, 80)}` : "vision_delegate_error");
        }
      }

      // ── application/pdf · honest fallback ─────────────────────────
      if (input.mime_type === "application/pdf") {
        return honestEmpty(t0, hash, sizeBytes, input.mime_type,
          "pdf_text_extraction_not_supported_yet · consider uploading each page as an image");
      }

      // ── unknown mime_type ─────────────────────────────────────────
      return honestEmpty(t0, hash, sizeBytes, input.mime_type, `unsupported_mime_type:${input.mime_type}`);
    },
  };
}

function honestEmpty(t0: number, file_hash: string, size: number, mime: string, error: string): FileExtractResult {
  return {
    output: {
      facts: [],
      overall_caption: undefined,
      extraction_confidence: 0.1,
    },
    provider_meta: {
      provider: "real-file",
      request_ms: Math.round(performance.now() - t0),
      completed: false,
      error,
      file_hash,
      file_size_bytes: size,
      mime_type: mime,
    },
  };
}
