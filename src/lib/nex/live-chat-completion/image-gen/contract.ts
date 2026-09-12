// src/lib/nex/live-chat-completion/image-gen/contract.ts
//
// Founder Phase 8 · P8-1 · Image Generation contract.
//
// ═══════════════════════════════════════════════════════════════════
// FOUNDER DOCTRINE (Image Generation companion to #3)
// ═══════════════════════════════════════════════════════════════════
//   "IMAGE GENERATION EXTRACTS INTENT · IMAGE OUTPUT NEVER ESTABLISHES TRUTH"
//
// The generated image is a rendering of the user's prompt — never a
// factual claim about the world. Downstream code MUST NOT treat a
// generated image as evidence for anything. Generated images are:
//   · Labelled clearly in the response envelope (image_kind: "generated")
//   · Watermarked with a NEX-generated attribution in metadata
//   · Stored with the prompt + model + hash in nex.generated_image
//   · Never convertible to an EvidenceItem
//
// Prompt safety:
//   · Doctrine #5 sanitiser runs against every prompt before it reaches
//     the provider (defence against prompt-injection in image workflows)
//   · Empty · trivially-short · obvious-hostile prompts rejected
//   · Provider-side safety (SD safety_checker) enforced when available

import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════
// Public request / response types
// ═══════════════════════════════════════════════════════════════════

export const ImageGenRequestSchema = z.object({
  prompt: z.string().min(3).max(2000),
  negative_prompt: z.string().max(1000).optional(),
  /** Common aspect ratios · width × height. Provider may snap to nearest supported. */
  width: z.number().int().min(64).max(2048).default(768),
  height: z.number().int().min(64).max(2048).default(768),
  /** Guidance scale (CFG). Provider default when omitted. */
  cfg_scale: z.number().min(0).max(30).optional(),
  /** Sampling steps. Provider default when omitted. */
  steps: z.number().int().min(1).max(150).optional(),
  /** Deterministic seed. -1 = random. */
  seed: z.number().int().default(-1),
  /** How many candidates to generate. Bounded by provider. */
  n: z.number().int().min(1).max(4).default(1),
  /** For observability + provenance. */
  conversation_id: z.string().max(120).optional(),
  /** Optional caller-supplied model_id override (subject to provider allowlist). */
  model_id: z.string().max(80).optional(),
  budget_ms: z.number().int().min(500).max(180_000).default(60_000),
});
export type ImageGenRequest = z.infer<typeof ImageGenRequestSchema>;

export interface ImageGenResultImage {
  /** Deterministic short id · imggen:<sha256(prompt+model+seed)>:<idx>. */
  ref_id: string;
  /** base64-encoded PNG bytes (data-URL prefix stripped). */
  content_base64: string;
  mime_type: string;              // "image/png"
  width: number;
  height: number;
  seed: number;                   // resolved seed (-1 → actual random from provider)
  /** Deterministic SHA-256 (16 chars) of the raw bytes · for de-dup + provenance. */
  content_hash: string;
}

export interface ImageGenResult {
  images: readonly ImageGenResultImage[];
  provider: string;
  model_id: string;
  prompt: string;
  negative_prompt: string | null;
  request_ms: number;
  completed: boolean;
  error?: string;
  safety_verdict: "clean" | "flagged" | "unknown";
}

export interface ImageGenProvider {
  name: string;
  generate(input: ImageGenRequest): Promise<ImageGenResult>;
}

// ═══════════════════════════════════════════════════════════════════
// Deterministic hash · sha256 first 16 chars
// ═══════════════════════════════════════════════════════════════════

export function hashImageContent(content_base64: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(content_base64).digest("hex").slice(0, 16);
}

export function makeImageRefId(prompt: string, model: string, seed: number, idx: number): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  const digest = createHash("sha256").update(`${prompt}|${model}|${seed}`).digest("hex").slice(0, 16);
  return `imggen:${digest}:${idx}`;
}

// ═══════════════════════════════════════════════════════════════════
// Prompt validation · lightweight · defence-in-depth alongside Doctrine #5.
// ═══════════════════════════════════════════════════════════════════

const _HOSTILE_PROMPT_RE = /\b(nude|naked|underage|child|csam|explicit sexual|beheading|weapon.*(schematic|blueprint)|make (a )?bomb)\b/i;

export function classifyPromptSafety(prompt: string): "clean" | "flagged" {
  return _HOSTILE_PROMPT_RE.test(prompt) ? "flagged" : "clean";
}
