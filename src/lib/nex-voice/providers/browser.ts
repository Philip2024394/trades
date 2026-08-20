// NEX Voice · Browser Web Speech API adapter.
//
// Prototype-only STT + TTS. £0 cost, zero deps, works in Chrome / Edge on
// Windows (Firefox partial · Safari uses SFSpeechRecognizer via WebKit).
//
// PROTOTYPE CAVEAT (must surface in UI): Chrome / Edge send audio to a
// cloud speech service (Google) for transcription. This adapter is NOT
// suitable for sensitive customer data. The swap-in privacy-preserving
// path is Groq Whisper Turbo or local whisper.cpp, each as a new adapter
// file — the caller code will not change.
//
// Design constraints inherited from types.ts:
//   · No access to NEX state, store, conversation_id, or chat API.
//   · Emits only { text, confidence, isFinal }.
//   · Speech synthesis runs entirely on-device via the OS voice.

import type {
  NexVoiceProvider,
  VoiceListenHandle,
  VoiceListenOptions,
  VoiceSpeakOptions,
} from "../types";

// Cross-browser SpeechRecognition ref. Declared as `any` because the
// Web Speech API types aren't in lib.dom for every TS version and adding
// a full typedef library is out of scope for a prototype.
type SR = any;

function getSpeechRecognitionCtor(): SR | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function getSpeechSynthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis ?? null;
}

export const browserVoiceProvider: NexVoiceProvider = {
  id: "browser",

  isSupported(): boolean {
    return !!getSpeechRecognitionCtor() && !!getSpeechSynthesis();
  },

  listen(opts: VoiceListenOptions): VoiceListenHandle {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      opts.onError("browser: SpeechRecognition not available in this runtime");
      return { stop: () => {} };
    }

    const rec: SR = new Ctor();
    rec.lang = opts.lang ?? "en-GB";
    rec.interimResults = !!opts.onPartial;
    rec.continuous = false;   // one utterance per session · caller controls loop
    rec.maxAlternatives = 1;

    let finalFired = false;

    rec.onresult = (ev: any) => {
      const results = ev.results;
      if (!results || results.length === 0) return;
      // Walk the fresh results this event carries.
      for (let i = ev.resultIndex ?? 0; i < results.length; i++) {
        const r = results[i];
        const alt = r[0];
        if (!alt) continue;
        const transcript = {
          text: (alt.transcript ?? "").trim(),
          confidence: typeof alt.confidence === "number" ? alt.confidence : 0.8,
          isFinal: !!r.isFinal,
        };
        if (r.isFinal) {
          finalFired = true;
          opts.onFinal(transcript);
        } else if (opts.onPartial) {
          opts.onPartial(transcript);
        }
      }
    };

    rec.onerror = (ev: any) => {
      const kind = ev?.error ?? "unknown";
      // "no-speech" and "aborted" are user-facing normal outcomes, not errors
      // worth alarming about. Surface them as an empty-final so the caller
      // can trigger the "didn't catch that" fallback.
      if (kind === "no-speech" || kind === "aborted") {
        if (!finalFired) opts.onFinal({ text: "", confidence: 0, isFinal: true });
        return;
      }
      opts.onError(`browser: ${kind}`);
    };

    rec.onend = () => {
      // If the recognition ended without ever firing a final result
      // (e.g. mic permission accepted but user said nothing loud enough),
      // synthesise an empty final so the UI stops spinning.
      if (!finalFired) opts.onFinal({ text: "", confidence: 0, isFinal: true });
    };

    try {
      rec.start();
    } catch (e) {
      opts.onError(`browser: start failed · ${String((e as Error)?.message ?? e)}`);
      return { stop: () => {} };
    }

    return {
      stop: () => {
        try { rec.stop(); } catch { /* already stopped */ }
      },
    };
  },

  async speak(text: string, opts: VoiceSpeakOptions = {}): Promise<void> {
    const synth = getSpeechSynthesis();
    if (!synth) return;
    const clean = (text ?? "").trim();
    if (!clean) return;

    // Cancel any in-flight utterance so we don't queue endlessly.
    synth.cancel();

    return new Promise<void>((resolve) => {
      const utter = new SpeechSynthesisUtterance(clean);
      utter.lang = opts.lang ?? "en-GB";
      utter.rate = opts.rate ?? 1.0;
      utter.pitch = opts.pitch ?? 1.0;
      if (opts.voiceName) {
        const match = synth.getVoices().find(v => v.name === opts.voiceName);
        if (match) utter.voice = match;
      } else {
        // Prefer a FEMALE en-GB voice by name (Windows/Chrome/Mac catalogues).
        // Falls through to any en-GB, then any en-*, then OS default.
        // NEX voice is female per Philip 2026-08-20 (staircase-company assistant
        // tone). Permanent commissioned voice is deferred (Phase 2b) — this
        // list picks the least-worst OS-shipped voice in the meantime.
        const voices = synth.getVoices();
        const FEMALE_NAME_HINTS = [
          "hazel", "zira", "susan", "kate", "libby", "sonia",     // Microsoft (Windows)
          "female",                                                 // "Google UK English Female" etc
          "samantha", "karen", "fiona", "moira", "tessa", "serena", // Apple / Mac
          "amelie", "amber",
        ];
        const isFemale = (v: SpeechSynthesisVoice) => {
          const n = (v.name || "").toLowerCase();
          return FEMALE_NAME_HINTS.some(hint => n.includes(hint));
        };
        const enGB = voices.filter(v => v.lang?.toLowerCase().startsWith("en-gb"));
        const enAny = voices.filter(v => v.lang?.toLowerCase().startsWith("en-"));
        const pick = enGB.find(isFemale) ?? enAny.find(isFemale) ?? enGB[0] ?? enAny[0];
        if (pick) utter.voice = pick;
      }
      utter.onend = () => resolve();
      utter.onerror = () => resolve();  // don't reject · caller only cares that we tried
      synth.speak(utter);
    });
  },

  cancelSpeech(): void {
    const synth = getSpeechSynthesis();
    try { synth?.cancel(); } catch { /* noop */ }
  },
};
