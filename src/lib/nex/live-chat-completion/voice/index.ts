// src/lib/nex/live-chat-completion/voice/index.ts
//
// Founder Phase 12 · Voice pipeline aggregator.
//
// Provider selection:
//   NEX_VOICE_PROVIDER=mock   → mock STT + mock TTS
//   NEX_VOICE_PROVIDER=real   → whisper.cpp + piper (with honest fallback)
//   default                    → mock

import { makeMockSttProvider, makeMockTtsProvider } from "./mock-providers";
import { makeWhisperSttProvider, makePiperTtsProvider } from "./real-providers";
import type { SttProvider, TtsProvider, SttResult, TtsResult } from "./contract";
import { withClient } from "@/lib/nex/db";

export * from "./contract";

export function makeDefaultSttProvider(): SttProvider {
  const kind = process.env.NEX_VOICE_PROVIDER ?? "mock";
  return kind === "real" ? makeWhisperSttProvider() : makeMockSttProvider();
}

export function makeDefaultTtsProvider(): TtsProvider {
  const kind = process.env.NEX_VOICE_PROVIDER ?? "mock";
  return kind === "real" ? makePiperTtsProvider() : makeMockTtsProvider();
}

// ═══════════════════════════════════════════════════════════════════
// Provenance persistence · fire-and-forget · null-pool = no-op
// ═══════════════════════════════════════════════════════════════════

export function persistTranscript(result: SttResult, conversation_id: string | null): void {
  void (async () => {
    try {
      await withClient(async (c) => {
        await c.query(
          `INSERT INTO nex.voice_transcript
             (transcript_id, conversation_id, provider, model_id, language, text, confidence,
              audio_hash, duration_s, request_ms, completed, error)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (transcript_id) DO NOTHING`,
          [result.transcript_id, conversation_id, result.provider, result.model_id, result.language,
           result.text, result.confidence, result.audio_hash, result.duration_s,
           result.request_ms, result.completed, result.error ?? null],
        );
      });
    } catch { /* provenance is best-effort */ }
  })();
}

export function persistSynthesis(result: TtsResult, conversation_id: string | null): void {
  void (async () => {
    try {
      await withClient(async (c) => {
        await c.query(
          `INSERT INTO nex.voice_synthesis
             (synth_id, conversation_id, provider, model_id, voice, text_hash,
              mime_type, duration_s, request_ms, completed, error)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (synth_id) DO NOTHING`,
          [result.synth_id, conversation_id, result.provider, result.model_id, result.voice,
           result.text_hash, result.mime_type, result.duration_s, result.request_ms,
           result.completed, result.error ?? null],
        );
      });
    } catch { /* provenance is best-effort */ }
  })();
}
