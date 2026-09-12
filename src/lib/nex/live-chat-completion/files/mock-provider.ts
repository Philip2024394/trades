// src/lib/nex/live-chat-completion/files/mock-provider.ts
//
// Founder BEGIN Phase 3.9 · Mock file provider for regression.
//
// Deterministic extractions keyed on filename + hint. Exercises the whole
// file-upload → evidence → Fabrication-Gate path without touching real
// PDF parsing or vision inference.
//
// Scenarios (matches on lowercase filename + hint):
//   contains "brochure"  → 4 brochure facts (hotel name / room count / amenities / rate)
//   contains "menu"      → 3 menu facts
//   contains "booking"   → 3 booking facts (guest / dates / total)
//   contains "policy"    → 2 policy facts
//   contains "empty"     → 0 facts, low extraction confidence
//   default              → 1 generic fact

import type { FileProvider, FileExtractInput, FileExtractResult, FileExtractedFact } from "./contract";
import { hashFileBase64 } from "./contract";

export function makeMockFileProvider(): FileProvider {
  return {
    name: "mock-file",
    async extract(input: FileExtractInput): Promise<FileExtractResult> {
      const t0 = performance.now();
      const combined = `${String(input.filename ?? "")} ${String(input.hint ?? "")}`.toLowerCase();
      const hash = hashFileBase64(input.content_base64);
      const sizeBytes = Buffer.from(input.content_base64, "base64").length;

      let facts: FileExtractedFact[] = [];
      let caption = "Mock file extraction · deterministic";
      let extractionConfidence = 0.5;

      if (combined.includes("empty")) {
        facts = [];
        extractionConfidence = 0.3;
        caption = "Mock: no legible content";
      } else if (combined.includes("brochure")) {
        facts = [
          { claim_text: "Hotel: Hotel Gaotama", category: "brochure", confidence: 0.9, page: 0 },
          { claim_text: "Rooms: 45", category: "brochure", confidence: 0.8, page: 0 },
          { claim_text: "Amenities: Wi-Fi, breakfast, parking", category: "brochure", confidence: 0.75, page: 1 },
          { claim_text: "Nightly rate from: Rp 350,000", category: "brochure", confidence: 0.7, page: 1 },
        ];
        extractionConfidence = 0.8;
        caption = "Mock brochure: 2-page PDF";
      } else if (combined.includes("menu")) {
        facts = [
          { claim_text: "Nasi Goreng Special — Rp 45,000", category: "menu", confidence: 0.9, page: 0 },
          { claim_text: "Ayam Bakar — Rp 55,000", category: "menu", confidence: 0.9, page: 0 },
          { claim_text: "Es Teh Manis — Rp 8,000", category: "menu", confidence: 0.9, page: 0 },
        ];
        extractionConfidence = 0.9;
      } else if (combined.includes("booking")) {
        facts = [
          { claim_text: "Guest: J. Smith", category: "booking", confidence: 0.85 },
          { claim_text: "Check-in: 2026-10-15, Check-out: 2026-10-17", category: "booking", confidence: 0.9 },
          { claim_text: "Total: Rp 700,000", category: "booking", confidence: 0.85 },
        ];
        extractionConfidence = 0.85;
      } else if (combined.includes("policy")) {
        facts = [
          { claim_text: "Cancellation: free up to 48h before check-in", category: "policy", confidence: 0.85 },
          { claim_text: "Pets: not allowed", category: "policy", confidence: 0.75 },
        ];
        extractionConfidence = 0.8;
      } else {
        facts = [
          { claim_text: "Uploaded document · generic mock output", category: "other", confidence: 0.35 },
        ];
        extractionConfidence = 0.4;
      }

      return {
        output: { facts, overall_caption: caption, extraction_confidence: extractionConfidence },
        provider_meta: {
          provider: "mock-file",
          request_ms: Math.round(performance.now() - t0),
          completed: true,
          file_hash: hash,
          file_size_bytes: sizeBytes,
          mime_type: input.mime_type,
        },
      };
    },
  };
}
