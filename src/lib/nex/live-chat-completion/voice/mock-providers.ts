// src/lib/nex/live-chat-completion/voice/mock-providers.ts
//
// Founder Phase 12 · P12-2 · Deterministic mock STT + TTS providers.
//
// Used for regression matrix. Hash-stable · same input → same output.

import type { SttProvider, SttRequest, SttResult, TtsProvider, TtsRequest, TtsResult } from "./contract";
import { hashAudioBase64, hashText } from "./contract";

// Minimal 44-byte WAV header for a 1-sample mono 8kHz PCM · silence.
// Used by the mock TTS provider so the returned data-URL is a valid WAV.
const _TINY_WAV_B64 = "UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAACAgICAgICAgICA";

// ═══════════════════════════════════════════════════════════════════
// Mock STT · deterministic transcript from audio hash keyword scan
// ═══════════════════════════════════════════════════════════════════

const _MOCK_STT_SCENARIOS: Array<{ marker: RegExp; text: string; language: string }> = [
  { marker: /^SGVsbG8/i, text: "hello", language: "en" },
  { marker: /^SGFsbG8/i, text: "halo", language: "id" },
  { marker: /^b3B0aW9u/i, text: "options please", language: "en" },
];

export function makeMockSttProvider(): SttProvider {
  return {
    name: "mock-stt",
    async transcribe(input: SttRequest): Promise<SttResult> {
      const t0 = performance.now();
      const audio_hash = hashAudioBase64(input.audio_base64);
      // Deterministic transcript derivation.
      let text = "mock transcript · replace with whisper.cpp for real speech";
      let language = input.language === "auto" ? "en" : input.language;
      for (const s of _MOCK_STT_SCENARIOS) {
        if (s.marker.test(input.audio_base64)) { text = s.text; language = s.language; break; }
      }
      return {
        transcript_id: `stt:${audio_hash}`,
        text,
        language,
        confidence: 0.85,
        duration_s: null,
        audio_hash,
        provider: "mock-stt",
        model_id: input.model_id ?? "mock",
        request_ms: Math.round(performance.now() - t0),
        completed: true,
      };
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// Mock TTS · returns tiny valid WAV
// ═══════════════════════════════════════════════════════════════════

export function makeMockTtsProvider(): TtsProvider {
  return {
    name: "mock-tts",
    async synthesize(input: TtsRequest): Promise<TtsResult> {
      const t0 = performance.now();
      const text_hash = hashText(input.text, input.voice);
      return {
        synth_id: `tts:${text_hash}`,
        content_base64: _TINY_WAV_B64,
        mime_type: "audio/wav",
        duration_s: 0.0125,
        text_hash,
        voice: input.voice,
        provider: "mock-tts",
        model_id: input.model_id ?? "mock",
        request_ms: Math.round(performance.now() - t0),
        completed: true,
      };
    },
  };
}
