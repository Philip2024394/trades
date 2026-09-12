// src/lib/nex/live-chat-completion/vision/contract.ts
//
// Founder BEGIN Phase 3.8 · Vision input contract.
//
// User attaches a photo (receipt, menu, property, business card, address
// sign). NEX extracts STRUCTURED facts about the image and feeds them as
// evidence into the same Truth-Engine-gated pipeline every other source
// uses.
//
// Rules enforced by contract:
//   1. Every extracted fact declares a `category` (receipt / menu / facility /
//      contact / address / other) so downstream policy can gate.
//   2. Every fact has a `confidence` 0..1 · providers must be honest.
//   3. Trust band on vision-derived evidence is CAPPED at
//      "evidence_provisional" · never canonical_verified. Users can't
//      elevate NEX's canonical facts via a photo without human review.
//   4. Every fact carries a stable `source_ref` (vision:<image_hash>:<i>)
//      so the LLM rescue Fabrication Gate can validate citations exactly
//      like it does for canonical / semantic / web evidence.
//   5. Providers MUST return structured JSON matching the Zod schema.
//      Non-conforming output → zero extracted facts (no facts is better
//      than fabricated facts).

import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════
// Fact categories · gate policy uses these
// ═══════════════════════════════════════════════════════════════════

export type VisionFactCategory =
  | "receipt"        // hotel bill / restaurant check / transport receipt
  | "menu"           // food or drink menu · pricing lists
  | "facility"       // amenity signage · pool photo · wifi sticker · gym
  | "contact"        // phone number · email · handle visible in the image
  | "address"        // street sign · building nameplate · address panel
  | "identity_document" // passport / KTP · REJECTED downstream by default
  | "other";

// ═══════════════════════════════════════════════════════════════════
// Provider output shape (Zod-strict)
// ═══════════════════════════════════════════════════════════════════

export const VisionExtractedFactSchema = z.object({
  claim_text: z.string().min(1).max(500),
  category: z.enum([
    "receipt", "menu", "facility", "contact", "address", "identity_document", "other",
  ]),
  confidence: z.number().min(0).max(1),
  /** Optional bounding-box hint · not required · providers may omit. */
  region: z.object({
    x: z.number(), y: z.number(), w: z.number(), h: z.number(),
  }).optional(),
});
export type VisionExtractedFact = z.infer<typeof VisionExtractedFactSchema>;

export const VisionProviderOutputSchema = z.object({
  facts: z.array(VisionExtractedFactSchema).max(30),
  /** Best-effort caption of the image, never used as a fact citation. */
  overall_caption: z.string().max(500).optional(),
  /** Provider-declared confidence in overall extraction (0..1). */
  extraction_confidence: z.number().min(0).max(1).default(0.5),
});
export type VisionProviderOutput = z.infer<typeof VisionProviderOutputSchema>;

// ═══════════════════════════════════════════════════════════════════
// Provider interface
// ═══════════════════════════════════════════════════════════════════

export interface VisionExtractInput {
  /** Raw base64 (no data-URI prefix). */
  image_base64: string;
  /** MIME type · used by provider to pick decoder path. */
  mime_type?: string;
  /** Free-text hint the user typed alongside the image · guides extraction. */
  hint?: string;
  /** Language for extracted claim_text (en · id). */
  language?: "en" | "id";
  budget_ms: number;
  signal?: AbortSignal;
}

export interface VisionExtractResult {
  output: VisionProviderOutput | null;
  provider_meta: {
    provider: string;
    request_ms: number;
    completed: boolean;
    error?: string;
    image_hash: string;   // deterministic short id of the source image
  };
}

export interface VisionProvider {
  name: string;
  extract(input: VisionExtractInput): Promise<VisionExtractResult>;
}

// ═══════════════════════════════════════════════════════════════════
// Deterministic image hash · sha256 first 16 hex chars of base64 payload
// ═══════════════════════════════════════════════════════════════════

export function hashImageBase64(image_base64: string): string {
  // Node's crypto is dynamic-loaded to keep the module edge-runtime-safe
  // if the deployment ever moves off Node.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(image_base64).digest("hex").slice(0, 16);
}
