// NEX Voice · public barrel.
//
// This file re-exports the provider factory, types, and orchestration hook.
// Callers should import everything from '@/lib/nex-voice' — never reach
// into providers/ or useNexVoice directly.
//
// Architecture:
//   · types.ts             — permanent NexVoiceProvider interface
//   · providers/*.ts       — swappable adapters (browser, groq, elevenlabs…)
//   · factory.ts           — provider dispatch (env / config)
//   · useNexVoice.ts       — SINGLE orchestration hook consumed by every
//                            NEX voice surface (see Voice Pipeline doctrine
//                            2026-08-21: one pipeline, brain-vs-voice split).

export type {
  NexVoiceProvider,
  VoiceTranscript,
  VoiceListenHandle,
  VoiceListenOptions,
  VoiceSpeakOptions,
} from "./types";

export { getVoiceProvider } from "./factory";

export { useNexVoice } from "./useNexVoice";
export type {
  NexVoiceState,
  NexVoiceLanguage,
  NexReplyMeta,
  UseNexVoiceOptions,
  UseNexVoiceApi,
} from "./useNexVoice";
