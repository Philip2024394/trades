// src/lib/nex/live-chat-completion/vision/mock-provider.ts
//
// Founder BEGIN Phase 3.8 · Mock vision provider for regression.
//
// Deterministic extractions keyed on the `hint` field. Lets the whole
// vision → evidence → Fabrication-Gate path be exercised without a real
// vision model.
//
// Scenarios (matches on lowercase hint):
//   contains "receipt"  → 3 receipt facts (hotel name · nights · total)
//   contains "menu"     → 2 menu facts (dish · price)
//   contains "facility" → 2 facility facts (amenity · label)
//   contains "contact"  → 2 contact facts (phone · email)
//   contains "empty"    → 0 facts, extraction_confidence 0.3
//   default             → 1 generic fact

import type { VisionProvider, VisionExtractInput, VisionExtractResult } from "./contract";
import { hashImageBase64 } from "./contract";

export function makeMockVisionProvider(): VisionProvider {
  return {
    name: "mock-vision",
    async extract(input: VisionExtractInput): Promise<VisionExtractResult> {
      const t0 = performance.now();
      const hint = String(input.hint ?? "").toLowerCase();
      const hash = hashImageBase64(input.image_base64);

      let facts: VisionExtractResult["output"]["facts"] = [];
      let caption = "Mock extraction · deterministic scenario";
      let extractionConfidence = 0.5;

      if (hint.includes("empty")) {
        facts = [];
        extractionConfidence = 0.3;
        caption = "Mock: no legible content detected";
      } else if (hint.includes("receipt")) {
        facts = [
          { claim_text: "Hotel name: Hotel Gaotama", category: "receipt", confidence: 0.85 },
          { claim_text: "Nights: 2", category: "receipt", confidence: 0.9 },
          { claim_text: "Total: Rp 480,000", category: "receipt", confidence: 0.8 },
        ];
        extractionConfidence = 0.85;
        caption = "Mock receipt: 2-night hotel bill";
      } else if (hint.includes("menu")) {
        facts = [
          { claim_text: "Nasi Goreng Special — Rp 45,000", category: "menu", confidence: 0.9 },
          { claim_text: "Es Teh Manis — Rp 8,000", category: "menu", confidence: 0.9 },
        ];
        extractionConfidence = 0.9;
        caption = "Mock menu: 2 items with prices";
      } else if (hint.includes("facility")) {
        facts = [
          { claim_text: "Free Wi-Fi signage visible", category: "facility", confidence: 0.75 },
          { claim_text: "Swimming pool photo", category: "facility", confidence: 0.7 },
        ];
        extractionConfidence = 0.75;
      } else if (hint.includes("contact")) {
        facts = [
          { claim_text: "Phone: +62 812 3456 7890", category: "contact", confidence: 0.8 },
          { claim_text: "Email: bookings@example.id", category: "contact", confidence: 0.8 },
        ];
        extractionConfidence = 0.8;
      } else {
        facts = [
          { claim_text: "Building exterior · generic mock output", category: "other", confidence: 0.4 },
        ];
        extractionConfidence = 0.4;
      }

      // All good · construct output.
      return {
        output: {
          facts,
          overall_caption: caption,
          extraction_confidence: extractionConfidence,
        },
        provider_meta: {
          provider: "mock-vision",
          request_ms: Math.round(performance.now() - t0),
          completed: true,
          image_hash: hash,
        },
      };
    },
  };
}
