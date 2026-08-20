// NEX Voice · provider interface (Router doctrine · Voice capability).
//
// This interface is PERMANENT. Providers (browser Web Speech API today,
// Groq Whisper Turbo / ElevenLabs / local whisper.cpp tomorrow) are
// TEMPORARY implementations behind it. Adding a provider = adding one file;
// swapping providers = one config change. Never widen this interface with
// provider-specific hooks.
//
// Deliberately narrow surface:
//   - transcribe: audio → text (no state, no store, no chat API access)
//   - speak:      text → audio (no state, no store, no chat API access)
// A voice provider MUST NEVER know about NEX state, conversation_id,
// established_facts, corrections, or the /api/nex-conv/chat endpoint.
// The caller wires transcript → existing chat API → reply → speak.
// This is how we honour "voice must not create a second brain."

export type VoiceTranscript = {
  text: string;
  confidence: number;   // 0..1 · < 0.5 → caller should trigger "didn't catch that" fallback
  isFinal: boolean;     // false for interim results (partial recognition)
};

export type VoiceSpeakOptions = {
  rate?: number;        // 0.5..2.0 · default 1.0
  pitch?: number;       // 0..2 · default 1.0
  voiceName?: string;   // provider-specific voice identifier (optional)
  lang?: string;        // BCP-47 · default 'en-GB'
};

export type VoiceListenHandle = {
  stop: () => void;
};

export type VoiceListenOptions = {
  lang?: string;                                  // BCP-47 · default 'en-GB'
  onPartial?: (t: VoiceTranscript) => void;       // interim results as user speaks
  onFinal: (t: VoiceTranscript) => void;          // final result when user stops
  onError: (msg: string) => void;                 // any capture failure
};

export interface NexVoiceProvider {
  /** Stable provider id (e.g. 'browser', 'groq', 'elevenlabs'). */
  readonly id: string;

  /** True iff the runtime supports this provider (feature-detect). */
  isSupported(): boolean;

  /** Begin listening. Returns a handle whose stop() ends the session. */
  listen(opts: VoiceListenOptions): VoiceListenHandle;

  /** Speak the text. Resolves when speech finishes (or is cancelled). */
  speak(text: string, opts?: VoiceSpeakOptions): Promise<void>;

  /** Cancel any in-flight speech synthesis. Safe to call when idle. */
  cancelSpeech(): void;
}
