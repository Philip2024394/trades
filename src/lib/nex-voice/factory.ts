// NEX Voice · provider factory (extracted from index.ts to break the
// import cycle between useNexVoice and the barrel).
//
// Adapter selection · env NEX_VOICE_PROVIDER (default 'browser').
// Registered LOCAL / PROTOTYPE providers only. Cloud voice providers
// (Groq Whisper, ElevenLabs, etc.) each land as a new adapter file and
// register here — never wire a customer-facing surface directly to a
// provider SDK. Router doctrine: interface permanent, provider temporary.

import { browserVoiceProvider } from "./providers/browser";
import { voxcpm2VoiceProvider } from "./providers/voxcpm2";
import type { NexVoiceProvider } from "./types";

const REGISTERED: Record<string, NexVoiceProvider> = {
  browser: browserVoiceProvider,
  // Task #83 (2026-08-22) · VoxCPM2 slot reserved · runtime deferred until
  // ≥8 GB VRAM available. STUB currently falls through to browser adapter
  // with a one-time console warning. See providers/voxcpm2.ts SWAP-POINT.
  voxcpm2: voxcpm2VoiceProvider,
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
