// NEX Voice · VoxCPM2 provider adapter · STUB (2026-08-22 · Task #83).
//
// STATUS: STUB · registers the "voxcpm2" provider slot · runtime deferred.
// Falls through to the browser adapter for both speak() and listen() with a
// one-time console warning. Preserves the interface commitment so that when
// real VoxCPM2 runtime becomes viable (post-16-GB-RAM upgrade OR discrete GPU
// with ≥8 GB VRAM), only the speak() body swaps — no consumer code changes.
//
// Why a stub, not a full integration:
//   · VoxCPM2 upstream: ~8 GB VRAM typical (openbmb/VoxCPM2 · Apache-2.0)
//   · This machine: RTX 2050 · 4 GB VRAM · 7.65 GB system RAM
//   · Even with everything else off, insufficient headroom
//   · Path 1 (Philip 2026-08-22 approved): reserve the slot · don't force runtime
//
// Why the stub falls through to browser, not throws:
//   · Doctrine: "Graceful fallback is mandatory." If someone flips
//     NEX_VOICE_PROVIDER=voxcpm2 today, they get the browser experience
//     (JARVIS/Gadis OS voices) not a crash. Console warns once so operators
//     see the transparent redirection.
//
// Framing (Philip 2026-08-22 verbatim):
//   · Qwen = NEX's brain
//   · RAG / NEX knowledge = NEX's learned external memory
//   · Vision/OCR = NEX's eyes (Task #69 · shipped)
//   · VoxCPM2 = NEX's mouth/voice (this task · slot reserved)
//   VoxCPM2 does not teach NEX. It only makes NEX speak more naturally + locally.
//
// STT (listen) is TTS-adjacent but distinct — VoxCPM2 is TTS-focused. STT
// keeps delegating to the browser adapter here. Replacing the browser's
// Google-dependent STT with something local (Groq Whisper Turbo · whisper.cpp)
// is a SEPARATE task Philip 2026-08-22 called out for later.
//
// Doctrine anchors:
//   · project_nex_owns_intelligence_capabilities_2026_08_22 (NEX-owned interfaces · pluggable adapters)
//   · Router doctrine (NEX Voice types.ts:1-7 · interface permanent · providers temporary)
//   · ADR-0044 (zero third-party AI · local endpoints only when runtime activated)

import type {
  NexVoiceProvider,
  VoiceListenHandle,
  VoiceListenOptions,
  VoiceSpeakOptions,
} from "../types";
import { browserVoiceProvider } from "./browser";

// One-time console notification when the stub is exercised · avoids log spam.
let stubNoticeEmitted = false;
function emitStubNoticeOnce(): void {
  if (stubNoticeEmitted) return;
  stubNoticeEmitted = true;
  // Intentionally console.warn so it surfaces in dev tools without being an
  // uncaught error. Operators know they're getting the browser fallback.
  // eslint-disable-next-line no-console
  console.warn(
    "[nex-voice/voxcpm2] STUB · VoxCPM2 runtime not yet integrated on this machine " +
    "(needs ≥8 GB VRAM · current: RTX 2050 4 GB). Falling through to browser adapter. " +
    "SWAP-POINT in this file will activate the real VoxCPM2 HTTP call post-hardware-upgrade. " +
    "See memory/project_nex_task83_voxcpm2_stub_shipped_2026_08_22.md",
  );
}

export const voxcpm2VoiceProvider: NexVoiceProvider = {
  id: "voxcpm2",

  isSupported() {
    // Slot is reserved. Support tracks the browser adapter (which we fall
    // through to). When real VoxCPM2 runtime lands, this becomes a probe
    // against the local VoxCPM2 endpoint (typically http://localhost:8000).
    return browserVoiceProvider.isSupported();
  },

  listen(opts: VoiceListenOptions): VoiceListenHandle {
    // VoxCPM2 is TTS-focused. STT stays on the browser adapter regardless of
    // whether VoxCPM2 runtime is active. This does NOT change when the SWAP-POINT
    // in speak() lands — listen() only moves off browser when a dedicated
    // local STT adapter ships (Task deferred · Philip 2026-08-22).
    return browserVoiceProvider.listen(opts);
  },

  async speak(text: string, opts?: VoiceSpeakOptions): Promise<void> {
    emitStubNoticeOnce();
    // ── SWAP-POINT ──────────────────────────────────────────────────────
    // When VoxCPM2 runtime becomes viable on this machine (or the deploy
    // target), replace this fallthrough with:
    //   1. POST {text, voiceConfig, lang} to `${VOXCPM2_URL}/synthesize`
    //   2. Receive PCM/WAV audio stream (VoxCPM2 supports streaming per upstream docs)
    //   3. Play via HTMLAudioElement or Web Audio API
    //   4. On any failure → fall back to browserVoiceProvider.speak(text, opts)
    // Design constraints for the eventual real implementation:
    //   · confidence cap 95 (mirror ADR-0027 · never claim perfect)
    //   · language passthrough: opts.lang (BCP-47) → VoxCPM2 lang code
    //   · voice persona: default to NEX female voice-design profile
    //   · timeout: cold-model-load can take 20-90s · adapter tolerates 120s
    //   · fallback: any error/timeout → browser adapter (fallback rule mandatory)
    // ────────────────────────────────────────────────────────────────────
    return browserVoiceProvider.speak(text, opts);
  },

  cancelSpeech() {
    // Cancel forwards to the active underlying adapter. When VoxCPM2 runtime
    // lands, this needs to cancel BOTH any in-flight VoxCPM2 fetch/stream
    // AND the browser adapter (in case fallback speech is playing).
    browserVoiceProvider.cancelSpeech();
  },
};
