// NEX Voice · dispatcher (mirrors scripts/nex-conv/lib/respond.mjs pattern).
//
// Adapter selection · env NEX_VOICE_PROVIDER (default 'browser').
// Registered LOCAL / PROTOTYPE providers only. Cloud voice providers
// (Groq Whisper, ElevenLabs, etc.) each land as a new adapter file and
// register here — never wire a customer-facing surface directly to a
// provider SDK. Router doctrine: interface permanent, provider temporary.

import { browserVoiceProvider } from "./providers/browser";
import type { NexVoiceProvider } from "./types";

export type { NexVoiceProvider, VoiceTranscript, VoiceListenHandle, VoiceListenOptions, VoiceSpeakOptions } from "./types";

const REGISTERED: Record<string, NexVoiceProvider> = {
  browser: browserVoiceProvider,
};

export function getVoiceProvider(id?: string): NexVoiceProvider {
  const wanted = id
    ?? (typeof process !== "undefined" ? process.env?.NEX_VOICE_PROVIDER : undefined)
    ?? "browser";
  const p = REGISTERED[wanted];
  if (!p) {
    throw new Error(
      `nex-voice: NEX_VOICE_PROVIDER='${wanted}' not registered. ` +
      `Registered: ${Object.keys(REGISTERED).join(", ")}.`
    );
  }
  return p;
}
