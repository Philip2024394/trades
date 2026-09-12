// src/lib/nex/live-chat-completion/voice/contract.ts
//
// Founder Phase 12 · P12-1 · Voice pipeline contract.
//
// ═══════════════════════════════════════════════════════════════════
// FOUNDER DOCTRINE (Voice companion)
// ═══════════════════════════════════════════════════════════════════
//   "VOICE INPUT IS TRANSCRIPT · VOICE OUTPUT IS SYNTHESIS ·
//    NEITHER ESTABLISHES TRUTH"
//
// A user's speech becomes an INPUT (transcript · confidence 0..1).
// NEX's spoken response is a RENDERING (synthesis · not a factual claim).
// Neither ever becomes an EvidenceItem. Truth still lives in the same
// Fabrication-Gate-v2-validated evidence chain regardless of input mode.
//
// Prompt safety:
//   · Doctrine #5 sanitiser runs against every synthesized text before
//     it reaches the TTS provider (defence against injected control chars,
//     hostile whitespace tricks, etc.)
//   · Transcripts flow into the chat pipeline as if the user had typed
//     them · same guardrails apply.

import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════
// STT (Speech-to-Text)
// ═══════════════════════════════════════════════════════════════════

export const SttRequestSchema = z.object({
  audio_base64: z.string().min(4).max(10_000_000),
  mime_type: z.enum(["audio/wav", "audio/mpeg", "audio/mp3", "audio/webm", "audio/ogg", "audio/flac"]).default("audio/wav"),
  language: z.enum(["en", "id", "auto"]).default("auto"),
  model_id: z.string().max(80).optional(),
  conversation_id: z.string().max(120).optional(),
  budget_ms: z.number().int().min(500).max(120_000).default(30_000),
});
export type SttRequest = z.infer<typeof SttRequestSchema>;

export interface SttResult {
  transcript_id: string;                // stt:<hash>
  text: string;
  language: string;
  confidence: number;                    // 0..1
  duration_s: number | null;
  audio_hash: string;
  provider: string;
  model_id: string;
  request_ms: number;
  completed: boolean;
  error?: string;
}

export interface SttProvider {
  name: string;
  transcribe(input: SttRequest): Promise<SttResult>;
}

// ═══════════════════════════════════════════════════════════════════
// TTS (Text-to-Speech)
// ═══════════════════════════════════════════════════════════════════

export const TtsRequestSchema = z.object({
  text: z.string().min(1).max(4000),
  voice: z.string().max(80).default("en_US-lessac-medium"),
  language: z.enum(["en", "id"]).default("en"),
  model_id: z.string().max(80).optional(),
  speed: z.number().min(0.5).max(2.0).default(1.0),
  conversation_id: z.string().max(120).optional(),
  budget_ms: z.number().int().min(500).max(120_000).default(30_000),
});
export type TtsRequest = z.infer<typeof TtsRequestSchema>;

export interface TtsResult {
  synth_id: string;                      // tts:<hash>
  content_base64: string;
  mime_type: string;                     // "audio/wav" or "audio/mpeg"
  duration_s: number | null;
  text_hash: string;
  voice: string;
  provider: string;
  model_id: string;
  request_ms: number;
  completed: boolean;
  error?: string;
}

export interface TtsProvider {
  name: string;
  synthesize(input: TtsRequest): Promise<TtsResult>;
}

// ═══════════════════════════════════════════════════════════════════
// Deterministic hash helpers
// ═══════════════════════════════════════════════════════════════════

export function hashAudioBase64(content_base64: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(content_base64).digest("hex").slice(0, 16);
}

export function hashText(text: string, voice: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(`${text}|${voice}`).digest("hex").slice(0, 16);
}
