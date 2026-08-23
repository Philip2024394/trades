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

// Chrome/Edge load voice metadata asynchronously — the first getVoices()
// call after page load often returns []. If we pick then, we fall through
// to the OS default (male on Windows) instead of the female voice we want.
// This waits (up to 1.5 s) for the voices list to populate. Cheap: no-op
// once voices are loaded (event fires exactly once, then getVoices() is
// synchronous).
function waitForVoices(synth: SpeechSynthesis, timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = synth.getVoices();
    if (voices.length > 0) return resolve(voices);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      synth.onvoiceschanged = null;
      resolve(synth.getVoices());
    };
    synth.onvoiceschanged = finish;
    setTimeout(finish, timeoutMs);
  });
}

// Voice V1 (Philip 2026-08-21 · pinned character brief):
//   female · warm-but-not-soft · confident · clear · intelligent ·
//   slightly lower/grounded · professional · slightly witty.
// Mental model: *"A very smart person calmly helping you get something done."*
// Character inspiration (Philip 2026-08-21): **Iron Man family — JARVIS /
// FRIDAY** but female. Confident · calm · slightly deliberate · warm
// without being effusive · dry wit under the surface · never customer-
// service · never overly excited · never robotic.
// Anti: customer-service voice · overly excited · robotic · whispery ·
// American-brightness that anchors NEX to a call-centre vibe.
//
// Two-tier picker: PREFERRED voices (Microsoft Neural + Google Neural
// female voices that hit the JARVIS-family brief) are tried first.
// Regular FEMALE hints are the fallback. Male hints block.
//
// Preferred order · JARVIS/FRIDAY DNA first (British + multilingual
// Neural — lower, calmer, more grounded), then American Neural, then
// fallback to older SAPI voices. Sonia/Libby (Microsoft UK Neural) carry
// the JARVIS gravitas most naturally on stock Windows 11. Ava is
// Microsoft's multilingual Neural (works across languages, warm-
// professional). For Indonesian, `Gadis` is the Microsoft id-ID Neural
// female voice; `Wavenet-A/B/C/D` are Google Cloud id-ID female voices
// when available in the browser.
const PREFERRED_NAME_HINTS = [
  // Tier 1 · JARVIS/FRIDAY family — grounded, calm, sophisticated
  "sonia",                                      // Microsoft en-GB Neural (JARVIS-adjacent, calm British)
  "libby",                                      // Microsoft en-GB Neural (warmer sibling)
  "ava",                                        // Microsoft Multilingual Neural (versatile, modern)
  // Tier 2 · American Neural — clear, warm, still competent
  "aria", "jenny", "emma", "michelle", "sara", "nancy",
  // Tier 3 · Google Wavenet / Neural2 — high-quality when available
  "wavenet", "neural2",
  // Indonesian Neural female (Microsoft id-ID)
  "gadis",
  // Others · older but usable
  "amber", "olivia",
];
const FEMALE_NAME_HINTS = [
  ...PREFERRED_NAME_HINTS,
  "hazel", "zira", "susan", "kate", "libby", "sonia",                    // Microsoft SAPI (older)
  "female",                                                              // Google "English Female"
  "samantha", "karen", "fiona", "moira", "tessa", "serena", "siri",      // Apple / Mac
  "amelie", "joanna", "salli", "kendra", "matthew", "raveena", "chantal",// Other
];
const MALE_NAME_HINTS = [
  "david", "mark", "george", "james", "male", "daniel", "oliver",
  "alex", "fred", "tom", "ryan", "guy",
  "ardi",                                                                // Microsoft id-ID male
];

function pickFemaleVoice(
  voices: SpeechSynthesisVoice[],
  lang: string,
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const langLower = lang.toLowerCase();
  const langPrefix = langLower.split("-")[0] ?? "en";
  const isPreferred = (v: SpeechSynthesisVoice) => {
    const n = (v.name || "").toLowerCase();
    return PREFERRED_NAME_HINTS.some(h => n.includes(h));
  };
  const isFemale = (v: SpeechSynthesisVoice) => {
    const n = (v.name || "").toLowerCase();
    return FEMALE_NAME_HINTS.some(h => n.includes(h));
  };
  const isMale = (v: SpeechSynthesisVoice) => {
    const n = (v.name || "").toLowerCase();
    return MALE_NAME_HINTS.some(h => n.includes(h));
  };
  const inLang = voices.filter(v => v.lang?.toLowerCase() === langLower);
  const inLangFamily = voices.filter(v => v.lang?.toLowerCase().startsWith(langPrefix + "-"));
  return (
    // Tier 1: preferred (Microsoft Neural / Google Wavenet / Neural2) in exact lang
    inLang.find(isPreferred)
    // Tier 2: preferred in lang family (e.g. Aria en-US when user asked en-GB)
    ?? inLangFamily.find(isPreferred)
    // Tier 3: any female in exact lang
    ?? inLang.find(isFemale)
    // Tier 4: any female in lang family
    ?? inLangFamily.find(isFemale)
    // Tier 5: any preferred (cross-lang) — better a neutral female voice
    //         in the wrong language than a male voice in the right one
    ?? voices.find(isPreferred)
    // Tier 6: any female anywhere
    ?? voices.find(isFemale)
    // Tier 7: any non-male voice in the right language
    ?? inLang.find(v => !isMale(v))
    ?? inLangFamily.find(v => !isMale(v))
    // Tier 8: last-resort language match
    ?? inLang[0]
    ?? inLangFamily[0]
    ?? voices[0]
    ?? null
  );
}

export const browserVoiceProvider: NexVoiceProvider = {
  id: "browser",

  isSupported(): boolean {
    return !!getSpeechRecognitionCtor() && !!getSpeechSynthesis();
  },

  listen(opts: VoiceListenOptions): VoiceListenHandle {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      const msg =
        "browser: SpeechRecognition not available in this runtime. " +
        "Chrome / Edge required (Firefox / Safari desktop don't ship it).";
      // eslint-disable-next-line no-console
      console.warn("[nex-voice]", msg);
      opts.onError(msg);
      return { stop: () => {} };
    }

    // Explicit mic-permission request. On Chrome / Edge, SpeechRecognition
    // will TRY to trigger the permission prompt implicitly, but the timing
    // is inconsistent and error paths differ per browser. Calling
    // getUserMedia({audio:true}) up-front:
    //   · guarantees the user sees a clear "allow microphone" prompt
    //   · gives us a deterministic denial signal (NotAllowedError)
    //   · warms the mic hardware so recognition starts faster
    // We immediately release the getUserMedia stream — SpeechRecognition
    // opens its own audio capture. This handshake is documented at
    // https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    let cancelled = false;
    const rec: SR = new Ctor();
    // Priority 2 V2: caller passes the active session language (en-GB / id-ID).
    // Default en-GB kept for backwards-compat with any pre-V2 callers.
    //
    // KNOWN PROTOTYPE LIMITATION (Philip 2026-08-21): the browser Web Speech
    // API REQUIRES a `lang` hint before recognition — this is why cross-
    // country speech (Scenarios C/D: Indonesian user speaking English, UK
    // user speaking Indonesian) produces corrupted transcripts. Resolution
    // is a language-agnostic STT provider (Whisper-class) behind this same
    // NexVoiceProvider interface — provider ignores `opts.lang` at runtime.
    // See pinned doctrine:
    //   project_nex_voice_language_agnostic_stt_target_architecture_2026_08_21
    // This is a PROTOTYPE constraint, NOT accepted product behaviour.
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

    // Kick off the getUserMedia prompt in parallel, then start recognition
    // once we've either got a stream or hit a permission error.
    const startRecognition = () => {
      if (cancelled) return;
      try {
        rec.start();
        // eslint-disable-next-line no-console
        console.info("[nex-voice] recognition started · lang=" + rec.lang);
      } catch (e) {
        opts.onError(`browser: start failed · ${String((e as Error)?.message ?? e)}`);
      }
    };

    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          // Immediately release · SpeechRecognition opens its own capture.
          stream.getTracks().forEach((t) => t.stop());
          startRecognition();
        })
        .catch((err: Error) => {
          const name = err?.name ?? "MicError";
          const msg =
            name === "NotAllowedError"
              ? "Microphone permission was denied. Enable it in the browser site settings and try again."
              : name === "NotFoundError"
              ? "No microphone found on this device."
              : name === "NotReadableError"
              ? "Another app is using the microphone. Close it and try again."
              : `Microphone error (${name}): ${err.message}`;
          // eslint-disable-next-line no-console
          console.warn("[nex-voice] getUserMedia failed ·", name, err.message);
          opts.onError(msg);
        });
    } else {
      // No getUserMedia (very old browser or non-secure context). Fall back
      // to the recognition's implicit prompt — better than nothing.
      // eslint-disable-next-line no-console
      console.warn("[nex-voice] navigator.mediaDevices unavailable · relying on SpeechRecognition implicit prompt");
      startRecognition();
    }

    return {
      stop: () => {
        cancelled = true;
        try { rec.stop(); } catch { /* already stopped */ }
      },
    };
  },

  async speak(text: string, opts: VoiceSpeakOptions = {}): Promise<void> {
    const synth = getSpeechSynthesis();
    if (!synth) return;
    const clean = (text ?? "").trim();
    if (!clean) return;

    const lang = opts.lang ?? "en-GB";

    // Wait for voices to actually be available before picking. On Chrome
    // the very first getVoices() after page load returns [] — without this
    // await the picker falls through to the OS default (male on Windows).
    // Cached after first call.
    const voices = await waitForVoices(synth);

    // Priority 2 V2 diagnostic: when asked for id-ID (Indonesian) but no
    // Indonesian voice is installed on this OS, log clearly so the user
    // understands the fallback rather than hearing English pronunciation
    // of Indonesian text. Per pinned Indonesian V2 doctrine: NEVER silently
    // pretend the voice is Indonesian.
    if (lang.toLowerCase().startsWith("id")) {
      const idVoices = voices.filter(v => v.lang?.toLowerCase().startsWith("id"));
      if (idVoices.length === 0) {
        // eslint-disable-next-line no-console
        console.warn("[NEX VOICE] No id-ID TTS voice available — falling back to nearest voice. Install Indonesian TTS: Windows Settings → Time & Language → Language → Add Indonesian → Speech.");
      } else {
        // eslint-disable-next-line no-console
        console.info(`[NEX VOICE] id-ID candidates found: ${idVoices.map(v => `${v.name} (${v.lang})`).join(", ")}`);
      }
    }

    // Cancel any in-flight utterance so we don't queue endlessly. Do this
    // AFTER awaiting voices so we don't cancel the utterance we're about
    // to schedule when tabs re-focus mid-await.
    synth.cancel();

    // Language-aware default TTS rate. Indonesian neural voices (Gadis
    // in particular) speak noticeably faster than en-GB Neural voices at
    // rate=1.0 — Philip 2026-08-21: *"voice speed too fast for Indonesian
    // speaking, needs slower."* A default of ~0.88 keeps NEX's warmth and
    // clarity without sounding dragged. Explicit caller-supplied `rate`
    // still wins. Add more languages here as they onboard.
    const langPrefix = lang.toLowerCase().split("-")[0];
    const langDefaultRate =
      langPrefix === "id" ? 0.88 :
      1.0;
    const rate = opts.rate ?? langDefaultRate;

    // JARVIS-family character (Philip 2026-08-21) needs a slightly lower
    // register than the browser default. Pitch 0.95 shifts the voice
    // down ~half a semitone — enough to feel grounded/deliberate without
    // sounding artificially deep. Callers can still override explicitly.
    const pitch = opts.pitch ?? 0.95;

    return new Promise<void>((resolve) => {
      const utter = new SpeechSynthesisUtterance(clean);
      utter.lang = lang;
      utter.rate = rate;
      utter.pitch = pitch;
      if (opts.voiceName) {
        const match = voices.find(v => v.name === opts.voiceName);
        if (match) utter.voice = match;
      } else {
        // NEX voice is FEMALE per Philip 2026-08-20 + international-neutral
        // per Voice V1 spec Philip 2026-08-21. Picker prioritises Microsoft
        // Neural / Google Wavenet voices before older SAPI voices. Permanent
        // commissioned voice is deferred until Priority 2 Voice V1 spec's
        // "prototype with stock voice first" gate is validated.
        const pick = pickFemaleVoice(voices, lang);
        if (pick) {
          utter.voice = pick;
          // eslint-disable-next-line no-console
          console.info(`[NEX VOICE] speak · lang=${lang} · voice="${pick.name}" (${pick.lang}) · rate=${rate.toFixed(2)} · pitch=${pitch.toFixed(2)}`);
        } else {
          // eslint-disable-next-line no-console
          console.warn(`[NEX VOICE] speak · lang=${lang} · no voice picked · using browser default`);
        }
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
